T5.1: ACCEPT

---

## A. Clean environment

1. 開始前確認 `.venv/` 不存在（`test ! -e .venv` 通過）。
2. 執行 `uv sync --locked` 成功（exit code `0`），建立 `.venv/` 並安裝 37 個套件。
3. Python 版本（`uv run python --version`）：`Python 3.13.9`。
4. `git diff --stat uv.lock`：空輸出（[uv.lock](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/uv.lock) 無任何變更）。

---

## B. AC12：品質關卡（[AGENTS.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/AGENTS.md) §1）

依序執行五個指令，全數通過（exit code 皆為 `0`）：

1. `uv sync`（exit status: `0`）
   ```text
   Resolved 39 packages in 6ms
   Audited 37 packages in 1ms
   ```
2. `uv run ruff format --check .`（exit status: `0`）
   ```text
   30 files already formatted
   ```
3. `uv run ruff check .`（exit status: `0`）
   ```text
   All checks passed!
   ```
4. `uv run mypy`（exit status: `0`）
   ```text
   Success: no issues found in 12 source files
   ```
5. `uv run pytest`（exit status: `0`）
   ```text
   tests/test_domain.py .....................................               [ 49%]
   tests/test_e2e.py ......                                                 [ 57%]
   tests/test_http.py .........                                             [ 69%]
   tests/test_stream.py .......................                             [100%]

   ====================== 75 passed, 1 deselected in 55.13s =======================
   ```

### `app/` 下 `# noqa` 與 `# type: ignore` 掃描結果

- `# type: ignore`：0 處。
- `# noqa`：共 5 處，全數符合 `AGENTS.md` §1（同行皆附錯誤代碼 `RUF001` 與保留 SPEC R5 全形標點之理由）：
  - [app/domain.py:202](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/domain.py#L202) — 符合（含錯誤代碼與同行理由）
  - [app/domain.py:212](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/domain.py#L212) — 符合（含錯誤代碼與同行理由）
  - [app/domain.py:220](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/domain.py#L220) — 符合（含錯誤代碼與同行理由）
  - [app/domain.py:229](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/domain.py#L229) — 符合（含錯誤代碼與同行理由）
  - [app/domain.py:239](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/domain.py#L239) — 符合（含錯誤代碼與同行理由）

---

## C. Full test suite

### 1. 預設測試組（`uv run pytest -q -rA --durations=5`，共執行 3 次）

- **Run 1**（exit status: `0`）：`75 passed, 1 deselected in 51.28s`
  - Slowest 5：`test_ac3_tcp_reconnect` (12.54s)、`test_r14_nonlog_timing` (9.29s)、`test_r18_ac6_cursor_and_reinstall` (5.62s)、`test_r3_r14_log_interval` (3.71s)、`test_r20_replay_live_overlap` (3.49s)
- **Run 2**（exit status: `0`）：`75 passed, 1 deselected in 51.07s`
  - Slowest 5：`test_ac3_tcp_reconnect` (12.41s)、`test_r14_nonlog_timing` (9.28s)、`test_r18_ac6_cursor_and_reinstall` (5.61s)、`test_r3_r14_log_interval` (3.70s)、`test_r20_replay_live_overlap` (3.48s)
- **Run 3**（exit status: `0`）：`75 passed, 1 deselected in 51.09s`
  - Slowest 5：`test_ac3_tcp_reconnect` (12.44s)、`test_r14_nonlog_timing` (9.28s)、`test_r18_ac6_cursor_and_reinstall` (5.61s)、`test_r3_r14_log_interval` (3.69s)、`test_r20_replay_live_overlap` (3.46s)
- 節點數：每次皆為 75（符合預期 75）。
- 失敗節點：無。Flakiness：無。

### 2. 效能測試（`uv run pytest -q -rA -m perf`，共執行 3 次，AC11）

- **Run 1**（exit status: `0`）：`PASSED tests/test_perf.py::test_ac11_log_latency` — `1 passed, 75 deselected in 1.39s`
- **Run 2**（exit status: `0`）：`PASSED tests/test_perf.py::test_ac11_log_latency` — `1 passed, 75 deselected in 1.38s`
- **Run 3**（exit status: `0`）：`PASSED tests/test_perf.py::test_ac11_log_latency` — `1 passed, 75 deselected in 1.39s`
- 失敗節點：無。Flakiness：無。

### 3. 失敗分類

無任何失敗（0 `IMPL BUG`、0 `TEST BUG`、0 `SPEC AMBIGUOUS`）。

---

## D. AC coverage map

依據 [docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md) §9 驗收條件與測試套件對照：

| AC | node ids | passed? | uncovered part |
|---|---|---|---|
| AC1 重建一致 | `tests/test_stream.py::test_ac1_ac2_midrun_sync[success]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[network_unreachable]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[dependency_missing]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[checksum_mismatch]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[disk_full]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[permission_denied]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[service_timeout]`, `tests/test_e2e.py::test_ac3_tcp_reconnect`（輔助邊界：`tests/test_stream.py::test_r20_replay_live_overlap`, `tests/test_stream.py::test_r18_r20_r25_live_cursor`） | Yes (3/3) | 無 |
| AC2 中途進入 | `tests/test_stream.py::test_ac1_ac2_midrun_sync[success]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[network_unreachable]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[dependency_missing]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[checksum_mismatch]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[disk_full]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[permission_denied]`, `tests/test_stream.py::test_ac1_ac2_midrun_sync[service_timeout]` | Yes (3/3) | 無 |
| AC3 斷線重連 | `tests/test_e2e.py::test_ac3_tcp_reconnect` | Yes (3/3) | 無 |
| AC4 劇本一致 | `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[success]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[network_unreachable]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[dependency_missing]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[checksum_mismatch]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[disk_full]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[permission_denied]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[service_timeout]`（純領域對應：`tests/test_domain.py::test_r6_script[...]` × 7） | Yes (3/3) | 無 |
| AC5 失敗停止 | `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[network_unreachable]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[dependency_missing]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[checksum_mismatch]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[disk_full]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[permission_denied]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[service_timeout]`（純領域對應：`tests/test_domain.py::test_r4_r5_tables`, `tests/test_domain.py::test_r6_script[...]` × 6） | Yes (3/3) | 無 |
| AC6 換輪 | `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`（輔助：`tests/test_stream.py::test_r16_r20_excluded_responses`） | Yes (3/3) | 依 SPEC §10 時間上限放寬規則（預期 ×3 + 200 ms），`reset` 逾時設為 3.2 秒而非嚴格 1 秒；其餘項目全數覆蓋 |
| AC7 結束 | `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[success]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[network_unreachable]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[dependency_missing]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[checksum_mismatch]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[disk_full]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[permission_denied]`, `tests/test_stream.py::test_ac4_ac5_ac7_complete_run[service_timeout]`（輔助：`tests/test_stream.py::test_r16_r20_excluded_responses`） | Yes (3/3) | 無 |
| AC8 並行 | `tests/test_http.py::test_r14_ac8_atomic_start` | Yes (3/3) | 無 |
| AC9 SSE 共通 | `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect`, `tests/test_e2e.py::test_r24_live_shutdown[sigint]`, `tests/test_e2e.py::test_r24_live_shutdown[sigterm]`, `tests/test_e2e.py::test_r25_ac9_sigkill_recovery`, `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env]`, `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[explicit]`, `tests/test_stream.py::test_r16_r20_excluded_responses`, `tests/test_domain.py::test_r19_r20_r22_wire_format`, `tests/test_http.py::test_r2_r3_isolation` | Yes (3/3) | 已宣告不自動測試：R25 無 `running` task 時的復原、SQLite WAL 模式與 event loop 不阻塞、R22 資料與 heartbeat 同時到期的平手條件（R24 時限依 SPEC §10 放寬為預期 ×3 + 200 ms） |
| AC10 慢速訂閱者 | `tests/test_stream.py::test_r23_ac10_slow_subscriber[env]`, `tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]` | Yes (3/3) | 無 |
| AC11 效能（`perf`） | `tests/test_perf.py::test_ac11_log_latency` | Yes (3/3) | 無 |
| AC12 品質關卡 | 無單一 pytest 節點；由 B 節五項品質關卡指令（含 75 項預設測試）覆蓋（R26 靜態頁檢核為 `tests/test_e2e.py::test_r26_html`） | Yes（B 節 5/5、C 節 3/3） | 已宣告不自動測試之瀏覽器行為 R27 與 C1–C4（已於 Phase 4 實機瀏覽器完成驗收） |

---

## E. v1.1.3 consistency（R27「錯誤與重試」）

檢視 [docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L177) 的 R27「錯誤與重試」與 `GET /` 所提供之頁面 [app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html)（由 [app/routers/page.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/routers/page.py) 直接回傳）：

- **(a) `OK`**：在同步流程中，呼叫 `GET /install` 若遇到非 `404` 的非成功回應、網路錯誤或 JSON 解析失敗，或分批呼叫 `GET /install/logs` 若遇到 `409` 以外的非成功回應、網路錯誤或 JSON 解析失敗，皆會拋出例外並由同步流程的錯誤處理區塊捕獲；在確認同步世代仍為最新後，透過排程重試函式在 `#run-status` 顯示錯誤訊息，並於 3 秒後重新執行同步流程。（`GET /install` 回 `404` 則依 R27 僅重置為空狀態；`GET /install/logs` 回 `409` 則依 R27 立即重跑同步流程。）
- **(b) `OK`**：`EventSource` 的 `error` 事件監聽器會先確認該連線仍為目前作用中的連線，並檢查目前輪次狀態是否仍為 `running`。當 `readyState` 為 `CLOSED` 時，會清除目前連線參考，且若該輪仍在執行中，則呼叫排程重試函式在 `#run-status` 顯示錯誤，並於 3 秒後重新執行同步流程（若該輪已結束，如收到 `204`，則不重試）。
- **(c) `OK`**：當該輪仍在執行中、`EventSource` 觸發 `error` 事件且 `readyState` 不是 `CLOSED`（依 WHATWG `EventSource` 規格即為瀏覽器自動重連中的 `CONNECTING` 狀態）時，僅在 `#run-status` 顯示連線中斷與重連中的錯誤訊息，不關閉連線、不設定重試計時器，也不重新執行同步流程；待瀏覽器自動重連成功並觸發 `open` 事件時，再恢復顯示目前輪次狀態。

### 版本標籤一致性

- [docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L1) 標題：`v1.1.3`（一致）。
- [contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L4) `info.version`：`1.1.2`（一致）。
- 應用程式 OpenAPI `info.version`（由 `create_app().openapi()["info"]["version"]` 驗證）：`1.1.2`（一致，符合 SPEC 附錄所述 v1.1.3 僅更新 R27 敘述、合約維持 `1.1.2`）。

---

## F. Clean-copy hygiene

- `git status --short --ignored` 僅列出 `.gitignore` 所忽略的工具輸出與快取（無任何已追蹤檔案變更或未忽略的新增檔案）：
  ```text
  !! .mypy_cache/
  !! .pytest_cache/
  !! .ruff_cache/
  !! .venv/
  !! app/__pycache__/
  !! app/routers/__pycache__/
  !! tests/__pycache__/
  ```
- `find . -name "install.db*" -not -path "./.git/*"`：空輸出，目錄中不存在任何 `install.db`。
- `./.t5-tmp/`：不存在。
- `uvicorn` 程序檢查（`pgrep -fl uvicorn`）：無任何 `uvicorn` 程序仍在執行。

---

## 不確定項目

無實質阻礙或偏差；僅備註兩點細節供紀錄：
1. 在 E 節 (c) 中，頁面 `EventSource` 的 `error` 監聽器係以 `readyState === CLOSED` 與其 `else` 分支區分，並未顯式比對 `readyState === CONNECTING`；依 WHATWG `EventSource` 規範，`error` 事件僅於 `CONNECTING` 或 `CLOSED` 時觸發，故實際行為與 R27 完全一致。
2. 在 D 節 AC5 中，SPEC 文字提及「`task_failed.data` 的四個字串欄位都不是空的」，而 R8 定義 `task_failed` 共有五個字串欄位（含 `stage_id`）；測試透過完整劇本比對核對全部五欄，並顯式斷言其餘四欄非空，無覆蓋缺漏。
