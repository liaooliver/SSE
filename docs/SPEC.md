# SPEC：安裝進度即時串流（v1.1.1）

依據 `install-progress-sequence.svg`（專案根目錄），用 FastAPI + SSE 實作「安裝卡住或失敗時，畫面能立刻看出是哪一個步驟、為什麼失敗」的服務：

- 使用者先選一個**模擬情境**，再按下「安裝」，伺服器就會模擬一次軟體安裝。安裝分成數個 **Stage**，每個 Stage 有數個 **Task**，Task 執行時會輸出 **log**。
- 畫面左側是 Stage 列表，右側是目前 Stage 的 Task 列表。執行中的 Task 逐行顯示 SSE 推送過來的 log，完成後收合，換下一個 Task。
- Task 失敗時，安裝立刻停止，該 Task 和錯誤 log 標成紅字，並顯示（模擬的）排除建議。
- 中途才打開頁面、重新整理或網路斷線，畫面都能補齊，**不漏、不重複**。
- 紀錄存在 SQLite；重新安裝時會先清掉上一輪。

> **核心不變式**：每一輪安裝只有一條事件序列，`seq` 從 1 開始連續遞增。事件**先寫進 SQLite，再廣播**。快照、補讀 log、SSE 都只是讀取這條序列的不同方式。

---

## 0. 合約檔

| 檔案 | 定義什麼 |
|---|---|
| `docs/SPEC.md`（本檔） | **行為**：輸入要得到什麼結果、邊界情況、錯誤怎麼處理、驗收條件 |
| `contracts/openapi.yaml` | **HTTP 的形狀**：網址、參數、狀態碼、JSON 結構；SSE 事件的 `data` schema 寫在 `x-sse-events` |
| `contracts/domain.pyi` | **Python 的形狀**：`app/domain.py` 必須提供、測試可以直接 import 的名稱和簽名 |

三份文件互相矛盾時，回報 `CONTRACT CONFLICT: ...`；合約沒有寫到的，回報 `CONTRACT GAP: ...`。不可以自己猜。

## 1. 執行與介面約定

- **R1** Python ≥ 3.13，使用 uv 管理。`uv sync` 之後，用 `uv run uvicorn app.main:app --port 8000` 啟動；只支援單一 worker。
- **R2** `app/main.py` 必須提供：
  - `create_app(db_path: str | None = None, log_interval: float | None = None, heartbeat_interval: float | None = None, subscriber_queue_size: int | None = None) -> FastAPI`
    - 每次呼叫都回傳一個新的 app，記憶體中的狀態（訂閱者、模擬器）完全獨立。兩個 app 使用同一個 `db_path` 時，行為未定義。
    - `create_app()` 本身**不做 I/O**。開資料庫、建表、R25 的復原，都在 lifespan 啟動時進行。
  - `app = create_app()`：模組層級的預設實例。
  - `app/domain.py` 必須提供 `contracts/domain.pyi` 列出的全部名稱。
  - 測試只能透過以下方式存取系統：`create_app`、`app`、`domain.pyi` 列出的名稱、HTTP，以及**直接以 ASGI 介面呼叫 app**（包含送 `lifespan.startup`／`lifespan.shutdown`、自行提供 `receive`／`send`，例如送入 `http.disconnect`，或讓 `send` 阻塞來模擬慢速客戶端）。不可以依賴其他內部結構，也不可以直接讀寫 SQLite 檔案，**唯一例外是 AC9 的復原測試**（見 §10）。
- **R3** 設定值的優先順序：明確傳入的非 `None` 參數 > 環境變數 > 預設值。環境變數在 `create_app()` 被呼叫時讀取。任何來源的值不合法或無法解析時，`create_app()` 拋出 `ValueError`。

  | 參數 | 環境變數 | 預設 | 合法範圍 |
  |---|---|---|---|
  | `db_path` | `SSE_DB_PATH` | `./install.db` | 非空字串 |
  | `log_interval` | `SSE_LOG_INTERVAL` | 0.15 | 有限數值，0 ≤ x ≤ 10（秒；0 表示盡快送出） |
  | `heartbeat_interval` | `SSE_HEARTBEAT_SECONDS` | 15.0 | 有限正數（秒） |
  | `subscriber_queue_size` | `SSE_SUBSCRIBER_QUEUE_SIZE` | 1000 | 整數 ≥ 1 |

## 2. 安裝計畫與模擬情境

- **R4** **固定的安裝計畫**（按下安裝之前就知道，對應 `domain.PLAN`）。依序是：

  | Stage `id` | 名稱 | Tasks（`id`：名稱，log 行數） |
  |---|---|---|
  | `prepare` | 準備環境 | `check_os` 檢查作業系統（8）· `check_disk` 檢查磁碟空間（6）· `check_deps` 檢查相依套件（12） |
  | `download` | 下載套件 | `fetch_manifest` 取得套件清單（6）· `download_packages` 下載套件（30）· `verify_checksum` 驗證雜湊（10） |
  | `install` | 安裝 | `extract` 解壓縮（20）· `copy_files` 複製檔案（40）· `register` 註冊元件（8） |
  | `configure` | 設定 | `write_config` 寫入設定（10）· `set_permissions` 設定權限（6）· `start_service` 啟動服務（12） |

  所有 `task_id` 在整份計畫中不重複。

- **R5** **模擬情境**（對應 `domain.SCENARIOS`，鍵就是情境 `id`）：

  | `id` | 標籤 | 失敗的 task | 先輸出幾行正常 log | `error_code` | `message` | `hint` |
  |---|---|---|---|---|---|---|
  | `success` | 全部成功 | — | — | — | — | — |
  | `network_unreachable` | 無法連線到套件伺服器 | `fetch_manifest` | 0 | `E_NETWORK` | 無法連線到套件伺服器 packages.example.com:443 | 請檢查網路、Proxy 與防火牆設定後重新安裝 |
  | `dependency_missing` | 缺少相依套件 | `check_deps` | 7 | `E_DEPENDENCY` | 缺少相依套件 libssl（需要 >= 3.0） | 請先安裝 libssl 3.0 以上版本後重新安裝 |
  | `checksum_mismatch` | 套件雜湊值不符 | `verify_checksum` | 9 | `E_CHECKSUM` | 套件 core-2.4.1.pkg 的 SHA-256 雜湊值不符 | 請清除下載快取後重新下載，或改用其他鏡像站 |
  | `disk_full` | 磁碟空間不足 | `copy_files` | 23 | `E_DISK_FULL` | 磁碟空間不足，/opt 剩餘 0 MB | 請釋放至少 2 GB 空間後重新安裝 |
  | `permission_denied` | 權限不足 | `set_permissions` | 3 | `E_PERMISSION` | 無法寫入 /etc/app：權限不足 | 請以系統管理員權限執行安裝 |
  | `service_timeout` | 服務啟動逾時 | `start_service` | 12 | `E_SERVICE_TIMEOUT` | 服務 app-daemon 在 30 秒內沒有回應 | 請查看服務 log，並確認連接埠 8443 沒有被佔用 |

  「先輸出幾行正常 log」= k，一定小於或等於該 task 的 log 行數。

- **R6** **事件劇本**（對應 `domain.script_for(scenario_id)`，結果完全由情境決定，不含 `seq`、`ts` 和 `run_id`）：
  1. `run_started`：劇本中的 `data` 只有 `{"scenario": <情境 id>}`。寫入這一輪時才加上 `run_id`，所以存進資料庫和串流送出的 `run_started` 是 `{"run_id", "scenario"}`（R8）
  2. 依照 R4 的順序，每個 stage：`stage_started` → 每個 task：`task_started` → 逐行 `log` → `task_succeeded` → 該 stage 的所有 task 都完成後 `stage_succeeded`
  3. 全部成功：`run_finished {result: "succeeded"}`
  4. 遇到情境指定的失敗 task 時：輸出 k 行 `level: "info"` 的 log（`line_no` 1…k）→ 1 行 `level: "error"` 的 log（`line_no` k+1，`text` 等於 `message`）→ `task_failed` → `stage_failed` → `run_finished {result: "failed"}`。之後**不再有任何事件**，其餘 stage 和 task 維持 `pending`。
  5. 正常 log 的 `text` 格式是 `[<task_id>] (<line_no>/<log 行數>) <描述>`，描述由實作決定，但同一個情境每次產生的內容都必須相同。

  `success` 情境共有 202 筆事件（1 + 4×2 + 12×2 + 168 + 1）。

## 3. 事件序列

- **R7** 每筆事件都有 `run_id`、`seq`、`type`、`data`、`ts`（ISO-8601 UTC，帶時區，結尾可以是 `Z` 或 `+00:00`）。同一輪的 `seq` 從 1 開始連續遞增，沒有空號；`run_started` 一定是 `seq = 1`。
- **R8** 事件的 `type` 和 `data`：

  | type | data |
  |---|---|
  | `run_started` | `{run_id: int, scenario: str}` |
  | `stage_started` / `stage_succeeded` / `stage_failed` | `{stage_id: str}` |
  | `task_started` / `task_succeeded` | `{stage_id: str, task_id: str}` |
  | `log` | `{stage_id: str, task_id: str, line_no: int, level: "info" \| "error", text: str, ts: str}` |
  | `task_failed` | `{stage_id: str, task_id: str, error_code: str, message: str, hint: str}` |
  | `run_finished` | `{result: "succeeded" \| "failed"}` |

- **R9** **事件 id** 是 `<run_id>.<seq>`，兩邊都是十進位的 ASCII 數字（`domain.format_event_id`）。解析時（`domain.parse_event_id`）先去掉頭尾空白，必須完全符合 `^[0-9]+\.[0-9]+$`，否則視為不合法（回傳 `None`）。
- **R10** **狀態機**（`domain.apply_event`）：stage 和 task 的狀態是 `pending → running → succeeded | failed`；run 的狀態是 `running → succeeded | failed`。快照（R13）一定等於從 `initial_snapshot` 開始，依序把該輪全部事件套用上去的結果。
  遇到下列任何一種情況，`apply_event` 一律拋出 `ValueError`：
  1. stage 或 task 的狀態轉換不符合上面的狀態機。
  2. `seq` 不是 `last_seq + 1`。
  3. `run_id` 和快照的 `run_id` 不符。
  4. 一輪的第一筆事件不是 `run_started`，或 `run_started` 出現在第一筆以外的位置。
  5. 這一輪已經結束（已經套用過 `run_finished`）之後，還有任何事件。
  6. `stage_started`／`stage_succeeded`／`stage_failed` 指向不存在的 stage id；`task_*` 或 `log` 事件的 `(stage_id, task_id)` 組合不在計畫（R4）中——包含 stage id 或 task id 不存在，以及 task id 存在但屬於另一個 stage。
  7. `task_*` 或 `log` 事件所屬的 stage 不是 `running`。
  8. `log` 事件所屬的 task 不是 `running`。
  9. `data` 缺少欄位，或欄位的型別不對（依 R8）。

  stage 結束（`stage_succeeded`／`stage_failed`）時，`apply_event` **不需要**檢查該 stage 的所有 task 是否都已經結束；測試不可以對這一點做任何斷言（拋出或不拋出都可以）。

  `apply_event` 也**不需要**檢查 `run_started` 的 `data.run_id` 或 `data.scenario` 是否和快照或事件本身的 `run_id` 相符（事件本身的 `run_id` 已經由第 3 項檢查）；測試不可以對這一點做任何斷言（拋出或不拋出都可以）。

  `apply_event` 也**不需要**強制 stage／task 依照計畫順序開始，也不需要檢查同一時間只有一個 stage／task 是 `running`；測試不可以對這一點做任何斷言（拋出或不拋出都可以）。

## 4. HTTP API

- **R11** `GET /install/plan` → `200 {stages: [{id, name, tasks: [{id, name}]}]}`，內容和順序同 R4。隨時都能呼叫。
- **R12** `GET /install/scenarios` → `200 [{id, label, fail_task_id: str | null}]`，順序同 R5。
- **R13** `GET /install` → **快照**：
  - `200 {run_id, scenario, status, last_seq, stages: [{id, name, status, tasks: [{id, name, status, error: null | {error_code, message, hint}}]}]}`
  - 狀態和 `last_seq` 必須從**同一個 SQLite 讀取交易**取得（不可分割），所以快照一定剛好反映 `seq ≤ last_seq` 的全部事件。
  - 這個資料庫從來沒有執行過任何一輪時，回 `404`。
- **R14** `POST /install`，body `{"scenario": str}`：
  - 缺少欄位、不是字串、情境不存在、JSON 格式錯誤 → `422`；額外的欄位直接忽略。
  - 目前有一輪正在執行 → `409`。檢查和建立必須是不可分割的操作：同時送出多個請求，最多只有一個成功。
  - 成功時：在**同一個交易**裡刪除上一輪的全部事件和紀錄，建立新的一輪，寫入 `run_started`（`seq = 1`），然後回 `202 {run_id, scenario}`。回應送出之前，`run_started` 就已經寫進資料庫，所以接著呼叫 `GET /install` 一定會得到這一輪的快照。
  - 新一輪的 `run_id` 一定大於這個資料庫檔案曾經用過的所有 `run_id`（例如用 `AUTOINCREMENT`）。
  - 模擬器在背景依照 R6 的劇本產生其餘事件，相鄰兩行 log 間隔 `log_interval` 秒；其他事件不額外等待。
- **R15** `GET /install/logs?run_id=<int>&after=<int>&until=<int>&limit=<int>` → 用 cursor 分批補讀 log：
  - `run_id` 必填；`after` 是整數 ≥ 0，預設 0；`until` 是整數 ≥ 0，預設為請求當下的 `last_seq`；`limit` 是整數 1–1000，預設 500。不合法 → `422`。
  - 沒有任何一輪 → `404`；`run_id` 不是目前這一輪 → `409`（客戶端應該重跑 R27 的同步流程）。
  - 回 `200 {run_id, items: [{seq, stage_id, task_id, line_no, level, text, ts}], next_after: int | null}`：`items` 只包含 `after < seq ≤ until` 的 `log` 事件，依 `seq` 遞增，最多 `limit` 筆。如果 `until` 以內還有更多 log，`next_after` 是本批最後一筆的 `seq`；沒有了就是 `null`。
- **R16** `GET /stats` → `200 {subscribers: int}`，目前 `/install/events` 中**正在重播或接收即時事件**的連線數。沒有進入串流就結束的回應——`404`、`204`，以及送出 `retry` 和 `reset` 後就關閉的回應——都不計入。新的 app 一開始是 0。
- **R17** `GET /health` → `200 {"status": "ok"}`。

## 5. SSE：`GET /install/events`

- **R18** **起點**：
  - 起點來源的優先順序：`Last-Event-ID` header（合法時）> query `last_event_id` > 沒有起點。
  - query `last_event_id` 不符合 R9 的格式 → `422`；header 不合法時視同沒有帶（瀏覽器只會送伺服器給過的 id）。
  - 沒有任何一輪 → `404`。
  - 設目前這一輪是 R、最後一筆是 L、起點是 `(r, n)`：

    | 條件 | 行為 |
    |---|---|
    | 沒有起點 | 從 R 的 `seq = 1` 開始送 |
    | `r ≠ R`，或 `n > L`，且這一輪還在執行 | 送出 `retry` 區塊，再送 `event: reset`（`data: {"run_id": R}`，**不帶 `id`**），然後關閉連線 |
    | `r ≠ R`，且這一輪已經結束 | 同上，送 `reset` |
    | `r = R`，這一輪已經結束，而且 `n ≥ L` | `204 No Content`（依 WHATWG 規格，瀏覽器收到後會永久停止重連） |
    | 其他 | 送出 `seq > n` 的事件 |

- **R19** **回應格式**：成功時回 `200`，header 包含：`Content-Type` 以 `text/event-stream` 開頭、`Cache-Control` 同時包含 `no-cache` 和 `no-transform`、`X-Accel-Buffering: no`，而且不壓縮。每筆事件的格式是 `id: <run_id>.<seq>`、`event: <type>`、`data: <單行 JSON>`，以 `\n\n` 結尾（`domain.format_event`）；欄位順序不保證，測試要用 SSE 解析器解析。
- **R20** **就緒與重播**：伺服器先完成訂閱登記（開始緩衝即時事件），再從 SQLite 讀出要重播的事件，更新 `/stats`，然後才送出第一個區塊。第一個區塊一定是單獨的 `retry: 3000\n\n`（`domain.RETRY_BLOCK`），立即送出。接著依序送出重播的事件，再接即時事件。重播和即時之間**不可漏、也不可重複**（緩衝中 `seq` ≤ 已送最大值的事件直接丟棄）。依 R16 不計入的回應（`404`、`204`，以及送出 `retry` 和 `reset` 後就關閉的回應）不更新 `/stats`。
- **R21** **結束**：送出 `run_finished` 之後，伺服器正常結束這個回應。
- **R22** **Heartbeat**：每次輸出任何內容後重新計時；連續 `heartbeat_interval` 秒沒有輸出時送出 `: ping\n\n`（`domain.PING_COMMENT`），閒置期間週期性重複。資料事件和 heartbeat 同時到期時，只送資料事件。
- **R23** **慢速訂閱者**：廣播時一律用不阻塞的方式把事件放進各訂閱者的佇列。某個佇列滿了（超過 `subscriber_queue_size`）時，伺服器主動結束該連線並更新 `/stats`；其他訂閱者不受影響。被踢掉的客戶端用 `Last-Event-ID` 重連後，可以從 SQLite 補回全部事件。
- **R24** **斷線與關機**：
  - 客戶端斷線時，依靠 ASGI 的取消機制結束 generator（不可吞掉 `CancelledError`），並在 `finally` 中退訂。直接用 ASGI 呼叫時，送入 `http.disconnect` 後 1 秒內，ASGI 呼叫就會返回；透過真的 uvicorn 時，客戶端關閉 TCP 連線後 2 秒內，`/stats.subscribers` 會回到連線前的值。
  - 還有 SSE 連線開著時，uvicorn 收到 SIGINT 或 SIGTERM 後，要在 3 秒內取消模擬器、結束所有串流並退出。這時如果有一輪正在執行，它在資料庫裡維持 `running`，交由 R25 處理。

## 6. 持久化（SQLite）

- **R25** 使用標準函式庫的 `sqlite3`（不新增依賴），開啟 WAL 模式。在 `async def` 裡不可以直接做同步的資料庫呼叫，一律透過 `asyncio.to_thread` 之類的方式執行；寫入要依序進行，確保 `seq` 連續。
  - **啟動復原**：lifespan 啟動時，如果資料庫裡有狀態是 `running` 的一輪（上次程序中斷），就依照 R10 補上事件，讓它結束：如果有 task 是 `running`，補上 `task_failed`（`error_code: "E_INTERRUPTED"`、`message: "伺服器在安裝途中停止"`、`hint: "請重新安裝"`）；如果有 stage 是 `running`，補上 `stage_failed`；最後補上 `run_finished {result: "failed"}`。補上的事件同樣遵守 R7 的 seq 規則。
  - 資料表的設計由實作決定。測試只能透過 HTTP 觀察資料庫的內容（AC9 的復原測試除外）。

## 7. 前端頁面

- **R26** `GET /` → `200`，`Content-Type: text/html; charset=utf-8`，是一個不依賴外部資源（不載入 CDN、字型或外部腳本）的單一 HTML 頁面。
  - 固定的元素 id：`#scenario`（`<select>`，選項來自 R12）、`#install-btn`、`#run-status`、`#stage-list`、`#task-list`、`#follow-btn`。
  - 每個 stage 節點帶 `data-stage-id` 和 `data-status`，每個 task 節點帶 `data-task-id` 和 `data-status`；`data-status` 的值和 R10 的狀態相同。
  - 一律用 `textContent` 顯示內容，不用 `innerHTML`。
  - 用 `addEventListener("<type>")` 監聽具名事件；收到 `run_finished` 或 `reset` 時呼叫 `close()`。
- **R27** 頁面行為：
  - **載入時**：讀取 R11、R12，畫出計畫；然後執行**同步流程**。如果 `GET /install` 回 `404`，只顯示計畫，所有節點都是 `pending`。
  - **同步流程**（對應 SVG 的階段 1）：`GET /install` 取得快照和 `last_seq = S` → 用 R15 從 `after=0` 開始、`until=S`，分批讀完所有 log → 開啟 `EventSource("/install/events?last_event_id=<run_id>.<S>")`。只套用 `seq` 大於已套用最大值的事件（保險機制；伺服器端本來就保證不重複）。
  - **按下安裝**：`POST /install`，成功（`202`）後重新執行同步流程；`409` 或 `422` 時在 `#run-status` 顯示錯誤。執行中時 `#install-btn` 是 disabled。
  - **收到 `reset` 或補讀時遇到 `409`**：關閉目前的連線，重新執行同步流程。
  - **錯誤與重試**：發生網路錯誤、同步流程中遇到 `409` 以外的錯誤，或這一輪還在執行時 `EventSource` 變成 `CLOSED`：在 `#run-status` 顯示錯誤，3 秒後重新執行同步流程。
  - **畫面**：左側 `#stage-list` 列出所有 stage 和狀態。右側 `#task-list` 顯示目前所選 stage 的 task。
    - 預設會自動跟著正在執行的 stage。自動跟隨時如果沒有 stage 正在執行，所選的 stage 依序是：失敗的 stage → 否則最後一個不是 `pending` 的 stage → 否則第一個 stage。
    - 使用者點了**目前顯示的以外**的 stage，就停止自動跟隨；點目前已經顯示的 stage 不會停止自動跟隨。
    - 只有按下 `#follow-btn` 才恢復自動跟隨（按下 `#install-btn` 不會恢復）。
  - **執行中的 task** 展開並逐行追加 log，自動捲到最底；`task_succeeded` 時收合。點開已收合的 task 可以查看它的 log，**不另發請求**。
  - **`task_failed`**：該 task 和它所在的 stage 標成紅色並保持展開；`level: "error"` 的 log 用紅字顯示；下方顯示 `message` 和 `hint`。
  - **`run_finished`**：`#run-status` 顯示結果，`#install-btn` 恢復可以按。
  - HTTP/1.1 下，瀏覽器對同一個網站最多只開 6 條連線；每個分頁會佔用 1 條 SSE。
  - **已知限制**：一輪結束後，頁面就停止監聽。如果之後有其他客戶端開始新的一輪，這個頁面不會得知；要等使用者按下 `#install-btn`、得到 `409` 時才會在 `#run-status` 顯示錯誤，使用者必須重新整理頁面。

## 8. 非功能需求

- **R28** `app/` 底下不可以使用 `print`，log 一律用 `logging`（`ruff check --select T201 app/`）。
- **R29** 程式碼規範依照 `AGENTS.md`。

## 9. 驗收條件

| AC | 條件（客觀、可以判定通過或失敗） | 需求 |
|---|---|---|
| AC1 重建一致 | 客戶端用 R27 的同步流程（快照 → 補讀 → SSE）。快照的 `last_seq = S` 代表前綴 `1..S`。客戶端的事件 = 前綴中的非 `log` 事件（由快照代表）+ 補讀取得的 `log` 事件 + SSE 收到的後綴。(1) 從快照狀態開始，依序對 SSE 收到的後綴套用 `apply_event`，得到的結果等於這一輪結束後的 `GET /install`；(2) 這三部分的 seq 合起來剛好是 `1..last_seq`（這一輪結束後的 `last_seq`），**沒有重複**（前端去重之前就要成立） | R13、R15、R18、R20 |
| AC2 中途進入 | `log_interval=0.001`，每個情境在不同的隨機時間點（固定 seed）執行同步流程 10 次，全部符合 AC1 | R13、R20 |
| AC3 斷線重連 | 透過真的 uvicorn，在隨機的 seq 位置切斷 TCP，帶最後收到的 id 作為 `Last-Event-ID` 重連，跑 30 次都符合 AC1 | R18、R20 |
| AC4 劇本一致 | 每個情境從頭訂閱，收到的事件序列扣掉 `seq`、log 的 `ts` 和 `run_started.data.run_id` 之後，完全等於 `script_for(scenario)`；`run_started.data.run_id` 等於這一輪實際的 `run_id`；`seq` 剛好是 `1..N` | R6、R7、R8 |
| AC5 失敗停止 | 每個失敗情境：目標 task 和它的 stage 都是 `failed`，後面的全部是 `pending`；`task_failed` 的 seq 大於該 task 所有 log 的 seq；`task_failed.data` 的四個字串欄位都不是空的，而且等於 R5 的表格；錯誤那一行的 `level` 是 `error`；`run_finished` 是最後一筆 | R5、R6 |
| AC6 換輪 | 第二輪開始後，用第一輪的 id 連線 → 1 秒內收到 `reset` 並被關閉；`GET /install/logs?run_id=<第一輪>` 回 `409`；第二輪的 `run_id` 大於第一輪；快照只反映第二輪 | R14、R15、R18 |
| AC7 結束 | 收到 `run_finished` 之後，伺服器結束回應；用最後一個 id 重連回 `204` | R18、R21 |
| AC8 並行 | 執行中再 `POST /install` → `409`；同時送出 10 個 `POST /install`，剛好 1 個回 `202` | R14 |
| AC9 SSE 共通 | header 符合 R19；第一個區塊是 `retry`；閒置時有 ping；R24 的斷線時限和關機時限；伺服器在執行中被終止並重新啟動後，`GET /install` 的狀態是 `failed`，而且出現 `E_INTERRUPTED` | R19、R20、R22、R24、R25 |
| AC10 慢速訂閱者 | 直接以 ASGI 呼叫，讓其中一個訂閱者的 `send` 一直阻塞，`subscriber_queue_size` 設很小：該連線被結束、`/stats` 下降，其他訂閱者照樣收到完整的事件序列 | R23 |
| AC11 效能（`perf`） | 真的 uvicorn，`log_interval=0.005`：先開始一輪 `success`，接著 20 個訂閱者從頭訂閱；每個訂閱者都要收到完整的事件序列。延遲樣本是「20 個訂閱者都收到 `retry` 之後才產生的 `log` 事件」（只有 `log` 帶 `ts`）；每筆樣本的延遲 = 從該 log 的 `ts` 到第 20 個訂閱者解析完它的時刻，p95 < 200 ms | R20、R23 |
| AC12 品質關卡 | `AGENTS.md` §1 的五個指令全部通過 | R28、R29 |

瀏覽器手動驗收（Phase 4）：
- 每個情境的畫面行為都符合 R27。
- 安裝到一半時重新整理頁面，畫面完整還原，log 沒有重複行。
- 用 DevTools 讓網路離線 5 秒再恢復，畫面自動補齊。
- 點開已收合的 task，Network 面板新增 0 個請求。

## 10. 測試指引（給測試作者）

- 不要用固定的 sleep 等伺服器準備好：串流用 R20 的 `retry` 區塊，伺服器啟動用 R17。
- 每個測試都用自己的 `tmp_path` 當 `db_path`；需要快速執行時設 `log_interval=0`。
- 直接用 ASGI 呼叫時，要先送 `lifespan.startup`，結束時送 `lifespan.shutdown`。`httpx.ASGITransport` 不會執行 lifespan，而且會等整個回應結束才交回內容，所以不適合用來測試串流。
- 時間相關的斷言：下限要嚴格檢查，上限放寬到預期值 ×3 再加 200 ms。
- 要測 `GET /install` 回 404，或 POST 之後馬上看快照，就用 `log_interval` 讓那一輪跑得夠久（例如 1 秒），不要依賴競速。
- **AC9 的復原測試**是唯一可以碰 SQLite 檔案的例外：做法是以子程序啟動 uvicorn、開始一輪、在執行中送 SIGKILL，再用同一個 `db_path` 重新啟動。測試只看 HTTP 的結果，不可以直接讀寫資料表。
- E2E 測試標記為 `e2e`（真的 uvicorn，單一 worker，連接埠由作業系統分配）；效能測試標記為 `perf`。
- 每個測試的名稱或 docstring 都要標出 R-id 或 AC-id。

## 11. 不在範圍內

驗證／授權、多個同時進行的安裝、真的安裝程式、「卡住」偵測（沒有輸出時自動判定卡住）、多 worker 或多台主機之間的廣播、HTTPS、HTTP/2、Vue 前端、頁面在一輪結束後主動得知其他客戶端開始的新一輪（R27 已知限制）。

---

## 附錄：版本紀錄

| 版本 | 內容 |
|---|---|
| v0.1–v0.3 | FastAPI SSE Demo（Clock 串流 + 聊天廣播）。**已全部作廢**：使用者在 2026-11-20 決定改以 `install-progress-sequence.svg` 為主軸。v0.3（T1.6）從來沒有搬回主 repo |
| v1.0 | 依 SVG 重寫：Stage／Task／Log 模型、7 種模擬情境、單一事件序列加上 SQLite、快照／補讀／SSE 三段同步、`<run_id>.<seq>` 事件 id 和 `reset`。決策紀錄見 `docs/plans/spec_v1_plan.md` |
| v1.1 | 使用者核准。依實作者與測試作者回報的缺口和衝突修正合約（T2.3），明細見下表 |
| v1.1.1 | 使用者決定。釐清 `apply_event` 的檢查範圍與 `/stats` 的更新條件（T2.3b），明細見下表 |

### v1.0 → v1.1 變更明細

| 項目 | 變更 | 影響的 R／AC 與檔案 |
|---|---|---|
| A1 | 劇本的 `run_started` 只帶 `{"scenario"}`，寫入時才加上 `run_id`；AC4 比對時另外扣掉 `run_started.data.run_id`，並要求它等於實際的 `run_id` | R6、AC4（R8 不變）；`domain.pyi` `script_for`、`ScriptStep` |
| A2 | R9 先去掉頭尾空白再比對，以 SPEC 為準；`openapi.yaml` 移除 `last_event_id` 的 `pattern`，改在說明中寫明依 R9 解析 | R9、R18；`openapi.yaml` |
| A3 | 明列 `apply_event` 必須拋出 `ValueError` 的全部情況；stage 結束時不要求檢查 task 是否都已結束 | R10；`domain.pyi` `apply_event` |
| A4 | `/stats` 只計算正在重播或接收即時事件的連線；`404`、`204`、`retry`+`reset` 後關閉的回應不計入 | R16 |
| B1 | `domain.pyi` 的型別別名改用 `X: TypeAlias = ...`（`stubtest` 不支援 PEP 695），名稱和意義不變 | R2；`domain.pyi` |
| B2、B3 | AC11 改為：先開始一輪 `success`，再讓 20 個訂閱者從頭訂閱；延遲樣本只取 20 個都收到 `retry` 之後產生的 `log` 事件 | AC11 |
| B4 | AC1 的 seq 計算方式寫清楚：快照前綴的非 log 事件 + 補讀的 log 事件 + SSE 後綴，剛好是 `1..last_seq` 且不重複 | AC1 |
| B5 | `openapi.yaml` 對齊 FastAPI 產生的 schema：`until` 改為 `anyOf: [integer ≥ 0, null]`；`POST /install` 的 body 改為引用新的 `InstallRequest` 元件 | R14、R15；`openapi.yaml` |
| C1 | 記錄已知限制：一輪結束後頁面停止監聽，不會得知其他客戶端開始的新一輪 | R27、§11 |
| C2 | 自動跟隨時沒有 stage 正在執行：選失敗的 stage → 最後一個非 `pending` 的 stage → 第一個 stage | R27 |
| C3 | 點目前顯示的 stage 不會停止自動跟隨；只有 `#follow-btn` 能恢復自動跟隨（按下安裝不會） | R27 |
| C4 | 網路錯誤、同步時遇到非 `409` 錯誤、執行中 `EventSource` 變成 `CLOSED`：在 `#run-status` 顯示錯誤，3 秒後重跑同步流程 | R27 |
| C5 | `AGENTS.md` §5 的專案結構加上 `app/static/index.html`（R26 頁面）和 `routers/page.py` | R26、R29；`AGENTS.md` |

### v1.1 → v1.1.1 變更明細

| 項目 | 變更 | 影響的 R／AC 與檔案 |
|---|---|---|
| D1 | R10 第 6 項改為：`task_*` 或 `log` 事件的 `(stage_id, task_id)` 組合不在計畫（R4）中就拋出 `ValueError`，包含 task id 存在但屬於另一個 stage | R10；`domain.pyi` `apply_event` |
| D2 | `apply_event` 不需要檢查 `run_started` 的 `data.run_id`／`data.scenario` 是否相符；測試不可斷言 | R10；`domain.pyi` `apply_event` |
| D3 | `apply_event` 不需要強制 stage／task 依計畫順序開始，也不需要檢查同時只有一個 `running`；測試不可斷言 | R10；`domain.pyi` `apply_event` |
| D4 | R20 補一句：依 R16 不計入的回應（`404`、`204`、`retry`+`reset` 後關閉）不更新 `/stats`；意義依 R16，不變 | R16、R20 |
