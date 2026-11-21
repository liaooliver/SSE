T7.5: 9 fixed, 0 rejected, 0 skipped

已將 4 項 SHOULD 與 5 項 NIT 全部整合至 [docs/technical.html](/Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html)，並新增四張全頁截圖與[證據索引](/Users/oliver/.local/share/sse-orchestra/docs-tech-ws/.t7-evidence/T7.5/INDEX.md)。`docs/ai-agents.html` 與 `REVIEW.md` 均未修改。

| 編號 | 修訂內容 |
|---|---|
| 1 · SHOULD | 圖 1 補上 HTTP 回傳方向、安裝路由向 SQLite 讀取快照與日誌的路徑，以及 `GET /stats` 從 `Broker` 取得訂閱數的方向。 |
| 2 · SHOULD | 圖 7 與正文區分了新輪次的第一筆事件和頁面的開流起點。新輪次從 `seq = 1` 起算，頁面收到 `202` 後重讀快照、補齊日誌，再從快照的 `last_seq` 之後接收事件。 |
| 3 · SHOULD | 補齊單元、HTTP、串流及端對端測試的 R／AC 編號，標明五道關卡對應 R28、R29 與 AC12，並區分 R26 首頁靜態檢查與 R27 瀏覽器手動驗收。 |
| 4 · SHOULD | 圖 5 補上第一筆帶 `id` 的事件送達前就斷線的情況，此時沿用原網址的查詢游標。圖 8 補上事件 ID 無效、輪次異常及 JSON 解析失敗時立即重新同步的分支。 |
| 5 · NIT | 目錄第 5 項與正文統一為「SSE 在這個專案的應用」。 |
| 6 · NIT | 模組表補上監控路由對 `RuntimeDep` 的依賴、`app/main.py` 掛載安裝路由的關係，以及 `parse_event_id`、`RETRY_BLOCK`、`PING_COMMENT`。 |
| 7 · NIT | 圖 2 的箭頭標明開始、成功與失敗事件。圖 2、圖 8 的圖說分別以 `<code>` 標示 `run_finished` 與 `CONNECTING`。 |
| 8 · NIT | 說明 `Broker` 為每個訂閱者建立專屬的有界佇列，登記訂閱後才讀取歷史事件。 |
| 9 · NIT | 補齊四個環境變數的名稱、預設值與單位，以及 R26 六個固定 DOM ID 的用途。 |

**成套一致性。** 兩篇已對齊 11 個共用色彩 token 的名稱與深淺色值，以及字型、頁首文件切換、日期 `2026-11-21`、頁尾「資料來源」與「圖 N：…」圖說格式。核對七種安裝情境、SSE 重連、空快照 `404`、前端建置及瀏覽器驗收後，未發現兩篇有待協調的矛盾。另依 `frontend/src/index.html:321` 修正圖 4，明確標示紅色日誌顯示的是 `log.text`。

**HTML 與版面檢查。**

- 外部資源 grep 命中第 `92、185、247、304、346、369、395、417` 行，依序對應圖 1 至圖 8。每行的 `http://www.w3.org/2000/svg` 是 SVG 命名空間，`url(#tip1)` 至 `url(#tip8)` 各自指向同圖的箭頭。四次渲染皆為零外部資源請求。
- `/Users/` grep 無輸出。12 個頁內連結均有唯一目標，兩份文件的相對連結有效。HTML 標籤全部配對，全文只有一個 `<h1>`。
- 已檢視四張全頁截圖與八張圖的細部。兩種配色在 1280 px 與 390 px 的頁面捲動寬度均等於視窗寬度，未見文字重疊。手機上的寬圖表可在各自容器內橫向捲動。

**截圖檔名**

| 寬度 | 淺色 | 深色 |
|---|---|---|
| 1280 px | `tech-1280-light.png` | `tech-1280-dark.png` |
| 390 px | `tech-390-light.png` | `tech-390-dark.png` |

**專案品質關卡。** 三項通過。`uv sync` 在讀取 macOS 系統設定時中止，其餘四項以既有虛擬環境執行。六個 E2E 測試均在 `tests/server.py:36` 綁定本機 TCP 連接埠時被沙盒拒絕，因此本次未達成 AC12。

| 指令 | 實際輸出摘錄 |
|---|---|
| `uv sync` | `Attempted to create a NULL object.`，結束碼 `101` |
| `uv run ruff format --check .` | `32 files already formatted` |
| `uv run ruff check .` | `All checks passed!` |
| `uv run mypy` | `Success: no issues found in 12 source files` |
| `uv run pytest` | `6 failed, 69 passed, 1 deselected in 36.15s`，六項皆為 `PermissionError: [Errno 1] Operation not permitted` |