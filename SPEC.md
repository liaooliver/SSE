# SPEC：FastAPI SSE Demo（v0.2，待使用者核准）

示範 Server-Sent Events 的 FastAPI 小型服務，包含兩種串流：
1. **Clock**：單一客戶端、可指定筆數的計時串流
2. **Messages**：多個客戶端的廣播串流

另外附一個瀏覽器 demo 頁面。全部資料存在記憶體，不使用資料庫。

---

## 1. 執行與介面約定

- **R1** Python ≥ 3.13，使用 uv 管理。`uv sync` 之後，用 `uv run uvicorn app.main:app --port 8000` 啟動。
- **R2** `app/main.py` 必須提供：
  - `create_app(heartbeat_interval: float | None = None, history_size: int | None = None, subscriber_queue_size: int | None = None) -> FastAPI`
    - 每次呼叫都回傳狀態完全獨立的新 app（廣播中心、歷史紀錄、計數器都不共用）
  - `app = create_app()`：模組層級的預設實例
  - 測試只能透過以下三種方式存取系統：上面兩個名稱、HTTP，以及**直接以 ASGI 介面呼叫 app**（可自行提供 `receive`／`send`，例如送入 `http.disconnect`，或讓 `send` 阻塞來模擬慢速客戶端）。不可依賴其他內部結構。
- **R3** 設定值的優先順序：明確傳入的非 `None` 參數 > 環境變數 > 預設值。環境變數在 `create_app()` 被呼叫時讀取。

  | 參數 | 環境變數 | 預設 | 合法範圍 |
  |---|---|---|---|
  | `heartbeat_interval` | `SSE_HEARTBEAT_SECONDS` | 15.0 | 有限正數 |
  | `history_size` | `SSE_HISTORY_SIZE` | 1000 | 整數 ≥ 0（0 表示停用重播） |
  | `subscriber_queue_size` | `SSE_SUBSCRIBER_QUEUE_SIZE` | 100 | 整數 ≥ 1 |

  任何來源的值不合法或無法解析時，`create_app()` 拋出 `ValueError`。

## 2. SSE 共通規則（套用於所有 `/events/*`）

- **R4** 參數驗證失敗時回 `422`，而且不開始串流。成功時回 `200`，並帶以下 header：
  - `Content-Type` 以 `text/event-stream` 開頭
  - `Cache-Control` 同時包含 `no-cache` 和 `no-transform`（測試用「包含」判斷，不要求整串相等）
  - `X-Accel-Buffering: no`
  - 不可對 `/events/*` 套用壓縮
- **R5** 每個事件依 WHATWG SSE 格式輸出，包含 `id:`、`event:`、`data:` 三個欄位，以 `\n\n` 結尾；`data` 是單行 JSON。欄位順序不保證，測試應該用 SSE 解析器解析。
- **R6** **就緒訊號**：伺服器完成該連線的所有準備工作後（Messages 要先完成 R14 的訂閱登記），第一個輸出的區塊一定是單獨的 `retry: 3000\n\n`，而且要立即送出，不等待任何事件。客戶端讀到這個區塊，就代表伺服器已經準備好了。
- **R7** **Heartbeat**：每次輸出任何內容後重新計時；連續 `heartbeat_interval` 秒沒有輸出時，送出 `: ping\n\n`，閒置期間週期性重複。Clock 和 Messages 兩種串流都適用。資料事件和 heartbeat 同時到期時，只送資料事件。
- **R8** 客戶端斷線時，伺服器要依靠 ASGI 的取消機制結束 generator（不可吞掉 `CancelledError`），並在 `finally` 中釋放資源。可觀察的行為：
  - 直接用 ASGI 呼叫時，送入 `http.disconnect` 後 1 秒內，ASGI 呼叫就會返回
  - 透過真的 uvicorn 時，客戶端關閉 TCP 連線後 2 秒內，`/stats`（R16）的計數會回到連線前的值

## 3. Clock 串流

- **R9** `GET /events/clock?count=<int>&interval=<float>`
  - `count`：整數 1–1000，預設 10
  - `interval`：有限數值 0.01–10 秒，預設 1.0
  - 只有在完全省略參數時才套用預設值。`count=`、`count=1.5`、`count=abc`、`interval=abc`、`interval=nan`、`interval=inf` 以及超出範圍的值都回 `422`。
- **R10** 時序與內容：
  - 送出 `retry` 區塊後，立即送出第一個 `event: tick`，之後相鄰兩個 tick 間隔 `interval` 秒
  - 第 k 個 tick：`id: k`，`data: {"seq": k, "ts": "<ISO-8601 UTC>"}`
  - 最後一個 tick 送完後，立即送出 `event: done`：`id: count+1`，`data: {"total": count}`，然後正常結束連線
- **R11** **Last-Event-ID**：header 去掉頭尾空白後，必須完全符合 `^[0-9]+$`（只接受 ASCII 數字，允許前導零），否則視同沒有帶。設 N 為解析出的值：
  - `N < count`：從 `seq = N+1` 開始送，送到 `count` 為止，最後送 `done`
  - `N == count`：只送 `done`（`id: count+1`、`total: count`）
  - `N > count`：回 `204 No Content`。依 WHATWG 規格，瀏覽器的 EventSource 收到 204 會永久停止重連，這樣可以避免收到 `done` 之後無限重連。

## 4. Messages 廣播

- **R12** `POST /messages`，body 為 JSON `{"user": str, "text": str}`
  - 先用 Python 的 `str.strip()` 去掉頭尾空白，再以 Unicode 碼點數檢查長度：`user` 為 1–32，`text` 為 1–500
  - 儲存、回應、廣播一律使用去掉空白後的值
  - 額外的欄位直接忽略
  - 缺少欄位、值為 `null` 或不是字串、JSON 格式錯誤、長度不合法，都回 `422`
  - 成功時回 `201`，body 為 `{"id": int, "user": str, "text": str, "ts": "<ISO-8601 UTC>"}`
  - `ts` 一律帶時區，結尾可以是 `Z` 或 `+00:00`，R10 也是如此
- **R13** 每次成功的 POST 都以不可分割的方式取得下一個連續整數 id（從 1 開始）；失敗的 POST 不消耗 id。同時有多個 POST 時，各 HTTP 回應的完成順序不限，但廣播和歷史紀錄一律依 id 遞增排列。
- **R14** `GET /events/messages`：伺服器先完成訂閱登記、確定要重播哪些歷史訊息、更新 `/stats`，然後才送出 R6 的 `retry` 區塊。之後每則訊息以 `event: message` 送出：`id` = 訊息 id，`data` = R12 的成功回應 body。
- **R15** **歷史重播**：保留最近 `history_size` 則訊息。`Last-Event-ID` 的解析規則同 R11，設解析出的值為 N：
  - 不合法或沒有帶：不重播
  - `N = 0`：重播歷史中的全部訊息
  - 一般情況：依序重播登記當下歷史中 `id > N` 的訊息。如果 N 比最舊的保留訊息還早，就從最舊的保留訊息開始重播（盡力而為，不保證完整）
  - 重播完畢後，登記完成之後才建立的每則訊息都恰好送一次，即使它的 id ≤ N
  - 從重播接到即時訊息時，不可漏、也不可重複；重播不佔用 R20 的佇列空間
- **R16** `GET /stats` → `200 {"subscribers": int, "active_streams": int, "messages_total": int}`
  - `subscribers`：目前 `/events/messages` 的連線數
  - `active_streams`：目前所有 `/events/*` 的連線數
  - `messages_total`：這個 app 實例累計成功處理的 POST 數，不受歷史淘汰影響，在回應 `201` 之前就已經加一
  - 新建立的 app 三個值都是 0

## 5. 其他端點

- **R17** `GET /health` → `200 {"status": "ok"}`
- **R18** `GET /` → `200`，`Content-Type: text/html; charset=utf-8`，是一個不依賴外部資源的單一 HTML 頁面，要求如下：
  - 用 `addEventListener("tick" | "done" | "message")` 監聽具名事件；收到 `done` 時呼叫 `close()`
  - 一律用 `textContent` 顯示內容，不用 `innerHTML`，避免 XSS
  - 固定使用以下元素 id（讓測試和手動 E2E 可以找到元素）：`#clock-status`、`#clock-log`、`#clock-restart`、`#msg-status`、`#msg-log`、`#msg-form`（內含 `input[name=user]` 和 `input[name=text]`）、`#form-error`
  - 顯示兩條串流的連線狀態（connecting / open / closed），以及每個事件的 id、event、data
  - POST 回 422 時，在 `#form-error` 顯示錯誤
  - 注意：在 HTTP/1.1 下，瀏覽器對同一個網站最多只開 6 條連線。這個頁面每個分頁會佔用 2 條，手動測試時最多同時開 2 個分頁。

## 6. 非功能需求

- **R19** 效能（屬於獨立的效能驗收，pytest 標記為 `perf`，對真的 uvicorn 執行）：
  - 50 個訂閱者都收到就緒訊號後，先暖機 5 則訊息
  - 接著依序送出 50 則訊息；每則的延遲 = 從送出 POST 到第 50 個訂閱者解析完該則事件為止，用單調時鐘計時
  - 50 筆延遲的 p95 < 500 ms
- **R20** 慢速訂閱者：
  - 廣播時一律用不阻塞的方式把訊息放進各訂閱者的佇列
  - 某個訂閱者的佇列滿了（超過 `subscriber_queue_size`）時，伺服器主動結束該連線，並更新 `/stats`；其他訂閱者繼續依序收到全部訊息，不受影響
  - 被踢掉的客戶端之後可以用 Last-Event-ID 重連，但只能補回仍在歷史紀錄中的訊息（見 R15）
  - 建議測試方式：直接以 ASGI 呼叫，讓某個訂閱者的 `send` 一直阻塞，再搭配很小的 `subscriber_queue_size`。透過真實 TCP 測試時，因為作業系統還有緩衝區，實際被踢掉的門檻會比佇列上限高很多。
- **R21** `app/` 底下不可使用 `print`，log 一律用 `logging`。用 `ruff check --select T201 app/` 驗證；`tests/` 不在此限。
- **R22** 優雅關機：還有 SSE 連線開著時，uvicorn 收到 SIGINT 或 SIGTERM 後，要在 3 秒內結束所有串流並退出。可以透過 lifespan 發出關機通知來實作。

## 7. 測試指引（給測試作者）

- 不要用固定的 sleep 等伺服器準備好，改用就緒訊號：R6 的 `retry` 區塊（串流），或 R17（伺服器啟動）。
- 時間相關的斷言：下限要嚴格檢查，上限放寬到預期值 ×3 再加 200 ms。
- 會一直持續的串流和斷線情境，請用 ASGI 直接呼叫，或啟動真的 uvicorn（單一 worker，連接埠由作業系統分配）。`httpx.ASGITransport` 會等整個回應結束才交回內容，不適合用來測試無限串流。
- E2E 測試標記為 `e2e`（啟動真的 uvicorn）。

## 8. 不在範圍內

驗證／授權、持久化、多 worker 或多台主機之間的廣播、HTTPS、HTTP/2。

---

## 附錄：v0.1 → v0.2 審閱處理紀錄

| 意見 | 來源 | 處理 |
|---|---|---|
| 測試無法判斷訂閱是否已完成 | Codex（blocker） | 採納：R6／R14 新增就緒訊號 |
| `done` 之後瀏覽器無限重連 | agy（blocker） | 採納：R11，`N > count` 時回 204 |
| `create_app` 參數與環境變數互相矛盾 | 兩邊（blocker） | 採納：R2／R3 改用 `None` 預設、明訂優先順序和 ValueError |
| 慢速訂閱者無法穩定觸發；佇列和歷史容量衝突 | 兩邊（blocker） | 採納：R20 允許 ASGI 直接驅動、佇列大小可調；歷史預設改為 1000 |
| p95 定義不清 | 兩邊（blocker） | 採納：R19 重新定義量測方式 |
| Demo 頁面：具名事件、XSS、可測試性、6 連線限制 | agy（blocker） | 採納：R18 |
| 首個 tick 和 done 的時序、heartbeat 規則 | 兩邊 | 採納：R7／R10 |
| Last-Event-ID 語法；Messages 端的邊界情況 | 兩邊 | 採納：R11／R15 |
| 先去空白再檢查長度、ts 格式、422 的各種情況 | 兩邊 | 採納：R12 |
| 連續 id、並行 POST 的順序 | Codex | 採納：R13 |
| Clock 斷線無法觀察 | 兩邊 | 採納：R8 改用 ASGI 呼叫返回和 `active_streams` 觀察 |
| 優雅關機 | agy | 採納：新增 R22 |
| `no-transform`、不可壓縮 | agy | 採納：R4 |
| 用靜態檢查驗證 R21 | 兩邊 | 採納：ruff T201 |
| 在 `create_app` 注入可推進的虛擬時鐘 | Codex | **不採納**：對 demo 來說太複雜，而且會讓程式為了測試而改變結構。改用就緒訊號、寬鬆的時間上限，以及 ASGI 直接驅動來避免測試隨機失敗 |
| 用 Playwright 做自動化瀏覽器 E2E | Codex | **部分採納**：自動化測試只檢查頁面的固定元素 id 和不使用外部資源；真瀏覽器的互動測試在 Phase 4 由 agy／Claude 手動執行 |
