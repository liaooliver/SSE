第一輪 `pytest` 測試套件正在執行中，待背景任務完成後繼續檢視結果並進行後續驗證。
正在執行第二輪 `pytest`（穩定性檢查），等待完成。
正在執行第三輪 `pytest`（穩定性檢查），等待完成。
正在執行變異測試 M8（R22 heartbeat），等待測試結果。
`T3: FAIL (2 impl bugs, 0 test bugs, 0 ambiguous, 0 flaky, 0 survived mutations)`

---

## A. 測試套件執行結果

### 1. 首次執行（`uv run pytest -q -rA --durations=5`）
- 摘要行：`2 failed, 71 passed, 1 deselected in 29.37s`（共 73 個非 `perf` 測試節點）
- 失敗節點：
  - `tests/test_domain.py::test_r10_payload_fields[run_started]`
  - `tests/test_domain.py::test_r10_payload_fields[log]`
- 錯誤（error）節點：無

### 2. 重複執行兩次（穩定性／flaky 檢查）
- 第 2 次（`uv run pytest -q -rA`）：`2 failed, 71 passed, 1 deselected in 28.40s`
- 第 3 次（`uv run pytest -q -rA`）：`2 failed, 71 passed, 1 deselected in 28.33s`
- 結果不一致（flaky）的節點：無（三次失敗與通過節點完全一致）。

### 3. 總耗時與最慢的 5 個節點（第 1 次執行）
- 總牆鐘時間：`29.37s`
- 最慢 5 個節點（`--durations=5`）：
  1. `9.82s call` — `tests/test_e2e.py::test_ac3_tcp_reconnect`
  2. `3.70s call` — `tests/test_http.py::test_r3_r14_log_interval`
  3. `2.68s call` — `tests/test_stream.py::test_r23_ac10_slow_subscriber[env]`
  4. `2.68s call` — `tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]`
  5. `2.66s call` — `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`

---

## B. 失敗分類

### `IMPL BUG`

#### 1. `tests/test_domain.py::test_r10_payload_fields[run_started]`
- **需求 ID**：R8、R10（第 9 項）
- **SPEC 預期行為**：
  - R8 規定 `run_started` 的 `data` 為 `{run_id: int, scenario: str}`。
  - R10 規定：「遇到下列任何一種情況，`apply_event` 一律拋出 `ValueError`：…… 9. `data` 缺少欄位，或欄位的型別不對（依 R8）。」
  - R10 補充說明僅免除值比對：「`apply_event` 也**不需要**檢查 `run_started` 的 `data.run_id` 或 `data.scenario` 是否和快照或事件本身的 `run_id` 相符（事件本身的 `run_id` 已經由第 3 項檢查）；測試不可以對這一點做任何斷言（拋出或不拋出都可以）。」但欄位存在性與型別檢查仍屬第 9 項必填規範。
- **實際觀察行為**：
  - 當 `run_started` 事件的 `data` 缺少 `run_id` 或缺少 `scenario`，或欄位型別不符（例如 `run_id` 為字串或布林值 `bool`，或 `scenario` 為整數）時，`apply_event` 未進行任何欄位驗證就直接更新 `last_seq` 並回傳新快照，沒有拋出 `ValueError`。
  - （註：測試未斷言 `data.run_id`／`data.scenario` 是否與快照相符，僅驗證必填與型別；修正時需注意 Python 中 `bool` 為 `int` 子類別，不可將布林值視為合法的 `int`。）

#### 2. `tests/test_domain.py::test_r10_payload_fields[log]`
- **需求 ID**：R8、R10（第 9 項）
- **SPEC 預期行為**：
  - R8 規定 `log` 的 `data` 為 `{stage_id: str, task_id: str, line_no: int, level: "info" | "error", text: str, ts: str}`。
  - R10 規定：「遇到下列任何一種情況，`apply_event` 一律拋出 `ValueError`：…… 9. `data` 缺少欄位，或欄位的型別不對（依 R8）。」
- **實際觀察行為**：
  - 當 `log` 事件的 `data` 缺少 `ts` 欄位，或 `ts` 型別非字串（例如整數）時，`apply_event` 未驗證 `ts` 欄位就直接接受該事件並回傳新快照，沒有拋出 `ValueError`（其餘欄位 `stage_id`、`task_id`、`line_no`、`level`、`text` 皆有驗證）。

### `TEST BUG`
- 無。

### `SPEC AMBIGUOUS`
- 無。

---

## C. 變異抽檢（Mutation Spot-Check）

共執行 10 項針對不同需求的單一行為變異（每次僅套用一項，驗證後立即還原 `app/`），**擊殺率 10/10（0 survived）**：

| # | R id | mutation (words) | killed? | killing node ids |
|---|---|---|---|---|
| 1 | R10 | 在 `apply_event` 處理 `stage_succeeded`／`stage_failed` 時，移除 stage 狀態必須為 `running` 的前置檢查，使 `pending` 或已結束的 stage 也能再次轉移為終態 | killed | `tests/test_domain.py::test_r10_invalid_events`, `tests/test_domain.py::test_r10_terminal_states` |
| 2 | R9 | 在 `parse_event_id` 中停止去除輸入字串頭尾空白，直接以原字串比對格式 | killed | `tests/test_domain.py::test_r9_ids`, `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` |
| 3 | R18 | 對於已結束輪次且起點滿足 `r = R`、`n ≥ L` 的 `GET /install/events` 請求，改送 `retry` + `reset` 串流而非 `204 No Content` | killed | `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[success]`（及全部 7 個 scenario 參數化節點）, `tests/test_stream.py::test_r16_r20_excluded_responses` |
| 4 | R20 | 在 SSE 串流從重播銜接即時事件時，移除 `seq ≤ 已送最大值` 的去重條件，使重播期間進入緩衝的即時事件重複送出 | killed | `tests/test_stream.py::test_r20_replay_live_overlap`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[success]`（及全部 7 個 scenario 參數化節點） |
| 5 | R16 | 在 `GET /install/events` 回傳 `204 No Content` 時延後到回應送出後的背景工作才取消訂閱，使該 `204` 回應在傳送期間被計入 `/stats.subscribers` | killed | `tests/test_stream.py::test_r16_r20_excluded_responses` |
| 6 | R15 | 查詢 `/install/logs` 時將下界條件由嚴格大於（`seq > after`）改為大於等於（`seq >= after`），造成 off-by-one | killed | `tests/test_http.py::test_r15_log_windows` |
| 7 | R14 | 開始新一輪安裝時移除「已有執行中輪次則拒絕」的檢查，允許併發的 `POST /install` 同時建立新輪次並回傳 `202` | killed | `tests/test_http.py::test_r14_ac8_atomic_start` |
| 8 | R22 | 在 SSE 閒置逾時達 `heartbeat_interval` 時重設計時器但不送出 `: ping` 註解區塊 | killed | `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env]`, `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[explicit]`, `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect` |
| 9 | R23 | 廣播事件遇到訂閱者佇列已滿時僅靜默略過事件，不移除訂閱者也不主動結束該慢速連線 | killed | `tests/test_stream.py::test_r23_ac10_slow_subscriber[env]`, `tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]` |
| 10 | R25 | 在 lifespan 啟動時跳過中斷輪次的啟動復原步驟，使先前未結束的輪次維持 `running` | killed | `tests/test_http.py::test_r2_r3_isolation`, `tests/test_e2e.py::test_r25_ac9_sigkill_recovery`, `tests/test_e2e.py::test_r24_live_shutdown[sigint]`, `tests/test_e2e.py::test_r24_live_shutdown[sigterm]` |

各項變異執行的目標指令：
1. `uv run pytest -q tests/test_domain.py -k "not test_r10_payload_fields"`
2. `uv run pytest -q tests/test_domain.py::test_r9_ids tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`
3. `uv run pytest -q tests/test_stream.py::test_ac4_ac5_ac7_complete_run tests/test_stream.py::test_r16_r20_excluded_responses`
4. `uv run pytest -q tests/test_stream.py::test_r20_replay_live_overlap tests/test_stream.py::test_ac1_ac2_midrun_sync`
5. `uv run pytest -q tests/test_stream.py::test_r16_r20_excluded_responses tests/test_stream.py::test_ac4_ac5_ac7_complete_run`
6. `uv run pytest -q tests/test_http.py::test_r15_log_windows tests/test_stream.py::test_r18_r20_r25_live_cursor`
7. `uv run pytest -q tests/test_http.py::test_r14_ac8_atomic_start`
8. `uv run pytest -q tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect`
9. `uv run pytest -q tests/test_stream.py::test_r23_ac10_slow_subscriber`
10. `uv run pytest -q tests/test_http.py::test_r2_r3_isolation tests/test_e2e.py::test_r25_ac9_sigkill_recovery tests/test_e2e.py::test_r24_live_shutdown`

---

## D. 測試套件稽核

### 1. 未被實質覆蓋的需求（不含已宣告為瀏覽器驗證的 R27、C1–C4 及 CI 品質關卡 R28–R29／AC12）
- **R14（「其他事件不額外等待」）**：`tests/test_http.py::test_r3_r14_log_interval` 僅針對第一個 task 的 8 行 log 檢查相鄰 log 間隔，並對第 1 行 log 到第 8 行 log 的總耗時設上限；未對非 log 事件（如開頭 `run_started`／`stage_started`／`task_started`，或跨 task 邊界時）是否錯誤插入 `log_interval` 等待做上限斷言。
- **R15（執行中省略 `until` 的預設行為）**：`tests/test_http.py::test_r15_log_windows` 與 `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` 僅在輪次已結束後測試省略 `until`；中途同步皆明確傳入 `until`。尚未測試輪次執行中省略 `until` 時是否剛好截斷至請求當下的 `last_seq`。
- **R19（`reset` 回應的 SSE 標頭）**：`tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` 與 `tests/test_stream.py::test_r16_r20_excluded_responses` 驗證了 `reset` 回應的狀態碼 `200`、`retry` 區塊、`reset` 事件內容與關閉連線，但未檢查該 `200` 回應的 `Content-Type`、`Cache-Control`、`X-Accel-Buffering` 及未壓縮標頭。
- **R22（資料事件與 heartbeat 同時到期時的優先規則）**：未覆蓋「資料事件和 heartbeat 同時到期時，只送資料事件」的平手處理條件（黑箱測試下難以決定性觸發）。
- **R25（WAL 模式、非同步執行、無執行中 task 時的復原分支）**：
  - 未檢查 SQLite 是否啟用 WAL 模式（受限於 R2 禁止測試直接讀取 SQLite）。
  - 未驗證資料庫存取未阻塞事件迴圈（僅靠靜態規範與間接併發測試）。
  - 啟動復原測試（`tests/test_e2e.py::test_r25_ac9_sigkill_recovery` 與 `tests/test_e2e.py::test_r24_live_shutdown`）均在已有 `running` task 時中斷，未涵蓋中斷時沒有 `running` task（例如僅有 `run_started`，或處於兩個 task 之間僅 stage 為 `running`）的復原路徑。
- **R26（HTML 頁面非瀏覽器可靜態檢查之要求）**：`tests/test_e2e.py::test_r26_html` 僅檢查 `Content-Type`、6 個固定元素 id（含 `#scenario` 為 `<select>`）與 HTML/CSS 宣告式資源不可連往外部，未檢查內嵌腳本是否避免使用 `innerHTML`、是否以 `addEventListener` 監聽具名事件並於 `run_finished`／`reset` 呼叫 `close()`，也未檢查動態腳本是否引用外部資源；`data-stage-id`／`data-task-id`／`data-status` 因由腳本動態產生而留待瀏覽器階段。

### 2. 弱斷言／潛在慢速機器 flaky 風險
- **永遠不會失敗的測試**：無整體空泛的測試。僅 `tests/test_http.py::test_r3_r14_log_interval` 中對第 1 筆 log（索引 0）的下限比較恆為非負值，屬迴圈起點的次要冗餘，後續 7 筆仍有實質下限檢查。
- **僅檢查狀態碼而未檢內容**：各 `404`／`409`／`422` 檢查均符合合約（合約未規範錯誤 body）；`tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` 對 `reset` 回應未驗 R19 標頭已列於上節。
- **在較慢或高負載機器上可能 flaky 的時序相依測試**：
  - `tests/test_e2e.py::test_ac3_tcp_reconnect`：使用 `log_interval=0.01` 搭配較短的 `network_unreachable` 情境（完整執行僅約 0.25–0.3 秒）連跑 30 輪。若任一輪中伺服器於 `POST /install` 後略微延遲、導致取得快照時輪次已結束或進度已推進至倒數第 3 行正常 log 之後，將觸發狀態非 `running` 失敗或隨機切點範圍為空的例外。
  - `tests/test_stream.py::test_ac1_ac2_midrun_sync[*]`：以 `log_interval=0.001` 執行，並斷言 10 次同步中至少有 1 次在 `running` 狀態取到快照。對於總事件數較少的情境（如 `network_unreachable`、`dependency_missing`），若事件迴圈排程稍慢，全部 10 次同步任務可能都在輪次結束後才取得快照而導致失敗（或僅少數幾次真正測到中途重疊）。
  - `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`：以 `log_interval=0.06` 啟動 `dependency_missing`（約 1.1–1.2 秒結束），期間依序發出快照、舊輪 log 查詢與兩次 `reset` 測試（含 `n > L`）。若機器在該段時間卡頓超過約 1.1 秒使該輪先結束，`n > L` 測試會收到 `204` 而非預期的 `reset`。
  - `tests/test_stream.py::test_r20_replay_live_overlap`：以 `log_interval=0.02` 執行 `network_unreachable`（約 0.5 秒結束），並等待參考串流推進至重播邊界後再多 3 筆事件。若慢速機器上輪次在開啟延遲訂閱者前已接近尾聲，可能無法湊足邊界後 3 筆事件而失敗。
  - `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env|explicit]`：使用較小的 `heartbeat=0.06` 與 `interval=0.25`，並嚴格斷言收到區塊的單調時間差 `>= heartbeat` 且 `<= 0.38s`、且須在 5 秒內累積連續 2 次 ping 與 2 筆 log。若機器 CPU 短暫停頓超過約 0.25 秒，或不同實作在送出前重設期限造成微秒級時間差，可能造成假性失敗。
  - `tests/test_stream.py::test_r18_r20_r25_live_cursor`：斷言新訂閱無重播資料時 `retry` 區塊必須在 `0.2s` 內到達；在極高負載或背景執行緒池排程延遲下，單次 SQLite 讀取加 ASGI 派發可能偶發超過 200 ms。
  - `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect`：等待 `/stats.subscribers` 歸零時使用無間隔的緊密輪詢迴圈持續發送 HTTP 請求，在慢速單核環境下可能增加伺服器負擔並拉長退訂觀測時間。

---

## 環境清理確認

- `./.t3-tmp/`：不存在（未建立／無殘留）。
- `install.db`（及 `-wal`／`-shm`）：工作目錄下無任何檔案。
- `git status --short` 與 `git diff` 實際輸出（皆為空）：

```text
$ git status --short && git diff && find . -maxdepth 3 \( -name "install.db*" -o -name ".t3-tmp" \)
(no output, exit code 0)
```
