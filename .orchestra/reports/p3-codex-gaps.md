新增 2 個測試節點，補上 R14、R15，並擴充既有節點的 R19、R26 檢查。三項離線檢查全部通過。更新後共有 **76 個節點，預設執行 75 個**。兩個已判定為實作問題的 R10 節點維持原樣。

修改的檔案為 `tests/test_http.py`、`tests/test_stream.py`、`tests/test_e2e.py`，另新增 `tests/page_script.py`。本次未讀取實作或執行 pytest。依驗證方原先約 30 秒及這次增加的等待量估算，正常無重試時約 **54 秒**；60 秒目標尚未實測。

## 1. 覆蓋缺口

| 需求 | 新增或變更的節點 | 判定與涵蓋範圍 |
|---|---|---|
| R14 | `tests/test_http.py::test_r14_nonlog_timing` | 新增。將 log 間隔設為 0.4 秒，依 ASGI 實際送出區塊的時間，逐段檢查起跑到首行 log、跨 task／stage 的相鄰非 log 事件，以及末行錯誤 log 到結束。每段零等待沿用 §10 的 0.2 秒容差。 |
| R13、R15 | `tests/test_stream.py::test_r15_midrun_default_until` | 新增。在同一輪執行中的兩個不同 log 序號省略 `until`。每次都用請求前後的快照確認 `last_seq` 相同，再用獨立 SSE 前綴核對全部項目與 `next_after`。若序號移動，改取下一個進度點。 |
| R18–R20、AC6、AC9 | `tests/test_stream.py::test_r16_r20_excluded_responses`、`tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` | R19 適用於 `200 retry`＋`reset`。兩個節點共用的 reset 驗證現在也檢查 `Content-Type`、`Cache-Control` 的 `no-cache` 與 `no-transform`、`X-Accel-Buffering: no`，以及客戶端接受壓縮時回應仍未壓縮。 |
| R25 | 不可確定性測試 | 公開介面無法把寫入端停在「run 執行中，但沒有 running task」的提交點。即使 SSE 或快照觀察到該狀態，終止程序前仍可能已寫入 `task_started`。 |
| R26 | `tests/test_e2e.py::test_r26_html` | 擴充回傳 HTML 的靜態檢查。辨識直接使用 `innerHTML`、字面模組載入及明確跨來源的 `fetch`。對能從原始碼判定的情形，檢查 `textContent`、`addEventListener`、`close`，並在事件註冊均為字面名稱時核對 `run_finished` 與 `reset`。迴圈、別名及共用關閉函式皆可使用。動態載入的實際目標、事件觸發後是否真的關閉，留給瀏覽器階段驗收。 |

## 2. 計時穩健性

| 節點 | 調整 | SPEC 界限 |
|---|---|---|
| `tests/test_e2e.py::test_ac3_tcp_reconnect` | log 間隔由 0.01 調為 0.015 秒。先確認快照仍有可選斷點才抽樣。錯過時等該輪結束並重建，每個斷線案例最多嘗試三輪。只有實際完成斷線、重連及 AC1 核對才計數。 | 維持 30 次。 |
| `tests/test_stream.py::test_ac1_ac2_midrun_sync`，全部 7 個情境 | 每輪十次同步都驗證 AC1。只有十次快照全部落在終態才重建該情境，最多三輪；同步內容錯誤會直接失敗。 | 保留 AC2 的 0.001 秒、固定種子、每情境十次同步，以及至少一次觀察到 `running`。 |
| `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` | 第二輪改用較長的 `checksum_mismatch`。取得 `running` 快照後，優先驗證同輪 `n > L` 的 reset，再查舊輪 log 及其他游標。 | AC6 的 1 秒與 §10 容差維持原值。 |
| `tests/test_stream.py::test_r20_replay_live_overlap` | 改用有 202 筆事件的 `success`。重播傳送受阻期間，仍須由獨立串流觀察到邊界後至少三筆事件，才解除阻塞並逐筆核對完整後綴。 | 維持原有重疊數量與完整性斷言。 |
| `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env]`、`[explicit]` | heartbeat 由 0.06 調為 0.3 秒，log 間隔由 0.25 調為 1.5 秒。仍須跨過資料事件並收到連續兩個 ping。 | 嚴格下限與 §10 上限公式均保留。新設定對應的上限為 1.1 秒。R24 的 ASGI 斷線基準仍為 1 秒。 |
| `tests/test_stream.py::test_r18_r20_r25_live_cursor` | 收到 `retry` 後再讀快照，確認游標仍在當下尾端。若等待逾時，只有獨立排程取樣也觀察到停頓才重試；測試必須取得一次合格的閒置樣本。 | `retry` 仍須在 0.2 秒內送出，後續第一筆仍須為游標加一。 |
| `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect` | 每次查 `/stats` 都核對 HTTP 狀態。仍未退訂時等 20 毫秒再查。 | R24 的 TCP 斷線基準仍為 2 秒，沿用 §10 容差。 |
| `tests/test_http.py::test_r3_r14_log_interval` | 從第二行 log 開始檢查累計下限，移除首行與零比較的無效斷言。 | 所有實際 log 間隔的界限維持原值。 |

## 3. 完整節點表

各表標題是節點的檔案前綴，與第一欄合起來即為完整 pytest node id。數量依測試宣告及參數靜態展開。

| marker | 節點數 |
|---|---:|
| none | 69 |
| e2e | 6 |
| perf | 1 |
| **合計** | **76** |

### `tests/test_domain.py::`　37 個

| 節點 | R / AC | marker |
|---|---|---|
| `test_r4_r5_tables` | R4、R5 | none |
| `test_r6_script[success]` | R6、R8、AC5 | none |
| `test_r6_script[network_unreachable]` | R6、R8、AC5 | none |
| `test_r6_script[dependency_missing]` | R6、R8、AC5 | none |
| `test_r6_script[checksum_mismatch]` | R6、R8、AC5 | none |
| `test_r6_script[disk_full]` | R6、R8、AC5 | none |
| `test_r6_script[permission_denied]` | R6、R8、AC5 | none |
| `test_r6_script[service_timeout]` | R6、R8、AC5 | none |
| `test_r6_r10_unknown_scenario` | R6、R10 | none |
| `test_r9_ids` | R9 | none |
| `test_r10_every_transition[success]` | R10 | none |
| `test_r10_every_transition[network_unreachable]` | R10 | none |
| `test_r10_every_transition[dependency_missing]` | R10 | none |
| `test_r10_every_transition[checksum_mismatch]` | R10 | none |
| `test_r10_every_transition[disk_full]` | R10 | none |
| `test_r10_every_transition[permission_denied]` | R10 | none |
| `test_r10_every_transition[service_timeout]` | R10 | none |
| `test_r10_invalid_events` | R10 | none |
| `test_r10_payload_fields[run_started]` | R8、R10 | none |
| `test_r10_payload_fields[stage_started]` | R8、R10 | none |
| `test_r10_payload_fields[stage_succeeded]` | R8、R10 | none |
| `test_r10_payload_fields[stage_failed]` | R8、R10 | none |
| `test_r10_payload_fields[task_started]` | R8、R10 | none |
| `test_r10_payload_fields[task_succeeded]` | R8、R10 | none |
| `test_r10_payload_fields[task_failed]` | R8、R10 | none |
| `test_r10_payload_fields[log]` | R8、R10 | none |
| `test_r10_payload_fields[run_finished]` | R8、R10 | none |
| `test_r10_unknown_identifiers[stage_started]` | R4、R10 | none |
| `test_r10_unknown_identifiers[stage_succeeded]` | R4、R10 | none |
| `test_r10_unknown_identifiers[stage_failed]` | R4、R10 | none |
| `test_r10_unknown_identifiers[task_started]` | R4、R10 | none |
| `test_r10_unknown_identifiers[task_succeeded]` | R4、R10 | none |
| `test_r10_unknown_identifiers[task_failed]` | R4、R10 | none |
| `test_r10_unknown_identifiers[log]` | R4、R10 | none |
| `test_r10_inactive_targets` | R10 | none |
| `test_r10_terminal_states` | R10 | none |
| `test_r19_r20_r22_wire_format` | R19、R20、R22 | none |

### `tests/test_http.py::`　9 個

| 節點 | R / AC | marker |
|---|---|---|
| `test_r9_r14_r15_r18_openapi` | R9、R14、R15、R18 | none |
| `test_r3_configuration_validation` | R2、R3 | none |
| `test_r2_r3_isolation` | R2、R3、R16、R25 | none |
| `test_r3_r14_log_interval` | R3、R14 | none |
| `test_r14_nonlog_timing` | R14 | none |
| `test_r11_r12_r13_r15_r16_r17_empty` | R11–R13、R15–R18 | none |
| `test_r14_ac8_atomic_start` | R13、R14、AC8 | none |
| `test_r15_log_windows` | R15 | none |
| `test_r3_r25_default_path` | R3、R25 | none |

### `tests/test_stream.py::`　23 個

| 節點 | R / AC | marker |
|---|---|---|
| `test_ac4_ac5_ac7_complete_run[success]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac4_ac5_ac7_complete_run[network_unreachable]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac4_ac5_ac7_complete_run[dependency_missing]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac4_ac5_ac7_complete_run[checksum_mismatch]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac4_ac5_ac7_complete_run[disk_full]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac4_ac5_ac7_complete_run[permission_denied]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac4_ac5_ac7_complete_run[service_timeout]` | R5–R8、R10、R13、R18–R21、AC4、AC5、AC7 | none |
| `test_ac1_ac2_midrun_sync[success]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_ac1_ac2_midrun_sync[network_unreachable]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_ac1_ac2_midrun_sync[dependency_missing]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_ac1_ac2_midrun_sync[checksum_mismatch]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_ac1_ac2_midrun_sync[disk_full]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_ac1_ac2_midrun_sync[permission_denied]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_ac1_ac2_midrun_sync[service_timeout]` | R13、R15、R18、R20、AC1、AC2 | none |
| `test_r15_midrun_default_until` | R13、R15 | none |
| `test_r16_r20_excluded_responses` | R16、R18–R20、AC9 | none |
| `test_r18_ac6_cursor_and_reinstall` | R14、R15、R18–R20、AC6、AC9 | none |
| `test_r16_r20_r22_r24_heartbeat_disconnect[env]` | R3、R16、R20、R22、R24、AC9 | none |
| `test_r16_r20_r22_r24_heartbeat_disconnect[explicit]` | R3、R16、R20、R22、R24、AC9 | none |
| `test_r23_ac10_slow_subscriber[env]` | R3、R16、R18、R20、R23、AC10 | none |
| `test_r23_ac10_slow_subscriber[explicit]` | R3、R16、R18、R20、R23、AC10 | none |
| `test_r18_r20_r25_live_cursor` | R7、R13、R15、R18、R20、R25 | none |
| `test_r20_replay_live_overlap` | R16、R20 | none |

### `tests/test_e2e.py::`　6 個

| 節點 | R / AC | marker |
|---|---|---|
| `test_ac3_tcp_reconnect` | R13、R15、R18、R20、AC1、AC3 | e2e |
| `test_ac9_tcp_headers_ping_disconnect` | R16–R20、R22、R24、AC9 | e2e |
| `test_r24_live_shutdown[sigint]` | R24、R25、AC9 | e2e |
| `test_r24_live_shutdown[sigterm]` | R24、R25、AC9 | e2e |
| `test_r25_ac9_sigkill_recovery` | R7、R8、R10、R13、R25、AC9 | e2e |
| `test_r26_html` | R26 | e2e |

### `tests/test_perf.py::`　1 個

| 節點 | R / AC | marker |
|---|---|---|
| `test_ac11_log_latency` | R20、R23、AC11 | perf |

## 4. 合約與依賴

| 類別 | 項目 |
|---|---|
| `CONTRACT GAP` | 無。R25 的復原結果已有定義，限制在於公開介面無法固定中斷點。 |
| `CONTRACT CONFLICT` | 無。 |
| `NEED DEPENDENCY` | 無。 |

## 5. 三項離線檢查輸出

沙箱無法使用預設 uv 快取。最終檢查使用可寫的暫存快取及 `UV_NO_SYNC=1`，沿用已同步的環境。三個指令的結束碼均為 `0`，`compileall -q` 成功時沒有輸出。

```text
$ uv run --offline ruff format --check tests
14 files already formatted

$ uv run --offline ruff check tests
All checks passed!

$ uv run --offline python -m compileall -q tests
```