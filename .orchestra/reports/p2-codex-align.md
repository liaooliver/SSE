已將 `tests/` 對齊 SPEC v1.1.1，修改 6 個檔案，新增 20 個 pytest 節點。更新後共 **74 個節點**，其中 `none` 67 個、`e2e` 6 個、`perf` 1 個。三項指定的離線檢查均通過。工作區沒有實作，因此未執行 pytest，也沒有實測的 p95 數值。

修改檔案為 `tests/test_domain.py`、`tests/test_http.py`、`tests/test_stream.py`、`tests/test_perf.py`、`tests/reference.py`、`tests/asgi.py`。規格、合約、設定與依賴均未修改。

### 1. 逐項變更

本表以函式名稱識別節點。各函式的完整路徑與參數 ID 見第 2 節。此次沒有移除或重新命名節點。

| 項目 | 節點與處理結果 |
|---|---|
| A1 | 修改 `test_r6_script` 的 7 個節點，要求劇本首筆資料恰好只有 `scenario`。`test_ac4_ac5_ac7_complete_run` 的 7 個節點先核對串流首筆的 `run_id` 等於 POST 實際建立的輪次，再移除該欄位比對劇本。共用這項比對的還有 `test_ac1_ac2_midrun_sync`、`test_r18_ac6_cursor_and_reinstall`、`test_r23_ac10_slow_subscriber`、`test_r20_replay_live_overlap`、`test_ac11_log_latency`。 |
| A2 | 修改 `test_r18_ac6_cursor_and_reinstall`，驗證含頭尾空白的 query 會從正確位置重播，數字中間含空白則回 `422`。新增 `test_r9_r14_r15_r18_openapi` 檢查 query schema 已移除 `pattern`。既有 `test_r9_ids` 與 header 空白案例已符合 R9。 |
| A3 | 修改 `test_r10_invalid_events`。新增 `test_r10_payload_fields` 9 個、`test_r10_unknown_identifiers` 7 個，以及 `test_r10_inactive_targets`、`test_r10_terminal_states` 各 1 個。涵蓋 R10 九項必須拋出 `ValueError` 的條件。沒有單以同一 stage 尚有未完成 task 為由要求接受或拒絕事件。 |
| A4 | 新增 `test_r16_r20_excluded_responses`，並修改 `test_r18_ac6_cursor_and_reinstall`。在 ASGI 傳送標頭與 body 時查詢 `/stats`，可抓到回應結束前就歸零的暫時計數。另驗證已結束輪次的真實重播仍占 1 條連線。 |
| B1 | 無需修改。`TypeAlias` 的宣告方式變更，公開名稱、可接受的值與行為相同。 |
| B2 | 修改 `test_ac11_log_latency`。真實 uvicorn 先接受 `success` 安裝，接著 20 位訂閱者各自從頭訂閱，逐一核對完整 202 筆事件內容與順序。 |
| B3 | 同一個 `test_ac11_log_latency` 只取產生時間嚴格晚於最後一位收到 `retry` 的 log。每筆取 20 人中最晚的解析完成時間，要求有樣本，並沿用最近秩法檢查 p95 `< 200 ms`。 |
| B4 | 無需修改 AC1 的計算。`test_ac1_ac2_midrun_sync` 與 `test_ac3_tcp_reconnect` 已將參照串流中的前綴非 log、實際補讀的 log、實際收到的 SSE 後綴合併，在去重前逐號核對 `1..last_seq`，並從快照歸約到最終狀態。 |
| B5 | 新增 `test_r9_r14_r15_r18_openapi`。核對 `until` 的 `anyOf`、整數下限 0、可為 `null` 且無固定數值預設，以及 POST body 的 `InstallRequest` 引用和必填字串 `scenario`。使用工廠回傳的 FastAPI 公開 `openapi()` 文件，避免額外要求 schema 必須掛載於特定網址。 |
| C1 | 無需修改。一輪結束後頁面停止監聽、無法感知其他客戶端換輪，屬瀏覽器驗收。HTTP 串流結束已有 AC7。 |
| C2 | 無需修改。自動跟隨時的 stage 選取順位須觀察瀏覽器畫面。 |
| C3 | 無需修改。點擊目前 stage 與恢復自動跟隨須操作頁面。既有 `test_r26_html` 已核對 `#follow-btn`。 |
| C4 | 無需修改。錯誤顯示、`EventSource.CLOSED` 與 3 秒後重新同步，留給瀏覽器驗收。 |
| C5 | 無需修改。`test_r26_html` 透過 `GET /` 驗收頁面，沒有依賴路由或靜態檔案的內部位置。 |
| D1 | 新增的 `test_r10_unknown_identifiers` 分別驗證 3 種 stage 事件、3 種 task 事件與 `log`。所有 task／log 案例都含未知 stage、未知 task，以及 task 存在但屬於其他 stage 的配對。 |
| D2 | 修改 `test_r10_invalid_events`，使用 stage 事件單獨測試事件本身跨輪。`test_r10_payload_fields[run_started]` 檢查必填與型別，沒有對型別正確但內容與快照不同的 `data.run_id` 或 `data.scenario` 下斷言。 |
| D3 | 無需移除節點。已核對 R10 測試沒有對「未依計畫順序啟動」或「同時有多個 running」本身下斷言。R6 的劇本順序仍照規格驗證。 |
| D4 | 由 `test_r16_r20_excluded_responses` 與 `test_r18_ac6_cursor_and_reinstall` 驗證。涵蓋 `404`、`204`、執行中與已結束時的 `retry`＋`reset`，以及已有其他重播連線時的非零計數基準。 |

### 2. 完整節點對照

「參數 ID」欄每個值代表一個獨立節點，在左欄後加上 `[值]` 即為完整 pytest node ID。`—` 表示左欄已是完整 ID。表內列出各節點直接驗證或支援的需求。

| 節點 | 參數 ID | R／AC | marker |
|---|---|---|---|
| `tests/test_domain.py::test_r4_r5_tables` | — | R4、R5 | none |
| `tests/test_domain.py::test_r6_script` | `success` | R4、R6、R8、AC4 | none |
| `tests/test_domain.py::test_r6_script` | `network_unreachable`、`dependency_missing`、`checksum_mismatch`、`disk_full`、`permission_denied`、`service_timeout` | R4–R6、R8、AC4、AC5 | none |
| `tests/test_domain.py::test_r6_r10_unknown_scenario` | — | R6、R10 | none |
| `tests/test_domain.py::test_r9_ids` | — | R9 | none |
| `tests/test_domain.py::test_r10_every_transition` | `success`、`network_unreachable`、`dependency_missing`、`checksum_mismatch`、`disk_full`、`permission_denied`、`service_timeout` | R10、R13 | none |
| `tests/test_domain.py::test_r10_invalid_events` | — | R10 | none |
| `tests/test_domain.py::test_r10_payload_fields` | `run_started`、`stage_started`、`stage_succeeded`、`stage_failed`、`task_started`、`task_succeeded`、`task_failed`、`log`、`run_finished` | R8、R10 | none |
| `tests/test_domain.py::test_r10_unknown_identifiers` | `stage_started`、`stage_succeeded`、`stage_failed`、`task_started`、`task_succeeded`、`task_failed`、`log` | R4、R10 | none |
| `tests/test_domain.py::test_r10_inactive_targets` | — | R10 | none |
| `tests/test_domain.py::test_r10_terminal_states` | — | R10 | none |
| `tests/test_domain.py::test_r19_r20_r22_wire_format` | — | R8、R19、R20、R22、AC9 | none |
| `tests/test_http.py::test_r9_r14_r15_r18_openapi` | — | R9、R14、R15、R18 | none |
| `tests/test_http.py::test_r3_configuration_validation` | — | R2、R3 | none |
| `tests/test_http.py::test_r2_r3_isolation` | — | R2、R3、R13、R16、R25 | none |
| `tests/test_http.py::test_r3_r14_log_interval` | — | R3、R14 | none |
| `tests/test_http.py::test_r11_r12_r13_r15_r16_r17_empty` | — | R4、R5、R11–R13、R15–R18 | none |
| `tests/test_http.py::test_r14_ac8_atomic_start` | — | R11、R13、R14、AC8 | none |
| `tests/test_http.py::test_r15_log_windows` | — | R15 | none |
| `tests/test_http.py::test_r3_r25_default_path` | — | R3、R25 | none |
| `tests/test_stream.py::test_ac4_ac5_ac7_complete_run` | `success` | R6–R8、R10、R13、R16、R18–R21、AC4、AC7 | none |
| `tests/test_stream.py::test_ac4_ac5_ac7_complete_run` | `network_unreachable`、`dependency_missing`、`checksum_mismatch`、`disk_full`、`permission_denied`、`service_timeout` | R5–R8、R10、R13、R16、R18–R21、AC4、AC5、AC7 | none |
| `tests/test_stream.py::test_ac1_ac2_midrun_sync` | `success`、`network_unreachable`、`dependency_missing`、`checksum_mismatch`、`disk_full`、`permission_denied`、`service_timeout` | R10、R13、R15、R18、R20、R27、AC1、AC2 | none |
| `tests/test_stream.py::test_r16_r20_excluded_responses` | — | R16、R18、R20 | none |
| `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` | — | R9、R13–R16、R18、R20、AC6 | none |
| `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect` | `env`、`explicit` | R3、R16、R20、R22、R24、AC9 | none |
| `tests/test_stream.py::test_r23_ac10_slow_subscriber` | `env`、`explicit` | R3、R16、R18、R20、R23、AC10 | none |
| `tests/test_stream.py::test_r18_r20_r25_live_cursor` | — | R7、R13、R15、R16、R18、R20、R25 | none |
| `tests/test_stream.py::test_r20_replay_live_overlap` | — | R16、R20 | none |
| `tests/test_e2e.py::test_ac3_tcp_reconnect` | — | R1、R13、R15、R18、R20、AC1、AC3 | e2e |
| `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect` | — | R1、R16–R20、R22、R24、AC9 | e2e |
| `tests/test_e2e.py::test_r24_live_shutdown` | `sigint`、`sigterm` | R1、R24、R25、AC9 | e2e |
| `tests/test_e2e.py::test_r25_ac9_sigkill_recovery` | — | R1、R7、R8、R10、R13、R14、R25、AC9 | e2e |
| `tests/test_e2e.py::test_r26_html` | — | R1、R26 | e2e |
| `tests/test_perf.py::test_ac11_log_latency` | — | R6–R8、R20、R23、AC11 | perf |

以測試宣告與參數 ID 靜態展開，`test_domain.py` 37 個、`test_http.py` 8 個、`test_stream.py` 22 個、`test_e2e.py` 6 個、`test_perf.py` 1 個，合計 **74 個**。專案預設排除 `perf`，預設選取 **73 個**。

### 3. 需求與驗收覆蓋

以下狀態指測試已寫入的覆蓋範圍，執行結果僅限第 5 節的三項檢查。

| 需求 | 覆蓋 | 判定依據 |
|---|---|---|
| R1 | 部分 | E2E 使用真實單 worker uvicorn 與 `app.main:app`。環境安裝與預設埠啟動屬整合關卡。 |
| R2 | 部分 | 涵蓋工廠隔離、lifespan、預設 app 入口及公開領域介面。黑箱測試只能觀察建構時 I/O 的外部效果。 |
| R3 | 部分 | 涵蓋非法值、邊界、建構時讀環境、參數覆寫及可觀察的設定效果。預設 heartbeat 15 秒與 queue 1000 的精確預設邊界未逐一量測。 |
| R4、R5 | 已覆蓋 | 逐項核對計畫順序、名稱、行數，以及七個情境的失敗位置與錯誤內容。 |
| R6 | 已覆蓋 | 核對七份完整劇本、首筆資料、正常與錯誤 log、停止位置及決定性。 |
| R7 | 部分 | 七情境均核對連續序號與輪次，所有公開 log 時戳驗證 UTC。非 log 事件的落盤時戳沒有公開輸出。 |
| R8、R9 | 已覆蓋 | 九種事件資料、實際 `run_id`、ASCII id、頭尾空白、內部空白、query 與 header 皆有案例。 |
| R10 | 已覆蓋 | 涵蓋初態、合法劇本逐步歸約、輸入快照不變，以及九類必要錯誤。 |
| R11、R12 | 已覆蓋 | 透過 HTTP 核對計畫與情境的內容、順序及回應形狀。 |
| R13 | 部分 | 空資料庫、執行中與終態快照均有驗證，並以獨立事件前綴比對原子性。SQLite 讀取交易的內部實作無法從 HTTP 證明。 |
| R14 | 部分 | 涵蓋驗證、額外欄位、併發、回應後立即可讀、換輪與重啟後輪號遞增。交易內部操作及舊資料實體刪除僅能驗證其公開效果。 |
| R15 | 部分 | 涵蓋 cursor、分頁、上下界、跨輪、輸入驗證及 `until` schema。單輪最多 168 筆 log，無法用既定劇本觸發預設 500 筆的截斷點。 |
| R16、R17 | 已覆蓋 | 驗證初始計數、重播及即時連線、排除回應傳送期間的計數，以及健康端點的狀態碼與內容。 |
| R18、R19 | 已覆蓋 | 涵蓋起點優先序、重播、reset、204、404、422、SSE headers、無壓縮與區塊格式。 |
| R20 | 部分 | 驗證首個 `retry`、送出時的計數、重播接即時無漏無重，以及排除回應。訂閱登記和 SQLite 讀取的內部先後由外部結果驗證。 |
| R21 | 已覆蓋 | 驗證 `run_finished` 為最後事件、正常 EOF 與最後 id 重連。 |
| R22 | 部分 | 驗證閒置時的週期性 ping 與輸出後重新計時。黑箱缺少可精確製造資料和 heartbeat 同時到期的時鐘。 |
| R23 | 已覆蓋 | 永久阻塞單一 ASGI `send`，核對慢連線被結束、計數下降、快連線完整及重連補送。 |
| R24 | 部分 | 驗證 ASGI 斷線、TCP 退訂及兩種關機訊號的時限與結果。generator 的 `finally` 與取消傳遞屬內部機制。 |
| R25 | 部分 | 透過 HTTP 驗證寫入先於廣播、SIGKILL 復原事件、連續序號與再次重啟的冪等性。未直接檢查 SQLite、WAL 或執行緒策略。 |
| R26 | 部分 | HTTP 與 HTML 解析涵蓋媒體型別、固定 ID、`select` 及宣告載入的資源。動態 DOM 與事件監聽行為留給瀏覽器。 |
| R27 | 部分 | 快照、補讀、續接、換輪與錯誤狀態碼已有 HTTP 驗證。選取、自動跟隨、畫面更新與 3 秒重試屬瀏覽器清單。 |
| R28、R29 | 未覆蓋 | 需在有實作的工作區檢查 `app/` 與全專案品質規範。 |

| 驗收 | 覆蓋 | 判定依據 |
|---|---|---|
| AC1 | 已覆蓋 | 三段 seq 合計逐號相符，從快照套用後綴後等於最終快照。 |
| AC2 | 已覆蓋 | 七個情境各執行十個固定種子的中途同步點。 |
| AC3 | 已覆蓋 | 真實 TCP 斷線並以 header 重連，共 30 輪，每輪核對 AC1。 |
| AC4 | 已覆蓋 | 七情境從頭訂閱，核對實際輪號、正規化後的完整劇本與連續 seq。 |
| AC5 | 已覆蓋 | 六個失敗情境均核對目標、錯誤明細、log 順序、後續 pending 與最後事件。 |
| AC6、AC7、AC8 | 已覆蓋 | 分別驗證換輪 reset 與舊 log 的 `409`、終止與 `204`、十個併發 POST 恰一個 `202`。 |
| AC9 | 已覆蓋 | 涵蓋 headers、retry、ping、斷線、關機時限，以及 SIGKILL 後由 HTTP 觀察 `E_INTERRUPTED`。 |
| AC10 | 已覆蓋 | 阻塞單一訂閱者期間驗證退訂、其他訂閱者的完整序列及重連補送。 |
| AC11 | 已覆蓋 | 依新程序驗證 20 份完整序列，並以共同就緒後產生的 log 計算 p95。 |
| AC12 | 未覆蓋 | 本工作區只能完成測試檔的三項離線檢查，全專案五項關卡尚未執行。 |

### 4. 剩餘合約項目

- **CONTRACT CONFLICT** 同輪已結束且游標超前時，R18 明定 `n ≥ L` 回 `204`。OpenAPI 的 `reset.when` 把「起點超前」概括列為 reset，少了輪次仍在執行的限定。測試保留 R18 明定的 `204` 斷言。[SPEC R18](/Users/oliver/.local/share/sse-orchestra/tests-ws/docs/SPEC.md:147) · [OpenAPI reset 說明](/Users/oliver/.local/share/sse-orchestra/tests-ws/contracts/openapi.yaml:279)
- **CONTRACT GAP** 無剩餘阻礙本次測試編寫的缺口。
- **NEED DEPENDENCY** 無。

### 5. 指定檢查的實際輸出

預設 uv 快取受到沙箱限制。最終檢查使用已同步的 `.venv`，設定 `UV_NO_SYNC=true`，並將 uv 與 Ruff 快取設於可寫的暫存目錄。

| 指令 | 輸出 | 結束碼 |
|---|---|---:|
| `uv run --offline ruff format --check tests` | `13 files already formatted` | 0 |
| `uv run --offline ruff check tests` | `All checks passed!` | 0 |
| `uv run --offline python -m compileall -q tests` | 無輸出 | 0 |