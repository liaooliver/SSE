T6.1 is done. `app/static/index.html` is now built locally from Tailwind CSS v4 + Preline UI, with the CSS inlined and no external resources. All five AGENTS.md checks pass; `pytest` finds no tests (exit 5), as expected. I checked the page in Chrome in light and dark mode at 1280 px and 375 px, with the success scenario and four failing scenarios.

## 1. 檔案
**新增**
- `frontend/package.json`、`frontend/package-lock.json`
- `frontend/src/index.html`：頁面模板，含 markup、原本的 script 和 CSS placeholder
- `frontend/src/input.css`
- `frontend/build.mjs`
- `frontend/README.md`

**修改**
- `app/static/index.html`：由 build 產生
- `.gitignore`：加上 `frontend/node_modules/`

**未修改**：Python 檔、`docs/`、`contracts/`、`AGENTS.md`、`pyproject.toml`、`uv.lock`。

**證據**：`/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.1/`，共 14 張 PNG 加 `INDEX.md`。

## 2. 版本與 build
- **版本（exact pin）**：`tailwindcss` 4.3.5、`@tailwindcss/cli` 4.3.5、`preline` 5.1.0，都是目前 npm 上的最新穩定版。
- **指令**：`cd frontend && npm ci && npm run build`（`build.mjs` 執行 Tailwind CLI `--minify`，再把 CSS inline 進模板）。
- **確定性**：連跑兩次 build，刪掉 `node_modules` 重新 `npm ci` 後再跑一次，三次的 `shasum -a 256` 都是 `66710639a888fd0c40fd31fcd7f853ba6f3204aec9ebd846feb1733189906e58`。
- **大小**：`app/static/index.html` 80,114 bytes，其中 CSS 約 50 KB。
- **檔頭**：第 1 行 `<!doctype html>`，第 2 行是「Generated from frontend/ … Do not edit by hand」註解。

## 3. 外部資源 grep（`app/static/index.html`）
| 字串 | 筆數 | 說明 |
|---|---|---|
| `http` | 7 | 全部是 inline SVG 的 `xmlns="http://www.w3.org/2000/svg"`。這只是 namespace 名稱，不會發出任何請求 |
| `<link` | 0 | |
| `src=` | 0 | 只有一個 `<script>`，沒有 src |
| `@import` | 0 | |
| `@font-face` | 0 | 只用系統字型 |
| `url(` | 0 | |

Tailwind 的授權 banner 原本帶有 `https://tailwindcss.com`。`build.mjs` 會去掉網址、保留 `MIT License` 字樣。build 也會自動檢查：CSS 只要出現 `http(s):`、`@import`、`@font-face`、`url(` 或 `</style` 就直接失敗。

## 4. Script 變更（全部只影響外觀，邏輯不變）
- **L54–112 新增 `const CLS = {…}`**：集中放 Tailwind/Preline class 字串。狀態樣式全靠既有的 `data-status`、`aria-current`、`aria-expanded`、`aria-pressed`、`data-kind` 屬性選擇器，所以更新狀態的程式一行都沒改。
- **L114 新增 `icon(name)`**：從靜態 `<template id="icon-chevron|icon-error">` clone 裝飾用 SVG。
- **L183、186**：stage 的 `li` 和 `button` 的 class 從空字串改成 `CLS.stage`、`CLS.stageBtn`。
- **L188–189**：`"badge"` 改成 `CLS.badge`，stage 名稱 span 的 `""` 改成 `CLS.name`。
- **L200、203、206、210、212、213、215**：`"task"`、`"task-head"`、`"badge"`、`"task-body"`、`"log"`、`"error-box"` 和錯誤代碼 `<p>` 換成對應的 `CLS.*`。原本的語意 class 名稱保留在字串開頭。
- **L207–209**：task head 多一個 `meta` span，包住 badge 和 chevron 圖示。badge 仍是同一個節點，`view.badge.textContent` 的更新方式不變。
- **L218–220**：錯誤框改成「圖示 + `errorText` 容器」，三個 `<p>` 移進容器。`errorCode`、`errorMessage`、`errorHint` 的參考和 `textContent` 寫法不變。
- **L321**：log 行的 class 從 `"error" : ""` 改成 `CLS.logError : CLS.logLine`。`CLS.logError` 仍含 `error` 這個 class。

沒有用 `innerHTML` 或 `insertAdjacentHTML`，資料一律走 `textContent`。

## 5. 設計摘要
- **Header**：Preline navbar token（`bg-navbar`、`border-navbar-line`）加裝飾用品牌圖示。`<select>` 用 Preline 基本 select 樣式（`bg-layer`、`border-layer-line`），箭頭是 inline SVG。`#install-btn` 是 Preline solid primary 按鈕，disabled 時 `disabled:opacity-50`。
- **`#run-status`**：獨佔一整列的 soft alert。`idle` 灰；`running` 藍色加旋轉 spinner；`succeeded` teal；`failed` 和 `error` 紅。前面的圓點或 spinner 用 `::before`，不新增元素。`role` 和 `aria-live` 保留。
- **左右兩欄**：都是 Preline card（`bg-card`、`border-card-line`、`rounded-xl`、`shadow-2xs`），h2 是 card header 加圖示。寬度 ≥768px 時並排（`md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]`），較窄時上下堆疊、stage 在上。
- **Stage 清單**：Preline sidebar nav 樣式。選取中的 stage 是藍底、藍框，左側有色條；失敗的 stage 是紅底、紅字、紅色條。
- **狀態 badge**：Preline soft badge。`pending` 灰、`running` 藍加 spinner、`succeeded` teal、`failed` 紅。設定 `motion-reduce` 時停止動畫。
- **Task**：可收合的卡片列，chevron 跟著 `aria-expanded` 旋轉；`running` 藍框、`failed` 紅框加紅字。
- **Log**：永遠是深色面板（`scheme-dark`），等寬字型，行號用 `marker`；長行會換行，所以 375px 下不會出現水平捲軸。錯誤行是紅字、粗體、淡紅底。「（尚無 log）」維持原本的 CSS generated content。
- **錯誤框**：Preline soft red alert 加圖示。
- **`#follow-btn`**：用 `aria-pressed:` 切換。開啟時是藍色 pill 加實心點；關閉時是白底按鈕加空心圈。
- **Dark mode**：跟著 `prefers-color-scheme`，用 Tailwind 預設的 media `dark:` variant。
- **Focus**：所有互動元素都有自訂的 `focus-ring` 或 `focus-ring-inset` 外框，light 和 dark 都看得到。
- **沒有加入 Preline JS**：沒有新的互動元件，不需要。

## 6. Gate 輸出
```
uv sync                    → Resolved 39 packages in 4ms / Audited 37 packages in 9ms
uv run ruff format --check → 17 files already formatted
uv run ruff check .        → All checks passed!
uv run mypy                → Success: no issues found in 12 source files
uv run pytest              → collected 0 items … 1 warning (PytestConfigWarning: No files were found in testpaths)，exit 5
```
`pytest` exit 5 是因為目前沒有 `tests/`（照 brief 不建立），不是失敗。

## 7. 瀏覽器檢查
**HTTP**：用 `SSE_DB_PATH=<mktemp>/t.db SSE_LOG_INTERVAL=0.05` 在 port 18642 啟動 server。`GET /` 回 `200`、`text/html; charset=utf-8`，內容和產生的檔案逐 byte 相同。結束時只停掉我自己啟動的 PID 61709/61711，暫存 DB 已刪除，`./install.db` 沒有被建立。

**檢查方法**：
- 使用者的 Chrome 開著 Dark Reader（filter 模式），每次截圖前都只在該頁面內暫時停用它的 style。
- **Light mode 是模擬的**：OS 是深色，所以我把頁面 CSSOM 裡 `prefers-color-scheme` 的 media rule 暫時改成 `not all`。**Dark mode 用的是真實的 OS 設定。**
- **375px**：Chrome 視窗最窄只能到 500px，所以我把同一個 `/` 放進 375px 寬的同源 iframe 裡測。量到 `scrollWidth` = 375，沒有水平捲動。

**檢查過的情境**：
- success：執行中與完成
- 失敗：`dependency_missing`、`disk_full`、`permission_denied`、`network_unreachable`
- 點選其他 stage 讓 follow 關閉、展開 pending task 看空 log、用 Tab 看 focus ring
- `#install-btn` 執行中為 disabled

**對比度**：用 JS 量文字和實際合成背景的 WCAG 對比，light 和 dark 兩種主題、所有狀態都量了。最低是 5.25（`#install-btn`），其他都 ≥ 5.87。

**分頁**：我開的分頁都已關閉。

**截圖**：
- 舊版：`before-01-idle-light-1280`、`before-02-failed-checksum-light-1280`、`before-03-success-running-light-1280`、`before-04-success-finished-light-1280`、`before-05-success-finished-375`
- 新版 1280px：`after-01-success-running-light-1280`、`after-02-success-finished-light-1280`、`after-03-failed-dependency-light-1280`、`after-04-follow-off-empty-log-focus-light-1280`、`after-05-success-running-dark-1280`、`after-06-failed-network-dark-1280`
- 新版 375px：`after-07-failed-permission-light-375`、`after-08-failed-permission-errorbox-light-375`、`after-09-success-running-dark-375`

## 8. 不確定與可能衝突之處
- **Preline 的 dark 是 `.dark` class，不是 media query**：我在 `input.css` 用 `@media (prefers-color-scheme: dark)` 手動複製了實際用到的約 20 個 token 的 dark 值。Preline 升級時要記得同步。另外 dark 的 `--primary` 我刻意維持 blue-600，不用 Preline 的 blue-500，因為 blue-500 配白字只有約 3.7:1，達不到 AA。
- **體積成本**：引入 `theme.css` 會把整個 `:root` token 區塊和一個用不到的 `.dark{}` 區塊（合計約 17 KB）也輸出進頁面。
- **刻意沒照 Preline 文件做的部分**：沒用 `@tailwindcss/forms`，因為不在允許的套件清單內，select 改成 `appearance-none` 加 inline SVG 箭頭；也沒加 Preline 文件裡的 `@source "…/preline/dist/*.js"`，因為沒有使用 Preline JS。
- **`data-kind` 沒有 `info`**：script 實際的值是 `idle`、`running`、`succeeded`、`failed`、`error`。我把 `running` 當成 brief 說的 info（藍色），`idle` 用中性灰。
- **新增的節點和 id**：都是裝飾或排版用。包括 header 內兩層 wrapper div、包住 select 的 span（label 和 select 的關聯不變）、task head 的 `meta` span，以及 `<template id="icon-chevron">`、`<template id="icon-error">`。所有 SVG 都加了 `aria-hidden="true"`。可見文字比對新舊完全一致。
- **npm 11 的 install-scripts 警告**：`@parcel/watcher` 的 install script 被略過，但它只有 `--watch` 模式會用到，build 正常。
- **README 寫的 Node 版本**：寫「Node.js 20 or later」是我的推斷，實際只在 Node 24.21.0 / npm 11.19.0 上測過。
- **Dark Reader 會反轉頁面**：它在 filter 模式下也會反轉這個新頁面（舊版也一樣）。要避免得加 `<meta name="darkreader-lock">`，但那是新元素，所以我沒有加。