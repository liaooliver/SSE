# SPEC-cloudflare：Durable Object 版差異規格（基於 SPEC v1.1.4）

版本：**cf1.1**

把 `docs/SPEC.md` v1.1.4 描述的系統移植成 Cloudflare Worker + Durable Object（DO），使用 TypeScript。
HTTP 介面（`contracts/openapi.yaml`）完全不變，前端頁面 `index.html` 原封不動。Python 版（`app/`）保留，不受本檔影響。

---

## 0. 使用方式

**`docs/SPEC.md` 仍是行為的基準；本檔只列出不同；兩者衝突時以本檔為準。**

### 0.1 合約檔

| 檔案 | 用在 Cloudflare 版的角色 |
|---|---|
| `docs/SPEC.md` | 行為基準（v1.1.4），只讀 |
| `docs/SPEC-cloudflare.md`（本檔） | 差異：平台不同而不得不改的條文、新的驗收方式 |
| `contracts/openapi.yaml` | HTTP 形狀，**完全不變** |
| `contracts/domain.pyi` | 只給 Python 版；Cloudflare 版不使用 |
| `contracts/domain.d.ts` | TypeScript 形狀：`worker/src/domain.ts` 必須提供、測試可以直接 import 的名稱和簽名（對應 `domain.pyi`；另加 Cloudflare 專用的 `ValueError`、`KeyError`（§0.2）和 R23 的 `SubscriberQueue`） |
| `AGENTS.md` §9 | `worker/` 的程式規範與品質關卡 |

文件互相矛盾時，回報 `CF-CONFLICT: ...`；沒有寫到的，回報 `CF-GAP: ...`。不可以自己猜。待決定與已決定的項目列在本檔末尾 §7。

### 0.2 讀 SPEC.md 時的替換規則

SPEC.md 中標為「不變」的條文，依下表替換用語後直接適用：

| SPEC.md 的寫法 | 在 Cloudflare 版讀作 |
|---|---|
| `create_app(log_interval=x)`、「`log_interval=x`」以及另外兩個設定 | 啟動 `wrangler dev` 時傳 `--var SSE_LOG_INTERVAL:x`（`SSE_HEARTBEAT_SECONDS`、`SSE_SUBSCRIBER_QUEUE_SIZE` 同理） |
| `db_path`、「資料庫」、「資料庫檔案」、`tmp_path` | `wrangler dev --persist-to <dir>` 的目錄（下稱 **persist 目錄**） |
| 「SQLite」 | DO 的 SQLite（`ctx.storage.sql`） |
| 「uvicorn」、「真的 uvicorn」 | 真的 `wrangler dev` 程序 |
| 「lifespan 啟動」 | DO 建構子中的 `ctx.blockConcurrencyWhile` |
| 「新的 app」 | 新啟動、使用全新空 persist 目錄的 `wrangler dev` 程序 |
| `domain.<snake_case 名稱>` | `contracts/domain.d.ts` 的對應名稱（函式改 camelCase，例如 `domain.script_for` → `scriptFor`；型別與常數名稱不變） |
| 「拋出 `ValueError`／`KeyError`」 | 拋出 `contracts/domain.d.ts` 宣告的同名類別 `ValueError`／`KeyError` 的實例 |
| `app/` | `worker/src/`（只在本移植範圍內） |
| 「`AGENTS.md` §1」 | `AGENTS.md` §9.1 |

### 0.3 型別對應（SPEC.md 條文中的 Python 型別）

| SPEC.md／pyi | TypeScript |
|---|---|
| `int` | `number`，而且 `Number.isSafeInteger(x)` 為真（`boolean` 不是 `int`）。從字串解析出來的整數超過 2^53−1 時一律不合法（§7 CF-GAP-1） |
| `float` | 有限的 `number` |
| `str` | `string` |
| `None`／`null` | `null` |
| `tuple[X, ...]` | `readonly X[]`（等同 `ReadonlyArray<X>`） |
| `Mapping[str, V]` | 事件 `data`：`Readonly<Record<string, V>>`；`SCENARIOS`：`ReadonlyMap<string, Scenario>`（保留插入順序） |
| 時間 `ts` | ISO-8601 UTC 字串（和 pyi 相同，不改成數值） |

---

## 1. 架構對照表

| # | 面向 | Python（SPEC v1.1.4） | Cloudflare（cf1.1） |
|---|---|---|---|
| 1 | 狀態容器 | 一個 uvicorn 程序（單一 worker），狀態在 app 內 | **一個 DO 實例**：class `InstallDO`，固定由 `env.INSTALL.idFromName("install")` 取得；Runtime、Store、Broker 全在這個 DO 裡 |
| 1 | 路由 | FastAPI router | Worker（`worker/src/index.ts`）只做薄路由：依 R3 驗證設定，把 `/install`、`/install/*`、`/health`、`/stats` 原封不動轉給 DO；這四個路徑都列在 `run_worker_first`（§7 CF-CONFLICT-1 已決定） |
| 1 | 頁面 `GET /` | `routers/page.py` 回傳 `app/static/index.html` | **Workers Static Assets** 提供 `worker/public/index.html`（和 `app/static/index.html` 逐 byte 相同），不經過 Worker |
| 2 | Store | `sqlite3` + WAL + `asyncio.to_thread` | DO 的 `ctx.storage.sql`；同步交易用 `ctx.storage.transactionSync`；資料持久到 `--persist-to` 目錄。不變式不變：先寫 SQLite 再廣播、`seq` 連續、一次只有一輪 |
| 3 | 模擬器 | `asyncio` 背景 task | **Alarm**：每次 `alarm()` 前進一「步」，步與步間隔 `log_interval`（R14） |
| 4 | Broker | 每個訂閱者一個 `asyncio.Queue`；async generator | DO 記憶體裡的訂閱者集合；SSE 回應是 `ReadableStream`；每個訂閱者一個 `SubscriberQueue`（R23） |
| — | Heartbeat | generator 等待逾時 | DO 內的 `setTimeout`／`setInterval`（R22） |
| 5 | 斷線偵測 | ASGI 取消、`http.disconnect` | 只有串流的 `cancel` 回呼或 `enqueue` 拋出例外；斷線後要等**第 2 次寫入**才偵測得到；時限改以 `heartbeat_interval` 為單位（R24） |
| 6 | 啟動復原（R25） | lifespan 啟動時 | DO 建構子的 `blockConcurrencyWhile`：有 `running` 的一輪就補 `E_INTERRUPTED` 收尾，並清掉殘留的 alarm |
| 7 | 執行方式 | `uv run uvicorn app.main:app --port 8000` | Node ≥ 20；`cd worker && npm ci && npx wrangler dev --port 8787`，乾淨 checkout 下直接可用（R1） |
| 7 | 設定 | `create_app` 參數 > 環境變數 > 預設；`db_path` | 只有 Worker 的 vars（`--var NAME:VALUE`）> 預設；沒有 `db_path`；不合法 → 請求回 `500` 加說明（R3） |
| 8 | 測試 | ASGI 直接呼叫 + 真的 uvicorn；pytest | **只透過 HTTP** 打真的 `wrangler dev`（每個測試檔自己啟動一個）+ 直接 import `domain` 純函式；vitest |
| 9 | 目錄 | `app/` | `worker/src/domain.ts`、`worker/src/index.ts`、`worker/src/install-do.ts`、`worker/public/index.html`、`worker/wrangler.jsonc`、`worker/package.json`、`worker/tests/`（完整目錄樹見 `AGENTS.md` §9.6） |
| — | 型別合約 | `contracts/domain.pyi` | `contracts/domain.d.ts` |
| — | log | `logging`，禁用 `print` | `worker/src/logger.ts`，其他地方禁用 `console.*`（R28） |
| — | 品質關卡 | ruff、mypy、pytest | `tsc`、ESLint + typescript-eslint、Prettier、vitest（AC12） |

---

## 2. 逐條處置表

處置：`不變`＝依 §0.2 替換用語後原文適用；`修改`＝原條文的意圖保留，但部分內容改寫；`替換`＝整條改寫；`不適用`＝Cloudflare 版沒有這條。`修改`／`替換` 的**完整新條文**在 §3，以同一個 ID 標示。

| ID | 處置 | 說明 |
|---|---|---|
| R1 | 替換 | Python／uv／uvicorn 改成 Node ≥ 20、TypeScript、`wrangler dev`；乾淨 checkout 下啟動指令直接可用（必要時用 `postinstall`）；固定 `wrangler.jsonc` 的必要設定；單一 DO 實例取代「單一 worker」。完整條文見 §3 R1 |
| R2 | 替換 | `create_app`、`app`、ASGI 直接呼叫都不存在。改成 Worker／DO 的模組介面，以及測試能存取系統的方式（HTTP、domain、程序控制、persist 目錄）。完整條文見 §3 R2 |
| R3 | 修改 | 只剩三個設定，只來自 Worker vars；沒有 `db_path`；寫明字串解析規則；不合法時所有經過 Worker 的請求回 `500` 加說明，不使用預設值。完整條文見 §3 R3 |
| R4 | 不變 | 對應 `PLAN` |
| R5 | 不變 | 對應 `SCENARIOS`（`ReadonlyMap`，迭代順序同 R5 表格） |
| R6 | 不變 | 對應 `scriptFor`。正常 log 的描述文字由 TypeScript 實作自行決定（不必和 Python 版相同），但同一個情境每次都要相同 |
| R7 | 不變 | `ts` 可以用 `Date.prototype.toISOString()`（結尾是 `Z`） |
| R8 | 不變 | |
| R9 | 修改 | 對應 `formatEventId`／`parseEventId`；加上「任一邊超過 2^53−1 就不合法」。完整條文見 §3 R9 |
| R10 | 不變 | 對應 `initialSnapshot`／`applyEvent`；拋出 `domain.d.ts` 的 `ValueError`；第 9 項的型別檢查依 §0.3（`int` = 安全整數） |
| R11 | 不變 | |
| R12 | 不變 | |
| R13 | 修改 | 「同一個 SQLite 讀取交易」改成「同一個 `transactionSync` 回呼」；「資料庫」改成 persist 目錄。完整條文見 §3 R13 |
| R14 | 修改 | 交易改成 `transactionSync`；背景模擬器改成 Alarm，寫明「一步」的切法和時間性質；寫明 body 的解析與檢查順序。完整條文見 §3 R14 |
| R15 | 修改 | 加上整數 query 參數的解析規則（超過 2^53−1 → `422`）、`run_id ≥ 1`（依 `openapi.yaml`）、`422` 先於 `404`／`409`。完整條文見 §3 R15 |
| R16 | 修改 | `subscribers` 定義成 DO 記憶體中訂閱者集合的大小，逐項列出加入與移除的時機；客戶端斷線但還沒偵測到的連線**仍然計入**，延遲上限由 R24 規定。完整條文見 §3 R16 |
| R17 | 修改 | `/health` 經過 Worker 驗證設定後轉給 DO；設定不合法時回 `500`；`200` 代表 DO 建構與 R25 復原已完成。完整條文見 §3 R17 |
| R18 | 不變 | 「合法」依 §3 R9：query `last_event_id` 任一邊超過 2^53−1 → `422`；這樣的 header 視同沒帶 |
| R19 | 不變 | 平台是否會自行壓縮 `text/event-stream` 未經驗證，見 L13；AC9 會檢查 |
| R20 | 修改 | 訂閱登記、讀取重播、更新 `/stats`、送出第一個區塊，在 DO 內同一段沒有 `await` 的同步程式碼裡完成。完整條文見 §3 R20 |
| R21 | 不變 | 把 `run_finished` 交給串流之後關閉串流；從訂閱者集合移除的時機見 R16 |
| R22 | 修改 | heartbeat 用 DO 內的計時器觸發（不用 Alarm）；定義什麼叫「輸出」；ping 不經過 R23 的佇列。完整條文見 §3 R22 |
| R23 | 替換 | 沒有 ASGI `send` 可以阻塞。「佇列」客觀定義為 `SubscriberQueue`（容量 `subscriber_queue_size`）＋`highWaterMark` 為 1 的回應串流；`push` 回報溢位時關閉該連線。正式實作前先用 spike 驗證 workerd 的串流行為，不符合才改用備用設計；外部行為與 `SubscriberQueue` 合約不變。完整條文見 §3 R23 |
| R24 | 修改 | 斷線只能靠 `cancel` 回呼或 `enqueue` 例外偵測；退訂時限改成 `2 × heartbeat_interval + 1` 秒；ASGI 的 `http.disconnect` 1 秒時限不適用；SIGINT／SIGTERM 的 3 秒關機時限不適用，改為觀察項（只量測、寫進回報）。完整條文見 §3 R24 |
| R25 | 替換 | `sqlite3`、WAL、`asyncio.to_thread` 不適用；保留「每個寫入動作一個交易、`seq` 連續、先寫再廣播」與「啟動復原」，復原移到 DO 建構子並清除 alarm。完整條文見 §3 R25 |
| R26 | 不變 | 由 Workers Static Assets 提供 `worker/public/index.html`，必須和 `app/static/index.html` 逐 byte 相同（AC12 檢查）。PoC P7（`materials/poc-report.md`，本機 `wrangler dev`）實測 `GET /` 回 `text/html; charset=utf-8` |
| R27 | 不變 | 頁面原封不動。平台可能在 15 分鐘後切斷串流（L3）時，靠 R27 現有的 `EventSource` 自動重連（`CONNECTING`）＋R18／R20 補齊 |
| R28 | 替換 | `print`／`logging` 改成：禁用 `console.*`，唯一例外是很薄的 `worker/src/logger.ts`。完整條文見 §3 R28 |
| R29 | 修改 | `worker/` 依照 `AGENTS.md` §9。完整條文見 §3 R29 |
| AC1 | 不變 | 只用 HTTP，照原文適用 |
| AC2 | 不變 | `log_interval=0.001` 以 `--var SSE_LOG_INTERVAL:0.001` 傳入 |
| AC3 | 修改 | 真的 `wrangler dev`；寫明「切斷 TCP」的做法；伺服器端舊連線的退訂延遲不影響判定。完整條文見 §3 AC3 |
| AC4 | 不變 | 比對對象是 TypeScript 的 `scriptFor` |
| AC5 | 不變 | |
| AC6 | 不變 | |
| AC7 | 不變 | |
| AC8 | 不變 | DO 是單執行緒，檢查與建立在同一個 `transactionSync` 內（R14） |
| AC9 | 修改 | 斷線時限改用 R24 的新定義；關機時限不是通過條件，改為觀察項；復原的必要項只有「SIGKILL 程序群組後，用同一個 `--persist-to` 重新啟動，R25 收尾出現 `E_INTERRUPTED`」；加檢查沒有 `Content-Encoding`。完整條文見 §3 AC9 |
| AC10 | 替換 | 改成「單元測試 `SubscriberQueue` 純邏輯 ＋ HTTP 層的冒煙測試」。完整條文見 §3 AC10 |
| AC11 | 修改 | 真的 `wrangler dev`；數字只代表本機。完整條文見 §3 AC11 |
| AC12 | 替換 | 品質關卡改成 `worker/` 下的 npm 指令（兩個 tsconfig 都要通過），另加乾淨 checkout 啟動檢查與 `index.html` 逐 byte 比對。完整條文見 §3 AC12 |

---

## 3. 新條文（修改／替換的完整內容）

### R1（替換）執行環境

- Node.js ≥ 20。程式放在 `worker/`，以 TypeScript 撰寫，在 Cloudflare Workers 執行期執行。本規格只涵蓋本機 `wrangler dev`：不使用 `--remote`、不登入、不部署。
- 啟動方式：`cd worker && npm ci && npx wrangler dev --port 8787`。在乾淨 checkout（沒有 `worker/node_modules/`、沒有 `worker/.wrangler/`）下，這個指令必須直接可用，而且不可以更改。
  - 如果 npm 預設不執行 `workerd`／`esbuild` 的 postinstall（PoC §4 第 5 點：npm 11 的行為），唯一的解法是在 `worker/package.json` 根層的 `scripts` 加上 `"postinstall": "npm rebuild esbuild workerd"`。不可以用其他方式，例如要求使用者手動執行額外的指令。
  - AC12 會檢查這一點。
- 依賴版本在 `worker/package.json` 精確釘選（不用 `^`、`~`），`worker/package-lock.json` 一起提交。
- `worker/wrangler.jsonc` 必須包含以下設定：
  - `"main": "src/index.ts"`
  - `"compatibility_date": "2026-11-01"`（PoC 驗證過的值；要改需另行決定）
  - `"durable_objects": { "bindings": [{ "name": "INSTALL", "class_name": "InstallDO" }] }`
  - `"migrations": [{ "tag": "v1", "new_sqlite_classes": ["InstallDO"] }]`（SQLite DO。不使用新版的 `exports` 寫法；兩者不能同時用，見 `materials/poc-report.md` §4 第 11 點）
  - `"assets": { "directory": "./public", "run_worker_first": ["/install", "/install/*", "/health", "/stats"] }`（PoC P7：沒有列在 `run_worker_first`、又不是靜態檔的路徑，會直接回 404 而不經過 Worker；`/install/*` 比對不到 `/install` 本身，所以兩個都要列）
  - **不得**在 `vars` 中設定 R3 的三個變數。
- 整個系統只有一個 DO 實例：Worker 一律用 `env.INSTALL.idFromName("install")` 取得 stub（取代 SPEC.md 的「只支援單一 worker」）。

### R2（替換）模組介面與測試存取方式

- `worker/src/index.ts`：
  - `export default` 一個 Worker handler（只有 `fetch`）；`export class InstallDO`（名稱和 `wrangler.jsonc` 的 `class_name` 一致，可以從 `install-do.ts` 再匯出）。
  - 對每個請求：先依 R3 驗證設定（不合法 → `500`，不轉給 DO）；合法時把 `/install`、`/install/*`、`/health`、`/stats` 的請求原封不動（方法、路徑、query、header、body）用 `stub.fetch` 轉給 DO，並原封不動回傳 DO 的回應（包含串流）。
  - Worker 不含商業邏輯，也不保留跨請求的狀態。
- `worker/src/install-do.ts`：`InstallDO` 負責 Store、Runtime（模擬器）、Broker 的全部行為。
- `worker/src/domain.ts`：必須提供 `contracts/domain.d.ts` 列出的全部名稱，簽名一致。
- 模組頂層不做 I/O。DO 的 I/O（建表、R25 復原、清 alarm）在建構子的 `ctx.blockConcurrencyWhile` 中完成。
- 獨立性：每個 `wrangler dev` 程序（各自的 persist 目錄）的狀態完全獨立。兩個程序使用同一個 persist 目錄時，行為未定義。
- `openapi.yaml` 沒有列出的路徑或方法：回應未定義，測試不可以斷言（`GET /` 以外不存在的靜態路徑，依 PoC P7 會由 Static Assets 回 404）。
- 測試只能透過以下方式存取系統：
  1. 對**自己啟動的** `wrangler dev` 程序送 HTTP；
  2. 從 `worker/src/domain.ts` import `contracts/domain.d.ts` 列出的名稱；
  3. 控制自己啟動的 `wrangler dev` 程序：啟動參數（`--port`、`--persist-to`、`--var`）與程序訊號（SIGINT、SIGTERM、SIGKILL）；
  4. 建立空的暫存目錄當 persist 目錄、重新啟動時重用它、測試結束後刪除它。

  不可以讀寫 persist 目錄的內容，不可以 import `index.ts`、`install-do.ts` 或其他非 domain 模組，不可以依賴 DO 內部結構或 wrangler 的內部端點。唯一的檔案例外是 AC12 的 `index.html` 逐 byte 比對（讀 repo 裡的兩個檔案）。

### R3（修改）設定值

- 設定值只來自 Worker 的環境變數（env binding），用 `wrangler dev --var NAME:VALUE` 傳入；沒有建構參數，也沒有 `db_path`（資料由 DO 管理，位置由 `--persist-to` 決定）。repo 裡不提交 `.dev.vars`。變數沒有提供時使用預設值。

  | 環境變數 | 預設 | 合法範圍 |
  |---|---|---|
  | `SSE_LOG_INTERVAL` | 0.15 | 有限數值，0 ≤ x ≤ 10（秒；0 表示下一步的 alarm 設在「現在」） |
  | `SSE_HEARTBEAT_SECONDS` | 15.0 | 有限正數（秒） |
  | `SSE_SUBSCRIBER_QUEUE_SIZE` | 1000 | 整數 ≥ 1 |

- 解析規則（值必須是字串；不是字串就不合法）：
  - `SSE_LOG_INTERVAL`、`SSE_HEARTBEAT_SECONDS`：去掉頭尾空白後必須完全符合 `^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$`，再轉成數值檢查範圍。
  - `SSE_SUBSCRIBER_QUEUE_SIZE`：去掉頭尾空白後必須完全符合 `^[+-]?[0-9]+$`，轉成數值後必須是安全整數，而且 ≥ 1。
- **快速失敗**：任何一個值不合法時，所有經過 Worker 的請求（`/install`、`/install/*`、`/health`、`/stats`）都回 `500`，`Content-Type: text/plain; charset=utf-8`，body 包含每一個不合法變數的名稱；請求不轉給 DO；不得改用預設值。`GET /` 由 Static Assets 提供、不經過 Worker，不受影響（L7）。
- 設定在每個經過 Worker 的請求時驗證（同一個程序內的值不會改變）。DO 取得設定時用同一個解析函式，不得自行套用不同的預設值或規則。

### R9（修改）事件 id

- **事件 id** 是 `<run_id>.<seq>`，兩邊都是十進位的 ASCII 數字（`formatEventId`）。
- 解析時（`parseEventId`）先去掉頭尾空白，必須完全符合 `^[0-9]+\.[0-9]+$`，**而且兩邊轉成數值後都 ≤ 2^53−1**（`Number.MAX_SAFE_INTEGER`）。不符合就是不合法，回傳 `null`，不拋出例外。
- 因此依 R18：query `last_event_id` 任一邊超過 2^53−1 → `422`；`Last-Event-ID` header 任一邊超過 → 視同沒帶。和 Python 版的差異見 L14。

### R13（修改）快照

- `GET /install` → `200 {run_id, scenario, status, last_seq, stages: [...]}`（形狀同 SPEC.md R13）。
- 狀態和 `last_seq` 必須在**同一個 `ctx.storage.transactionSync` 回呼**內讀出，所以快照一定剛好反映 `seq ≤ last_seq` 的全部事件。
- 這個 persist 目錄從來沒有執行過任何一輪時，回 `404`。

### R14（修改）開始安裝與模擬器

`POST /install`，body `{"scenario": str}`：

- **解析**：body 以 UTF-8 解析成 JSON（不檢查 `Content-Type`）。JSON 格式錯誤、頂層不是物件、缺少 `scenario`、`scenario` 不是字串、情境不存在 → `422`（body 內容不屬於合約）；額外的欄位直接忽略。`422` 的檢查先於 `409`。
- **互斥**：目前有一輪是 `running` → `409`。檢查和建立在同一個 `transactionSync` 回呼內完成：同時送出多個請求，最多只有一個成功。
- **成功**：在同一個 `transactionSync` 回呼裡刪除上一輪的全部事件和紀錄、建立新的一輪、寫入 `run_started`（`seq = 1`）；提交後安排第 0 步的 alarm（見下），然後回 `202 {run_id, scenario}`。回應送出之前，`run_started` 已經寫入，所以接著呼叫 `GET /install` 一定會得到這一輪的快照。
- 新一輪的 `run_id` 一定大於這個 persist 目錄曾經用過的所有 `run_id`（例如用 `AUTOINCREMENT`；PoC 建表時用過）。
- **模擬器（Alarm）**：
  - 把 `scriptFor(scenario)` 去掉第 1 筆（`run_started`，已由上面的交易寫入）之後，切成「步」：
    - 第 0 步：第一個 `log` 之前的全部事件；
    - 第 j 步（j ≥ 1）：第 j 個 `log` 事件，加上緊接在它後面、直到下一個 `log` 之前的全部非 `log` 事件。所以最後一步以 `run_finished` 結尾。
    - 例：`success` 的第 0 步是 `stage_started(prepare)`、`task_started(check_os)`；第 8 步是 `check_os` 的第 8 行 log、`task_succeeded(check_os)`、`task_started(check_disk)`。
  - 回 `202` 之前用 `setAlarm(Date.now())` 安排第 0 步。每次 `alarm()` **剛好執行一步**：在一個 `transactionSync` 回呼裡寫入這一步的全部事件（同一步的 `ts` 可以相同），提交後依 `seq` 順序廣播；如果這一步不含 `run_finished`，再用 `setAlarm(Date.now() + log_interval × 1000)` 安排下一步。
  - 要執行哪一步，只由 SQLite 中這一輪的 `scenario` 和 `last_seq` 決定，不依賴 DO 記憶體。所以平台重試同一個 alarm 時，不會重複寫入，也不會跳號。
  - `alarm()` 觸發時，如果沒有 `running` 的一輪，什麼都不做，也不安排下一次。
  - `alarm()` 中發生例外時：用 logger 記錄 `error` 後重新拋出，交給平台重試（PoC §4 第 11 點：指數退避，最多 6 次）。
  - 可以判定的時間性質：相鄰兩個 `log` 事件的 `ts` 差 ≥ `log_interval`（只有下限；上限受 alarm 延遲影響，見 L2）。非 `log` 事件和它前面的 `log`（或第 0 步）在同一個交易寫入，不額外等待。

### R15（修改）補讀 log

`GET /install/logs?run_id=<int>&after=<int>&until=<int>&limit=<int>` → 用 cursor 分批補讀 log：

- **整數解析**：每個參數的原始字串必須完全符合 `^[0-9]+$`（不去空白；不允許正負號、小數點、指數、空字串），而且轉成數值後 ≤ 2^53−1（§7 CF-GAP-1 已決定；和 Python 版的差異見 L14）；否則 `422`。同一個參數重複出現時，行為未定義，測試不可以斷言。
- `run_id` 必填，≥ 1（依 `openapi.yaml`）；`after` ≥ 0，預設 0；`until` ≥ 0，預設為請求當下的 `last_seq`；`limit` 1–1000，預設 500。不合法 → `422`。`422` 的檢查先於 `404`／`409`。
- 沒有任何一輪 → `404`；`run_id` 不是目前這一輪 → `409`。
- 回 `200 {run_id, items: [{seq, stage_id, task_id, line_no, level, text, ts}], next_after: int | null}`：`items` 只包含 `after < seq ≤ until` 的 `log` 事件，依 `seq` 遞增，最多 `limit` 筆。如果 `until` 以內還有更多 log，`next_after` 是本批最後一筆的 `seq`；沒有了就是 `null`。

### R16（修改）`/stats`

- `GET /stats` → `200 {subscribers: int}`。`subscribers` 是 DO 記憶體中**訂閱者集合目前的大小**。
- **加入**：一條 `/install/events` 回應在 R20 登記時加入集合。`404`、`204`，以及送出 `retry` 和 `reset` 後就關閉的回應，都不加入。
- **移除**：下列任何一種情況發生時移除，移除後 `/stats` 立即反映：
  1. 把 `run_finished` 交給串流之後，伺服器關閉串流（R21）；
  2. R23 的佇列溢位，伺服器關閉連線；
  3. 偵測到客戶端斷線：串流的 `cancel` 回呼被呼叫，或對串流 `enqueue` 拋出例外（R24）；
  4. DO 結束（程序結束或 DO 被回收）。新建構的 DO 集合是空的。
- 因為第 3 項只有在客戶端斷線後的寫入時才偵測得到（L1），客戶端關閉連線後、偵測到之前，**該連線仍然計入** `subscribers`；這段延遲的上限由 R24 規定。
- 新啟動的 `wrangler dev`（不論 persist 目錄裡有沒有資料）一開始是 0。

### R17（修改）`/health`

- `GET /health` → Worker 先依 R3 驗證設定，不合法時回 `500`（R3）；合法時轉給 DO，DO 回 `200 {"status": "ok"}`。
- DO 在處理任何請求之前，就已經完成建構（包括 R25 的建表、復原、清 alarm），所以 `/health` 回 `200` 代表這些都已完成。測試用它判斷 `wrangler dev` 已經就緒。

### R20（修改）就緒與重播

- DO 處理 `GET /install/events` 時，在**同一段沒有 `await` 的同步程式碼**內依序完成：
  1. 依 R18 判定要怎麼回應（讀取這一輪的狀態和 L）；
  2. 需要串流時，建立 `ReadableStream`，把這個訂閱者加入集合（從這時起計入 `/stats`，即時事件開始進入它的 R23 佇列）；
  3. 從 SQLite 讀出要重播的事件；
  4. 把 `retry: 3000\n\n`（`RETRY_BLOCK`）當作第一個區塊單獨交給串流，接著依序交給串流重播的事件。之後才接即時事件。
- DO 是單執行緒，這段程式碼執行期間不會有 alarm 或其他請求寫入，所以重播和即時之間不會漏，也不會重複。防護規則仍然保留：即時事件的 `seq` ≤ 已經交給串流的最大 `seq` 時，直接丟棄。
- 重播的事件包含 `run_finished` 時，交給串流後立即依 R21 關閉並依 R16 移除（在同一段同步程式碼內，所以 `/stats` 觀察不到）。
- 依 R16 不加入集合的回應（`404`、`204`，以及送出 `retry` 和 `reset` 後就關閉的回應），不更新 `/stats`。

### R22（修改）Heartbeat

- 每條串流各自用 DO 內的計時器（`setTimeout` 或 `setInterval`）觸發，不用 Alarm。PoC P6（本機 `wrangler dev`）實測：DO 內 15 s 的 `setInterval`，ping 在 15.0／30.01／45.01／60.01／75.01 s 到達，連線沒有斷。
- 「輸出」的定義：對該串流的 controller 呼叫 `enqueue`。`retry`、重播事件、從佇列移入串流的即時事件、`reset`、ping 都算。
- 距離上次輸出滿 `heartbeat_interval` 秒時，送出 `: ping\n\n`（`PING_COMMENT`），閒置期間週期性重複。ping 只在距離上次輸出 ≥ `heartbeat_interval` 時送出（時間下限）。
- ping 直接交給串流，不經過 R23 的佇列，也不受佇列狀態影響（R24 的斷線偵測靠的就是這些寫入）。
- 資料事件和 heartbeat 同時到期時，只送資料事件。
- 訂閱者依 R16 移除時，它的計時器必須清除。

### R23（替換）慢速訂閱者

**外部可觀察行為**（不論實作用設計 A 或 B，都必須成立）：

- 某個訂閱者的佇列滿了時，伺服器結束該連線，並依 R16 更新 `/stats`；
- 其他訂閱者不受影響；
- 被結束的客戶端用 `Last-Event-ID` 重連後，可以從 SQLite 補回全部事件；
- `SubscriberQueue` 的單元合約（`contracts/domain.d.ts`）和 AC10 第 1 部分不變。即使採用設計 B，`worker/src/domain.ts` 仍然要提供 `SubscriberQueue`，並通過 AC10 的單元測試。

**實作前的 spike（必要）**：

- 做正式實作之前，實作者先寫一個小 spike，在本機 `wrangler dev` 驗證：把 `ReadableStream` 當作 `Response` body、用 `new CountQueuingStrategy({ highWaterMark: 1 })` 建立時，`pull` 在什麼時候被呼叫、`enqueue` 之後 `desiredSize` 怎麼變化。客戶端持續讀取、暫停讀取兩種情況都要測。
- 結果寫進實作回報，並寫明最後採用設計 A 或 B。spike 的程式不交付，不放進 `worker/src/`、`worker/tests/`。
- 結果符合預期（客戶端有讀取時 `pull` 會被呼叫，而且 `desiredSize` 會隨未讀區塊增加而減少）→ 用設計 A。不符合 → 改用設計 B。

**設計 A（預設）**：

- 每個訂閱者有一個 `SubscriberQueue`（`contracts/domain.d.ts`），容量為 `subscriber_queue_size`，裡面放「已經廣播給它、但還沒交給回應串流」的即時事件。
- 回應串流是用 `new CountQueuingStrategy({ highWaterMark: 1 })` 建立的 `ReadableStream`。即時事件的流向：
  - 廣播時，佇列是空的**而且** `controller.desiredSize > 0`：直接交給串流；
  - 否則：`push` 進佇列；
  - 串流的 `pull` 回呼被呼叫時：從佇列依序 `shift` 出事件交給串流，直到佇列是空的或 `desiredSize ≤ 0`。
- 重播事件、`retry`、`reset`、ping 直接交給串流，不經過佇列，也不佔容量。
- 廣播是同步、不等待的：對每個訂閱者各做一次上面的處理。`push` 回傳 `false`（佇列裡已經有 `subscriber_queue_size` 筆）時，DO 立即關閉該連線（`controller.close()`，已經交給串流的區塊照常送出；佇列裡剩下的事件丟棄），並依 R16 移除。同一次廣播中，其他訂閱者照常處理，不受影響。
- 被關閉的客戶端用 `Last-Event-ID` 重連後，依 R18／R20 從 SQLite 補回全部事件。

**設計 B（spike 不符合預期時才使用）**：

- 不使用自己的佇列。回應串流用 `new CountQueuingStrategy({ highWaterMark: subscriber_queue_size })` 建立，所有區塊（`retry`、重播事件、即時事件、`reset`、ping）都直接交給串流。
- 廣播時，把即時事件交給某個訂閱者的串流之前，如果 `controller.desiredSize ≤ 0`，就算溢位：DO 立即 `controller.close()` 並依 R16 移除，同一次廣播中其他訂閱者照常處理。
- 和設計 A 的差異：重播事件、`retry`、ping 也會佔用容量。

### R24（修改）斷線與關機

- **斷線**：DO 只能從兩個訊號得知客戶端斷線：串流的 `cancel` 回呼，或 `enqueue` 拋出例外。兩者都必須處理，任何一個發生，就依 R16 移除該訂閱者並清除它的計時器。不可以依賴 `request.signal`（PoC 實測它沒有比 `cancel` 更早觸發）。
- **斷線時限**：透過真的 `wrangler dev`，客戶端關閉 TCP 連線後，`/stats.subscribers` 在 **`2 × heartbeat_interval + 1` 秒**內回到連線前的值（這是預期值，測試上限依 SPEC.md §10 放寬）。依據：客戶端斷線後，要等第 2 次寫入才偵測得到；閒置時每 `heartbeat_interval` 至少寫入一次（R22）。PoC（本機 `wrangler dev`）實測 1 s 心跳的偵測延遲是 1030–1705 ms。
- SPEC.md 中「直接用 ASGI 呼叫時，送入 `http.disconnect` 後 1 秒內返回」**不適用**（沒有 ASGI）。
- **關機（不適用，改為觀察項）**：SPEC.md R24 的「uvicorn 收到 SIGINT 或 SIGTERM 後，要在 3 秒內取消模擬器、結束所有串流並退出」**不適用於 Cloudflare 版**，因為關機行為由 wrangler 工具鏈決定，程式碼無法影響。
  - Worker／DO 沒有關機掛勾，程式不處理程序訊號。
  - 觀察項（只量測，寫進回報，不是通過條件）：還有 SSE 連線開著、而且有一輪正在執行時，對 `wrangler dev` 的程序群組送 SIGTERM（另外一次送 SIGINT），記錄下面三件事：到所有 SSE 連線在客戶端結束（EOF 或連線錯誤）花了多久、到群組裡的程序全部退出花了多久、有沒有留下 `workerd` 子程序。
  - 程序被終止時正在執行的一輪，在 SQLite 裡維持 `running`；下次用同一個 persist 目錄啟動時，依 R25 處理（必要項只驗證 SIGKILL 的情況，見 AC9 第 5 項）。

### R25（替換）持久化與啟動復原

- 事件與輪次資料只存在 DO 內建的 SQLite（`ctx.storage.sql`），持久到 `wrangler dev --persist-to <dir>`（沒有指定時是 wrangler 的預設位置 `worker/.wrangler/state`）。Python 版的 `sqlite3`、WAL 模式、`asyncio.to_thread` **不適用**（DO 的 SQLite API 是同步的本機呼叫）。
- 資料表的設計由實作決定，在 DO 建構子的 `ctx.blockConcurrencyWhile` 內用 `CREATE TABLE IF NOT EXISTS` 建立。
- **寫入**：每一個會產生事件的動作——R14 的建立新一輪、R14 模擬器的一步、下面的啟動復原——各自在**一個** `ctx.storage.transactionSync` 回呼裡完成。新事件的 `seq` 在同一個回呼裡由目前的 `last_seq` 算出。回呼裡不可以有 `await`，也不可以用 `sql.exec` 下 `BEGIN`／`COMMIT`（PoC §6 引用的官方文件）。回呼丟出例外時，整個動作 rollback（PoC P2 實測）。廣播只在 `transactionSync` 返回（已提交）之後進行。因此 `seq` 連續、沒有空號。
- **啟動復原**：DO 建構時，在 `blockConcurrencyWhile` 內、處理任何請求或 alarm 之前：
  1. 如果有狀態是 `running` 的一輪，就依照 R10 補上事件讓它結束：有 task 是 `running` 就補 `task_failed`（`error_code: "E_INTERRUPTED"`、`message: "伺服器在安裝途中停止"`、`hint: "請重新安裝"`）；有 stage 是 `running` 就補 `stage_failed`；最後補 `run_finished {result: "failed"}`。全部在一個 `transactionSync` 回呼內寫入，遵守 R7 的 `seq` 規則。
  2. 接著一律呼叫 `ctx.storage.deleteAlarm()`，清掉殘留的 alarm（不論第 1 步有沒有補事件）。
- DO 被回收後重建，或 `wrangler dev` 被終止後用同一個 persist 目錄重新啟動，都走這條路。重新啟動後，第一個經過 Worker 的請求（包括 `/health`）收到回應之前，復原就已經完成。
- 測試只能透過 HTTP 觀察儲存的內容。AC9 的復原測試只能重用 persist 目錄，不可以讀寫它的內容。

### R28（替換）log

- `worker/src/` 和 `worker/tests/` 底下不可以呼叫 `console` 的任何方法，唯一例外是 `worker/src/logger.ts`。
- 執行期的 log 一律透過 `logger.ts`。它只 export `debug`、`info`、`warn`、`error` 四個函式，簽名都是 `(message: string, fields?: Readonly<Record<string, string | number | boolean | null>>) => void`，每次呼叫輸出一行（格式由實作決定）。
- 檢查方式：`npm run lint` 通過（ESLint `no-console: "error"`，只對 `src/logger.ts` 關閉）；在 `worker/src` 與 `worker/tests` 搜尋 `console.`，只會出現在 `src/logger.ts`。

### R29（修改）程式規範

- `worker/` 的程式碼依照 `AGENTS.md` §9。`app/` 仍依照 `AGENTS.md` §1–§8。

### AC3（修改）斷線重連

透過真的 `wrangler dev`（`SSE_LOG_INTERVAL` 讓一輪持續夠久，例如 `0.02`），在隨機的 `seq` 位置（固定 seed）由客戶端切斷 TCP：銷毀 socket，不重用連線（例如 `node:http` 搭配 `agent: false` 並呼叫 `socket.destroy()`）。接著帶最後收到的 id 作為 `Last-Event-ID` 重新連線。跑 30 次都符合 AC1。伺服器端舊連線的退訂延遲（R24）不影響判定。需求：R18、R20。

### AC9（修改）SSE 共通

全部透過真的 `wrangler dev`。**必要項**（通過條件）：

1. 回應 header 符合 R19，而且沒有 `Content-Encoding` header（或它的值是 `identity`）；
2. 第一個區塊是 `retry`；
3. `SSE_HEARTBEAT_SECONDS` 設小（例如 `0.5`）、`SSE_LOG_INTERVAL` 設成它的數倍（例如 `3`）：一輪執行中、兩個 log 之間的閒置期間會收到 `: ping`，而且每個 ping 和前一次輸出的間隔 ≥ `heartbeat_interval`；
4. R24 的斷線時限；
5. 復原（關機相關的唯一必要項）：
   - 用子程序在獨立的程序群組啟動 `wrangler dev`，開始一輪（例如 `SSE_LOG_INTERVAL=1`）；
   - 從快照確認有 task 是 `running` 之後，對**整個程序群組**送 SIGKILL，並確認群組裡的程序都已經結束；
   - 再用同一個 `--persist-to`（可以換新的空閒埠）重新啟動；
   - `/health` 回 `200` 之後，`GET /install` 的 `status` 是 `failed`，而且有 task 的 `error.error_code` 是 `E_INTERRUPTED`。

**觀察項**（不是通過條件，結果寫進回報）：R24 的 SIGTERM／SIGINT 關機量測。也可以順便記錄：用同一個 persist 目錄重新啟動後，是否同樣以 `E_INTERRUPTED` 收尾。

需求：R19、R20、R22、R24、R25。

### AC10（替換）慢速訂閱者

客戶端的 `send` 阻塞無法在真的 TCP 上穩定重現（本機核心緩衝很大），所以分成兩部分：

1. **單元測試**（`worker/tests/unit/`，直接 import `SubscriberQueue`），全部要成立：
   - 容量 c 時，連續 `push` c 筆都回 `true`；第 c+1 筆回 `false`，而且 `size` 仍然是 c、內容不變；
   - `shift` 依 FIFO 順序取出；佇列是空的時回 `undefined`；
   - `shift` 之後可以再 `push` 成功；
   - 兩個實例互不影響：A 溢位時，B 照常 `push` 成功，內容完整；
   - 容量不是 ≥ 1 的安全整數（例如 0、-1、1.5、`NaN`）時，建構子拋出 `ValueError`。
2. **HTTP 冒煙測試**（`worker/tests/e2e/`，真的 `wrangler dev`，`SSE_SUBSCRIBER_QUEUE_SIZE=1`，`success` 情境）：客戶端從頭訂閱；每當串流在收到 `run_finished` 之前就結束，就用最後收到的 id 作為 `Last-Event-ID` 重新連線（R23）。最後一定會收到 `run_finished`，而且所有連線收到的事件 `seq` 合起來剛好是 `1..N`，沒有重複。這一輪結束、所有連線都關閉後，`/stats.subscribers` 在 R24 的斷線時限內回到 0。伺服器有沒有真的踢掉連線，取決於本機緩衝，**不做斷言**。

預設容量（1000）下 20 個訂閱者都收到完整序列、沒有連線被提早結束，由 AC11 涵蓋。需求：R23。

### AC11（修改）效能（perf）

真的 `wrangler dev`，`SSE_LOG_INTERVAL=0.005`：先開始一輪 `success`，接著 20 個訂閱者從頭訂閱；每個訂閱者都要收到完整的事件序列。延遲樣本是「20 個訂閱者都收到 `retry` 之後才產生的 `log` 事件」（只有 `log` 帶 `ts`）；每筆樣本的延遲 = 從該 log 的 `ts` 到第 20 個訂閱者解析完它的時刻，p95 < 200 ms。測試放在 `worker/tests/perf/`，用 `npm run test:perf` 執行。結果只代表本機 `wrangler dev`，不代表正式環境（L5）。需求：R20、R23。

### AC12（替換）品質關卡

從**乾淨 checkout**（沒有 `worker/node_modules/`、沒有 `worker/.wrangler/`）開始，在 `worker/` 下依序執行，全部都要成立：

1. `npm ci` 的 exit code 是 0；
2. 乾淨 checkout 啟動檢查（R1）：`npx wrangler dev --port <作業系統分配的空閒埠>` 能夠啟動，60 秒內 `GET /health` 回 `200`；檢查完後停止整個程序群組；
3. `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 的 exit code 全部是 0。其中 `typecheck` 代表 `tsconfig.json`（`src/`）和 `tsconfig.test.json`（`tests/`）兩個專案都通過；
4. `npm test` 裡要有一個測試，斷言 `worker/public/index.html` 和 `app/static/index.html` 逐 byte 相同（R26）。AC11 用 `npm run test:perf` 另外執行，不屬於本關卡。Python 版（`app/`）的品質關卡仍依 SPEC.md AC12，不在本移植範圍。需求：R28、R29。

---

## 4. SPEC.md 其他章節的處置

| 章節 | 處置 | 說明 |
|---|---|---|
| 開頭的核心不變式 | 不變 | 「SQLite」讀作 DO 的 SQLite；先寫後廣播由 R25 的交易規則保證 |
| §0 合約檔 | 修改 | 改看本檔 §0.1；`CONTRACT CONFLICT`／`CONTRACT GAP` 改成 `CF-CONFLICT`／`CF-GAP` |
| §9 瀏覽器手動驗收（Phase 4） | 不變 | 改開 `http://localhost:8787/` |
| §11 不在範圍內 | 修改 | 原有項目全部保留，另外加上：正式環境部署與 `--remote`、多個 DO 實例、WebSocket／Hibernation、正式環境的效能與斷線延遲 |

### §10 測試指引

| SPEC.md §10 項目 | 處置 | Cloudflare 版 |
|---|---|---|
| 不要用固定 sleep；串流用 `retry`，伺服器啟動用 R17 | 修改 | 串流就緒仍用 `retry`。伺服器啟動：輪詢 `GET /health` 直到 `200`，每次請求和整體都要有逾時（整體建議 60 秒） |
| 每個測試用自己的 `tmp_path` 當 `db_path`；快速執行時 `log_interval=0` | 修改 | **每個測試檔**自己啟動一個 `wrangler dev`：`--persist-to <新建的空暫存目錄>`、`--port <作業系統分配的空閒埠>`、用 `--var` 傳設定。同一個檔案裡的測試共用狀態，所以不可以依賴執行順序；需要全新狀態（例如 R13 的 `404`、R16 的初始 0）、不同設定或重新啟動的測試，放在自己的測試檔。`log_interval=0` 時每一步仍然是一次 alarm（L10） |
| ASGI 直接呼叫要送 `lifespan.startup`／`shutdown`；`httpx.ASGITransport` 不適合串流 | 不適用 | 沒有 ASGI |
| 時間斷言：下限嚴格，上限放寬到 ×3 + 200 ms | 不變 | 也適用 R24 的新時限 |
| 測 `404` 或 POST 之後馬上看快照，用 `log_interval` 讓那一輪跑久一點 | 不變 | 用 `--var SSE_LOG_INTERVAL:1` |
| AC9 復原測試是唯一可以碰 SQLite 檔案的例外 | 修改 | 只可以重用 persist 目錄（SIGKILL 程序群組後用同一個 `--persist-to` 重新啟動），不可以讀寫它的內容 |
| E2E 標記 `e2e`、效能標記 `perf` | 修改 | vitest 用目錄區分：`tests/unit/`（domain 純函式）、`tests/e2e/`（真的 `wrangler dev`）、`tests/perf/`（AC11）。`npm test` 跑 unit + e2e；`npm run test:perf` 跑 perf |
| 每個測試的名稱或 docstring 標出 R-id 或 AC-id | 不變 | 標在測試名稱或測試上方的註解 |

另外新增的指引（細節見 `AGENTS.md` §9.7）：

- 用 `detached: true` 讓 `wrangler dev` 自成一個程序群組；結束時對整個群組送 SIGTERM，逾時再送 SIGKILL，並確認群組裡已經沒有程序（`wrangler dev` 底下還有 `workerd` 子程序）。
- e2e 和 perf 測試檔依序執行，不平行（PoC 只驗證過一次跑一個 `wrangler dev`）。
- 不新增依賴：SSE 解析器自己寫在 `tests/helpers/`；一般請求用 Node 內建的 `fetch`；切斷 TCP 用 `node:http`（`agent: false`）並銷毀 socket。

---

## 5. 平台限制與已知差異

以下數字凡是標「PoC」的，都出自 `materials/poc-report.md`，而且都是**本機 `wrangler dev`** 的結果（TypeScript 那一欄）。

- **L1 斷線偵測延遲**：客戶端關閉 socket 後，DO 要等斷線後的**第 2 次** `enqueue` 才會觸發 `cancel`；第 1 次 `enqueue` 不會丟例外；沒有寫入就永遠偵測不到。PoC：1 s 心跳的延遲是 1705／1536／1367／1200／1030 ms；15 s 心跳一次是 18,459 ms，另一次 20 s 內沒有偵測到。`request.signal`（不論有沒有 `enable_request_signal`）沒有更早觸發。影響：斷線後到偵測到之前，`/stats` 仍然計入、DO 仍然保留該訂閱者的資源（R16、R24）。
- **L2 Alarm 延遲與重試**：PoC 50 次、目標 150 ms 的 alarm，間隔平均／最小／最大 153.7／152／163 ms，實際觸發比設定時間晚平均 3.5 ms、最多 13 ms。官方文件（PoC §4 第 11 點，正式環境，本機未驗證）：可能延遲最多 1 分鐘；失敗時指數退避重試，從 2 s 開始，最多 6 次；每次 `setAlarm` 算一次 row write。影響：R14 只保證 log 間隔的下限；重試用完之後，這一輪會停在 `running`，直到 DO 重建時由 R25 收尾。
- **L3 串流開著時的 15 分鐘上限**：官方文件寫「每個操作最多在 15 分鐘內阻止回收」，但沒有寫 SSE 串流滿 15 分鐘後會怎樣（PoC §4 第 11 點）。正式環境中長時間的串流可能被平台切斷；客戶端靠 `EventSource` 自動重連加上 R18／R20 補齊（R27 已經處理 `CONNECTING`）。`alarm()` 的 15 分鐘 wall-clock 上限不影響本系統，因為每一步都很短。
- **L4 本機與正式環境的差異**：PoC 全部在本機 `wrangler dev` 執行（前面有一層本機 proxy），**沒有驗證正式環境**：斷線偵測延遲、alarm 準度、閒置 70–140 秒回收、Static Assets 路由、回應壓縮都可能不同。本規格只驗收本機。
- **L5 效能數字**：AC11 的結果只代表本機單一 `wrangler dev`，不代表正式環境。
- **L6 單一 DO**：所有請求、alarm、廣播都在同一個 DO 裡依序執行；吞吐量受這一個實例限制（符合 SPEC.md §11「不做多 worker」）。
- **L7 設定錯誤不會讓啟動失敗**：Python 版是 `create_app()` 拋 `ValueError`、程序起不來；Cloudflare 版 `wrangler dev` 照常啟動，改成每個經過 Worker 的請求回 `500`，`GET /` 仍然回 `200`（R3）。
- **L8 R23 的整合行為無法在 TCP 上穩定重現**：只有 `SubscriberQueue` 的純邏輯可以確定地驗證（AC10）。另外，模擬器一步會同步廣播多個事件（一步最多 5 個，例如在 stage 交界：`log`、`task_succeeded`、`stage_succeeded`、`stage_started`、`task_started`），所以 `subscriber_queue_size` 小於這個數字時，即使是快速的客戶端也可能被關閉；預設值 1000 不受影響。R23 的設計 A 依賴 workerd 對 `ReadableStream` 回應 body 的 `pull`／`desiredSize` 行為，PoC 沒有驗證；實作前由 R23 的 spike 驗證，不符合時改用設計 B（重播事件也會佔容量）。
- **L9 DO 記憶體狀態**：重啟後訂閱者集合清空（`/stats` 回到 0），SQLite 資料保留（PoC §4 第 8 點）。正式環境中 DO 在一輪中途被重建（例如部署新版）時，這一輪會依 R25 以 `E_INTERRUPTED` 結束，和 Python 版程序重啟相同。
- **L10 `log_interval = 0`**：Python 版是「盡快送出」；Cloudflare 版每一步仍然是一次 alarm，一輪 `success` 約 170 次 alarm。單次 alarm 的額外延遲在 `setAlarm(Date.now())` 時是多少，PoC 沒有量測。
- **L11 JSON 編碼**：TypeScript 的 `JSON.stringify` 直接輸出 UTF-8 中文，Python `json.dumps` 預設輸出 `\uXXXX`。兩者解析後相同；測試必須用 JSON／SSE 解析器比對，不可以比對原始 bytes。
- **L12 少了 ASGI 直接呼叫**：SPEC.md R24 的「`http.disconnect` 後 1 秒內返回」和 AC10 的「讓 `send` 阻塞」無法再直接測試；分別由 R24 的新時限和 AC10 的替代方案取代。
- **L13 回應壓縮**：R19 要求不壓縮。平台（本機或正式環境）會不會自行壓縮 `text/event-stream`，PoC 沒有驗證；AC9 會檢查本機的 `Content-Encoding`。
- **L14 整數邊界（已決定，§7 CF-GAP-1）**：Python 的 `int` 沒有上限，TypeScript 的 `number` 只能精確表示到 2^53−1。Cloudflare 版把超過 2^53−1 的整數一律視為不合法，因此和 Python 版有以下差異：
  - query `last_event_id` 任一邊超過 → Cloudflare 回 `422`；Python 會當作合法起點（通常是 `r ≠ R`，回 `reset`）；
  - `Last-Event-ID` header 任一邊超過 → Cloudflare 視同沒帶（從 `seq = 1` 開始送）；Python 同上，會回 `reset`；
  - R15 任一參數超過 → Cloudflare 回 `422`；Python 會進入 handler（例如 `run_id` 不是目前這一輪 → `409`）。

  另外，R15 的解析規則比 FastAPI 更嚴格（不接受空白、`+`）。這些邊界輸入不屬於和 Python 版比較的基準。
- **L15 關機時間不保證**：`wrangler dev` 收到 SIGINT／SIGTERM 後多久退出、會不會留下 `workerd`，由工具鏈決定，PoC 沒有量測。R24 改成觀察項，不擋關卡；資料一致性由 R25 的啟動復原保證（AC9 第 5 項）。

---

## 6. 版本紀錄

| 版本 | 內容 |
|---|---|
| cf1.0 | 第一版（T8.2）。依 `materials/poc-report.md`（T8.1）與使用者／協調者已定案的 9 條架構決定撰寫；`docs/SPEC.md`、`contracts/openapi.yaml`、`contracts/domain.pyi` 不變。新增 `contracts/domain.d.ts` 和 `AGENTS.md` §9 |
| cf1.1 | 協調者決定（T8.2b）：§7 的 CF-CONFLICT-1、CF-GAP-1～5 全部定案，明細見下方「cf1.1 的決定明細」。修改 R1、R9、R15、R23、R24、AC9、AC12、L8、L14，新增 L15；`contracts/domain.d.ts` 改寫整數邊界的說明，陣列型別改寫成 `readonly X[]`（意義不變）；`AGENTS.md` §9 加入 `@types/node`、`postinstall`、R23 spike |

### cf1.0 的決定明細

（F1、F4 中和 cf1.1 衝突的部分，以「cf1.1 的決定明細」為準。）

| 項目 | 決定 | 影響 |
|---|---|---|
| F1 | `/stats` 也轉給 DO，`run_worker_first` 列出 `/install`、`/install/*`、`/health`、`/stats`。等 CF-CONFLICT-1 確認 | R1、R2、R16 |
| F2 | 模擬器的「一步」= 1 個 `log` + 緊接在後的非 `log` 事件（第 0 步是第一個 log 之前的事件）；每次 alarm 剛好一步；進度只由 SQLite 的 `last_seq` 推導，所以 alarm 重試不會重複；`alarm()` 中的例外記 log 後重新拋出 | R14 |
| F3 | 訂閱者數 = DO 記憶體集合的大小；斷線但還沒偵測到的連線仍然計入；逐項列出移除時機 | R16 |
| F4 | 斷線時限 = `2 × heartbeat_interval + 1` 秒（依 PoC「第 2 次寫入才偵測得到」）；關機時限維持 3 秒，改成對 `wrangler dev` 程序群組送訊號（CF-GAP-3） | R24、AC9 |
| F5 | 慢速訂閱者：每個訂閱者一個 `SubscriberQueue`（容量 `subscriber_queue_size`，滿了再 `push` 就回 `false`）＋`highWaterMark` 1 的串流；溢位時 `controller.close()` | R23、AC10、`domain.d.ts` |
| F6 | Heartbeat 用 DO 內的計時器；ping 不經過佇列 | R22 |
| F7 | 設定值的字串解析規則；不合法時回 `500`、`text/plain`、body 含變數名稱 | R3、R17 |
| F8 | query 整數的解析規則（`^[0-9]+$`、≤ 2^53−1）；`run_id ≥ 1` 依 `openapi.yaml`；`422` 先於 `404`／`409`；POST body 不檢查 `Content-Type` | R14、R15 |
| F9 | 啟動復原在 DO 建構子內完成，之後一律 `deleteAlarm()` | R25 |
| F10 | `domain.d.ts` 的對應規則：資料欄位維持 snake_case（就是線路格式）；`ValueError`／`KeyError` 宣告成同名的 `Error` 子類；`SCENARIOS` 用 `ReadonlyMap`。時間維持 ISO 字串：`domain.pyi` 裡沒有數值時間（只有 `ts: str`），所以沒有改成 epoch 秒 | `domain.d.ts`、§0.3 |
| F11 | log 只能透過 `worker/src/logger.ts`，其他地方禁用 `console.*` | R28 |
| F12 | 測試目錄分 unit／e2e／perf；e2e 和 perf 依序執行；`index.html` 逐 byte 比對放進 `npm test` | AC11、AC12、§4 |
| F13 | `compatibility_date` 固定為 PoC 驗證過的 `2026-11-01`；DO 用 `migrations` + `new_sqlite_classes` 宣告 | R1 |

### cf1.1 的決定明細

| 項目 | 決定 | 影響 |
|---|---|---|
| G1 | CF-CONFLICT-1：`/stats` 也轉給 DO，列入 `run_worker_first`（確認 F1） | 架構表、R1、R2 |
| G2 | CF-GAP-1 選 (a)：超過 2^53−1 的整數一律不合法；`parseEventId` 回 `null`（query → `422`，header → 視同沒帶）；R15 → `422`；`domain.d.ts` 維持 `number` | R9、R15、R18 說明、L14、`domain.d.ts` |
| G3 | CF-GAP-2：乾淨 checkout 下 `cd worker && npm ci && npx wrangler dev --port 8787` 必須直接可用，指令不改；需要時用根層 `"postinstall": "npm rebuild esbuild workerd"`；列為 AC12 的檢查項 | R1、AC12、`AGENTS.md` §9.2 |
| G4 | CF-GAP-3 選 (c)：關機時間只量測、寫進回報；R24 的 3 秒關機時限不適用、改為觀察項；AC9 中關機相關的必要項只留 SIGKILL 復原 | R24、AC9、L15 |
| G5 | CF-GAP-4 選 (a)：允許 `@types/node`（devDependency、精確釘選），`tsconfig.test.json` 檢查 `tests/`，`typecheck` 要兩個 tsconfig 都通過 | AC12、`AGENTS.md` §9.1–§9.3 |
| G6 | CF-GAP-5 選 (a)：正式實作前用 spike 驗證 workerd 的串流行為，結果寫進實作回報；不符合才改用設計 B。外部可觀察行為與 `SubscriberQueue` 合約不變 | R23、L8、`AGENTS.md` §9.5 |

---

## 7. 待決定與已決定

### 7.1 待決定

目前沒有待決定的項目（0 個）。

### 7.2 已決定（cf1.1，協調者決定）

每一項保留原本的問題描述，並寫出決定和新條文的位置。

- **CF-CONFLICT-1：`/stats` 的路由。**
  - **已決定**：`/stats` 也轉給 DO。架構表的路由、R1 的 `run_worker_first`、R2 的轉送清單都列出 `/install`、`/install/*`、`/health`、`/stats`（G1）。
  - 原問題：已定案的架構第 1 條只列出 `/install`、`/install/*`、`/health`，但 `openapi.yaml` 有 `GET /stats`；依 PoC P7，沒列進 `run_worker_first` 的話，`/stats` 會被 Static Assets 回 404。
- **CF-GAP-1：超過 2^53−1 的整數。**
  - **已決定：選 (a)**。超過 2^53−1 的整數一律不合法：`parseEventId` 回 `null`（query `last_event_id` → `422`，`Last-Event-ID` header → 視同沒帶）；R15 的參數 → `422`。`domain.d.ts` 維持 `number`。新條文見 §3 R9、§3 R15；和 Python 版的差異見 L14（G2）。
  - 原問題：Python 的 `int` 沒有上限，TypeScript 的 `number` 只能精確表示到 2^53−1。被否決的選項：(b) 改用 `bigint`、(c) 用字串比較大小。
- **CF-GAP-2：npm 11 的 install scripts。**
  - **已決定**：實作者必須讓乾淨 checkout 執行 `cd worker && npm ci && npx wrangler dev --port 8787` 時直接可用，啟動指令不改。如果 npm 預設不執行 `workerd`／`esbuild` 的 postinstall，解法是在 `worker/package.json` 根層的 `scripts` 加上 `"postinstall": "npm rebuild esbuild workerd"`。「乾淨 checkout 下 `npm ci` 之後 `npx wrangler dev` 能起來」列為 AC12 的檢查項。新條文見 §3 R1、§3 AC12、`AGENTS.md` §9.2（G3）。
  - 原問題：PoC §4 第 5 點，npm 11 預設不執行 `workerd`、`esbuild` 的 postinstall，沒有 `workerd` 執行檔就起不來。
- **CF-GAP-3：`wrangler dev` 的關機行為與時限。**
  - **已決定：選 (c)**。`wrangler dev` 的關機時間只量測、寫進回報，不當作通過條件。R24 的 3 秒關機時限不適用於 Cloudflare 版，改為觀察項。AC9 中關機相關的必要項只留「SIGKILL 後用同一個 `--persist-to` 重新啟動，R25 收尾出現 `E_INTERRUPTED`」。新條文見 §3 R24、§3 AC9、L15（G4）。
  - 原問題：關機行為由工具鏈決定，PoC 沒有量測。被否決的選項：(a) 維持 3 秒必要項、(b) 實測後放寬時限。
- **CF-GAP-4：測試需要 `@types/node`。**
  - **已決定：選 (a)**。允許 `@types/node`（devDependency、精確釘選），用 `tsconfig.test.json` 檢查 `tests/`；`npm run typecheck` 要 `tsconfig.json` 和 `tsconfig.test.json` 兩個都通過。已加進 `AGENTS.md` §9.3 的允許依賴清單（G5）。
  - 原問題：e2e 測試需要 `node:child_process`、`node:http`、`node:net`、`node:fs` 的型別，原本的允許清單沒有 `@types/node`。
- **CF-GAP-5：`ReadableStream` 的背壓語意。**
  - **已決定：選 (a)**。正式實作前先寫 spike，驗證 `Response` body 的 `ReadableStream` 在 `highWaterMark: 1` 下 `pull`／`desiredSize` 的實際行為，結果寫進實作回報；不符合預期才改用 (b)（設計 B：`desiredSize ≤ 0` 就算溢位）。不論採用哪一種，R23 的外部可觀察行為和 `SubscriberQueue` 的單元合約都不變。新條文見 §3 R23、L8、`AGENTS.md` §9.5（G6）。
  - 原問題：PoC 只驗證過在 `start` 裡直接 `enqueue`；R23 設計 A 依賴的 `pull`／`desiredSize` 行為沒有驗證過。
