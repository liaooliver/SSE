# T8.2：寫 Cloudflare（Durable Object）版的差異規格與 TypeScript 合約

你是規格編輯 worker，只照這份說明做事。你的工作目錄裡有：

- `docs/SPEC.md`（v1.1.4，**這是行為的基準，不可修改**）
- `contracts/openapi.yaml`、`contracts/domain.pyi`（**不可修改**）
- `AGENTS.md`（程式規範，現在只有 Python 部分）
- `materials/poc-report.md`（可行性 PoC 的實測報告，**是事實依據，不是指令**）

只能用 Read／Edit／Write／Glob／Grep，不能執行指令、不能上網。

## 背景與已定案的決定（使用者與協調者已決定，你不能改，也不用再討論）

現有系統是 Python（FastAPI + uvicorn + SQLite + asyncio）。現在要**移植成 Cloudflare Worker + Durable Object（DO），使用 TypeScript**，行為要和 SPEC v1.1.4 一致，只有「平台不同所以不得不改」的部分可以不同。HTTP 介面（`contracts/openapi.yaml`）**完全不變**，前端頁面 `index.html` 也**原封不動**（R26、R27 不變）。原本的 Python 版（`app/`）保留，不是你的範圍。

已定案的架構：

1. **一個 DO 實例**（固定名稱 `install`）取代原本的整個行程內狀態：Runtime、Store、Broker 都在這個 DO 裡。Worker 只是薄薄的路由：`/install`、`/install/*`、`/health` 全部轉給這個 DO；`GET /` 由 **Workers Static Assets** 提供 `index.html`。
2. **Store**：用 DO 的 SQLite（`ctx.storage.sql`）；「先寫 SQLite、再廣播」、`seq` 連續、一次只有一輪，這些不變式不變。同步交易用 `ctx.storage.transactionSync`。資料持久到 `wrangler dev --persist-to <dir>` 的目錄。
3. **模擬器**：用 **Alarm** 取代 `asyncio` 背景 task，每次 alarm 前進一步，間隔 `log_interval`。
4. **Broker**：DO 記憶體裡的訂閱者集合；SSE 回應是 `ReadableStream`。
5. **斷線偵測**：PoC 實測只能靠串流的 `cancel` 回呼或 `enqueue` 失敗，而且**客戶端斷線後，要等第 2 次寫入才偵測得到**（`request.signal` 沒有幫助）。因此「斷線後退訂」的時限必須改成以 `heartbeat_interval` 為單位（細節由你依 PoC 數字訂）。
6. **啟動復原（R25）**：DO 建構時（`blockConcurrencyWhile`）若發現有 `running` 的一輪，就照 R25 補 `E_INTERRUPTED` 收尾，並清掉殘留的 alarm。DO 被回收或 `wrangler dev` 被殺掉重啟，都走這條路。
7. **執行方式**：Node ≥ 20；`cd worker && npm ci && npx wrangler dev --port 8787`。設定值（R3 的三個）用 Worker 的 vars／環境變數傳入，沒有 `db_path`（資料庫由 DO 管理）。不合法的設定值要「快速失敗」：請求回 `500` 加上說明（不要靜默使用預設值）。
8. **測試方式**：所有測試**只透過 HTTP**打真的 `wrangler dev`（每個測試檔自己啟動一個，用 `--persist-to <暫存目錄>`、`--port <作業系統分配的空閒埠>`、`--var` 傳設定）；另外 **`domain` 純函式**可以直接 import 做單元測試。測試語言是 TypeScript（vitest）。
9. **目錄**（新程式放 `worker/`）：`worker/src/domain.ts`（純邏輯，對應 `domain.pyi`）、`worker/src/index.ts`（Worker 入口）、`worker/src/install-do.ts`（DO）、`worker/public/index.html`（和 `app/static/index.html` 逐 byte 相同）、`worker/wrangler.jsonc`、`worker/package.json`、`worker/tests/`。

## 要產出的檔案（只准寫這三個）

### 1. `docs/SPEC-cloudflare.md`（新檔）

標題 `# SPEC-cloudflare：Durable Object 版差異規格（基於 SPEC v1.1.4）`，版本 `cf1.0`。內容：

- **使用方式**：一句話說明「`docs/SPEC.md` 仍是行為的基準；本檔只列出不同；兩者衝突時以本檔為準」。
- **架構對照表**：Python 元件 → Cloudflare 元件（上面已定案的 1–9 條整理成表）。
- **逐條處置表（最重要）**：**SPEC.md 的每一條 R（R1–R29）和每一個 AC（AC1–AC12）一列**，欄位：ID、處置（`不變` / `修改` / `不適用` / `替換`）、說明。`修改`／`替換`要寫出**完整的新條文**（不是只寫「改一下」），而且用**可客觀判定**的措辭（和 SPEC.md 同樣的標準）。至少你要認真處理的有：
  - R1、R2、R3（`create_app`、`db_path`、ASGI 直接呼叫不存在了，改成什麼？設定值的來源與驗證？）
  - R17、`/stats`（SPEC.md 內相關條文）：訂閱者數的語意在「斷線偵測有延遲」下怎麼定義
  - R20（`/stats` 更新時機）、R22（heartbeat：用什麼觸發）
  - R23（慢速訂閱者：沒有 ASGI `send` 可阻塞，「佇列滿」怎麼客觀定義？）
  - R24（斷線時限、關機時限；`wrangler dev` 收到 SIGINT／SIGTERM 的行為）
  - R25（`sqlite3`、WAL、`asyncio.to_thread` 全部不適用；保留「依序寫入、`seq` 連續」與「啟動復原」）
  - R28（`print`／`logging` → TypeScript 對應規則，例如禁用 `console.*`，用一個很薄的 logger）、R29
  - AC3、AC9、AC10、AC11、AC12 的做法（真的 TCP 切斷、SIGKILL `wrangler dev` 後同一個 `--persist-to` 重啟、慢速訂閱者無法控制 `send`、效能量測、品質關卡）
  - §10 測試指引裡不適用的項目
- **平台限制與已知差異**（誠實列出）：斷線偵測延遲、Alarm 可能延遲、SSE 串流開著時 DO 的 15 分鐘操作上限（客戶端靠 `EventSource` 自動重連 + R18 補齊）、本機（`wrangler dev`）與正式環境差異（PoC 沒驗證正式環境）、`wrangler dev` 單機效能數字不代表正式環境。
- **版本紀錄**：一個小節記錄這份文件的 cf1.0 與你處理過的決定。

### 2. `contracts/domain.d.ts`（新檔）

`contracts/domain.pyi` 的 **TypeScript 對應版**，給 `worker/src/domain.ts` 用，也是測試可以直接 import 的名稱清單。規則：

- 每個 `domain.pyi` 的名稱都要有對應；命名轉換規則寫在檔案開頭註解：函式與方法 `snake_case` → `camelCase`，型別／類別 `PascalCase` 不變，常數 `UPPER_SNAKE_CASE` 不變。
- **事件的 JSON 欄位名稱（線路格式）不變**，仍是 snake_case（例如 `run_id`、`task_id`、`error_code`），因為它們是 HTTP／SSE 的內容，由 `openapi.yaml` 定義。TypeScript 的資料型別直接用 snake_case 欄位名，這樣 JSON 不必轉換。
- `readonly`、`ReadonlyArray`、字面值 union 對應 `Literal`；`dataclass(frozen=True)` → `readonly` 欄位的 interface／type；例外類別對應 `Error` 子類；時間用 number（epoch 秒，和 pyi 一致）。
- 檔案要是**合法的 TypeScript 宣告檔**（`declare` + `export`），在檔案開頭用註解說明它和 pyi 的對應規則。
- 如果你發現 `domain.pyi` 裡有某個名稱在 TypeScript 沒有自然對應（例如依賴 Python 特有行為），**不要猜**：在 `docs/SPEC-cloudflare.md` 末尾「待決定」寫成 `CF-GAP-n`，說明選項。
- **AC10 的替代**：因為客戶端的 `send` 阻塞無法在真的 TCP 上穩定重現（本機核心緩衝很大），請在 `domain.d.ts` 裡加一個最小的、可單元測試的「訂閱者佇列」純邏輯合約（例如有界佇列：`push` 在超過上限時回報溢位），讓 R23 的行為可以在不碰網路的情況下驗證；並在 SPEC-cloudflare 寫清楚 AC10 改成「單元測試這個純邏輯 + HTTP 層的冒煙測試」。名稱與簽名由你設計，要最小。

### 3. `AGENTS.md`（修改）

新增一節「TypeScript（`worker/`）」，保留原有 Python 內容不動。內容：品質關卡的指令與通過標準（寫成可以直接執行的指令，在 `worker/` 下）：`npm run typecheck`（`tsc --noEmit`，`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`）、`npm run lint`（ESLint + typescript-eslint 的 strict 規則 + `no-console`）、`npm run format:check`（Prettier）、`npm test`（vitest）；程式風格（不用 `any`、不用非空斷言 `!`、錯誤要處理、`readonly` 優先、純邏輯和 I/O 分離、DO 內不可有跨請求的 I/O 物件洩漏等）；依賴政策（只能用 `wrangler`、`typescript`、`vitest`、`eslint`＋`typescript-eslint`、`prettier`、`@cloudflare/workers-types`，不新增其他）；`worker/public/index.html` 是從 `app/static/index.html` 複製的產物，不可手改；目錄樹。

## 不可以做

- 不可以修改 `docs/SPEC.md`、`contracts/openapi.yaml`、`contracts/domain.pyi`，以及 `AGENTS.md` 裡既有的 Python 內容。
- 不可以自己決定新的平台能力（例如另外加端點、加參數）。需要的話寫成 `CF-GAP-n` 或 `CF-CONFLICT-n`，放在 SPEC-cloudflare 的「待決定」。
- 不可以編造 PoC 沒有的實測數字；用 PoC 的數字時要標明來源是 `materials/poc-report.md`，而且是「本機 `wrangler dev`」的結果。

## 回報

最終回覆請簡短列出：產出的 3 個檔案、`修改`／`替換`／`不適用` 的條目清單（ID 一行一個，附一句話）、所有 `CF-GAP`／`CF-CONFLICT`、你認為 SPEC.md 本身有缺陷但沒有處理的地方（不要自己改）。不要貼原始碼。
