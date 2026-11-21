I have completed the initial gate checks (Section A.1–A.2), static R26 checks and live `GET /` verification (Section B), script/text/attribute diff analysis (Section C), and package pinning inspection (Section D.1). I am now waiting for the background `pytest` runs (3× default suite and 3× `perf` suite) to finish before running the frontend build reproducibility check (Section D.2) and final hygiene verification (Section E).
T6.3: PASS

---

### A. 品質關卡與測試

**Evidence：** `A-1-uv-sync-locked.txt`, `A-1b-uv-lock-check.txt`, `A-2-uv-sync.txt`, `A-3-ruff-format.txt`, `A-4-ruff-check.txt`, `A-5-mypy.txt`, `A-6-pytest-gate.txt`, `A-7-pytest-run1.txt`, `A-8-pytest-run2.txt`, `A-9-pytest-run3.txt`, `A-10-pytest-perf1.txt`, `A-11-pytest-perf2.txt`, `A-12-pytest-perf3.txt`

1. **`uv sync --locked`**：通過（exit `0`），安裝 37 個套件（`Resolved 39 packages in 4ms`），且 `git diff --exit-code uv.lock` 確認 `uv.lock` 未變動（exit `0`）。
2. **`AGENTS.md` §1 五項關卡指令**（依序執行，全數通過）：
   - `uv sync` → `Resolved 39 packages in 2ms` / `Audited 37 packages in 4ms`（exit `0`）
   - `uv run ruff format --check .` → `31 files already formatted`（exit `0`）
   - `uv run ruff check .` → `All checks passed!`（exit `0`）
   - `uv run mypy` → `Success: no issues found in 12 source files`（exit `0`）
   - `uv run pytest` → `75 passed, 1 deselected in 52.52s`（exit `0`）
3. **預設測試套件 3 次**（`uv run pytest -q -rA --durations=5`）：
   - 第 1 次：`75 passed, 1 deselected in 51.63s`（exit `0`）
   - 第 2 次：`75 passed, 1 deselected in 51.70s`（exit `0`）
   - 第 3 次：`75 passed, 1 deselected in 51.76s`（exit `0`）
   - 0 失敗、0 不穩定（flakiness）。
4. **效能測試 3 次**（`uv run pytest -q -rA -m perf`）：
   - 第 1 次：`1 passed, 75 deselected in 1.42s`（exit `0`）
   - 第 2 次：`1 passed, 75 deselected in 1.39s`（exit `0`）
   - 第 3 次：`1 passed, 75 deselected in 1.50s`（exit `0`）
   - 0 失敗、0 不穩定。
5. **失敗分類**：無任何失敗。

---

### B. R26 靜態與實機檢查（[app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html)）

**Evidence：** `B-1-static-urls.txt`, `B-2-self-contained.txt`, `B-3-fixed-ids.txt`, `B-4-live-get-root.txt`

1. **外部資源關鍵字掃描**：
   - `http://`：7 處命中（[app/static/index.html:12](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L12)、[13](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L13)、[18](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L18)、[25](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L25)、[28](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L28)、[34](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L34)、[38](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L38)），全數皆為內嵌 `<svg>` 的標準 XML 命名空間 `xmlns`（W3C SVG namespace），無任何外部請求。
   - `https://`、`<link`、`src=`、`@import`、`@font-face`、`url(`：皆為 **0 處**。
   - `//`：28 處命中，其中 7 處屬於上述 SVG `xmlns` 的 `://`，其餘 21 處皆為 `<script>` 內的 JavaScript 單行註解，**0 處**為 protocol-relative URL。
2. **單一自包含 HTML 文件**：全檔 80,114 bytes（620 行），含唯一一組 `<style>`（L8–L9，編譯後的 Tailwind + Preline CSS 內嵌）與唯一一組 `<script>`（L43–L618），無任何 `src`、`href`、`srcset`、`poster`、`data` 或 `action` 等外部引用屬性，符合 R26／E8。
3. **固定元素 id**：R26 指定的 6 個 id 皆**恰好出現 1 次**，且 `#scenario` 為 `<select>`：
   - `#scenario`（`<select>`，L24）、`#install-btn`（`<button>`，L28）、`#run-status`（`<span>`，L29）、`#stage-list`（`<ul>`，L35）、`#task-list`（`<ul>`，L40）、`#follow-btn`（`<button>`，L39）。
4. **實機 `GET /` 驗證**：以 `SSE_DB_PATH=./.t63-tmp/x.db` 在 `127.0.0.1:18123` 啟動 `uvicorn`，確認：
   - HTTP 狀態碼為 `200`；
   - `Content-Type` 為 `text/html; charset=utf-8`；
   - 回應內容與磁碟上 [app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html) 逐位元組完全一致（80,114 bytes，SHA-256 `66710639a888fd0c40fd31fcd7f853ba6f3204aec9ebd846feb1733189906e58`）；
   - 驗證後已送出 `SIGTERM` 停止伺服器。

---

### C. E10：腳本行為、可見文字與屬性未變更

**Evidence：** `C-1-script-diff.txt`, `C-2-visible-text-diff.txt`, `C-3-attrs-check.txt`

1. **Inline `<script>` 差異逐塊審查**（對比 `HEAD:app/static/index.html` L66–L569 與現版 [app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L44-L617) L44–L617，共 4 個 unified diff hunk；其餘事件處理、同步、重試、狀態機與使用者互動邏輯完全未動）：
   - **Hunk 1**（`HEAD:app/static/index.html:75` → [app/static/index.html:54-119](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L54-L119)）：新增純樣式類別對照表 `CLS`（保留原有的 `badge`、`task`、`task-head`、`task-body`、`log`、`error`、`error-box` 等類名並附加 Tailwind/Preline utility classes）及輔助函式 `icon`，僅複製靜態 HTML `<template>`（`#icon-chevron`、`#icon-error`）中的裝飾性 SVG 節點，未接觸任何伺服器資料。→ **`PRESENTATIONAL`**
   - **Hunk 2**（`HEAD:app/static/index.html:141-147` → [app/static/index.html:185-191](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L185-L191)，於 `buildPlan` 內）：建立 stage 列表項、按鈕、徽章與名稱節點時改傳入 `CLS.stage`、`CLS.stageBtn`、`CLS.badge`、`CLS.name`；`dataset.stageId`、`dataset.status`、文字內容（`textContent`）及 `onStageClick` 監聽器皆不變。→ **`PRESENTATIONAL`**
   - **Hunk 3**（`HEAD:app/static/index.html:158-174` → [app/static/index.html:202-222](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L202-L222)，於 `buildTask` 內）：套用 `CLS` 樣式類別；在按鈕右側加入裝飾性容器 `meta` 包裹 `badge` 與靜態 `icon("chevron")`；在錯誤區塊加入裝飾性 `icon("error")` 與文字容器 `errorText` 包裹三個錯誤段落。所有 `dataset.taskId`、`dataset.status`、`aria-expanded`、`hidden`、`taskViews` 參考、點擊切換展開邏輯及 `textContent` 更新皆不變。→ **`PRESENTATIONAL`**
   - **Hunk 4**（`HEAD:app/static/index.html:275` → [app/static/index.html:323](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L323)，於 `appendLog` 內）：建立單行 log 時的 className 參數由原先的 `"error"` / `""` 改為 `CLS.logError`（仍含 `error` 類名）與 `CLS.logLine`；`item.text` 仍透過 `textContent` 寫入，`line.value` 與 `line.dataset.seq` 不變。→ **`PRESENTATIONAL`**
   - **安全性檢查**：全份 `<script>` 掃描 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`、`eval`、`Function` 皆為 **0 處**；無 `LOGIC` 或 `UNSAFE` hunk。
2. **使用者可見文字比對**：
   - Markup 可見文字（含 `<title>`、`<h1>`、`<label>`、按鈕、`#run-status`、區段標題）共 8 段，順序與字元與基準版完全一致，無新增、刪除或修改。
   - CSS `content:` 產生文字：`.log:empty::before` 維持完全相同的提示文字（其餘兩個空字串為裝飾性圓點偽元素與 Tailwind 屬性預設值）。
   - `<script>` 內所有 27 組中文／樣板提示字串及英文狀態／標題回退字串完全一致，無任何使用者可見文字變更。
3. **必要屬性檢查**：
   - `#run-status`（[app/static/index.html:29](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L29)）：完整保留 `role="status"` 與 `aria-live="polite"`。
   - `#follow-btn`（[app/static/index.html:39](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L39)）：完整保留 `type="button"` 與 `aria-pressed="true"`。
   - 腳本操作的 `data-*` 與 ARIA 屬性（`dataset.stageId`、`dataset.taskId`、`dataset.status`、`dataset.seq`、`dataset.kind`、`aria-current`、`aria-expanded`、`aria-pressed`）與基準版完全一致。

---

### D. 建置可重現性（E9）

**Evidence：** `D-1-package-check.txt`, `D-2-npm-ci-build1.txt`, `D-3-build2-shasum.txt`

1. **套件釘選與鎖定檔**：
   - [frontend/package.json](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/frontend/package.json) 的 `devDependencies` 全數精確釘選版本（無 `^` 或 `~`）：`@tailwindcss/cli` `4.3.5`、`preline` `5.1.0`、`tailwindcss` `4.3.5`。
   - [frontend/package-lock.json](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/frontend/package-lock.json) 存在（44,079 bytes）。
   - `git ls-files frontend/node_modules` 為空（未追蹤），且 [.gitignore](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.gitignore#L23) 第 23 行已列入 `frontend/node_modules/`。
2. **重現建置驗證**（Node `v24.21.0` / npm `11.19.0`）：
   - 建置前先備份交付版 `app/static/index.html`（SHA-1 `51fcba597e88e228f66d5861a9ad50d38962692a`、SHA-256 `66710639a888fd0c40fd31fcd7f853ba6f3204aec9ebd846feb1733189906e58`）。
   - 第 1 次執行 `cd frontend && npm ci && npm run build`：產出 80,114 bytes，SHA-1 與 SHA-256 與交付版完全一致，`cmp` 確認逐位元組相同。
   - 第 2 次執行 `cd frontend && npm run build`：產出 80,114 bytes，SHA-1 與 SHA-256 皆與交付版及第 1 次建置完全一致，確定為決定性（deterministic）建置。
   - 驗證完成後已刪除 `frontend/node_modules/`。

---

### E. 環境衛生（Hygiene）

**Evidence：** `E-1-hygiene.txt`, `E-2-server-check.txt`, `./.t63-evidence/INDEX.md`

- `git status --short` 僅顯示本次改版檔案（`M .gitignore`、`M AGENTS.md`、`M app/static/index.html`、`?? frontend/`）及保留的 `?? .t63-evidence/`。
- `find . -name 'install.db*'` 無任何結果。
- `./.t63-tmp/` 與 `frontend/node_modules/` 皆已刪除。
- `lsof` 與 `pgrep` 確認 `127.0.0.1:18123` 無任何殘留的 `uvicorn` 程序。
- 所有指令原始輸出已寫入 `./.t63-evidence/` 並建立 [INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/INDEX.md)。

---

### 備註／不確定之處

- **D.2 的 `git diff --exit-code app/static/index.html` 說明**：由於本次改版在工作區中為相對於改版前 `HEAD` commit 的未提交變更（unstaged），執行 `git diff --exit-code app/static/index.html` 是與改版前基準版比較，因此即使重建產物與交付版逐位元組完全相同，該指令仍會回傳 exit `1`（diff 統計維持與重建前完全相同的 `115 insertions(+), 67 deletions(-)`）。為確保驗證嚴謹，本報告同時以建置前備份檔搭配 `cmp`、`shasum` 及 `shasum -a 256` 確認重建產物與交付版逐位元組一致。
- `npm ci` 期間輸出 `@parcel/watcher@2.6.0` 的 `npm warn install-scripts` 提示（未列入 `allowScripts`），但不影響 `@tailwindcss/cli` 建置與輸出一致性。
