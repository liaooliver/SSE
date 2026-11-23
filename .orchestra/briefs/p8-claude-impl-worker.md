# T8.3：實作 Cloudflare Worker + Durable Object 版（`worker/`）

你是實作 worker，只照這份說明做事。你的工作目錄是專案根目錄（impl-ws）。**所有檔案只寫在這個資料夾裡。**

## 目標

把現有的 Python 版（`app/`，FastAPI + SQLite + SSE）移植成 **TypeScript 的 Cloudflare Worker + 一個 Durable Object**，放在新的 `worker/` 目錄。行為依規格：

1. `docs/SPEC.md`（v1.1.4，行為基準）
2. `docs/SPEC-cloudflare.md`（cf1.1，**逐條列出和 SPEC.md 不同之處；兩者衝突時以它為準**）
3. `contracts/openapi.yaml`（HTTP 形狀，不變）、`contracts/domain.d.ts`（`worker/src/domain.ts` 必須提供的名稱與簽名，是 `domain.pyi` 的 TS 版）
4. `AGENTS.md` **§9（TypeScript）**：完成的定義、必要設定、依賴政策、程式風格、Worker／DO 寫法、專案結構。**請逐字照做，尤其 §9.2、§9.3、§9.5、§9.6。**

先把這四份讀完，再動手。`app/`（Python 實作）是**行為參考**：domain 的純邏輯（劇本、事件驗證、`applyEvent`、`formatEvent`、`parseEventId` 等）請照著移植，行為必須逐項一致；`app/static/index.html` 是前端頁面，原封不動複製成 `worker/public/index.html`（`cp`，逐 byte 相同，不得編輯）。

## 起點素材

- `materials/toolchain/package.json`、`package-lock.json`：**已經驗證可安裝、版本精確釘選的依賴**（wrangler 4.166.0、typescript 6.0.3 等；`typescript-eslint` 要求 typescript < 6.1，所以不能用 7.x）。請複製到 `worker/` 當起點，**不要改任何版本**，只補上 `package.json` 的 scripts（§9.2 固定名稱）、`prettier` 欄位、`name`／`private` 等。裝好後的 npm 會警告 `esbuild`／`workerd` 的 postinstall 沒有執行——這正是 SPEC-cloudflare R1 的 `postinstall: npm rebuild esbuild workerd` 要解決的事，請實測確認需要並加上。
- `materials/poc-report.md`：可行性 PoC 的實測報告，含 Durable Object／SQLite／Alarm／SSE 串流／斷線偵測／Static Assets 的**可運作程式片段與陷阱**。這是事實依據，請善用（尤其 §3、§4）。

## 工作順序（請照順序）

1. **鷹架**：建立 `worker/` 的設定檔（`package.json`、`tsconfig.json`、`tsconfig.test.json`、`eslint.config.mjs`、`vitest.config.ts`、`.prettierignore`、`wrangler.jsonc`），`npm ci` 成功，並確認「乾淨 checkout（刪掉 `node_modules/`、`.wrangler/`）下 `npm ci && npx wrangler dev --port <埠>` 直接能起來」（AC12）。
2. **R23 spike（AGENTS §9.5，正式實作前必做）**：寫一個臨時 spike（放 `worker/.spike/`，**完成後刪掉，不交付**），驗證 `Response` body 的 `ReadableStream` 在 `CountQueuingStrategy({ highWaterMark: 1 })` 下 `pull`／`desiredSize` 的實際行為（客戶端持續讀取、暫停讀取兩種情況）。據此決定採用設計 A 或 B，把結果寫進回報。
3. **`src/domain.ts`**：照 `contracts/domain.d.ts`，純函式，無 I/O，不讀 `Date`、不用亂數。含 `SubscriberQueue`。
4. **`src/install-do.ts`**、**`src/index.ts`**、**`src/logger.ts`**：依 SPEC-cloudflare 與 AGENTS §9.5。Alarm 驅動模擬；先寫 SQLite（`transactionSync`）再廣播；R25 復原在 `blockConcurrencyWhile` 裡做；斷線偵測靠 `cancel`／`enqueue` 失敗＋心跳；所有訂閱者結束路徑共用同一個移除函式。
5. **頁面**：`cp app/static/index.html worker/public/index.html`。
6. **自我檢查**：自己啟動 `wrangler dev`，用 `curl`／你自己寫的臨時腳本驗證主要行為（`GET /`、`/install/plan`、`/install/scenarios`、`POST /install` 202／409／422、`/install/logs` 分頁、`/install/events` 的 SSE 格式與 `Last-Event-ID` 重連、各 R18 分支、`/stats`、`/health`、R25 的 SIGKILL 後以同一個 `--persist-to` 重啟復原）。臨時腳本放 `worker/.tmp/`，**完成後刪掉**。你**沒有**測試可以用（測試由別人寫，你看不到也不要找）。
7. **品質關卡**：AGENTS §9.1 的指令都要跑。`npm run typecheck`、`npm run lint`、`npm run format:check` 必須通過。你的工作區沒有測試檔，所以 `npm test`／`npm run test:perf` 會因為找不到測試而失敗，這是預期的：**不要為此改 scripts 或加 `--passWithNoTests`**，在回報裡寫明「沒有測試檔，未能執行」即可（`tsconfig.test.json` 在沒有測試檔時，用 `include` 的 glob 不會報錯；若會報錯，請回報而不是放寬設定）。

## 限制

- 只准新增或修改 `worker/`。**不可以修改** `app/`、`docs/`、`contracts/`、`AGENTS.md`、`pyproject.toml`、`frontend/`。
- 依賴只用 AGENTS §9.3 的清單；需要別的就回報 `NEED DEPENDENCY`。
- 本機埠號只能用 **18800–18899**（`wrangler dev --port 188xx`，`--inspector-port` 用 189xx）。做完要把所有 `wrangler`／`workerd`／`node` 程序**停掉**，用 `pgrep -fl "wrangler|workerd"` 確認為空。
- **絕對不要**執行：`wrangler login`、`wrangler deploy`、任何 `--remote`、`wrangler d1 …`，或任何需要 Cloudflare 帳號的動作。遇到登入提示就停下來並回報。
- 規格和合約沒寫到的不要猜：回報 `CONTRACT GAP: …`；互相矛盾的回報 `CONTRACT CONFLICT: …`。不要自己多加測試可能依賴的公開介面。
- 不可以碰這個資料夾以外的路徑；不可以上網（`npm ci` 從 registry 安裝除外，不能用其他網路）。

## 回報

最終回覆用 AGENTS.md §8 的格式，並包含：
1. 改了哪些檔案（`worker/` 下的清單）。
2. §9.1 每個指令的輸出（貼結果摘要，沒跑過就說沒跑過）。
3. **R23 spike 的結果與採用的設計（A 或 B）**。
4. 乾淨 checkout 下 `npm ci && npx wrangler dev` 的實測結果。
5. 自我檢查做了哪些項目、各自的結果；哪些項目沒驗證到。
6. 所有 `CONTRACT GAP`／`CONTRACT CONFLICT`／`NEED DEPENDENCY`。
7. 殘留檢查（`pgrep` 結果、已刪除的 `.spike/`、`.tmp/`）。

不要貼大段原始碼。
