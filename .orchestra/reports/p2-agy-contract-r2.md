CONTRACT CHECK: PASS

---

## 1. stubtest

將 [domain.pyi](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/domain.pyi) 複製到 `./.t25-tmp/stubs/app/domain.pyi` 並建立空檔 `./.t25-tmp/stubs/app/__init__.pyi` 後執行：

```text
$ MYPYPATH=./.t25-tmp/stubs uv run python -m mypy.stubtest app.domain
Success: no issues found in 1 module
```

結論：`app.domain` 與 [domain.pyi](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/domain.pyi) 完全相符，無任何錯誤。

---

## 2. `app.openapi()` vs `contracts/openapi.yaml`

以 `app.main.create_app(db_path="./.t25-tmp/openapi.db").openapi()` 產生 OpenAPI schema，與 [openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml) 逐項比對（共 8 個 path、9 個 operation）：

| path method | item | yaml | generated | verdict |
|---|---|---|---|---|
| `(root)` | `openapi` | `3.1.0` | `3.1.0` | `match` |
| `(root)` | `info.title` | `Install progress streaming` | `Install progress streaming` | `match` |
| `(root)` | `info.version` | `1.1.2` | `1.1.2` | `match` |
| `(root)` | paths & methods 集合 | 8 paths / 9 operations | 完全一致（8 paths / 9 operations） | `match` |
| `GET /install/plan` | parameters / requestBody | 無 | 無 | `match` |
| `GET /install/plan` | responses status & media | `200` `application/json` | `200` `application/json` | `match` |
| `GET /install/plan` | `200` schema (`Plan`) | `$ref: Plan`；`additionalProperties: false`、`required: [stages]`、inline stage/task | `$ref: Plan`；`additionalProperties: false`、`required: [stages]`、拆分為 `PlanStage` / `PlanTask` | `artefact` |
| `GET /install/plan` | `Plan.stages[]` (`PlanStage`) | `additionalProperties: false`、`required: [id, name, tasks]`、`id/name: string` | `additionalProperties: false`、`required: [id, name, tasks]`、`id/name: string` | `match` |
| `GET /install/plan` | `Plan.stages[].tasks[]` (`PlanTask`) | `additionalProperties: false`、`required: [id, name]`、`id/name: string` | `additionalProperties: false`、`required: [id, name]`、`id/name: string` | `match` |
| `GET /install/scenarios` | parameters / requestBody | 無 | 無 | `match` |
| `GET /install/scenarios` | responses status & media | `200` `application/json` | `200` `application/json` | `match` |
| `GET /install/scenarios` | `200` schema | `array` of `$ref: ScenarioInfo` | `array` of `$ref: ScenarioInfo` | `match` |
| `GET /install/scenarios` | `ScenarioInfo` fields/required/extra | `additionalProperties: false`、`required: [id, label, fail_task_id]`、`id/label: string` | 同左 | `match` |
| `GET /install/scenarios` | `ScenarioInfo.fail_task_id` | `type: [string, "null"]` | `anyOf: [{type: string}, {type: "null"}]` | `artefact` |
| `GET /install` | parameters / requestBody | 無 | 無 | `match` |
| `GET /install` | responses status & media | `200` `application/json`、`404` | `200` `application/json`、`404` | `match` |
| `GET /install` | `Snapshot` fields/required/extra | `additionalProperties: false`、`required: [run_id, scenario, status, last_seq, stages]`、`scenario: string`、`status: enum[running, succeeded, failed]` | 同左 | `match` |
| `GET /install` | `Snapshot.run_id`, `last_seq` | `type: integer, minimum: 1` | `type: integer, minimum: 1.0` | `artefact` |
| `GET /install` | `Snapshot.stages[]` | inline object | `$ref: StageOut`（`additionalProperties: false`、`required: [id, name, status, tasks]`、`id/name: string`、`status: $ref Status`） | `artefact` |
| `GET /install` | `Status` | `type: string, enum: [pending, running, succeeded, failed]` | `type: string, enum: [pending, running, succeeded, failed]` | `match` |
| `GET /install` | `Snapshot.stages[].tasks[]` | inline object | `$ref: TaskOut`（`additionalProperties: false`、`required: [id, name, status, error]`、`id/name: string`、`status: $ref Status`） | `artefact` |
| `GET /install` | `TaskOut.error` | `oneOf: [{type: "null"}, {$ref: TaskError}]` | `anyOf: [{$ref: TaskError}, {type: "null"}]` | `artefact` |
| `GET /install` | `TaskError` | `additionalProperties: false`、`required: [error_code, message, hint]`、三欄位皆 `type: string, minLength: 1` | 同左 | `match` |
| `POST /install` | parameters | 無 | 無 | `match` |
| `POST /install` | requestBody | `required: true`、`application/json`、`$ref: InstallRequest`（`required: [scenario]`、`scenario: string`、未設 `additionalProperties: false`） | 同左 | `match` |
| `POST /install` | responses status & media | `202` `application/json`、`409`、`422` | `202` `application/json`、`409`、`422` `application/json` | `match` |
| `POST /install` | `202` schema | inline object（`additionalProperties: false`、`required: [run_id, scenario]`、`scenario: string`） | `$ref: InstallStarted`（`additionalProperties: false`、`required: [run_id, scenario]`、`scenario: string`） | `artefact` |
| `POST /install` | `202` `run_id` | `type: integer, minimum: 1` | `type: integer, minimum: 1.0` | `artefact` |
| `POST /install` | `422` body | 僅 description | 自動產生 `$ref: HTTPValidationError` | `artefact` |
| `GET /install/logs` | query `run_id` | `required: true`、`type: integer, minimum: 1` | `required: true`、`type: integer, minimum: 1` | `match` |
| `GET /install/logs` | query `after` | `required: false`、`type: integer, minimum: 0, default: 0` | `required: false`、`type: integer, minimum: 0, default: 0` | `match` |
| `GET /install/logs` | query `until` | `required: false`、`anyOf: [{type: integer, minimum: 0}, {type: "null"}]` | `required: false`、`anyOf: [{type: integer, minimum: 0}, {type: "null"}]` | `match` |
| `GET /install/logs` | query `limit` | `required: false`、`type: integer, minimum: 1, maximum: 1000, default: 500` | `required: false`、`type: integer, minimum: 1, maximum: 1000, default: 500` | `match` |
| `GET /install/logs` | requestBody | 無 | 無 | `match` |
| `GET /install/logs` | responses status & media | `200` `application/json`、`404`、`409`、`422` | `200` `application/json`、`404`、`409`、`422` `application/json` | `match` |
| `GET /install/logs` | `200` schema | inline object（`additionalProperties: false`、`required: [run_id, items, next_after]`、`run_id: integer`、`items: array[$ref LogItem]`） | `$ref: LogPageOut`（同左欄位、required、extra） | `artefact` |
| `GET /install/logs` | `200` `next_after` | `type: [integer, "null"]` | `anyOf: [{type: integer}, {type: "null"}]` | `artefact` |
| `GET /install/logs` | `LogItem` fields/required/extra | `additionalProperties: false`、`required: [seq, stage_id, task_id, line_no, level, text, ts]`、`stage_id/task_id/text: string`、`level: enum[info, error]`、`ts: string, format: date-time` | 同左 | `match` |
| `GET /install/logs` | `LogItem.seq`, `line_no` | `type: integer, minimum: 1` | `type: integer, minimum: 1.0` | `artefact` |
| `GET /install/logs` | `422` body | 僅 description | 自動產生 `$ref: HTTPValidationError` | `artefact` |
| `GET /install/events` | query `last_event_id` | `required: false`、`type: string` | `required: false`、`anyOf: [{type: string}, {type: "null"}]` | `artefact` |
| `GET /install/events` | header `Last-Event-ID` | `required: false`、`type: string` | `required: false`、`anyOf: [{type: string}, {type: "null"}]` | `artefact` |
| `GET /install/events` | requestBody | 無 | 無 | `match` |
| `GET /install/events` | responses status & media | `200` `text/event-stream` (`type: string`)、`204`、`404`、`422` | `200` `text/event-stream` (`type: string`)、`204`、`404`、`422` | `match` |
| `GET /install/events` | `200` response headers | 宣告 `Cache-Control`、`X-Accel-Buffering` | 未宣告 response headers | `artefact` |
| `GET /stats` | parameters / requestBody | 無 | 無 | `match` |
| `GET /stats` | responses status & media | `200` `application/json` | `200` `application/json` | `match` |
| `GET /stats` | `200` schema | inline object（`additionalProperties: false`、`required: [subscribers]`） | `$ref: Stats`（`additionalProperties: false`、`required: [subscribers]`） | `artefact` |
| `GET /stats` | `Stats.subscribers` | `type: integer, minimum: 0` | `type: integer, minimum: 0.0` | `artefact` |
| `GET /health` | parameters / requestBody | 無 | 無 | `match` |
| `GET /health` | responses status & media | `200` `application/json` | `200` `application/json` | `match` |
| `GET /health` | `200` schema | inline object（`additionalProperties: false`、`required: [status]`、`status: {type: string, const: ok}`） | `$ref: Health`（`additionalProperties: false`、`required: [status]`、`status: {type: string, const: "ok"}`） | `artefact` |
| `GET /health` | `Health.status` | `type: string, const: ok` | `type: string, const: "ok"` | `match` |
| `GET /` | parameters / requestBody | 無 | 無 | `match` |
| `GET /` | responses status & media & schema | `200` `text/html` (`type: string`) | `200` `text/html` (`type: string`) | `match` |

結論：所有差異皆為 FastAPI/Pydantic 產出特性（`artefact`），0 項偏離。

---

## 3. E1 文字一致性（`openapi.yaml` vs SPEC R18）

[openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L130) 中 `GET /install/events` 的 `204` 說明：
> `"Run finished and the start point (r, n) has r = R and n >= L, the last seq (R18)."`

[openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L279-L282) 中 `x-sse-events.control.reset.when`：
> `Start point (r, n) with r != R (current run running or finished), or r = R and n > L (last seq) while the run is still running (R18). If the run has finished and r = R, n >= L, the response is 204, not reset.`

對照 [SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L140-L148) R18 表格：
- `r ≠ R`，或 `n > L`，且這一輪還在執行 → 送 `reset`
- `r ≠ R`，且這一輪已經結束 → 同上，送 `reset`
- `r = R`，這一輪已經結束，而且 `n ≥ L` → `204 No Content`
- 其他 → 送出 `seq > n` 的事件

結論：兩處文字與 SPEC R18 在所有 `(執行中/已結束, r vs R, n vs L)` 組合下完全一致。

---

## 4. 測試匯入範圍（`tests/`）

經靜態 AST 掃描 `tests/` 底下全部 13 個 `.py` 檔案，所有 `app` 相關匯入如下：

- [tests/public_api.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/tests/public_api.py) → `app.domain` → `PING_COMMENT`, `PLAN`, `RETRY_BLOCK`, `SCENARIOS`, `Event`, `EventType`, `JsonValue`, `ScriptStep`, `Snapshot`, `StageState`, `TaskError`, `TaskState`, `apply_event`, `format_event`, `format_event_id`, `initial_snapshot`, `parse_event_id`, `script_for`
- [tests/public_api.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/tests/public_api.py) → `app.main` → `create_app`

（其餘測試模組皆僅透過相對匯入 `.public_api` 使用上述公開介面；[tests/server.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/tests/server.py) 以子程序啟動 `uvicorn app.main:app`，符合 R1/R2 與 §10 規範。）

檢查結果：
- 來自 `app.main` 的匯入僅有 `create_app`（允許集合：`create_app`, `app`）。
- 來自 `app.domain` 的 18 個名稱全數宣告於 [domain.pyi](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/domain.pyi#L10-L35) 的 `__all__`。
- 無任何其他 `app.*` 模組匯入、無動態匯入（`importlib` / `__import__`）、無存取 `app.state` / 內部屬性。
- 無任何 `sqlite3` 匯入或直接讀寫 SQLite 檔案的存取（0 項違規）。

---

## 5. 測試收集（Collection）

```text
$ uv run pytest --collect-only -q -m "e2e or perf or not e2e"
tests/test_domain.py::test_r4_r5_tables
tests/test_domain.py::test_r6_script[success]
tests/test_domain.py::test_r6_script[network_unreachable]
tests/test_domain.py::test_r6_script[dependency_missing]
tests/test_domain.py::test_r6_script[checksum_mismatch]
tests/test_domain.py::test_r6_script[disk_full]
tests/test_domain.py::test_r6_script[permission_denied]
tests/test_domain.py::test_r6_script[service_timeout]
tests/test_domain.py::test_r6_r10_unknown_scenario
tests/test_domain.py::test_r9_ids
tests/test_domain.py::test_r10_every_transition[success]
tests/test_domain.py::test_r10_every_transition[network_unreachable]
tests/test_domain.py::test_r10_every_transition[dependency_missing]
tests/test_domain.py::test_r10_every_transition[checksum_mismatch]
tests/test_domain.py::test_r10_every_transition[disk_full]
tests/test_domain.py::test_r10_every_transition[permission_denied]
tests/test_domain.py::test_r10_every_transition[service_timeout]
tests/test_domain.py::test_r10_invalid_events
tests/test_domain.py::test_r10_payload_fields[run_started]
tests/test_domain.py::test_r10_payload_fields[stage_started]
tests/test_domain.py::test_r10_payload_fields[stage_succeeded]
tests/test_domain.py::test_r10_payload_fields[stage_failed]
tests/test_domain.py::test_r10_payload_fields[task_started]
tests/test_domain.py::test_r10_payload_fields[task_succeeded]
tests/test_domain.py::test_r10_payload_fields[task_failed]
tests/test_domain.py::test_r10_payload_fields[log]
tests/test_domain.py::test_r10_payload_fields[run_finished]
tests/test_domain.py::test_r10_unknown_identifiers[stage_started]
tests/test_domain.py::test_r10_unknown_identifiers[stage_succeeded]
tests/test_domain.py::test_r10_unknown_identifiers[stage_failed]
tests/test_domain.py::test_r10_unknown_identifiers[task_started]
tests/test_domain.py::test_r10_unknown_identifiers[task_succeeded]
tests/test_domain.py::test_r10_unknown_identifiers[task_failed]
tests/test_domain.py::test_r10_unknown_identifiers[log]
tests/test_domain.py::test_r10_inactive_targets
tests/test_domain.py::test_r10_terminal_states
tests/test_domain.py::test_r19_r20_r22_wire_format
tests/test_e2e.py::test_ac3_tcp_reconnect
tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect
tests/test_e2e.py::test_r24_live_shutdown[sigint]
tests/test_e2e.py::test_r24_live_shutdown[sigterm]
tests/test_e2e.py::test_r25_ac9_sigkill_recovery
tests/test_e2e.py::test_r26_html
tests/test_http.py::test_r9_r14_r15_r18_openapi
tests/test_http.py::test_r3_configuration_validation
tests/test_http.py::test_r2_r3_isolation
tests/test_http.py::test_r3_r14_log_interval
tests/test_http.py::test_r11_r12_r13_r15_r16_r17_empty
tests/test_http.py::test_r14_ac8_atomic_start
tests/test_http.py::test_r15_log_windows
tests/test_http.py::test_r3_r25_default_path
tests/test_perf.py::test_ac11_log_latency
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[success]
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[network_unreachable]
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[dependency_missing]
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[checksum_mismatch]
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[disk_full]
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[permission_denied]
tests/test_stream.py::test_ac4_ac5_ac7_complete_run[service_timeout]
tests/test_stream.py::test_ac1_ac2_midrun_sync[success]
tests/test_stream.py::test_ac1_ac2_midrun_sync[network_unreachable]
tests/test_stream.py::test_ac1_ac2_midrun_sync[dependency_missing]
tests/test_stream.py::test_ac1_ac2_midrun_sync[checksum_mismatch]
tests/test_stream.py::test_ac1_ac2_midrun_sync[disk_full]
tests/test_stream.py::test_ac1_ac2_midrun_sync[permission_denied]
tests/test_stream.py::test_ac1_ac2_midrun_sync[service_timeout]
tests/test_stream.py::test_r16_r20_excluded_responses
tests/test_stream.py::test_r18_ac6_cursor_and_reinstall
tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env]
tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[explicit]
tests/test_stream.py::test_r23_ac10_slow_subscriber[env]
tests/test_stream.py::test_r23_ac10_slow_subscriber[explicit]
tests/test_stream.py::test_r18_r20_r25_live_cursor
tests/test_stream.py::test_r20_replay_live_overlap

74 tests collected in 0.05s
```

分項計數驗證（`--collect-only`）：
- unmarked (`-m "not e2e and not perf"`): **67**
- `e2e` (`-m "e2e"`): **6**
- `perf` (`-m "perf"`): **1**
- 合計：**74**，無任何 collection 或 import 錯誤。

---

## 6. 全專案品質關卡（[AGENTS.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/AGENTS.md) §1，不含 pytest）

於清除 `./.t25-tmp/` 後執行：

```text
$ uv run ruff format --check .
29 files already formatted
```

```text
$ uv run ruff check .
All checks passed!
```

```text
$ uv run mypy
Success: no issues found in 12 source files
```

---

## 偏離項目（Deviations）

無（0 deviations）。

## `CONTRACT GAP` / `CONTRACT CONFLICT`

無。

## 清理與工作區狀態確認

- `./.t25-tmp/` 已刪除。
- `./install.db` 不存在。
- `git status --short` 為空。

```text
$ ls -ld ./.t25-tmp ./install.db 2>&1; echo "---git status---"; git status --short
ls: ./.t25-tmp: No such file or directory
ls: ./install.db: No such file or directory
---git status---
```
