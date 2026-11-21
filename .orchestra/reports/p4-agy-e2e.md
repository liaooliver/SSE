I am running the first batch of exploratory E2E checks against a real `uvicorn` instance; waiting for completion before inspecting the results and running the remaining checks.
Exploratory E2E Part 1 (Checks 1, 2, 3, 4, 9) has completed; waiting for Part 2 (Checks 5, 6, 7, 8, 10) to finish before reviewing all outputs and running performance tests.
T4: PASS

---

## T4.1 自動化 E2E 測試

執行指令：`uv run pytest -q -rA -m e2e`（連續執行 3 次）

| Run | Summary | Failing nodes | Flakiness |
|---|---|---|---|
| 1 | `6 passed, 70 deselected in 16.77s` | 無 | 無 |
| 2 | `6 passed, 70 deselected in 15.67s` | 無 | 無 |
| 3 | `6 passed, 70 deselected in 15.61s` | 無 | 無 |

3 次皆全數通過的節點：
- `tests/test_e2e.py::test_ac3_tcp_reconnect`
- `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect`
- `tests/test_e2e.py::test_r24_live_shutdown[sigint]`
- `tests/test_e2e.py::test_r24_live_shutdown[sigterm]`
- `tests/test_e2e.py::test_r25_ac9_sigkill_recovery`
- `tests/test_e2e.py::test_r26_html`

---

## T4.2 探索性 E2E（對真實 `uv run uvicorn app.main:app --host 127.0.0.1 --port <p>`）

所有測試伺服器均僅綁定 `127.0.0.1:18101–18117`，並透過 `SSE_DB_PATH` 指向 `./.t4-tmp/*.db`。

| # | check | R/AC | verdict |
|---|---|---|---|
| 1 | Plain endpoints & invalid inputs | R11–R17, R26 | `OK` |
| 2 | Live stream with 3 concurrent `curl -N` | R16, R19, R20, R21 | `OK` |
| 3 | Reconnect & R18 edge cases | R9, R18, R20, AC3 | `OK` |
| 4 | Concurrency (10 parallel `POST /install`) | R14, AC8 | `OK` |
| 5 | Heartbeat (`: ping`) | R22 | `OK` |
| 6 | Client disconnect (`/stats.subscribers` recovery ≤ 2 s) | R16, R24 | `OK` |
| 7 | Graceful shutdown (`SIGINT` & `SIGTERM`) + restart recovery | R24, R25, AC9 | `OK` |
| 8 | Crash recovery (`SIGKILL`) + `run_id` monotonic | R14, R25 | `OK` |
| 9 | Logs paging (running & finished) | R15 | `OK` |
| 10 | Slow subscriber (real TCP loopback) | R23 | `OK`（無法於 macOS loopback TCP 穩定觸發，見下方說明） |

### 1. Plain endpoints & invalid inputs（R11–R17, R26）

啟動：`SSE_DB_PATH=.t4-tmp/c1.db SSE_LOG_INTERVAL=0.005 uv run uvicorn app.main:app --host 127.0.0.1 --port 18101`

```text
$ curl -i -sS http://127.0.0.1:18101/health
HTTP/1.1 200 OK
content-type: application/json

{"status":"ok"}

$ curl -i -sS http://127.0.0.1:18101/install/plan
HTTP/1.1 200 OK
content-type: application/json

{"stages":[{"id":"prepare","name":"準備環境","tasks":[{"id":"check_os","name":"檢查作業系統"},{"id":"check_disk","name":"檢查磁碟空間"},{"id":"check_deps","name":"檢查相依套件"}]},{"id":"download","name":"下載套件","tasks":[{"id":"fetch_manifest","name":"取得套件清單"},{"id":"download_packages","name":"下載套件"},{"id":"verify_checksum","name":"驗證雜湊"}]},{"id":"install","name":"安裝","tasks":[{"id":"extract","name":"解壓縮"},{"id":"copy_files","name":"複製檔案"},{"id":"register","name":"註冊元件"}]},{"id":"configure","name":"設定","tasks":[{"id":"write_config","name":"寫入設定"},{"id":"set_permissions","name":"設定權限"},{"id":"start_service","name":"啟動服務"}]}]}

$ curl -i -sS http://127.0.0.1:18101/install/scenarios
HTTP/1.1 200 OK
content-type: application/json

[{"id":"success","label":"全部成功","fail_task_id":null},{"id":"network_unreachable","label":"無法連線到套件伺服器","fail_task_id":"fetch_manifest"},{"id":"dependency_missing","label":"缺少相依套件","fail_task_id":"check_deps"},{"id":"checksum_mismatch","label":"套件雜湊值不符","fail_task_id":"verify_checksum"},{"id":"disk_full","label":"磁碟空間不足","fail_task_id":"copy_files"},{"id":"permission_denied","label":"權限不足","fail_task_id":"set_permissions"},{"id":"service_timeout","label":"服務啟動逾時","fail_task_id":"start_service"}]

$ curl -i -sS http://127.0.0.1:18101/install
HTTP/1.1 404 Not Found
{"detail":"No run has been started on this database"}

$ curl -i -sS http://127.0.0.1:18101/stats
HTTP/1.1 200 OK
{"subscribers":0}

$ curl -i -sS http://127.0.0.1:18101/install/events
HTTP/1.1 404 Not Found
{"detail":"No run exists"}

$ curl -i -sS http://127.0.0.1:18101/
HTTP/1.1 200 OK
content-length: 19938
content-type: text/html; charset=utf-8
# 檢查結果：必要元素 id (#scenario, #install-btn, #run-status, #stage-list, #task-list, #follow-btn) 全齊、無外部 URL、無 innerHTML、使用 textContent 與 addEventListener
```

無效輸入與邊界（`curl -i -sS`）：
- `GET /stats`（在 `404 /install/events` 之後）：`200 {"subscribers":0}`
- `GET /install/logs?run_id=1`（尚無任何一輪）：`404 Not Found`
- `POST /install`：
  - `{}` → `HTTP/1.1 422 Unprocessable Content`
  - `{"scenario": 123}` → `HTTP/1.1 422 Unprocessable Content`
  - `{"scenario": "does_not_exist"}` → `HTTP/1.1 422 Unprocessable Content`
  - `{not-json` → `HTTP/1.1 422 Unprocessable Content`
  - `{"scenario":"dependency_missing","extra_field":42}`（額外欄位依 R14 忽略）→ `HTTP/1.1 202 Accepted` `{"run_id":1,"scenario":"dependency_missing"}`
- `GET /install/logs`：
  - 缺 `run_id` / `run_id=0` / `limit=0` / `limit=1001` / `limit=abc` / `after=-1` / `until=-1` → 皆 `HTTP/1.1 422 Unprocessable Content`
  - `GET /install/logs?run_id=999`（非目前輪次）→ `HTTP/1.1 409 Conflict` `{"detail":"run_id is not the current run"}`

### 2. Live stream with `curl -N`（R16, R19, R20, R21）

啟動：`SSE_DB_PATH=.t4-tmp/c2.db SSE_LOG_INTERVAL=0.02 uv run uvicorn app.main:app --host 127.0.0.1 --port 18102`  
執行：`POST /install {"scenario":"success"}` → `202 {'run_id': 1, 'scenario': 'success'}`，於不同時間點（t=0s、0.5s、1.2s）併行開啟 3 個 `curl -i -N -sS -H "Accept-Encoding: gzip" http://127.0.0.1:18102/install/events`。

```text
HTTP/1.1 200 OK
date: Sat, 21 Nov 2026 01:54:14 GMT
server: uvicorn
cache-control: no-cache, no-transform
x-accel-buffering: no
content-type: text/event-stream; charset=utf-8
transfer-encoding: chunked

retry: 3000

id: 1.1
event: run_started
data: {"run_id":1,"scenario":"success"}

id: 1.2
event: stage_started
data: {"stage_id":"prepare"}
...
id: 1.201
event: stage_succeeded
data: {"stage_id":"configure"}

id: 1.202
event: run_finished
data: {"result":"succeeded"}
```

觀察：
- R19 header 全部符合且無 `Content-Encoding` 壓縮（即使送 `Accept-Encoding: gzip`）。
- 3 個客戶端皆首塊為 `retry: 3000`、收到 202 筆事件、`id` 為 `1.1..1.202` 連續無重複、於 `run_finished` 後正常結束（exit code `0`）。
- `/stats` 變化：`1 → 2 → 3 → 0`。

### 3. Reconnect & R18 cases（R9, R18, R20, AC3）

啟動：`SSE_DB_PATH=.t4-tmp/c3.db SSE_LOG_INTERVAL=0.025 uv run uvicorn app.main:app --host 127.0.0.1 --port 18103`  
先執行 Run 1（`network_unreachable` 完成，`run_id=1, last_seq=41`），再開始 Run 2（`success`, `run_id=2`）。於第 38 筆事件（`id: 2.38`）強制切斷 `curl -N`，隨即以兩種方式重連：
- Header：`curl -i -N -sS -H "Last-Event-ID: 2.38" http://127.0.0.1:18103/install/events`
  → `first_block='retry: 3000'`，續傳 `39..202`（164 筆），與前段合併剛好 `1..202`、0 缺漏、0 重複。
- Query 含前後空白：`curl -i -N -sS "http://127.0.0.1:18103/install/events?last_event_id=%202.38%20"`
  → `first_block='retry: 3000'`，續傳 `39..202`（164 筆），與前段合併剛好 `1..202`、0 缺漏、0 重複。

R18 邊界案例實測輸出（節錄）：

```text
# 執行中 n > L (Last-Event-ID: 2.9999) 與舊輪 id (Last-Event-ID: 1.1) — 兩者皆回 retry + reset（無 id）並關閉：
HTTP/1.1 200 OK
cache-control: no-cache, no-transform
x-accel-buffering: no
content-type: text/event-stream; charset=utf-8

retry: 3000

event: reset
data: {"run_id": 2}

# 結束後 (L=202)：n = L (2.202) 與 n > L (2.212)，header 與 query 皆回：
HTTP/1.1 204 No Content

# 結束後舊輪 id (Last-Event-ID: 1.1)：回 retry + reset（無 id）並關閉
retry: 3000

event: reset
data: {"run_id": 2}

# 結束後 n < L (Last-Event-ID: 1.200，於另輪驗證)：續傳 201..202 後關閉
retry: 3000

id: 1.201
event: stage_succeeded
data: {"stage_id":"configure"}

id: 1.202
event: run_finished
data: {"result":"succeeded"}

# 不合法 query (?last_event_id=abc / 2.1.0 / 空字串)：
HTTP/1.1 422 Unprocessable Content
{"detail":"Malformed last_event_id"}

# 不合法 Last-Event-ID header（單獨帶）：視同沒帶，從 seq=1 重播 2.1..2.202 (HTTP 200)
# 不合法 Last-Event-ID header + 合法 query (?last_event_id=2.202)：退回使用 query，回 HTTP 204 No Content
# 所有檢查後 GET /stats -> {"subscribers": 0}
```

### 4. Concurrency（R14, AC8）

啟動：`SSE_DB_PATH=.t4-tmp/c4.db SSE_LOG_INTERVAL=0.01 uv run uvicorn app.main:app --host 127.0.0.1 --port 18104`  
同時併發送出 10 個 `POST /install {"scenario":"success"}`：

```text
10 parallel POSTs status codes: [409, 202, 409, 409, 409, 409, 409, 409, 409, 409]
Count 202=1, Count 409=9, winner=[{'run_id': 1, 'scenario': 'success'}]
POST while running -> 409 {'detail': 'A run is already in progress'}
Run 1 finished: run_id=1, status=succeeded
POST after finish -> 202 {'run_id': 2, 'scenario': 'network_unreachable'}
```

### 5. Heartbeat（R22）

啟動：`SSE_DB_PATH=.t4-tmp/c5.db SSE_LOG_INTERVAL=4.0 SSE_HEARTBEAT_SECONDS=0.5 uv run uvicorn app.main:app --host 127.0.0.1 --port 18105`  
開始一輪後以 `curl -N -sS http://127.0.0.1:18105/install/events` 記錄閒置期間收到的每一行時間戳：

```text
Captured lines (t_sec, line):
  (0.006, 'retry: 3000'), ..., (0.006, 'id: 1.4'), (0.006, 'event: log'), ...
  (0.508, ': ping'), (1.009, ': ping'), (1.51, ': ping'), (2.01, ': ping')
Ping intervals (expected ~0.5s): [0.501, 0.501, 0.5]
```

### 6. Disconnect（R16, R24）

啟動：`SSE_DB_PATH=.t4-tmp/c6.db SSE_LOG_INTERVAL=2.0 SSE_HEARTBEAT_SECONDS=10.0 uv run uvicorn app.main:app --host 127.0.0.1 --port 18106`  
開始一輪並連線 1 個 `curl -N`，強制 `SIGKILL` 該 `curl` 後輪詢 `/stats`：

```text
Before connect: /stats = {'subscribers': 0}
After connect:  /stats = {'subscribers': 1}
After kill:     /stats = {'subscribers': 0}, recovery_time=0.002s (limit <= 2.0s)
```

### 7. Shutdown（R24, R25, AC9）

對真實 `uvicorn` 伺服器（`SSE_LOG_INTERVAL=0.5`）在執行中且掛有 2 個 `curl -N` 連線時，分別對 `uvicorn` process PID 傳送 `SIGINT`（port 18107, `c7_sigint.db`）與 `SIGTERM`（port 18117, `c7_sigterm.db`），隨後以同一個 DB 重啟並呼叫 `GET /install`：

```text
--- Trial: SIGINT (uvicorn pid=49041) ---
Before SIGINT: /stats={'subscribers': 2}, snapshot.status=running, last_seq=4
Server exited in 0.253s (rc=0, limit <= 3.0s); clients exited: [(0, 0.253), (0, 0.253)]
After restart GET /install -> 200: run_id=1, status=failed, last_seq=7
Failed tasks: [["prepare", "failed", "check_os", "failed", {"error_code": "E_INTERRUPTED", "message": "伺服器在安裝途中停止", "hint": "請重新安裝"}]]

--- Trial: SIGTERM (uvicorn pid=49047) ---
Before SIGTERM: /stats={'subscribers': 2}, snapshot.status=running, last_seq=4
Server exited in 0.247s (rc=143, limit <= 3.0s); clients exited: [(0, 0.247), (0, 0.247)]
After restart GET /install -> 200: run_id=1, status=failed, last_seq=7
Failed tasks: [["prepare", "failed", "check_os", "failed", {"error_code": "E_INTERRUPTED", "message": "伺服器在安裝途中停止", "hint": "請重新安裝"}]]
```

（註：若以 `uv run uvicorn` 啟動，需將訊號送給實際 `uvicorn` 子程序或整個 process group，因 `uv` 會在等待子程序期間忽略單送給 `uv` 自身的 `SIGINT`。）

### 8. Crash recovery（R25, R14）

啟動：`SSE_DB_PATH=.t4-tmp/c8_crash.db SSE_LOG_INTERVAL=0.5 uv run uvicorn app.main:app --host 127.0.0.1 --port 18108`  
執行中對 `uvicorn` PID 送出 `SIGKILL`，再以同一個 `c8_crash.db` 重啟：

```text
Before crash POST /install -> 202 {'run_id': 1, 'scenario': 'success'} (uvicorn pid=49053)
Mid-run before SIGKILL: status=running, last_seq=4
SIGKILL sent to uvicorn pid=49053; proc exited rc=137
After SIGKILL restart GET /install -> 200: run_id=1, status=failed, last_seq=7
Failed tasks: [["prepare", "failed", "check_os", "failed", {"error_code": "E_INTERRUPTED", "message": "伺服器在安裝途中停止", "hint": "請重新安裝"}]]
Recovered stream events=7, contiguous=True, tail=[
  ('1.5', 'task_failed', '{"stage_id":"prepare","task_id":"check_os","error_code":"E_INTERRUPTED","message":"伺服器在安裝途中停止","hint":"請重新安裝"}'),
  ('1.6', 'stage_failed', '{"stage_id":"prepare"}'),
  ('1.7', 'run_finished', '{"result":"failed"}')
]
New POST after recovery -> 202 {'run_id': 2, 'scenario': 'network_unreachable'} (increased=True)
```

### 9. Logs paging（R15）

啟動：`SSE_DB_PATH=.t4-tmp/c9.db SSE_LOG_INTERVAL=0.02 uv run uvicorn app.main:app --host 127.0.0.1 --port 18109`

```text
# 執行中省略 until：停在請求當下的 last_seq，不阻塞
While running (omitting until, limit=1000): snap_before.last_seq=36, snap_after.last_seq=38, status_after=running, returned_count=27, max_seq=38, next_after=None
While running (omitting until, limit=5): count=5, seqs=[4, 5, 6, 7, 8], next_after=8

# 結束後以 limit=25 逐頁串接 next_after：
Paging with limit=25 -> pages (after, count, next_after):
  [(0, 25, 32), (32, 25, 63), (63, 25, 94), (94, 25, 121), (121, 25, 146), (146, 25, 177), (177, 18, None)]
Paged total=168, SSE log total=168, exact_match=True, strictly_increasing=True
```

### 10. Slow subscriber（R23）

嘗試兩組真實 `uvicorn` + 停滯 TCP 客戶端（讀完 HTTP headers 後停止 `recv()`，並將客戶端 `SO_RCVBUF` 設為 `1024` 與 `512` bytes）搭配正常 `curl -N` 客戶端：
- 組別 A：`SSE_LOG_INTERVAL=0.002`, `SSE_SUBSCRIBER_QUEUE_SIZE=2`（port 18110）
- 組別 B：`SSE_LOG_INTERVAL=0`, `SSE_SUBSCRIBER_QUEUE_SIZE=1`（port 18111）

```text
macOS loopback socket buffers after SO_RCVBUF=512: actual SO_RCVBUF=512, SO_SNDBUF=131072
log_interval=0, queue_size=1: snap=succeeded(202), stats={'subscribers': 0}, normal_events=202, stalled_bytes=38798, stalled_events=202
```

觀察與說明：
- 在 macOS loopback TCP 上，伺服器端預設核心傳送緩衝區 `SO_SNDBUF = 131072` bytes（128 KiB），而整個 `success` 情境 202 筆 SSE 事件總位元組數僅 `38,798` bytes（約 38 KiB）。因此即便停滯客戶端完全不呼叫 `recv()` 且 `SSE_SUBSCRIBER_QUEUE_SIZE=1`，`uvicorn` 仍可將整輪資料無阻塞寫入核心 `SO_SNDBUF`，不會對 asyncio transport 產生背壓以填滿訂閱者佇列。
- 因此**無法在真實 macOS loopback TCP 上對單一 run 穩定重現 R23 慢速訂閱者踢除**（這也是 SPEC AC10 採用直接 ASGI 阻塞 `send` 來驗證 R23 的原因）。實測中正常客戶端完全不受停滯客戶端影響（完整收到 `1..202` 且連續無缺漏），未發現異常。

---

## Deviations

無（0 deviations）。

---

## T4.3 效能測試（AC11）

執行指令：`uv run pytest -q -rA -m perf`（無其他重負載程序並行，連續執行 3 次）

| Run | Node | Summary | p95 輸出 |
|---|---|---|---|
| 1 | `tests/test_perf.py::test_ac11_log_latency` | `1 passed, 75 deselected in 1.50s` | 測試未印出 p95 數值 |
| 2 | `tests/test_perf.py::test_ac11_log_latency` | `1 passed, 75 deselected in 1.47s` | 測試未印出 p95 數值 |
| 3 | `tests/test_perf.py::test_ac11_log_latency` | `1 passed, 75 deselected in 1.47s` | 測試未印出 p95 數值 |

3 次全數通過。

---

## 清理確認

1. `./.t4-tmp/` 已刪除，且工作區內不存在任何 `install.db*`、`git status --short` 為空：
```text
$ echo "git status --short:"; git status --short; echo "find install.db:"; find . -name "install.db*" -not -path "./.venv/*"; echo "check .t4-tmp:"; test ! -e .t4-tmp && echo ".t4-tmp deleted"
git status --short:
find install.db:
check .t4-tmp:
.t4-tmp deleted
```

2. 無任何本階段啟動的 `uvicorn` 伺服器仍在執行：
```text
$ ps -eo pid,comm,args | grep -E "python.*uvicorn|bin/uvicorn" | grep -v grep || echo "no uvicorn server running"
no uvicorn server running
```
