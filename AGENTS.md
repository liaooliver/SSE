# AGENTS.md — 程式碼規範（所有 AI worker 共用）

本檔是**寫程式的規範**，適用於 Claude、Codex、agy 所有 worker。
規格（要做什麼）看 `docs/SPEC.md` 和 `contracts/`；本檔只管「怎麼寫」。
兩者衝突時以 `docs/SPEC.md`／`contracts/` 為準，並在回報中指出衝突。

## 1. 完成的定義（每次交付前必須全部通過，並把輸出貼進回報）

```bash
uv sync
uv run ruff format --check .
uv run ruff check .
uv run mypy
uv run pytest            # 有 tests/ 時
```

- 不要只說「應該可以」；沒有跑過就說沒跑過。
- 不准用 `# noqa`、`# type: ignore` 讓檢查過關，除非同一行附上錯誤代碼和理由，例如
  `# type: ignore[attr-defined]  # starlette 型別缺漏，見 issue #123`。
- 不准修改 `pyproject.toml` 的 lint／型別設定來讓自己的程式過關。覺得規則不合理就在回報裡提出。

## 2. 工具

| 工具 | 用途 | 規則 |
|---|---|---|
| uv | 依賴與虛擬環境 | 只用 `uv add` / `uv add --dev`；不用 pip；`uv.lock` 要一起交付 |
| Ruff | lint + 格式化 | 設定在 `pyproject.toml`，不另開設定檔 |
| mypy | 型別檢查（strict + pydantic plugin） | CI 唯一的型別關卡 |
| pytest | 測試 | `asyncio_mode = auto`；`-m e2e` 真的 uvicorn、`-m perf` 效能 |
| Node / npm | 只用於建置前端 | 只在 `frontend/` 裡用 `npm ci`、`npm run build`；版本精確釘選，`package-lock.json` 要一起交付；執行 app 與測試不需要 |

不准新增依賴，除非任務說明允許。需要時在回報寫 `NEED DEPENDENCY: <套件> — <理由>`。

## 3. 型別

- 所有函式（含巢狀函式、端點、fixture 以外的 helper）都要標**參數和回傳型別**。
- **禁止 `Any`**（mypy 已開 `disallow_any_explicit`）。外部輸入先當 `object`，驗證後再收窄。
- 用現代語法：`list[str]`、`dict[str, int]`、`X | None`；不用 `typing.List`、`Optional`、`Union`。
- 從 `collections.abc` import `AsyncIterator`、`Callable`、`Sequence` 等，不從 `typing`。
- 結構化資料：
  - 跨 HTTP 邊界 → Pydantic v2 `BaseModel`
  - 純領域邏輯內部 → `@dataclass(frozen=True, slots=True)` 或 `TypedDict`（以 `contracts/domain.pyi` 為準）
- 常數用 `Final`；固定字串集合用 `Literal` 或 `enum.StrEnum`。
- 不用 `cast()` 掩蓋型別問題；真的需要時附註理由。

## 4. FastAPI 寫法

- **App 工廠**：`create_app(...)` 建立 app，模組層級 `app = create_app()`。不在 import 時做 I/O。
- **啟動／關閉**：用 `lifespan`（`@asynccontextmanager`），不用已棄用的 `@app.on_event`。
  共享狀態放 `app.state` 或由 lifespan 建立的物件，不用模組層級的可變全域變數。
- **參數宣告一律用 `Annotated`**：
  ```python
  @router.get("/events/clock")
  async def clock(
      count: Annotated[int, Query(ge=1, le=100)] = 10,
      last_event_id: Annotated[str | None, Header()] = None,
  ) -> StreamingResponse: ...
  ```
- **依賴注入**：共享資源（broker、設定）用 `Depends`，並定義型別別名
  `BrokerDep = Annotated[Broker, Depends(get_broker)]`。
- **回應**：所有 JSON 端點（包含 `/health`）都用 Pydantic model 或明確的回傳型別，
  讓 FastAPI 自動產生符合 `contracts/openapi.yaml` 的 schema；不回傳裸的 `dict` 當作公開 API 形狀。
- **狀態碼**：用 `status.HTTP_201_CREATED` 等常數，不寫魔術數字。
- **錯誤**：用 `HTTPException` 或註冊 exception handler；不吞例外、不用裸 `except:`。
- **async 規則**：
  - `async def` 裡不能呼叫阻塞函式（`time.sleep`、同步檔案／網路 I/O）。Ruff `ASYNC` 會擋。
  - 背景 task 要有人持有參考並在關閉時取消；不留孤兒 task。
  - 處理 `asyncio.CancelledError` 時清理完要重新拋出，不可吞掉。
- **SSE**：串流用 async generator；客戶端斷線時要停止產生並釋放資源（見 SPEC）。

## 5. 專案結構

```
app/
  main.py        # create_app、lifespan、掛 router；不放商業邏輯
  domain.py      # 純邏輯：不 import fastapi、不做 I/O（依 contracts/domain.pyi）
  routers/       # 只處理 HTTP：解析輸入 → 呼叫 domain/服務 → 組回應
    page.py      # GET /（R26）：回傳 app/static/index.html
  static/
    index.html   # R26 頁面的建置產物，由 frontend/ 產生（單一 HTML，不依賴外部資源）；不得手動編輯
  schemas.py     # Pydantic request/response model
  broker.py      # 執行期狀態（訂閱者、歷史）等有狀態元件
frontend/        # R26 頁面的建置來源；只有改頁面時需要 Node
  package.json   # 精確釘選 tailwindcss、@tailwindcss/cli、preline 版本；`build` script
  package-lock.json  # 鎖定檔，要一起交付
  src/index.html # 頁面模板（markup + inline script）；頁面唯一的來源
  src/input.css  # Tailwind + Preline 匯入、自訂 CSS
  build.mjs      # 跑 Tailwind CLI，把 CSS inline 進模板，寫出 ../app/static/index.html
  README.md      # 建置與修改頁面的說明
tests/           # 由測試作者負責；實作者不得建立或讀取
contracts/       # 合約檔（唯讀，只有規格編輯 worker 能改）
```

- 依賴方向：`routers → domain / broker`，`domain` 不依賴任何其他 app 模組。
- 公開介面只有 `create_app`、`app`、以及 `contracts/domain.pyi` 列出的名稱。
  其他模組名稱可以自由調整，但不得讓測試依賴它們。
- 要改頁面：編輯 `frontend/src/`，在 `frontend/` 裡跑 `npm run build`，並把原始碼和產生的
  `app/static/index.html` 一起 commit。

## 6. 風格

- 格式交給 `ruff format`，不手動排版爭論。行寬 100。
- 命名：模組／函式／變數 `snake_case`，類別 `PascalCase`，常數 `UPPER_SNAKE`；內部 helper 加底線前綴。
- 函式短小、單一職責；早回傳取代深層巢狀。
- 公開函式寫 docstring，說明行為並引用 SPEC 的 R-id（例如 `"""R11: ..."""`）。
- 不留註解掉的程式碼、不留 `print`（用 `logging`）、不留未說明的 `TODO`（要寫 `TODO(<任務ID>)`）。
- 不寫「為了以後可能用到」的抽象或設定；只做 SPEC 要求的事。

## 7. 測試（測試作者適用）

- 只根據 `docs/SPEC.md` 與 `contracts/` 寫；只能 import `create_app`、`app`、`domain.pyi` 列出的名稱。
- 每個測試名稱或 docstring 標出需求 ID；回報附「測試名稱 → R-id」對照表。
- HTTP 測試用 `httpx.AsyncClient(transport=ASGITransport(app=...))`；SSE 解析可用 `httpx-sse`。
- 不用 `sleep` 猜時間；用 `create_app` 的參數縮短間隔，所有等待都要有逾時。
- 合約不夠用時不要猜：回報 `CONTRACT GAP: <缺什麼> — <為什麼需要>`。

## 8. 回報格式

每次結束都回報：改了哪些檔案、第 1 節所有指令的實際輸出、沒做完或不確定的地方。

## 9. TypeScript（`worker/`）

本節只適用 `worker/`（Cloudflare Worker + Durable Object 版）。§1–§5、§7 的指令與工具規則只適用 Python（`app/`）；
§6 的精神（函式短小、早回傳、不留註解掉的程式碼、`TODO(<任務ID>)`、不寫多餘的抽象）和 §8 的回報格式
同樣適用 `worker/`（回報時貼的是 §9.1 的輸出）。
規格看 `docs/SPEC.md` + `docs/SPEC-cloudflare.md`（兩者衝突時以後者為準）、`contracts/openapi.yaml`、
`contracts/domain.d.ts`。規格和本節衝突時以規格為準，並在回報中指出。

### 9.1 完成的定義（每次交付前在 `worker/` 下全部通過，並把輸出貼進回報）

```bash
cd worker
npm ci                 # 乾淨 checkout 下必須成功，之後 npx wrangler dev 能起來（§9.2、AC12）
npm run typecheck      # tsc --noEmit：tsconfig.json（src）和 tsconfig.test.json（tests）兩個都要通過
npm run lint           # eslint .
npm run format:check   # prettier --check .
npm test               # vitest run：tests/unit + tests/e2e
npm run test:perf      # AC11：只在交付效能相關變更或任務要求時執行
```

- 通過標準：每個指令的 exit code 都是 0。沒有跑過就說沒跑過。
- 不准用註解讓檢查過關，除非同一行寫出規則名稱和理由：
  - `// @ts-expect-error -- <理由>`；禁用 `// @ts-ignore` 和 `// @ts-nocheck`。
  - `// eslint-disable-next-line <規則名稱> -- <理由>`；禁用整個檔案範圍的 `eslint-disable`。
- 不准修改 `tsconfig*.json`、`eslint.config.mjs`、Prettier 設定來讓自己的程式過關。覺得規則不合理就在回報裡提出。

### 9.2 必要的設定

- `package.json` 的 scripts（名稱固定）：
  - `"dev": "wrangler dev --port 8787"`
  - `"typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json"`：
    兩個 tsconfig 都要通過才算通過，任何一個失敗 exit code 就不是 0
  - `"postinstall": "npm rebuild esbuild workerd"`：只在 npm 預設不執行 `workerd`／`esbuild` 的
    postinstall 時（例如 npm 11）加上，而且這是唯一允許的解法（SPEC-cloudflare R1）
- 乾淨 checkout（沒有 `node_modules/`、`.wrangler/`）下，`cd worker && npm ci && npx wrangler dev --port 8787`
  必須直接可用，不可以要求額外的手動步驟，也不可以更改這個指令（AC12 會檢查）。
  - `"lint": "eslint ."`
  - `"format": "prettier --write ."`、`"format:check": "prettier --check ."`
  - `"test": "vitest run tests/unit tests/e2e"`、`"test:perf": "vitest run tests/perf"`
- `tsconfig.json`（`src/` + `../contracts/domain.d.ts`）與 `tsconfig.test.json`（`tests/` + `src/domain.ts`）都要開：
  `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、
  `noFallthroughCasesInSwitch`、`noEmit`。`tsconfig.json` 的 `types` 只用 `@cloudflare/workers-types`；
  `tsconfig.test.json` 的 `types` 用 `node`（`@types/node`），負責檢查 `tests/`。
- `eslint.config.mjs`（flat config）：typescript-eslint 的 `strictTypeChecked` + `stylisticTypeChecked`，
  另外開 `no-console: "error"`（只對 `src/logger.ts` 關閉）和 `@typescript-eslint/prefer-readonly`。
  不使用 `@eslint/js`（不在允許清單）。
- Prettier：設定放在 `package.json` 的 `"prettier"` 欄位，`printWidth: 100`；`.prettierignore` 排除
  `public/`、`.wrangler/`。
- vitest：`vitest.config.ts`，`fileParallelism: false`（e2e／perf 一次只跑一個 `wrangler dev`）。

### 9.3 依賴政策

- 只允許這些 devDependencies，版本精確釘選（不用 `^`、`~`），`package-lock.json` 一起交付：
  `wrangler`、`typescript`、`vitest`、`eslint`、`typescript-eslint`、`prettier`、`@cloudflare/workers-types`、
  `@types/node`（只給 `tsconfig.test.json` 檢查 `tests/` 用）。
- `dependencies` 必須是空的：Worker 只用平台 API。
- 只用 `npm ci`／`npm install --save-dev --save-exact`；不用其他套件管理工具。
- 需要其他套件時不要自己加，在回報寫 `NEED DEPENDENCY: <套件> — <理由>`。

### 9.4 型別與程式風格

- 不用 `any`（明確或隱含都不行）。外部輸入（JSON、query、header、env）先當 `unknown`，用型別守衛收窄。
- 不用非空斷言 `!`。不用 `as` 掩蓋型別問題（`as const` 可以）；真的需要時同一行註明理由。
- `readonly` 優先：欄位 `readonly`、`readonly T[]`（typescript-eslint `array-type` 的預設寫法）、
  `Readonly<Record<K, V>>`；優先用 `const`。
- 所有 export 的函式都要標參數和回傳型別。用 `satisfies` 讓 JSON 回應的物件對照
  `openapi.yaml` 形狀的型別。
- 錯誤要處理：不准空的 `catch`；`catch` 只能做規格寫明的處理（例如 `enqueue` 失敗 → 退訂），
  否則用 logger 記錄後重新拋出。不留浮動的 Promise（`no-floating-promises`）。
- 命名：函式／變數 `camelCase`，型別／類別 `PascalCase`，常數 `UPPER_SNAKE_CASE`，檔名 `kebab-case`；
  線路格式的 JSON 欄位維持 snake_case（`run_id` 等，見 `contracts/domain.d.ts`）。
- HTTP 狀態碼用具名常數集中定義，不在各處寫魔術數字。
- export 的函式寫 JSDoc，說明行為並引用 R-id（例如 `/** R11: ... */`）。
- 不留 `console.*`（只有 `src/logger.ts` 可以，R28）、不留註解掉的程式碼、不留未說明的 `TODO`。
- 用 ESM；除了 Worker 入口（平台規定要 `export default`）之外不用 default export。

### 9.5 Worker／DO 寫法

- **純邏輯與 I/O 分離**：`src/domain.ts` 不 import `cloudflare:workers`、不做 I/O、不讀 `Date`、不用亂數、
  不呼叫 logger。型別從 `contracts/domain.d.ts` re-export（`export type { ... } from`），
  並讓 typecheck 抓得到值和合約不一致（例如另一個檔案以 `import type * as Contract` 搭配型別指派對照）。
- **`src/index.ts`**：只驗證設定（R3）、用 `idFromName("install")` 取得 stub、原封不動轉送請求和回應。
  不放商業邏輯，模組層級沒有可變狀態。
- **`src/install-do.ts`**：Store、Runtime、Broker 都放在 `InstallDO` 的實例欄位裡；建構子的 I/O
  只在 `ctx.blockConcurrencyWhile` 裡做（建表、R25 復原、`deleteAlarm`）。
- **R23 spike（正式實作前必做）**：先寫一個小 spike，在本機 `wrangler dev` 驗證 `Response` body 的
  `ReadableStream` 在 `CountQueuingStrategy({ highWaterMark: 1 })` 下 `pull`／`desiredSize` 的實際行為
  （客戶端持續讀取、暫停讀取兩種情況）。結果和最後採用的設計（A 或 B）寫進實作回報。spike 程式不交付，
  不放進 `src/`、`tests/`。不論採用哪一種設計，R23 的外部行為和 `SubscriberQueue` 合約都不變。
- **交易**：每個會產生事件的動作用一個 `ctx.storage.transactionSync`；回呼裡不 `await`、不下 `BEGIN`；
  提交之後才廣播（R25）。
- **不可以有跨請求的 I/O 物件洩漏**：不可以把 `Request`、`Response`、`request.signal` 或其他屬於
  單一請求的 I/O 物件存進 DO 欄位。唯一例外是訂閱者的 `ReadableStream` controller（PoC 驗證過可以
  跨請求、從 alarm 寫入），它必須在訂閱者移除時一起丟掉。
- **訂閱者的生命週期**：每個訂閱者持有 controller、`SubscriberQueue`、heartbeat 計時器。所有結束路徑
  （`run_finished`、R23 溢位、`cancel` 回呼、`enqueue` 例外）都呼叫同一個移除函式；這個函式清除計時器、
  從集合移除，而且重複呼叫也安全。不留孤兒計時器。
- 不依賴 `request.signal` 偵測斷線（R24）。
- `alarm()`：沒有 `running` 的一輪就直接返回；發生例外時用 logger 記錄後重新拋出（R14）。

### 9.6 專案結構

```
worker/
  package.json         # 精確釘選；§9.2 的 scripts；prettier 設定
  package-lock.json    # 鎖定檔，要一起交付
  wrangler.jsonc       # main、compatibility_date、durable_objects、migrations、assets（SPEC-cloudflare R1）
  tsconfig.json        # src + ../contracts/domain.d.ts
  tsconfig.test.json   # tests
  eslint.config.mjs
  vitest.config.ts
  .prettierignore
  src/
    index.ts           # Worker 入口：驗證設定 → 轉給 DO；export default handler、export InstallDO
    install-do.ts      # InstallDO：Store（SQLite）、Runtime（alarm）、Broker（訂閱者）
    domain.ts          # 純邏輯，依 contracts/domain.d.ts
    logger.ts          # 唯一可以呼叫 console 的地方（R28）
  public/
    index.html         # 從 app/static/index.html 複製的產物，逐 byte 相同；不得手動編輯
  tests/
    unit/              # domain 純函式（含 SubscriberQueue，AC10）
    e2e/               # 真的 wrangler dev
    perf/              # AC11
    helpers/           # 啟動／停止 wrangler dev、SSE 解析器等
```

- 依賴方向：`index.ts → install-do.ts → domain.ts`；`domain.ts` 不依賴任何其他模組（只 import 合約的型別）。
- 公開介面只有 `contracts/domain.d.ts` 列出的名稱（測試可以 import）和 `wrangler.jsonc` 引用的 export。
  其他模組名稱可以自由調整，但不可以讓測試依賴它們。
- `.wrangler/`、`node_modules/`、`.dev.vars` 不提交。
- **頁面**：`worker/public/index.html` 是產物，只能用 `cp ../app/static/index.html public/index.html`
  更新（在 `worker/` 下）。要改頁面，先照 §5 改 `frontend/` 並重新產生 `app/static/index.html`，再複製。
  `npm test` 會檢查兩個檔案逐 byte 相同（AC12）。

### 9.7 測試（測試作者適用）

- 只根據 `docs/SPEC.md`、`docs/SPEC-cloudflare.md`、`contracts/` 寫。從 `src/domain.ts` 只能 import
  `contracts/domain.d.ts` 列出的名稱；不可以 import `src/` 的其他模組。
- 存取系統只透過 SPEC-cloudflare R2 列出的方式；不可以讀寫 persist 目錄的內容（唯一的檔案例外是
  AC12 的 `index.html` 比對）。
- 每個測試檔自己啟動一個 `wrangler dev`：
  - `npx wrangler dev --port <port> --persist-to <dir> --var NAME:VALUE ...`，cwd 是 `worker/`；
  - `<dir>` 用新建的空暫存目錄；`<port>` 由作業系統分配（先 listen 埠 0 取得號碼）；啟動失敗時換埠重試，
    次數有上限；
  - 用 `detached: true` 讓它自成一個程序群組；就緒判斷用輪詢 `GET /health` 直到 `200`（每次請求和
    整體都要有逾時）；
  - 結束時對整個群組送 SIGTERM，逾時再送 SIGKILL，確認群組裡已經沒有程序，再刪除暫存目錄。
- 需要全新狀態、不同設定或重新啟動的測試，放在自己的測試檔。
- 不新增依賴：一般請求用 Node 內建的 `fetch`；SSE 解析器自己寫在 `tests/helpers/`；切斷 TCP 用
  `node:http`（`agent: false`）並銷毀 socket。
- 不用 `sleep` 猜時間；用 `--var` 縮短間隔；所有等待都要有逾時。時間斷言依 SPEC.md §10
  （下限嚴格，上限 ×3 + 200 ms）。
- 每個測試名稱或測試上方的註解標出 R-id／AC-id；回報附「測試名稱 → R-id」對照表。
- 合約不夠用時不要猜：回報 `CF-GAP: <缺什麼> — <為什麼需要>`。
