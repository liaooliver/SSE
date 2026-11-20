`CONTRACT CHECK: FAIL (9 deviations)`

---

### 1. `app.domain` vs `contracts/domain.pyi`（`mypy.stubtest`）

將 [contracts/domain.pyi](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/domain.pyi) 複製至 `./.t25-tmp/stubs/app/domain.pyi`（搭配空的 `./.t25-tmp/stubs/app/__init__.pyi`）後執行：

```text
$ MYPYPATH=./.t25-tmp/stubs uv run python -m mypy.stubtest app.domain
Success: no issues found in 1 module
```

結果：**通過，無任何差異**。[app/domain.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/domain.py) 的所有公開符號與型別簽名皆與 [contracts/domain.pyi](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/domain.pyi) 一致。

---

### 2. `app.openapi()` vs `contracts/openapi.yaml`

以 `create_app(db_path="./.t25-tmp/openapi.db").openapi()` 產生 schema，與 [contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml) 逐項比對（[app/main.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/main.py)、[app/schemas.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/schemas.py)、[app/routers/install.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/routers/install.py)、[app/routers/system.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/routers/system.py)、[app/routers/page.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/routers/page.py)）：

| path method | item | yaml | generated | verdict |
|---|---|---|---|---|
| `(top-level)` | `info.title` | `"Install progress streaming"` | `"Install progress streaming"` | match |
| `(top-level)` | `info.version` | `"1.1.1"` | `"1.0.0"` | **impl deviates** |
| `GET /install/plan` | params / body | none | none | match |
| `GET /install/plan` | `200` media type & ref | `application/json`, `$ref: Plan` | `application/json`, `$ref: Plan` | match |
| `GET /install/plan` | `Plan` schema | `additionalProperties: false`, `required: [stages]`, inline stage (`id, name, tasks`) & task (`id, name`) | 拆成 `Plan` → `PlanStage` → `PlanTask`，欄位、型別、`required`、`additionalProperties: false` 全同 | match（拆分為元件屬 `artefact`） |
| `GET /install/scenarios` | params / body | none | none | match |
| `GET /install/scenarios` | `200` media type & schema | `application/json`, `array` of `$ref: ScenarioInfo` | `application/json`, `array` of `$ref: ScenarioInfo` | match |
| `GET /install/scenarios` | `ScenarioInfo` schema | `additionalProperties: false`, `required: [id, label, fail_task_id]`, `fail_task_id: {type: [string, "null"]}` | 同欄位與 `additionalProperties: false`；`fail_task_id` 為 `anyOf: [{type: string}, {type: "null"}]` | artefact（OAS 3.1 語意等價） |
| `GET /install` | params / body | none | none | match |
| `GET /install` | responses status & media | `200` (`application/json`, `$ref: Snapshot`), `404` | `200` (`application/json`, `$ref: Snapshot`), `404` | match |
| `GET /install` | `Snapshot` fields / required | `additionalProperties: false`, `required: [run_id, scenario, status, last_seq, stages]`, `status` enum `[running, succeeded, failed]` | 欄位名稱、型別、`required`、`enum`、`additionalProperties: false` 均一致 | match |
| `GET /install` | `Snapshot.run_id`, `Snapshot.last_seq` | `type: integer, minimum: 1` | `type: integer`（缺少 `minimum: 1`） | **impl deviates** |
| `GET /install` | `StageOut` / `TaskOut` / `Status` | inline stage & task，`Status` enum 4 值，`TaskOut.error` 為 `oneOf: [null, $ref: TaskError]` | 拆成 `StageOut` / `TaskOut`、`Status` enum 4 值；`error` 為 `anyOf: [$ref: TaskError, null]` | artefact（`anyOf` vs `oneOf` 互斥型別語意等價） |
| `GET /install` | `TaskError` schema | `additionalProperties: false`, `required: [error_code, message, hint]`, 三欄位皆 `minLength: 1` | 同欄位與 `additionalProperties: false`，但三欄位皆缺少 `minLength: 1` | **impl deviates** |
| `POST /install` | requestBody | `required: true`, `application/json`, `$ref: InstallRequest`（`required: [scenario]`, `scenario: string`, 未設 `additionalProperties: false`） | `required: true`, `application/json`, `$ref: InstallRequest`（結構全同） | match |
| `POST /install` | `202` media type & fields | `application/json`, inline object `additionalProperties: false`, `required: [run_id, scenario]`, `run_id: integer (minimum: 1)`, `scenario: string` | `application/json`, `$ref: InstallStarted`（`additionalProperties: false`, `required: [run_id, scenario]`），但 `run_id` 缺少 `minimum: 1` | **impl deviates** |
| `POST /install` | `409` | `409`（無 body schema） | `409`（無 body schema） | match |
| `POST /install` | `422` | `422`（無 body schema；`info.description` 註明 422 body 為 FastAPI 預設且非合約） | `422` + `application/json` `$ref: HTTPValidationError` | artefact |
| `GET /install/logs` | query `run_id` | `required: true`, `integer`, `minimum: 1` | `required: true`, `integer`, `minimum: 1` | match |
| `GET /install/logs` | query `after` | `required: false`, `integer`, `minimum: 0`, `default: 0` | `required: false`, `integer`, `minimum: 0`, `default: 0` | match |
| `GET /install/logs` | query `until` | `required: false`, `anyOf: [{integer, minimum: 0}, {null}]` | `required: false`, `anyOf: [{integer, minimum: 0}, {null}]` | match |
| `GET /install/logs` | query `limit` | `required: false`, `integer`, `minimum: 1`, `maximum: 1000`, `default: 500` | `required: false`, `integer`, `minimum: 1`, `maximum: 1000`, `default: 500` | match |
| `GET /install/logs` | `200` `LogPageOut` | `application/json`, `additionalProperties: false`, `required: [run_id, items, next_after]`, `next_after: {type: [integer, "null"]}` | `$ref: LogPageOut` 同結構，`next_after` 為 `anyOf: [{type: integer}, {type: "null"}]` | artefact（OAS 3.1 語意等價） |
| `GET /install/logs` | `LogItem` fields & constraints | `additionalProperties: false`, `required` 7 欄；`seq`/`line_no` 有 `minimum: 1`，`ts` 有 `format: date-time`，`level` enum `[info, error]` | 欄位、`required`、`level` enum 一致；但 `seq`/`line_no` 缺少 `minimum: 1`，`ts` 缺少 `format: date-time` | **impl deviates** |
| `GET /install/logs` | `404`, `409` | `404`, `409` | `404`, `409` | match |
| `GET /install/logs` | `422` | `422`（無 body schema） | `422` + `application/json` `$ref: HTTPValidationError` | artefact |
| `GET /install/events` | query `last_event_id` (`type`) | `required: false`, `{type: string}` | `required: false`, `anyOf: [{type: string}, {type: "null"}]` | artefact（FastAPI 對 `str \| None = None` 的輸出；對照 `until` 在 v1.1 B5 已對齊 YAML） |
| `GET /install/events` | query `last_event_id` (`pattern`) | 無 `pattern`（SPEC v1.1 A2 特地移除，因 R9 先 strip 空白再比對） | `pattern: "^[0-9]+\\.[0-9]+$"`（來自 `app/routers/install.py:162` `json_schema_extra`） | **impl deviates** |
| `GET /install/events` | header `Last-Event-ID` | `required: false`, `{type: string}` | `required: false`, `anyOf: [{type: string}, {type: "null"}]` | artefact（FastAPI 對 `str \| None = None` 的輸出） |
| `GET /install/events` | `200` media type & schema | `text/event-stream`, `{type: string}` | `text/event-stream`, `{type: string}` | match |
| `GET /install/events` | `200` response `headers` | 宣告 `Cache-Control`、`X-Accel-Buffering` (`const: "no"`) | 未在 OpenAPI `responses.200` 宣告 `headers` | artefact（FastAPI 不會從 `StreamingResponse` 子類自動推斷回應標頭） |
| `GET /install/events` | `204`, `404`, `422` | `204`, `404`, `422`（皆無 body schema） | `204`, `404`, `422`（皆無 body schema） | match |
| `GET /stats` | params / body | none | none | match |
| `GET /stats` | `200` media type & schema | `application/json`, `additionalProperties: false`, `required: [subscribers]`, `subscribers: {type: integer, minimum: 0}` | `$ref: Stats` 同結構，但 `subscribers` 缺少 `minimum: 0` | **impl deviates** |
| `GET /health` | params / body | none | none | match |
| `GET /health` | `200` media type & schema | `application/json`, `type: object`, `additionalProperties: false`, `required: [status]`, `properties: {status: {type: string, const: ok}}` | `application/json`, `type: object`, `additionalProperties: {type: string}`（無 `properties`、`required`、`const: ok`，且允許任意字串鍵） | **impl deviates**（因依 `AGENTS.md §4` 例外回傳 `dict[str, str]`；依 `AGENTS.md` 首段，衝突時以 `contracts/` 為準） |
| `GET /` | params / body / `200` | none；`200` `text/html` `{type: string}` | none；`200` `text/html` `{type: string}` | match |

---

### 3. 已知文字衝突裁決（R18 vs `openapi.yaml` `reset.when`）

#### 衝突是否存在
**是，確實存在 `CONTRACT CONFLICT`。**

#### 兩份文件原文引述
- **[docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L140-L148) R18**：
  > 設目前這一輪是 R、最後一筆是 L、起點是 `(r, n)`：
  > - `r ≠ R`，或 `n > L`，且這一輪還在執行 → 送出 `retry` 區塊，再送 `event: reset`（`data: {"run_id": R}`，**不帶 `id`**），然後關閉連線
  > - `r ≠ R`，且這一輪已經結束 → 同上，送 `reset`
  > - `r = R`，這一輪已經結束，而且 `n ≥ L` → `204 No Content`（依 WHATWG 規格，瀏覽器收到後會永久停止重連）
- **[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L276-L279) `x-sse-events.control.reset`**：
  ```yaml
  reset:
    wire: "event: reset\ndata: {\"run_id\": <current run_id>}\n\n"
    has_id: false
    when: start point belongs to another run or is ahead of the run (R18)
  ```
  （同檔第 130 行 `responses."204"`：`description: Run finished and the client already has the last event.`）

差異點：在 **「目前這一輪已經結束、`r = R` 且游標超前（`n > L`）」** 的情況下：
- **SPEC R18** 明確規定屬於 `r = R`，這一輪已經結束，而且 `n ≥ L` → 回 **`204 No Content`**（且將 `n > L` 送 `reset` 限定於「且這一輪還在執行」）。
- **`openapi.yaml` `reset.when`** 寫「`is ahead of the run (R18)`」卻**未限定**該輪必須仍在執行，與其所引用的 R18 文字矛盾。

#### 實作透過 HTTP 的實際行為觀測
對 `create_app(..., log_interval=0)` 執行一輪 `success` 至結束（`run_id=1, status="succeeded", last_seq=202`），另對 `log_interval=1.0` 執行中輪次（`run_id=1, status="running", last_seq=2`）發送 HTTP 請求：

```text
Finished run snapshot summary: {'run_id': 1, 'status': 'succeeded', 'last_seq': 202}
[finished n == L (query)] status=204 content-type=None body=''
[finished n > L (query)] status=204 content-type=None body=''
[finished n > L (header)] status=204 content-type=None body=''
[finished n < L (query)] status=200 content-type=text/event-stream; charset=utf-8 body='retry: 3000\n\nid: 1.202\nevent: run_finished\ndata: {"result":"succeeded"}\n\n'
[finished r != R (query)] status=200 content-type=text/event-stream; charset=utf-8 body='retry: 3000\n\nevent: reset\ndata: {"run_id": 1}\n\n'
Running run snapshot summary: {'run_id': 1, 'status': 'running', 'last_seq': 2}
[running n > L (query)] status=200 content-type=text/event-stream; charset=utf-8 body='retry: 3000\n\nevent: reset\ndata: {"run_id": 1}\n\n'
```

結論：**實作遵循 SPEC R18**——已結束的輪次在 `r = R` 且 `n ≥ L`（含 `n > L`，無論 query 或 `Last-Event-ID` header）一律回 `204 No Content`；僅在執行中輪次遇到 `n > L`（或任何時候 `r ≠ R`）才送 `reset`。

---

### 4. 測試匯入範圍檢查（`tests/`）

AST 掃描 `tests/` 底下全部 13 個 `.py` 檔案後，所有 `app` 匯入清冊如下（其餘測試檔僅透過相對匯入自 `tests/public_api.py` 取得公開介面）：

- [tests/public_api.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/tests/public_api.py) → `app.domain` → `PING_COMMENT`, `PLAN`, `RETRY_BLOCK`, `SCENARIOS`, `Event`, `EventType`, `JsonValue`, `ScriptStep`, `Snapshot`, `StageState`, `TaskError`, `TaskState`, `apply_event`, `format_event`, `format_event_id`, `initial_snapshot`, `parse_event_id`, `script_for`（18 個名稱，**全部**列於 [contracts/domain.pyi](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/domain.pyi) `__all__`）
- [tests/public_api.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/tests/public_api.py) → `app.main` → `create_app`

補充確認：
- [tests/server.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/tests/server.py) 以子程序執行 `uvicorn app.main:app`（符合 R1／R2／AC9）。
- 無任何 `app.*` 內部模組匯入、無動態匯入（`importlib` / `__import__`）、無存取 `app.state` 或內部屬性。
- 無任何 `sqlite3` 匯入、SQL 查詢或直接讀寫 `.db` 檔案；資料庫路徑僅透過 `create_app(db_path=...)` 與 `SSE_DB_PATH` 環境變數（含子程序重啟）傳遞。

結果：**通過，0 項違規**。

---

### 5. Pytest 收集檢查（Collection）

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

Marker 分佈確認：
- 未標記（`-m "not e2e and not perf"`）：**67**
- `e2e`（`-m "e2e"`）：**6**
- `perf`（`-m "perf"`）：**1**
- 合計：**74** 個測試節點，無任何 collection / import 錯誤，與測試作者預期完全相符。

---

### 偏差清單（共 9 項）

1. `[impl]` [app/main.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/main.py#L31) (`info.version`) — expected `"1.1.1"` ([contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L4), [docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L1) v1.1.1) — actual `"1.0.0"`.
2. `[impl]` [app/routers/install.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/routers/install.py#L161-L163) (`GET /install/events` query `last_event_id`) — expected schema 不含 `pattern`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L104-L111)、[docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L247) v1.1 A2 / R9 / R18） — actual 產出 `"pattern": "^[0-9]+\\.[0-9]+$"`.
3. `[impl]` [app/routers/system.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/routers/system.py#L17-L20) (`GET /health` `200` response schema) — expected `{type: object, additionalProperties: false, required: [status], properties: {status: {type: string, const: ok}}}`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L156-L162)） — actual `{type: object, additionalProperties: {type: string}}`（缺少 `properties.status`、`const: ok`、`required: [status]` 與 `additionalProperties: false`）.
4. `[impl]` [app/schemas.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/schemas.py#L94-L98) (`InstallStarted.run_id`, `POST /install` `202`) — expected `minimum: 1`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L61)） — actual `{type: integer}`（無 `minimum`）.
5. `[impl]` [app/schemas.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/schemas.py#L71-L78) (`Snapshot.run_id`, `Snapshot.last_seq`) — expected 兩欄位皆 `minimum: 1`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L228-L231)） — actual 皆為 `{type: integer}`（無 `minimum`）.
6. `[impl]` [app/schemas.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/schemas.py#L45-L50) (`TaskError.error_code`, `message`, `hint`) — expected 三欄位皆 `minLength: 1`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L220-L222)） — actual 皆為 `{type: string}`（無 `minLength`）.
7. `[impl]` [app/schemas.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/schemas.py#L101-L110) (`LogItem.seq`, `line_no`, `ts`) — expected `seq` 與 `line_no` 為 `minimum: 1`、`ts` 為 `format: date-time`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L261-L267)） — actual `seq` 與 `line_no` 無 `minimum`、`ts` 無 `format: date-time`.
8. `[impl]` [app/schemas.py](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/schemas.py#L121-L124) (`Stats.subscribers`, `GET /stats` `200`) — expected `minimum: 0`（[contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L147)） — actual `{type: integer}`（無 `minimum`）.
9. `[yaml]` [contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L276-L279) (`x-sse-events.control.reset.when`) — expected 依 [docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L145-L147) R18 將游標超前（`n > L`）送 `reset` 限定於「這一輪還在執行」 — actual 寫成 `"start point belongs to another run or is ahead of the run (R18)"`，未排除已結束輪次.

---

### `CONTRACT GAP` / `CONTRACT CONFLICT`

- `CONTRACT CONFLICT`: [docs/SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/docs/SPEC.md#L140-L148) R18 規定已結束輪次且 `r = R, n ≥ L`（含游標超前 `n > L`）應回 `204 No Content`，僅執行中輪次的 `n > L` 送 `reset`；但 [contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L276-L279) `x-sse-events.control.reset.when` 將 `"is ahead of the run (R18)"` 泛指為送 `reset` 而未限定輪次仍在執行。
- `CONTRACT CONFLICT`（規範與合約間衝突）: [AGENTS.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/AGENTS.md) §4 允許 `/health` 回傳裸 `dict[str, str]`，與 [contracts/openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/contracts/openapi.yaml#L156-L162) 對 `GET /health` `200` 定義的嚴格物件 schema（`additionalProperties: false`, `required: [status]`, `status: const "ok"`）衝突；依 `AGENTS.md` 頂部規則，兩者衝突時以 `contracts/openapi.yaml` 為準。
- `CONTRACT GAP`: 無。

---

### 清理與工作樹狀態確認

`./.t25-tmp/` 已刪除，且 `git status --short` 無任何變更：

```text
$ rm -rf ./.t25-tmp && test ! -e ./.t25-tmp && echo "t25-tmp deleted" && git status --short
t25-tmp deleted
```
