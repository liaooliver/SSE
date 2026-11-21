等待第一輪 `pytest` 執行完成。
等待第二輪與第三輪 `pytest` 執行完成。
等待 Mutation 2（R14）的 `tests/test_http.py` 測試完成。
等待 Mutation 4（R19）的 `tests/test_stream.py` 測試完成。
等待 Mutation 6（R20）的 `tests/test_stream.py` 測試完成。
`T3: PASS`

---

## A. 測試執行結果

執行指令：`uv run pytest -q -rA --durations=5`（排除 `perf`，包含 `e2e`，共選取 75 個節點）。

### 第 1 次執行
- **摘要行**：`75 passed, 1 deselected in 53.14s`
- **失敗／錯誤節點**：無
- **總耗時**：`53.14s`
- **最慢的 5 個節點**：
  - `14.44s call     tests/test_e2e.py::test_ac3_tcp_reconnect`
  - `9.28s call     tests/test_http.py::test_r14_nonlog_timing`
  - `5.63s call     tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`
  - `3.70s call     tests/test_http.py::test_r3_r14_log_interval`
  - `3.47s call     tests/test_stream.py::test_r20_replay_live_overlap`

### 重複執行穩定性（第 2、3 次）
- **第 2 次摘要行**：`75 passed, 1 deselected in 50.93s`（無失敗／錯誤）
- **第 3 次摘要行**：`75 passed, 1 deselected in 50.91s`（無失敗／錯誤）
- **Flaky 節點**：無（3 次執行 75 個節點結果完全一致）。
- （附註：已額外確認 AC12 品質關卡 `uv run ruff format --check .`、`uv run ruff check .`、`uv run mypy` 皆全數通過。）

---

## B. 失敗分類

無失敗節點（`0 impl bugs, 0 test bugs, 0 ambiguous`）。Round 1 失敗的 `tests/test_domain.py::test_r10_payload_fields[run_started]` 與 `tests/test_domain.py::test_r10_payload_fields[log]` 皆已通過。

---

## C. 新增與修改測試審查及目標變異測試

### 1. 逐項測試審查（對照 SPEC v1.1.2）

- **`tests/test_http.py::test_r14_nonlog_timing`**（R14）
  - **(a) 是否僅斷言規格要求、不過度限制實作**：是。在 `log_interval=0.4` 下，僅驗證第一筆 log 之前、最後一筆 log 之後，以及連續兩個非 log 事件之間的間隔不超過 `200 ms`（符合 SPEC §10 的 `0 × 3 + 200 ms` 容差）；刻意不對執行中跨 task 的 `(log, task_succeeded)` 與 `(task_started, log)` 下斷言，避免過度限制實作對跨 task 相鄰 log 的解讀。
  - **(b) 規格被破壞時能否確實失敗**：能。於非 log 事件前多等一個 `log_interval` 時立即失敗（見變異 #2）。

- **`tests/test_stream.py::test_r15_midrun_default_until`**（R13、R15）
  - **(a)**：是。於執行中前後兩次快照 `last_seq` 相同且 `status == "running"` 的穩定空窗，省略 `until` 呼叫 `GET /install/logs`，驗證回傳內容與當下已發生的全部 log 一致且 `next_after` 為 `null`，完全符合 R15。
  - **(b)**：能（針對可從 HTTP 觀察到的違規）。當實作把省略 `until` 且執行中視為「無上限」（例如回傳非 `null` 的 `next_after` 表示仍有後續 log，或等待更多 log／不以請求當下 `last_seq` 截斷）時會失敗（見變異 #3）。補充技術說明：在單一 SQLite 讀取交易快照內，請求當下資料庫中本就不存在 `seq > last_seq` 的紀錄，因此單純在查詢中省略 `seq <= last_seq` 條件在黑箱 HTTP 層面與有設條件完全等價（等價變異體）。

- **`tests/test_stream.py::test_r16_r20_excluded_responses`**（R16、R18–R20、AC9）
  - **(a)**：是。除原有對 `404`、`204`、`retry`+`reset` 不計入 `/stats` 以及重播仍計數的驗證外，對 `retry`+`reset` 的 `200` 回應補驗 R19 標頭（`Content-Type`、`Cache-Control` 含 `no-cache` 與 `no-transform`、`X-Accel-Buffering: no`、未壓縮），與 R19 及 `openapi.yaml` 一致。
  - **(b)**：能。僅移除 `retry`+`reset` 回應的單一必要標頭即失敗（見變異 #4）。

- **`tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`**（R14、R15、R18–R20、AC6、AC9）
  - **(a)**：是。換輪後先驗證新輪次處於 `running` 前置條件，再驗證 `n > L` 與舊輪起點皆回傳 `reset`、不計入 `/stats` 且符合 R19 標頭，並驗證結束後舊輪仍送 `reset`、header／query 優先序與 `422` 規則，無過度限制。
  - **(b)**：能。移除 `retry`+`reset` 標頭即失敗（見變異 #4），換輪與起點規則破壞亦會失敗。

- **`tests/test_e2e.py::test_r26_html`**（R26）
  - **(a)**：是。驗證 `200`、`Content-Type: text/html; charset=utf-8`、6 個固定元素 id 唯一存在且 `#scenario` 為 `<select>`、不載入外部資源（涵蓋 HTML 屬性、CSS 資源規則、腳本模組載入與跨來源 `fetch`），以及不使用 `innerHTML`。靜態腳本分析刻意在出現動態成員存取或非字面事件名稱時退讓，不會對合法的 JavaScript 寫法造成誤判。
  - **(b)**：部分能。違反 `Content-Type`、缺少／重複固定 id、載入外部資源或直接寫入／使用 `innerHTML` 時會確實失敗（見變異 #5）。但需注意其靜態分析限制：當頁面腳本包含任何非字串字面值的方括號索引（如一般陣列取索引或物件鍵值查表）時，對 `textContent`、`addEventListener`、`close()` 及 `run_finished`／`reset` 具名事件監聽的正向存在性檢查會被略過，因此若移除 `close()` 或改用非具名監聽而未引入 `innerHTML`，此測試無法攔截（詳見 D 節）。

- **`tests/test_e2e.py::test_ac3_tcp_reconnect`**（R13、R15、R18、R20、AC1、AC3）
  - **(a)**：是。強化為在每輪斷線試驗前確認快照 `last_seq` 尚未越過最後可選斷點（最多重試 3 次，避免測到空窗或已結束輪次），未放寬 AC1／AC3 驗收條件。
  - **(b)**：能。真實 TCP 斷線重連若漏送、重送或忽略 `Last-Event-ID` 皆會失敗。

- **`tests/test_stream.py::test_ac1_ac2_midrun_sync[*]`**（R13、R15、R18、R20、AC1、AC2）
  - **(a)**：是。維持 `log_interval=0.001` 與固定 seed 抽樣 10 個進度點，強化為檢查至少有快照實際命中 `running` 狀態（若全數錯過最多重試 3 輪，全錯過則明確失敗），防止空轉通過且不更動 AC1／AC2 規格。
  - **(b)**：能。在重播與即時交界去重失效時全部 7 個情境皆失敗（見變異 #6）。

- **`tests/test_stream.py::test_r20_replay_live_overlap`**（R16、R20）
  - **(a)**：是。於首次送出前暫停並確認 `/stats` 計數為 2，且明確斷言即時事件已越過快照邊界至少 3 筆才放行，確保重播與即時緩衝必然重疊，完全符合 R20。
  - **(b)**：能。移除邊界去重時立即失敗（見變異 #6）。

- **`tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[*]`**（R3、R16、R20、R22、R24、AC9）
  - **(a)**：是。強化為迴圈結束後明確斷言已收滿至少 2 筆 log 與 2 次連續 ping（防止提早結束而空轉通過），下限嚴格檢查 `heartbeat_interval`，上限依 SPEC §10 採用 `×3 + 200 ms`，斷線退訂亦依 R24 與 §10 上限檢查。
  - **(b)**：能。Heartbeat 週期錯誤、未於資料事件後重設計時、或斷線未於時限內退訂皆會失敗。

- **`tests/test_stream.py::test_r18_r20_r25_live_cursor`**（R7、R13、R15、R18、R20、R25）
  - **(a)**：是。強化為驗證訂閱後仍處於閒置空窗才量測 `retry` 延遲（上限 `200 ms` 符合 §10 的 `0 × 3 + 200 ms`），且僅在獨立排程探針亦偵測到事件迴圈停頓時才允許重試（最多 3 次，否則失敗），兼顧抗抖動與規格嚴謹性。
  - **(b)**：能。若 `retry` 等待下一筆事件才送出、廣播早於落盤、或對執行中 `seq == last_seq` 誤判為 `204`／`reset` 皆會失敗。

- **`tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect`**（R16–R20、R22、R24、AC9）
  - **(a)**：是。強化為若閒置串流未見 ping 即結束會明確失敗，並於 TCP 關閉、`/stats` 歸回基準值（時限依 R24 的 2 秒套用 §10 `×3 + 200 ms`）後確認輪次仍在 `running`，確保測得的是客戶端主動斷線退訂。
  - **(b)**：能。缺少必要標頭、啟用壓縮、缺少 ping 或關閉 TCP 後未及時退訂皆會失敗。

- **`tests/test_http.py::test_r3_r14_log_interval`**（R3、R14）
  - **(a)**：是。移除無作用斷言後，保留預設值／環境變數／顯式覆寫優先順序、建構時快照環境變數、嚴格下限與 §10 上限（`×3 + 200 ms`）驗證，完全符合 R3、R14 與 §10。
  - **(b)**：能。間隔優先序錯誤或實際節奏低於下限／超過上限時皆會失敗。

---

### 2. 目標變異測試結果

每次變異皆獨立執行並以 `git checkout -- app/` 還原。

| # | R id | mutation (words) | command | killed? | killing node ids |
|---|---|---|---|---|---|
| 1 | R10 item 9 | 對 `run_started` 事件略過 `data` 必填欄位與型別驗證 | `uv run pytest -q tests/test_domain.py` | Yes | `tests/test_domain.py::test_r10_payload_fields[run_started]` |
| 2 | R14 | 於非 log 事件（`stage_started`）產生前額外等待一個 `log_interval` | `uv run pytest -q tests/test_http.py` | Yes | `tests/test_http.py::test_r14_nonlog_timing` |
| 3 | R15 | 省略 `until` 且輪次仍在執行時視為無上限（認定仍有後續 log 而回傳非 `null` 的 `next_after`，而非以請求當下的 `last_seq` 作為上限）（註：若僅於單一 SQLite 讀取交易內省略 `seq <= last_seq` 條件，因資料庫當下無 `seq > last_seq` 紀錄，屬不可從 HTTP 區分的等價變異體） | `uv run pytest -q tests/test_stream.py tests/test_http.py -k r15` | Yes | `tests/test_stream.py::test_r15_midrun_default_until` |
| 4 | R19 | 僅在 `retry`+`reset` 回應移除 `X-Accel-Buffering` 標頭（保留一般事件串流的所有標頭） | `uv run pytest -q tests/test_stream.py` | Yes | `tests/test_stream.py::test_r16_r20_excluded_responses`, `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` |
| 5 | R26 | 將前端頁面腳本中一處設定節點文字的寫法由 `textContent` 改為 `innerHTML` | `uv run pytest -q tests/test_e2e.py -k test_r26_html` | Yes | `tests/test_e2e.py::test_r26_html` |
| 6 | R20 | （Round 1 重複驗證）移除重播結束切換至即時串流時的 `seq <= last_sent` 去重檢查 | `uv run pytest -q tests/test_stream.py` | Yes | `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[*]`（7 個情境）, `tests/test_stream.py::test_ac1_ac2_midrun_sync[*]`（7 個情境）, `tests/test_stream.py::test_r16_r20_excluded_responses`, `tests/test_stream.py::test_r23_ac10_slow_subscriber[env]`, `tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]`, `tests/test_stream.py::test_r20_replay_live_overlap`（共 18 個節點） |
| 7 | R23 | （Round 1 重複驗證）當慢速訂閱者佇列已滿時靜默丟棄事件，不主動結束該連線也不從訂閱者集合移除 | `uv run pytest -q tests/test_stream.py -k test_r23_ac10_slow_subscriber` | Yes | `tests/test_stream.py::test_r23_ac10_slow_subscriber[env]`, `tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]` |

---

## D. 尚待留意之覆蓋缺口（已宣告不可測項目以外）

除簡報已列明之項目（R25 無 `running` task 時的復原、WAL 模式／不阻塞 event loop、R22 資料與 heartbeat 同時到期、瀏覽器行為 R27 與 C1–C4）外，目前自動化測試仍有以下有限缺口：

1. **R26 靜態腳本的正向檢查在一般腳本上會退讓**：`tests/test_e2e.py::test_r26_html` 只要偵測到腳本含任何非字串字面值的方括號索引（例如陣列取索引或表查詢），便會略過對 `textContent`、`addEventListener`、`close()` 及 `run_finished`／`reset` 具名事件監聽的正向存在性檢查；同時 R26 要求的 `data-stage-id`、`data-task-id`、`data-status` 係由前端執行期產生，亦未在靜態檢查中驗證，這些項目仍須依賴 Phase 4 瀏覽器驗收。
2. **R14 執行中跨 task 邊界之非 log 延遲**：`tests/test_http.py::test_r14_nonlog_timing` 為避免過度限制實作，不對第一筆與最後一筆 log 之間的 `(log, task_succeeded)` 與 `(task_started, log)` 下斷言；若僅在執行中某 task 最後一行 log 與 `task_succeeded` 之間插入單次額外延遲，可能不會被該測試單獨攔截。
3. **R3 布林型別顯式參數**：`tests/test_http.py::test_r3_configuration_validation` 未測試直接傳入 Python `bool`（`True`／`False`）作為數值設定參數時是否拋出 `ValueError`。
4. **R15 `after > until`（兩者皆大於 0）與 R18 執行中透過 `Last-Event-ID` header 傳送 `n > L`**：目前 `GET /install/logs` 邊界未單獨測 `after > until > 0`，而執行中 `n > L` 觸發 `reset` 僅透過 query 參數測試（未另以 header 路徑單獨驗證）。
5. **OpenAPI 全端點 schema 一致性**：`tests/test_http.py::test_r9_r14_r15_r18_openapi` 僅核對 `POST /install` body、`GET /install/logs` 的 `until` 與 `GET /install/events` 的 `last_event_id`，未全面比對其餘端點與回應模型（如 `/health`、`Snapshot`、`Plan` 等）與 `contracts/openapi.yaml` 的逐欄一致。
6. **R7 非 log 持久化事件的 `ts`**：因 R8 線上格式僅於 `log` 事件暴露 `ts`，非 log 事件落盤後的 `ts` 格式無法透過黑箱 HTTP 介面直接觀察。

---

## E. 工作目錄清理確認

- `./.t3-tmp/`：不存在（未建立／已確認無殘留）。
- `install.db`：已檢查整個工作目錄，不存在任何 `install.db`（或對應 `-wal`／`-shm`）檔案。
- `git status --short` 輸出（完全空白）：

```text
```
