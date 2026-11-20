已在 `tests/` 完成 27 個測試函式，展開參數後共 **54 個測試節點**：47 個一般測試、6 個 `e2e`、1 個 `perf`。指定的三項離線檢查全部通過。此工作區沒有實作，因此未執行 pytest，也沒有行為驗收結果。

新增檔案均位於 `tests/`。測試檔為 `test_domain.py`、`test_http.py`、`test_stream.py`、`test_e2e.py`、`test_perf.py`。共用 fixture 與工具為 `conftest.py`、`public_api.py`、`reference.py`、`asgi.py`、`wire.py`、`sync_client.py`、`server.py`、`__init__.py`。測試只透過公開介面觀察安裝資料，包含 SIGKILL 後的復原驗證。

### 測試節點對照

下表以 `S` 合併列示參數化節點。每個 `[S]` 都展開為七個實際 pytest 參數 ID：`[success]`、`[network_unreachable]`、`[dependency_missing]`、`[checksum_mismatch]`、`[disk_full]`、`[permission_denied]`、`[service_timeout]`。AC5 適用於其中六個失敗情境。所有 `e2e` 和 `perf` 節點另共用 R1 的單一 worker 啟動與 R17 的 `/health` 就緒檢查。

| Test node ID | R-id／AC-id | Marker |
|---|---|---|
| `tests/test_domain.py::test_r4_r5_tables` | R4、R5 | none |
| `tests/test_domain.py::test_r6_script[S]` | R5、R6、R8、AC5 | none |
| `tests/test_domain.py::test_r6_r10_unknown_scenario` | R6、R10 | none |
| `tests/test_domain.py::test_r9_ids` | R9 | none |
| `tests/test_domain.py::test_r10_every_transition[S]` | R7、R8、R10、R13 | none |
| `tests/test_domain.py::test_r10_invalid_events` | R7、R10 | none |
| `tests/test_domain.py::test_r19_r20_r22_wire_format` | R8、R19、R20、R22 | none |
| `tests/test_http.py::test_r3_configuration_validation` | R2、R3 | none |
| `tests/test_http.py::test_r2_r3_isolation` | R2、R3、R16、R25 | none |
| `tests/test_http.py::test_r3_r14_log_interval` | R3、R14 | none |
| `tests/test_http.py::test_r11_r12_r13_r15_r16_r17_empty` | R11、R12、R13、R15、R16、R17、R18 | none |
| `tests/test_http.py::test_r14_ac8_atomic_start` | R11、R13、R14、AC8 | none |
| `tests/test_http.py::test_r15_log_windows` | R15 | none |
| `tests/test_http.py::test_r3_r25_default_path` | R3、R25 | none |
| `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[S]` | R5–R8、R10、R13、R16、R18–R21、AC4、AC5、AC7 | none |
| `tests/test_stream.py::test_ac1_ac2_midrun_sync[S]` | R13、R15、R18、R20、AC1、AC2 | none |
| `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` | R14、R15、R18、R20、AC6 | none |
| `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env]` | R3、R16、R20、R22、R24、AC9 | none |
| `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[explicit]` | R3、R16、R20、R22、R24、AC9 | none |
| `tests/test_stream.py::test_r23_ac10_slow_subscriber[env]` | R3、R16、R18、R20、R23、AC10 | none |
| `tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]` | R3、R16、R18、R20、R23、AC10 | none |
| `tests/test_stream.py::test_r18_r20_r25_live_cursor` | R7、R13、R15、R18、R20、R25 | none |
| `tests/test_stream.py::test_r20_replay_live_overlap` | R16、R20 | none |
| `tests/test_e2e.py::test_ac3_tcp_reconnect` | R13–R15、R18、R20、AC1、AC3 | e2e |
| `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect` | R16、R19、R20、R22、R24、AC9 | e2e |
| `tests/test_e2e.py::test_r24_live_shutdown[sigint]` | R24、R25、AC9 | e2e |
| `tests/test_e2e.py::test_r24_live_shutdown[sigterm]` | R24、R25、AC9 | e2e |
| `tests/test_e2e.py::test_r25_ac9_sigkill_recovery` | R7、R8、R10、R13、R14、R25、AC9 | e2e |
| `tests/test_e2e.py::test_r26_html` | R26 | e2e |
| `tests/test_perf.py::test_ac11_log_latency` | R20、R23、AC11 | perf |

### 需求涵蓋

「已涵蓋」表示已寫入可執行的斷言。下表按需求列出黑箱測試能驗證的範圍。

| 需求 | 涵蓋程度 | 範圍與限制 |
|---|---|---|
| R1 | 部分涵蓋 | E2E 使用真實 `uvicorn app.main:app`、單一 worker 和 OS 配發的埠。本次未驗證從空環境執行 `uv sync`。 |
| R2 | 部分涵蓋 | 驗證獨立 app、lifespan、ASGI 訊息與預設入口。以不存在的父目錄呼叫工廠可檢查是否過早開庫，無法證明所有形式的 I/O 都未發生。 |
| R3 | 部分涵蓋 | 驗證錯值、邊界、設定優先序、工廠讀取環境的時機、預設路徑與 log 間隔。固定劇本無法精確辨識預設佇列容量 1000，也無法穩定製造 15 秒的預設心跳空窗。 |
| R4、R5、R6、R8、R9、R10 | 已涵蓋 | 逐欄核對計畫與七種情境，逐筆核對劇本、payload、事件 ID、不可變快照及非法轉換。 |
| R7 | 部分涵蓋 | 核對每輪連續序號、首筆事件及所有公開 log 的 UTC 時間戳。非 log 事件的持久化時間戳未公開。 |
| R11、R12 | 已涵蓋 | 核對 HTTP 結構、內容與順序。 |
| R13、R14 | 部分涵蓋 | 驗證快照與其精確事件前綴一致、建立後立即可讀、並行互斥、換輪與 log 節奏。SQLite 交易邊界只能從外部結果間接驗證。 |
| R15 | 部分涵蓋 | 驗證開閉區間、排序、cursor、末頁、輸入限制、404 與 409。單輪最多 168 筆 log，無法精確區分預設上限 500 和其他大於 168 的值。 |
| R16、R17 | 已涵蓋 | 核對訂閱數的增減及健康檢查回應。 |
| R18 | 部分涵蓋 | 涵蓋 header 優先序、無效起點、執行中與終態的 reset、續傳和 204。帶外圍空白的 query 有合約衝突。 |
| R19、R21 | 已涵蓋 | 解析實際 SSE 區塊，核對標頭、未壓縮傳輸、單行 JSON、結束事件與正常 EOF。 |
| R20 | 部分涵蓋 | 在第一次 `send` 阻塞時檢查訂閱數，刻意累積即時事件，再驗證重播交接沒有漏送或重複。SQLite 讀取與內部登記的精確先後無法直接觀察。 |
| R22 | 部分涵蓋 | 驗證資料輸出後重新計時、連續 ping、嚴格時間下限及 §10 上限。公開介面無法精確安排資料與心跳同時到期。 |
| R23 | 已涵蓋 | 一條連線的 `send` 持續阻塞，驗證伺服器主動結束它、訂閱數下降、另一條連線收到完整序列，並可從最後讀到的 ID 補回。 |
| R24 | 部分涵蓋 | 涵蓋 ASGI 斷線、TCP 關閉、SIGINT 與 SIGTERM 的時限，以及重啟後的狀態。generator 內部如何傳遞 `CancelledError` 無法直接觀察。 |
| R25 | 部分涵蓋 | SIGKILL 後以同一路徑重啟，核對已廣播前綴、三筆復原事件、`E_INTERRUPTED` 內容及再次重啟的冪等性。WAL、執行緒策略及無執行中 task 的瞬間分支未直接驗證。 |
| R26 | 部分涵蓋 | 驗證 HTTP 狀態、UTF-8 HTML、六個固定 ID、`select` 及 HTML／CSS 宣告的外部資源。動態 DOM 和 JavaScript 行為留待瀏覽器驗收。 |
| R27 | 未涵蓋 | 測試客戶端執行三段同步。實際頁面的操作、捲動、樣式、跟隨與重連行為屬後續瀏覽器驗收。 |
| R28 | 未涵蓋 | 此工作區沒有 `app/` 可檢查 `print` 或 logging。 |
| R29 | 部分涵蓋 | 本次已檢查測試套件的格式、lint 與編譯。實作及全專案品質關卡待整合環境驗證。 |

| 驗收條件 | 涵蓋程度 | 驗證內容 |
|---|---|---|
| AC1 | 已涵蓋 | 核對快照前綴、逐頁 log、完整 SSE 後綴與 `apply_event` 重建終態。序號計數方式見下方。 |
| AC2 | 已涵蓋 | 七個情境各執行十次同步，`log_interval=0.001`，使用固定種子選擇進度點。 |
| AC3 | 已涵蓋 | 真實 TCP 上進行 30 輪斷線與重連，每輪以最後收到的 ID 續傳並驗證 AC1。 |
| AC4 | 部分涵蓋 | 七個情境均核對完整順序、連號及 payload。`run_started.run_id` 依該輪實際值核對。 |
| AC5、AC6、AC7、AC8 | 已涵蓋 | 分別驗證六種失敗的停止位置、換輪清理、結束後回 204，以及十個並行 POST 恰有一個成功。 |
| AC9 | 已涵蓋 | 涵蓋標頭、retry、ping、斷線與關機時限，以及 SIGKILL 後的實際重啟復原。 |
| AC10 | 已涵蓋 | 阻塞單一 `send`，驗證淘汰、其他訂閱者的完整序列及重連補送。 |
| AC11 | 部分涵蓋 | 20 個真實 TCP 訂閱者各自解析完整 202 筆事件；對共同就緒後產生的 log，取最後一位完成解析的時間，驗證 p95 < 200 ms。 |
| AC12 | 未涵蓋 | 本次三項指定檢查已通過；AGENTS.md §1 的五個全專案關卡尚未執行。 |

### 合約差異與採用口徑

- **CONTRACT CONFLICT — AC11 與 R18、R21。** AC11 要求 20 個訂閱者先收到 `retry` 才開始安裝。空資料庫必須回 `404`，上一輪的串流也會在 `run_finished` 後關閉。效能測試先啟動 `success`，再讓 20 位訂閱者從頭接收，只計算共同就緒後的延遲。
- **CONTRACT GAP — AC11 的全事件延遲。** R8 與 OpenAPI 只對 `log` 公開 `ts`。其餘事件可驗證接收完整性，無法計算從產生到解析的延遲。
- **CONTRACT CONFLICT — AC4 與 R6、R8。** `script_for(scenario_id)` 沒有 `run_id` 參數，但實際 `run_started.data` 必須帶每輪不同的 `run_id`。測試獨立核對實際輪號，其餘劇本資料按 AC4 比對。
- **CONTRACT CONFLICT — R9、R18 與 OpenAPI 的 query pattern。** R9 要求先去除頭尾空白，OpenAPI 的 query 正規表示式要求原字串直接符合格式。已測純解析器與 header 的空白處理，略過帶外圍空白 query 的 HTTP 狀態斷言。
- **CONTRACT GAP — AC1 的序號計數。** 快照的 `last_seq=S` 已概括前綴，其中包含補讀回來的 log。測試分別核對完整前綴狀態與逐筆 log，再將「前綴非 log、補讀 log、SSE 後綴」合併，要求排序後精確等於 `1..last_seq`，因此能抓出重複及缺號。
- **CONTRACT GAP — R22 同時到期。** 公開介面沒有可控制的時鐘。測試驗證可觀察的心跳間隔與重設行為，略過精確同時到期的優先序斷言。
- **NEED DEPENDENCY — 無。**

### 離線檢查輸出

沿用已同步的虛擬環境，設定 `UV_NO_SYNC=1`，並將快取放在可寫的暫存目錄。

| 指令 | 實際輸出 | 退出碼 |
|---|---|---:|
| `uv run --offline ruff format --check tests` | `13 files already formatted` | 0 |
| `uv run --offline ruff check tests` | `All checks passed!` | 0 |
| `uv run --offline python -m compileall -q tests` | 無輸出 | 0 |