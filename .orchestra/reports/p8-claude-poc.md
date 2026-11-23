# T8.1 報告：Cloudflare Durable Object 可行性 PoC

全部測試都在本機跑（`wrangler dev` / `pywrangler dev`，沒有用 `--remote`），沒有登入，也沒有部署。
環境：macOS（darwin 24.5）、Node 24.21、wrangler 4.166.0、workerd 2026-11-19、workers-py 1.17.9（workers-runtime-sdk 1.9.7）、compatibility_date `2026-11-01`。

兩個 PoC 的路由和行為一樣，同一支 `verify.py`（只用標準庫）可以驗兩邊：

| 路由 | 用途 |
|---|---|
| `/install` | P1：Worker → DO stub → 回 JSON |
| `/install/stream?hb=ms` | P4/P5/P6：SSE 訂閱 |
| `/install/start?n=50&ms=150` | P3：啟動 alarm 迴圈（每一步：transactionSync 寫入 → 廣播） |
| `/install/stats` | alarm 間隔、目前訂閱者、斷線紀錄 |
| `/install/rows` | P2：SELECT |
| `/install/txfail` | P2：transactionSync 裡丟例外 → 確認有 rollback |
| `/install/broadcast` | 手動廣播一次 |

## 1. 結論表

| # | Python（workers-py 1.17.9） | TypeScript |
|---|---|---|
| P1 DO＋stub | **可行**：`from workers import DurableObject`；`env.INSTALL.get(env.INSTALL.idFromName("demo"))` → `await stub.fetch(request)` 回 200 | **可行**：同樣寫法，回 200 |
| P2 SQLite | **可行**：`ctx.storage.sql.exec` 建表／INSERT／SELECT 都正常。`ctx.storage.transactionSync(create_proxy(fn))` 能提交，丟例外會 rollback。重啟後資料還在 | **可行**：用法相同。rollback 與重啟後持久化都驗過 |
| P3 Alarm | **可行**：`async def alarm(self, alarm_info=None)`，在裡面重設 150 ms 後的下一次，連跑 50 次。間隔平均 155.5 ms，最大 157 ms | **可行**：50 次，間隔平均 153.7 ms，最大 163 ms |
| P4 SSE 廣播 | **可行**：`js.ReadableStream.new(...)` 包進 `workers.Response`。3 個客戶端各收到相同的 50 筆 | **可行**：`new ReadableStream({start, cancel})`。3 個客戶端各收到相同的 50 筆 |
| P5 斷線偵測 | **有限制**：靠 ReadableStream 的 `cancel` 回呼才能偵測，而且只在斷線後的**第 2 次寫入**時才會觸發。沒有寫入就永遠偵測不到。延遲是 1–2 個心跳週期（1 s 心跳：1.0–1.7 s；15 s 心跳：18.4 s） | **有限制**：行為和 Python 完全相同。`request.signal` 不論有沒有加 `enable_request_signal`，都沒有比 `cancel` 早觸發 |
| P6 15 s 心跳 | **可行**：在 DO 裡用 `js.setInterval(create_proxy(fn), 15000)`，ping 在 15.0／30.01／45.01／60.01／75.01 s 到達，連線一直沒斷 | **可行**：`setInterval`，到達時間相同 |
| P7 Static Assets | **可行**：`assets.directory=./public` 加 `run_worker_first: ["/install", "/install/*"]`。`/` 回 text/html，`/install*` 進 Worker，其他不存在的路徑回 404 且不經過 Worker | **可行**：設定相同，結果相同 |
| P8 平台約束 | 查官方文件，見下方 §4／§6，兩種語言適用一樣 | 同左 |

Python 路線 P1–P6 沒有一項做不到，也沒用到 hack；唯一用到的是官方文件寫明的 FFI（`create_proxy`、`to_js`、`from js import ReadableStream`）。依照指示，TypeScript 還是把 P1–P7 都驗了一遍，作為對照。

## 2. 建議：選 TypeScript

兩條路都能用。理由：

- **可靠度**：Python Workers 還在 beta。這次就碰到要求 uv ≥ 0.13.4、`pywrangler` 會自動建 `.venv-workers` 並用 PATH 上的 Python 3.14 等工具鏈問題（見 §4）。TS 只要 wrangler，沒有其他依賴。
- **冷啟動（本機實測）**：Python 每次啟動後第一個請求要 **2136 ms／2495 ms**（Pyodide 初始化），TS 是 **23 ms**。啟動後兩邊的請求都在個位數 ms。
- **程式量**：TS 125 行，Python 169 行。Python 多出來的是 FFI 轉換（`create_proxy`、`to_js(..., dict_converter=Object.fromEntries)`、`toArray().to_py()`）。
- **型別／測試**：TS 用 `@cloudflare/workers-types` 加 `tsc` 就能檢查，`DurableObject<Env>`、`SqlStorage` 都有型別，這次 `npx tsc -p .` 通過。Python 這邊的 JS 物件都是 `JsProxy`，沒有靜態型別。
- 斷線偵測、alarm 準度兩邊實測沒差，不是選語言的考量點。

## 3. 關鍵程式片段

### 3.1 設定（兩邊共用；Python 多一個 flag，`main` 指向 `src/entry.py`）
```jsonc
{
  "name": "ts-poc",
  "main": "src/index.ts",                 // Python: "src/entry.py"
  "compatibility_date": "2026-11-01",
  // Python 另加: "compatibility_flags": ["python_workers"],
  "durable_objects": { "bindings": [{ "name": "INSTALL", "class_name": "InstallDO" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["InstallDO"] }],
  "assets": {
    "directory": "./public",
    "run_worker_first": ["/install", "/install/*"]   // 其他路徑走 assets；找不到就 404，不進 Worker
  }
}
```

### 3.2 TypeScript（完整檔：`ts-poc/src/index.ts`）
```ts
import { DurableObject } from "cloudflare:workers";
interface Env { INSTALL: DurableObjectNamespace<InstallDO>; }
const enc = new TextEncoder();

export class InstallDO extends DurableObject<Env> {
  sql: SqlStorage;
  subs = new Map<number, { c: ReadableStreamDefaultController<Uint8Array>; timer: ReturnType<typeof setInterval> }>();
  nextSid = 0;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, step INTEGER, ts REAL, msg TEXT)");
  }
  // 寫入失敗或 cancel 時移除訂閱者
  send(sid: number, text: string) {
    const s = this.subs.get(sid); if (!s) return;
    try { s.c.enqueue(enc.encode(text)); } catch { this.drop(sid, "enqueue-error"); }
  }
  drop(sid: number, how: string) {
    const s = this.subs.get(sid); if (!s) return;
    clearInterval(s.timer); this.subs.delete(sid);
  }
  broadcast(text: string) { for (const sid of [...this.subs.keys()]) this.send(sid, text); }

  stream(hbMs: number) {               // SSE + 心跳 + 斷線偵測
    const sid = this.nextSid++;
    return new ReadableStream<Uint8Array>({
      start: (c) => {
        const timer = setInterval(() => this.send(sid, `: ping ${Date.now()}\n\n`), hbMs);
        this.subs.set(sid, { c, timer });
        c.enqueue(enc.encode(`: connected sid=${sid}\n\n`));
      },
      cancel: () => this.drop(sid, "cancel"),   // 客戶端斷線後，下次寫入時觸發（見 §4）
    });
  }

  async alarm() {                      // 每 150 ms 推進一步
    const t = Date.now(), step = ++this.run.step; this.run.remaining--;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("INSERT INTO events(step, ts, msg) VALUES (?, ?, ?)", step, t, `step ${step}`);
      this.sql.exec("INSERT OR REPLACE INTO meta(k, v) VALUES ('last_step', ?)", String(step));
    });
    this.broadcast(`data: ${JSON.stringify({ step, ts: t })}\n\n`);   // 先寫 SQLite，再廣播
    if (this.run.remaining > 0) await this.ctx.storage.setAlarm(Date.now() + this.run.ms);
  }

  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "/install/stream")
      return new Response(this.stream(Number(url.searchParams.get("hb") ?? 15000)),
        { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
    if (url.pathname === "/install/start") { /* this.run = {...}; */ await this.ctx.storage.setAlarm(Date.now() + 150); return Response.json({ ok: true }); }
    // SELECT: this.sql.exec("SELECT COUNT(*) AS c FROM events").one().c / .toArray()
    return new Response("not found", { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return env.INSTALL.get(env.INSTALL.idFromName("demo")).fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

### 3.3 Python（完整檔：`py-poc/src/entry.py`）
```python
from js import Date, Object, ReadableStream, TextEncoder, clearInterval, setInterval
from pyodide.ffi import create_proxy, to_js
from workers import DurableObject, Response, WorkerEntrypoint
ENC = TextEncoder.new()

class InstallDO(DurableObject):
    def __init__(self, ctx, env):
        super().__init__(ctx, env)
        self.sql = ctx.storage.sql
        self.sql.exec("CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, step INTEGER, ts REAL, msg TEXT)")
        self.subs = {}; self.next_sid = 0

    def _send(self, sid, text):
        sub = self.subs.get(sid)
        if sub is None: return
        try: sub["c"].enqueue(ENC.encode(text))
        except Exception: self._drop(sid, "enqueue-error")

    def _drop(self, sid, how):
        sub = self.subs.pop(sid, None)
        if sub: clearInterval(sub["timer"])

    def _stream(self, hb_ms):
        sid = self.next_sid; self.next_sid += 1
        def start(controller):
            self.subs[sid] = {"c": controller, "timer": None}
            self.subs[sid]["timer"] = setInterval(create_proxy(lambda: self._send(sid, f": ping {Date.now():.0f}\n\n")), hb_ms)
            controller.enqueue(ENC.encode(f": connected sid={sid}\n\n"))
        def cancel(reason=None):
            self._drop(sid, "cancel")
        # dict_converter 一定要加，否則傳過去的是 JS Map，ReadableStream 讀不到 start/cancel
        return ReadableStream.new(to_js({"start": create_proxy(start), "cancel": create_proxy(cancel)},
                                        dict_converter=Object.fromEntries))

    async def alarm(self, alarm_info=None):
        step = ...; t = Date.now()
        def tx():                                   # 同步函式；丟例外 = rollback（已驗證）
            self.sql.exec("INSERT INTO events(step, ts, msg) VALUES (?, ?, ?)", step, t, f"step {step}")
        self.ctx.storage.transactionSync(create_proxy(tx))
        self.broadcast(f"data: {{\"step\": {step}}}\n\n")
        if remaining > 0:
            await self.ctx.storage.setAlarm(Date.now() + 150)

    async def fetch(self, request):
        # path = urlparse(request.url).path
        return Response(self._stream(15000), headers={"content-type": "text/event-stream", "cache-control": "no-cache"})
        # SELECT: self.sql.exec("SELECT ...").toArray().to_py()  -> list[dict]
        # JSON:   Response.json({...})

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        stub = self.env.INSTALL.get(self.env.INSTALL.idFromName("demo"))
        return await stub.fetch(request)
```

## 4. 陷阱清單

1. **斷線偵測只能靠寫入觸發（兩種語言都一樣，本機實測）**：客戶端關掉 socket 之後，DO 這邊不會立刻知道。ReadableStream 的 `cancel` 要等斷線後的**第 2 次** `enqueue` 才會觸發；第 1 次 `enqueue` 不會丟例外。`drops[].how` 每次都是 `cancel`，沒出現過 `enqueue-error`。
   → **可靠做法**：每個訂閱者都要有定期寫入（心跳），並且同時處理 `cancel` 回呼和 `enqueue` 的 try/catch。偵測延遲上限約等於 2 × 心跳週期（15 s 心跳 → 最多約 30 s）。要更快就把心跳縮短（1 s 心跳 → 1.0–1.7 s）。
   → `request.signal` 在 DO 裡沒有比 `cancel` 早觸發，加上 `--compatibility-flags enable_request_signal` 也一樣。所以不要靠它。
   → 這個延遲是在 `wrangler dev`（前面有一層本機 proxy）量到的，正式環境的延遲**未驗證**。
2. **workers-py 1.17.9 要求 uv ≥ 0.13.4**，系統的 uv 0.9.5 會直接報錯：`ERROR uv version at least 0.13.4 required`。解法是把新版 uv 裝進專案的 `.venv`，再把 `.venv/bin` 放到 PATH 前面（`py-poc/dev.sh` 已經這樣做）。
3. **pywrangler 呼叫的是 `npx --yes wrangler`**（`pywrangler/utils.py`）。專案裡沒有 wrangler 的話，它會從 npm 臨時下載。所以 `py-poc` 也裝了本地的 wrangler 4.166.0，鎖住版本。
4. **pywrangler dev 會另外建 `.venv-workers`，而且用 PATH 上的 Python**（這台是 3.14），跟 `uv init --python 3.12` 的設定無關。它還會產生 `python_modules/`（vendored 模組約 112 KiB）。另外，shell 裡殘留的 `VIRTUAL_ENV` 會干擾 uv，`dev.sh` 會先 `unset` 它。
5. **npm 11 的 allowScripts**：`npm i` 預設不跑 `workerd`、`esbuild` 的 postinstall，要先 `npm install-scripts approve esbuild workerd`，再 `npm rebuild esbuild workerd`，否則沒有 workerd 執行檔。
6. **Python 的 `ReadableStream` 參數**一定要用 `to_js(..., dict_converter=Object.fromEntries)`，並把 callback 包成 `create_proxy`（官方 Streams 頁的 Python 範例就是這樣寫）。
7. **Python 的 `transactionSync`**：沒有 snake_case 包裝，直接呼叫 JS 方法 `ctx.storage.transactionSync(create_proxy(fn))`，`fn` 必須是同步函式。在 `fn` 裡丟 Python 例外，外面會收到 `RuntimeError: boom`，而且資料有 rollback（`before 100 / after 100`）。官方文件只有 JS 範例，這是實測確認的。
8. **DO 記憶體裡的狀態（訂閱者、alarm 統計）在重啟後會清空**，SQLite 的資料不會。所以 alarm 迴圈的「目前進度」如果要在 DO 被回收後接得上，必須寫進 SQLite（PoC 寫在 `meta.last_step`）。
9. **跨請求寫入 stream 沒問題**：在 `alarm()` 和 `/install/broadcast` 請求裡，對別的請求建立的 stream 呼叫 `enqueue`，兩種語言都正常，沒有出現 cross-request I/O 錯誤。
10. **`run_worker_first` 要用陣列 glob**：`["/install", "/install/*"]`。`/install/*` 不會比對到 `/install` 本身，所以兩個都要列。
11. **P8 平台約束（官方文件，正式環境，本機未驗證）**：
    - **回收／休眠**：DO 在有 request、RPC、response stream、WebSocket 或 pending I/O 進行中時會保持活著；閒置 70–140 秒才會被回收。開著的 HTTP 串流不能休眠（Hibernation 只適用 WebSocket）。另外，「每個操作最多在 15 分鐘內阻止回收」，文件沒寫 SSE 串流滿 15 分鐘後會怎樣，所以**客戶端要能自動重連**（EventSource 本身就會重連）。
    - **CPU**：每個 request／alarm 預設 30 秒 CPU，可以用 `limits.cpu_ms` 調到 5 分鐘。SSE 大部分時間在等待，不算 CPU。
    - **Wall-clock**：HTTP／RPC 只要呼叫端還連著就沒有上限；**alarm handler 最長 15 分鐘**。
    - **Alarm**：可以設到毫秒精度，通常幾 ms 內觸發，**但可能延遲最多 1 分鐘**。失敗會用指數退避重試，從 2 s 開始，最多 6 次。官方建議在 `alarm()` 裡自己 catch 例外並重設下一次。每次 `setAlarm` 計為一次 row write。
    - **免費方案**：「Workers Free plan: Only Durable Objects with SQLite storage backend are available」，也就是免費方案只能用 SQLite DO，正好是這次用的 `new_sqlite_classes`。
    - 新版文件改用 `exports`（`"type": "durable-object"`、`"storage": "sqlite"`）宣告 DO，它和 `migrations` 不能同時用。這次用的 `migrations` + `new_sqlite_classes` 在 wrangler 4.166 本機可以正常跑。

## 5. 實測數字（本機 `wrangler dev`）

| 項目 | Python | TypeScript |
|---|---|---|
| Alarm 50 次、目標 150 ms：間隔 平均／最小／最大 | 155.5 / 153 / 157 ms | 153.7 / 152 / 163 ms |
| Alarm 實際觸發比設定時間晚 平均／最大 | 4.4 / 6 ms | 3.5 / 13 ms |
| 3 個訂閱者收到的事件數 | 50 / 50 / 50，序列完全相同 | 50 / 50 / 50，序列完全相同 |
| 斷線偵測延遲，15 s 心跳 | 18,449 ms；另一個 20 s 內沒偵測到，之後的心跳才偵測到 | 18,459 ms；另一個同樣 20 s 內沒偵測到 |
| 斷線偵測延遲，1 s 心跳（5 次） | 1711 / 1536 / 1364 / 1198 / 1025 ms | 1705 / 1536 / 1367 / 1200 / 1030 ms |
| 15 s 心跳到達時間（從連線起算，秒） | 15.0, 30.01, 45.01, 60.01, 75.01，連線沒斷 | 15.0, 30.01, 45.01, 60.01, 75.01，連線沒斷 |
| 第一個請求（冷啟動） | 2136 ms、2495 ms | 23 ms |
| transactionSync 丟例外 | before 100 / after 100，rolled_back true | before 0 / after 0，rolled_back true |
| 重啟 dev 後 `/install/rows` | count 100，last_step 50 | count 50，last_step 50 |

原始輸出：TS 在 `ts-poc/verify-output.txt`。Python 的重點輸出如下：
```
== P1 Worker -> DO stub.fetch: (200, 'application/json', '{"ok": true, "from": "durable-object"}')
== P7 GET / -> 200 text/html; charset=utf-8 html=True
== P7 GET /nope-not-an-asset -> 404 (asset 404, Worker not invoked)
== P4 sub A: received 50 data events, first=[1, 2, 3] last=[48, 49, 50]   (B、C 相同)
== P4 all subscribers got identical event sequence: True
== P3 alarm stats: {'steps': 50, 'intervals_n': 49, 'interval_avg': 155.53, 'interval_min': 153, 'interval_max': 157, 'lag_avg': 4.4, 'lag_max': 6}
== P2 rows: {"count": [{"c": 100}], "last": [{"id": 100, "step": 50, ...}], "meta": [{"k": "last_step", "v": "50"}]}
== P5 sub A sid=3: closed by client, DO dropped via 'cancel' after 18449 ms
== P5 sub B sid=4: NOT dropped within 20 s
== P5 remaining sub C got manual event: True
== P6 sub C ping arrival (s since connect): [15.0, 30.01, 45.01, 60.01, 75.01]; socket still open: True
(重啟後) {"count": [{"c": 100}], ... "meta": [{"k": "last_step", "v": "50"}]}
/install/txfail -> {"before": 100, "after": 100, "rolled_back": true, "err": "RuntimeError: boom"}
```
（Python 的 count 是 100，因為第一次跑 verify 時 verifier 有 bug 中途停掉，但 50 步的 alarm 已經寫進 DB；第二次又寫了 50 筆。）

## 6. 引用來源

- https://developers.cloudflare.com/workers/languages/python/ （`python_workers` flag、`uvx --from workers-py pywrangler init`、`uv run pywrangler dev`）
- https://developers.cloudflare.com/workers/languages/python/ffi/
- https://developers.cloudflare.com/workers/languages/python/basics/
- https://developers.cloudflare.com/workers/runtime-apis/streams/ （Python 用 `ReadableStream.new(to_js({"start": create_proxy(start)}))` 的範例）
- https://developers.cloudflare.com/durable-objects/get-started/ （`from workers import DurableObject`）
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ （`transactionSync` 的 callback 必須是同步；`exec` 不能下 BEGIN）
- https://developers.cloudflare.com/durable-objects/api/alarms/ （Python `async def alarm(self, alarm_info)`、毫秒精度、可能延遲最多 1 分鐘、重試規則、15 分鐘 wall time）
- https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ （70–140 秒閒置回收、pending I/O 阻止回收、15 分鐘上限）
- https://developers.cloudflare.com/durable-objects/platform/limits/ （每個 request／alarm 30 s CPU，可調到 5 分鐘；有 response stream 時 DO 保持活著）
- https://developers.cloudflare.com/durable-objects/platform/pricing/ （免費方案只能用 SQLite DO）
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://developers.cloudflare.com/workers/static-assets/binding/ （`run_worker_first` 陣列 glob 與 `!` 排除）
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- 原始碼：`py-poc/.venv/.../workers/entrypoints.py`（DurableObject／DurableObjectContext）、`pywrangler/utils.py`（`npx --yes wrangler`）

## 7. 殘留檢查

- 啟動過的程序：`pywrangler dev`（18720／18920，啟動兩次）、`wrangler dev`（18710／18910，啟動三次：一般、加 `enable_request_signal`、測持久化），以及它們底下的 `workerd`。
- 停止方式：`pkill -f "wrangler dev"`、`pkill -f pywrangler`、`pkill -f workerd`。
- 最後檢查：
  ```
  $ pgrep -fl "wrangler|workerd|pywrangler"; echo "pgrep exit=$?"
  pgrep exit=1          # 空
  $ lsof -nP -iTCP:18700-18999 -sTCP:LISTEN; echo "lsof exit=$?"
  lsof exit=1           # 沒有任何埠在 listen
  ```
- 沒有執行 login、deploy 或任何 `--remote` 指令，也沒有出現登入提示。所有檔案都在這個資料夾內：`node_modules/`、`.venv/`、`.uv-cache/`、`.venv-workers/`、`python_modules/`、`.wrangler/state/`。
