T6.3: PASS

所有回歸檢查（A–E）皆已通過，無實作或測試失敗、無 flakiness、無 R26 外部資源違規、無 `LOGIC` / `UNSAFE` 腳本變更或可見文字變動，前端建置可完全重現且工作區乾淨。所有命令原始輸出皆已保存於 [.t63-evidence/INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/INDEX.md)。

---

### A. 品質關卡與測試

- **證據檔**：
  - [A-01-uv-sync-locked.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-01-uv-sync-locked.txt)
  - [A-02-uv-sync.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-02-uv-sync.txt)
  - [A-03-ruff-format-check.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-03-ruff-format-check.txt)
  - [A-04-ruff-check.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-04-ruff-check.txt)
  - [A-05-mypy.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-05-mypy.txt)
  - [A-06-pytest-gate.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-06-pytest-gate.txt)
  - [A-07-pytest-run1.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-07-pytest-run1.txt) / [A-08-pytest-run2.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-08-pytest-run2.txt) / [A-09-pytest-run3.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-09-pytest-run3.txt)
  - [A-10-pytest-perf-run1.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-10-pytest-perf-run1.txt) / [A-11-pytest-perf-run2.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-11-pytest-perf-run2.txt) / [A-12-pytest-perf-run3.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/A-12-pytest-perf-run3.txt)

1. **鎖檔同步**：`uv sync --locked && git diff --stat uv.lock` → 尾行 `Audited 37 packages in 6ms`、`uv.lock` 無任何變更（exit `0`）。
2. **`AGENTS.md` §1 五項關卡**：
   - `uv sync` → `Resolved 39 packages in 2ms` / `Audited 37 packages in 0.45ms`（exit `0`）
   - `uv run ruff format --check .` → `31 files already formatted`（exit `0`）
   - `uv run ruff check .` → `All checks passed!`（exit `0`）
   - `uv run mypy` → `Success: no issues found in 12 source files`（exit `0`）
   - `uv run pytest` → `75 passed, 1 deselected in 51.40s`（exit `0`）
3. **預設測試套件連跑 3 次**（`uv run pytest -q -rA --durations=5`）：
   - 第 1 次：`75 passed, 1 deselected in 51.29s`（exit `0`）
   - 第 2 次：`75 passed, 1 deselected in 51.53s`（exit `0`）
   - 第 3 次：`75 passed, 1 deselected in 51.56s`（exit `0`）
   - 無任何失敗或 flakiness。
4. **效能測試連跑 3 次**（`uv run pytest -q -rA -m perf`）：
   - 第 1–3 次皆為 `1 passed, 75 deselected in 1.39s`（exit `0`，`test_ac11_log_latency` 全數通過）。
5. **失敗分類**：無任何失敗。

---

### B. `app/static/index.html` 的 R26 靜態與實機檢查

- **證據檔**：
  - [B-01-external-refs-scan.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/B-01-external-refs-scan.txt)
  - [B-02-structure-and-ids.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/B-02-structure-and-ids.txt)
  - [B-03-http-get-root.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/B-03-http-get-root.txt)

1. **外部資源樣式掃描**（[app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html)）：
   - `https://`、`<link`、`src=`、`@import`、`@font-face`、`url(`：**皆為 0 筆**。
   - `http://`：共 7 筆，位於 `app/static/index.html:12, 13, 18, 25, 28, 34, 38`，**全部為 inline `<svg>` 的標準 XML namespace 宣告**（`xmlns` 指向 W3C SVG 2000 namespace），無外部資源請求。
   - `//`：共 28 筆，其中 7 筆為上述 SVG `xmlns` 中的雙斜線，其餘 21 筆皆位於 `app/static/index.html:46–597` 的 inline `<script>` 單行註解；CSS 區塊與 HTML 標記中無任何 protocol-relative URL。
2. **單一自包含 HTML 文件確認**：
   - 檔案以 `<!doctype html>` 開頭，包含剛好 1 個 inline `<style>`（51,506 bytes）與 1 個無外部屬性之 inline `<script>`（20,938 bytes），無任何 `<link>`、`<img>`、`<iframe>`、`<audio>`、`<video>`、`<source>`、`<object>`、`<embed>`、`<base>` 或 `href=` 屬性。
3. **R26 固定元素 id 唯一性確認**：
   - `#scenario`（`<select>`，[index.html:24](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L24)）、`#install-btn`（`<button>`，[index.html:28](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L28)）、`#run-status`（`<span>`，[index.html:29](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L29)）、`#stage-list`（`<ul>`，[index.html:35](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L35)）、`#task-list`（`<ul>`，[index.html:40](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L40)）、`#follow-btn`（`<button>`，[index.html:39](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L39)）皆**各出現剛好 1 次**，且 `#scenario` 確為 `<select>`。
4. **實機 `GET /` 驗證**：
   - 以 `SSE_DB_PATH=./.t63-tmp/x.db` 在 `127.0.0.1:18163` 啟動 `uvicorn app.main:app`。
   - `GET /` 回傳 `HTTP/1.1 200 OK`、`content-type: text/html; charset=utf-8`、`content-length: 80151`。
   - 回應內容與磁碟上 [app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html) 的 SHA-256 皆為 `9aed92c47b6c879a3e0253cf2317f0d18fa53c53c59b62fd3b533100711008da`，`cmp` 確認 byte-identical；測畢已以 `SIGTERM` 停止伺服器並確認連接埠關閉。

---

### C. E10：腳本行為、可見文字與屬性未變動

- **證據檔**：
  - [C-01-script-diff.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/C-01-script-diff.txt)
  - [C-02-visible-text-diff.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/C-02-visible-text-diff.txt)
  - [C-03-required-attributes.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/C-03-required-attributes.txt)

1. **Inline `<script>` diff 逐一判定**（基線 `HEAD:app/static/index.html:65–570` vs 新版 [app/static/index.html:43–618](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L43-L618)），共 **4 個 hunk**，無任何 `LOGIC` 或 `UNSAFE`：
   - **Hunk 1**（基線 `:74` 之後 → 新版 [index.html:54–118](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L54-L118)）— **`PRESENTATIONAL`**：新增 `CLS` 常數物件集中管理 Tailwind/Preline class 名稱（並保留原語意 class 如 `badge`、`task`、`task-head`、`task-body`、`log`、`error`、`error-box`），以及輔助函式 `icon`，僅以 `cloneNode(true)` 複製頁面靜態 `<template id="icon-chevron">` 與 `<template id="icon-error">` 中的純裝飾性 `<svg>`，不接觸任何伺服器資料。
   - **Hunk 2**（`buildPlan`，基線 `:141–147` → 新版 [index.html:185–191](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L185-L191)）— **`PRESENTATIONAL`**：建立 stage 的 `<li>`、`<button>`、`<span>` 與 `badge` 時改傳入 `CLS` 的對應 class 字串；DOM 事件監聽、`dataset.stageId`、`dataset.status` 與節點文字設定方式皆未變。
   - **Hunk 3**（`buildTask`，基線 `:158–174` → 新版 [index.html:202–222](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L202-L222)）— **`PRESENTATIONAL`**：為 task 相關節點套用 `CLS` class 字串，將 `badge` 與靜態 `chevron` 圖示包進裝飾性 `<span>` 容器，並將三個錯誤段落與靜態 `error` 圖示包進裝飾性 `<div>` 容器。`taskViews` 持有的參考、`aria-expanded`、`hidden`、`dataset.taskId`/`dataset.status` 及收合點擊行為均未變。
   - **Hunk 4**（`appendLog`，基線 `:275` → 新版 [index.html:323](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L323)）— **`PRESENTATIONAL`**：建立 log 行 `<li>` 時依 `item.level` 改傳 `CLS.logError` 或 `CLS.logLine`（取代原本的 `"error"` 與空字串），仍以 `textContent` 寫入 `item.text`，且保留 `error` class、`line.value`、`dataset.seq` 與自動捲底邏輯。
   - 安全性確認：全檔案掃描 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write` 均為 0 筆。
2. **使用者可見文字比對**：
   - HTML 標記可見文字節點序列與基線完全一致（8 個文字節點：頁面標題、主標題、情境標籤、按鈕文字、初始狀態文字、兩區段標題、自動跟隨按鈕文字；無新增、刪除或修改）。
   - `<template>` 內無任何可見文字節點；`title`、`aria-label`、`placeholder`、`alt` 屬性在前後版本皆無。
   - CSS `content` 屬性保留原本的空 log 提示文字（另新增的空字串 `""` 僅供 Tailwind `::before` 裝飾圓點／旋轉圈使用，無可見文字）。
   - `<script>` 中扣除 `CLS` class 名稱後的字串差異僅為移入 `CLS` 的舊 class 字串，以及建立裝飾容器／查詢靜態圖示模板用的標籤與模板識別字串；**所有狀態文字、錯誤訊息、按鈕文案與格式化模板 100% 未變更**。
3. **關鍵屬性保留確認**：
   - `#run-status`（[index.html:29](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L29)）保留 `role="status"` 與 `aria-live="polite"`。
   - `#follow-btn`（[index.html:39](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L39)）保留 `type="button"` 與 `aria-pressed="true"`。
   - `#install-btn`（[index.html:28](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html#L28)）保留 `type="button"` 與初始 `disabled`。
   - 腳本中所有 `dataset.*`（`stageId`、`taskId`、`status`、`seq`、`kind`）與 `setAttribute`/`removeAttribute`（`aria-expanded`、`aria-current`、`aria-pressed`）呼叫清單與基線完全一致。

---

### D. 建置可重現性（E9）

- **證據檔**：
  - [D-01-package-and-gitignore.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/D-01-package-and-gitignore.txt)
  - [D-02-npm-ci.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/D-02-npm-ci.txt)
  - [D-03-npm-build-and-repro.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/D-03-npm-build-and-repro.txt)

1. **版本釘選與忽略設定**：
   - [frontend/package.json](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/frontend/package.json) 精確釘選 `@tailwindcss/cli` (`4.3.5`)、`preline` (`5.1.0`)、`tailwindcss` (`4.3.5`)，無任何 `^` 或 `~`。
   - [frontend/package-lock.json](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/frontend/package-lock.json) 存在（44,079 bytes）。
   - `git ls-files frontend/node_modules` 為空（未被追蹤），且 `git check-ignore -v frontend/node_modules/` 命中 [.gitignore:23](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.gitignore#L23)。
2. **重現建置驗證**（Node `v24.21.0`、npm `11.19.0`）：
   - `cd frontend && npm ci` 成功安裝 47 個套件（exit `0`）。
   - 第 1 次 `npm run build` 產生 80,151 bytes，SHA-256 為 `9aed92c47b6c879a3e0253cf2317f0d18fa53c53c59b62fd3b533100711008da`，與交付前備份之 [app/static/index.html](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/app/static/index.html) 經 `git diff --no-index --exit-code` 比對為 byte-identical（exit `0`）。
   - 第 2 次 `npm run build` 產生完全相同的 SHA-256（`9aed92c47b6c879a3e0253cf2317f0d18fa53c53c59b62fd3b533100711008da`）。
   - 測畢已刪除 `frontend/node_modules/`。

---

### E. 環境衛生

- **證據檔**：[E-01-hygiene.txt](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/.t63-evidence/E-01-hygiene.txt)
- `git status --short` 僅包含改版檔案（`.gitignore`、`AGENTS.md`、`app/static/index.html`、`frontend/` 內 6 個原始檔）與 `.t63-evidence/`。
- 全目錄搜尋 `install.db*` 為空（未產生預設資料庫檔）。
- `./.t63-tmp/` 與 `frontend/node_modules/` 均已刪除。
- B.4 啟動之 `uvicorn`（`127.0.0.1:18163`）已正常結束並確認拒絕連線，無殘留背景伺服器。

---

### 備註／不確定之處

- **關於 D.2 的 `git diff --exit-code app/static/index.html`**：因本工作區的 `HEAD`（`d4a764e`）為改版前的 baseline commit，而改版內容是以未暫存（unstaged）的工作樹修改存在，直接執行 `git diff --exit-code app/static/index.html` 會將工作樹與改版前的 `HEAD` 比對（顯示 115 insertions, 67 deletions），無法單獨證明重建產物與「交付的改版檔案」相同。因此本次在不改動 git 狀態的前提下，先於建置前將交付的 `app/static/index.html` 備份至 `./.t63-tmp/`，再以 `git diff --no-index --exit-code` 與 `shasum -a 256` 確認兩次重建結果皆與交付檔案 byte-identical。
- 無其他不確定項目。
