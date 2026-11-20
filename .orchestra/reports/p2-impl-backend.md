# T2.1a 回報：後端實作

後端已全部做完，只剩前端頁面 R26/R27 依指示留給下一個任務。第 1 節的四個指令全部通過，`mypy.stubtest` 對 `contracts/domain.pyi` 也是 `Success`。有兩件事需要你決定：

- **`stubtest` 和 `domain.pyi` 寫法衝突**：為了讓 stubtest 過，`app/domain.py` 的 5 個型別別名沒照合約的 `type X = ...` 寫法，改成一般的 union（見第 5 節 CONFLICT 1）。
- **`run_started` 的劇本內容是我自己選的**：`script_for` 的第一步只帶 `{"scenario"}`，不帶 `run_id`（見第 5 節 GAP 1）。測試作者做 AC4 比對時，要先拿掉 `run_id` 才會相等。

## 1. 檔案與架構

新增或修改的檔案（都在 `app/` 底下，沒有建立 `tests/`）：

| 檔案 | 內容 |
|---|---|
| `domain.py`（新） | 純邏輯，合約列出的名稱全部提供：PLAN、SCENARIOS、`script_for`、`apply_event`、`format_event` 等 |
| `store.py`（新） | SQLite（WAL）。只開一條連線，用一把 `threading.Lock` 把每個方法排隊執行，每個方法本身是一個交易。由呼叫端透過 `asyncio.to_thread` 呼叫 |
| `broker.py`（新） | 訂閱者集合，每個訂閱者有一個有上限的 `asyncio.Queue`。`publish` 用 `put_nowait`，佇列滿了就移除該訂閱者並通知它結束 |
| `sse.py`（新） | `EventStreamResponse`，自己實作 ASGI 的 `__call__`：送資料、等斷線、等停止訊號三件事同時進行，先發生的勝出。另有重播加即時的 generator，以及 heartbeat |
| `runtime.py`（新） | R3 設定解析，以及 `Runtime`：開資料庫、R25 復原、模擬器背景 task、關機處理 |
| `schemas.py`（新） | Pydantic 模型。元件名稱對齊合約的 `Plan`、`ScenarioInfo`、`Snapshot`、`TaskError`、`LogItem`、`Status` |
| `routers/install.py`、`routers/system.py`（新） | R11–R18 的端點 |
| `main.py`（改） | 換成 R2 的簽名；lifespan 負責建立和關閉 Runtime |

**事件流向**：模擬器每一步先 `await to_thread(store.append)`。在交易中算出 `seq = MAX + 1`、寫入；如果是 `run_finished`，同一個交易裡更新 run 的狀態。寫完才 `broker.publish`，放進各訂閱者的佇列，再由各自的 SSE generator 輸出。

**SSE 連線的順序**：先訂閱 → 用一個交易讀出目前這一輪和 `seq > n` 的事件 → 決定回 404、204、reset 或串流 → 送 `retry` → 重播 → 接即時事件。即時事件中 `seq ≤ 已送出最大值` 或 `run_id` 不符的直接丟掉。

**關機**：lifespan 啟動時，把 SIGINT/SIGTERM 的處理接在 uvicorn 原本的處理之前。收到訊號就取消模擬器，並結束所有串流。這是必要的：uvicorn 預設會一直等到串流自己結束才關機。lifespan 關閉時會把原本的處理還回去。

## 2. R-id 完成狀況

- **已實作**：R1–R25、R28；R29 的品質關卡通過。
- **沒有實作**：R26、R27（前端，依指示留給下一個任務）。

## 3. 品質關卡輸出

```
$ uv sync
Resolved 39 packages in 4ms
Audited 37 packages in 0.70ms
$ uv run ruff format --check .
15 files already formatted
$ uv run ruff check .
All checks passed!
$ uv run mypy
Success: no issues found in 11 source files
```

`uv run pytest` 依指示沒有跑。另外跑了 `MYPYPATH=<暫存目錄> python -m mypy.stubtest app.domain`，結果是 `Success: no issues found in 1 module`。

**`# noqa` 的使用**：`domain.py` 有 5 行 R5 錯誤訊息用了 `# noqa: RUF001  SPEC R5 原文的全形標點`。這些字串必須和 SPEC 的原文完全相同，ruff 卻會檢查全形標點；依 AGENTS.md 的規定，代碼和理由寫在同一行。

## 4. 手動驗證

驗證時用的是暫存腳本和暫存資料庫，跑完都刪了，啟動的 uvicorn 也都停了，最後確認沒有殘留程序。

直接以 ASGI 呼叫（自己送 lifespan、自己提供 receive/send）的結果：
- 沒有任何一輪時：`GET /install`、`/install/events`、`/install/logs` 都回 404。
- 回 422 的情況：body 缺欄位、不是字串、情境不存在、JSON 壞掉，以及 `last_event_id=x`、`limit=0`。
- 7 個情境逐一從頭訂閱：
  - `seq` 都是連續的 1..N，`success` 有 202 筆。
  - 事件扣掉 `ts` 和 `run_started.run_id` 之後，等於 `script_for`。
  - 依序套用 `apply_event` 的結果，等於 `GET /install`。
  - `/install/logs` 用 limit=7 分批，讀到的 seq 剛好是全部 log。
  - header 符合 R19。
  - 用最後一個 id 重連回 204。
- 同時送 10 個 POST：剛好一個 202，其餘九個 409。
- 換輪：
  - 新的 `run_id` 大於舊的；舊 `run_id` 查 logs 回 409；執行中再 POST 回 409。
  - 用舊一輪的 id 連線，以及 `n > L` 的 id 連線，都收到 `retry` 加 `reset` 後被關閉。
- 斷線：送 `http.disconnect` 後，ASGI 呼叫立刻返回。
- 慢速訂閱者：佇列上限設 5、`send` 一直阻塞，該連線被結束，`/stats` 從 3 降到 1；另一個正常訂閱者照樣收到完整的 202 筆。
- Heartbeat：`heartbeat_interval=0.2`、log 間隔 1 秒時，兩行 log 之間收到 4 個 `: ping`。
- 執行中、有串流開著時送 lifespan shutdown：0.003 秒內結束。重新啟動後快照是 `failed`，含 `E_INTERRUPTED`。

透過真的 uvicorn（`curl -N`）：
- 串流開著時送 SIGINT：0.35 秒退出。送 SIGTERM：0.26 秒退出。curl 正常結束。
- 重啟後快照是 `failed`、`E_INTERRUPTED`，這是 R25 的復原。
- 用 curl 測「帶最後一個 id 重連回 204」這一步，因為我的 shell 引號寫錯沒有真正測到。204 只在 ASGI 測試裡驗證過。

## 5. CONTRACT GAP / CONFLICT / NEED DEPENDENCY

- **CONTRACT CONFLICT 1**：`domain.pyi` 用 `type X = ...` 定義 `JsonValue`、`EventType`、`Status`、`RunStatus`、`LogLevel`。但 mypy 的 stubtest 不支援執行期的 PEP 695 別名：執行期照合約寫成 `type`，stubtest 會報 5 個 `is not a Union`。
  - **我的選擇**：執行期改成一般的 union，例如 `Status = Literal["pending"] | Literal["running"] | ...`，語意相同，stubtest 和 mypy 都通過。
  - **另一個做法**：保留 `type` 寫法，在 stubtest 加 allowlist 排除這 5 個名稱。
- **CONTRACT GAP 1**：R8 規定 `run_started` 的 data 是 `{run_id, scenario}`，但 `script_for(scenario_id)` 拿不到 `run_id`；AC4 又要求事件「扣掉 seq 和 log 的 ts 後完全等於 script_for」。
  - **我的選擇**：劇本的 `run_started` 只帶 `{"scenario": id}`；實際寫入的事件帶完整的 `{run_id, scenario}`。測試做 AC4 時需要先拿掉 `run_id`。
- **CONTRACT CONFLICT 2（輕微）**：R9 規定先去掉頭尾空白再比對格式，但 openapi 的 `last_event_id` 寫了 `pattern ^[0-9]+\.[0-9]+$`。
  - **我的選擇**：行為照 SPEC，`" 3.5 "` 會被接受；openapi 裡仍標出 pattern，只是不用來檢查輸入。
- **CONTRACT GAP 2**：R10 只寫了節點本身的狀態轉換。
  - **我的選擇**：除了 R10 列出的檢查，另外會拋出 `ValueError` 的情況：第一筆不是 `run_started`、`run_started` 不在第一筆、run 已結束後還有事件、task 或 log 事件所屬的 stage 不是 `running`、`log` 時 task 不是 `running`、stage 或 task 的 id 不存在、data 欄位型別錯誤。
  - **沒有做的檢查**：沒有檢查 stage 結束時底下的 task 是否都已完成。
- **CONTRACT GAP 3**：reset、204、404 這種短連線算不算 `/stats` 的連線數，沒有規定。
  - **我的選擇**：不算，只計入真正進入串流的連線。
- **小差異（不影響合約檢查）**：
  - `until` 參數產生的 schema 是 `anyOf[integer, null]`，合約寫的是 `integer`。因為 `until` 沒有固定預設值（預設是請求當下的 `last_seq`），只能宣告成可為 null。
  - POST 的 request body 產生成一個 `$ref`（`InstallRequest`），合約是行內的 object，欄位和必填相同。
- **NEED DEPENDENCY**：無。