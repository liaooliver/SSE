T4.4: PASS（0 deviations；check 10 只做了靜態檢查，沒有在瀏覽器裡實際觀察）

## 總表

| # | check | R/C | verdict |
|---|---|---|---|
| 1 | 無 run 時載入 | R26、R27 載入時 | OK |
| 2 | `success` 安裝畫面 | R27 按下安裝、畫面 | OK |
| 3 | 點開已收合 task，不另發請求 | R27 | OK |
| 4 | 失敗情境 `checksum_mismatch` | R27 `task_failed`、C2 | OK |
| 5 | 自動跟隨規則 | R27、C3 | OK |
| 6 | 中途加入（含第二個分頁） | R27 同步流程、AC1 | OK |
| 7 | 執行中重新整理 | R27、R20 | OK |
| 8 | 錯誤處理：409、伺服器停止與復原 | R27、C4、R25 | OK |
| 9 | 已知限制 | C1 | OK |
| 10 | 文字安全 | R26 | OK（僅靜態檢查；未在瀏覽器實際觀察） |

## 各項觀察

**1. 無 run 時載入**
- `GET /install` 回 404。`#scenario` 是 `<select>`，有 R12 的 7 個選項；`#install-btn`、`#run-status`、`#stage-list`、`#task-list`、`#follow-btn` 都存在。
- 4 個 stage（`prepare`、`download`、`install`、`configure`）的 `data-status` 都是 `pending`；右側 3 個 task（`check_os`、`check_disk`、`check_deps`）也都是 `pending`。`#run-status` 顯示「尚未執行過安裝」。
- 頁面只請求同源的 `/`、`/install/plan`、`/install/scenarios`、`/install`。Network 清單裡的 `chrome-extension://` 和 `data:` 項目來自瀏覽器擴充功能。HTML 沒有 `<link>`、外部 `<script src>` 或 `url()`。

**2. `success` 安裝畫面**
- 我在頁面裡放了 200 ms 取樣器，記錄整輪的畫面狀態。
- 安裝期間 `#install-btn` 一直是 disabled。
- 所選 stage 跟著執行中的 stage 依序走 `prepare` → `download` → `install` → `configure`，沒有一次不一致。
- 執行中的 task `aria-expanded=true`，log 逐行增加，滾動位置每次取樣都在底部（`NOTBOTTOM` 為 0 次）。`task_succeeded` 後該 task 收合成 `aria-expanded=false`。
- 結束時 `#run-status` 顯示「第 1 輪（全部成功）：安裝完成，全部成功」，按鈕恢復可按。

**3. 點開已收合 task，不另發請求**
- 真的點擊已成功的 `write_config` 後，展開並顯示 10 行 log。
- 點擊後 `read_network_requests` 回報 0 個新請求。

**4. 失敗情境 `checksum_mismatch`**
- `download` stage 是 `failed`，`verify_checksum` 是 `failed`，兩者都是紅色（`rgb(198, 40, 40)`）；`install`、`configure` 維持 `pending`。
- 失敗的 task `aria-expanded=true`，共 10 行 log。第 10 行是 `level: error`，顏色是 `rgb(255, 107, 107)`，其他 info 行是 `rgb(221, 221, 221)`。
- log 下方顯示：錯誤代碼 `E_CHECKSUM`、原因「套件 core-2.4.1.pkg 的 SHA-256 雜湊值不符」、排除建議「請清除下載快取後重新下載，或改用其他鏡像站」。
- `#run-status` 的 `data-kind=failed`。
- 重新整理頁面後（載入已結束的失敗 run），所選 stage 是 `download`（失敗的那個）。C2 只在載入時單獨驗證；run 結束當下，正在執行的 stage 本來就是失敗的 `download`，所以這一刻選到哪個 stage 沒有分辨力。

**5. 自動跟隨規則（C3）**
- 在 `download` 執行中點擊目前顯示的 `download`：`follow` 維持 `aria-pressed=true`，之後仍自動切到 `install`。
- 在 `install` 執行中點 `prepare`：`aria-pressed=false`，按鈕文字變成「恢復自動跟隨」，整輪結束後畫面仍停在 `prepare`。
- 跟隨關閉時在 run 結束後按 `#install-btn` 開新一輪：`follow` 仍是 false，所選 stage 維持 `prepare`，沒有被拉走。
- 按 `#follow-btn` 後：`follow` 變 true，立刻跳到執行中的 `download`，按鈕文字回到「自動跟隨中」。

**6. 中途加入**
- 我用 `curl -X POST` 開 run 5，約 15 秒後載入頁面。
- 完成後我把每個 task 的畫面 log 逐行跟 `/install/logs` 比對：12 個 task 全部相符，沒有重複行，總共 168 行；加入時和加入後 `copy_files` 還在進行，畫面持續更新到結束。
- 第二個分頁在 run 進行中開啟，同樣是 168 行、無重複，並跟到 `succeeded`。第二個分頁已關閉。

**7. 執行中重新整理**
- 我用 `curl` 開 run 6，約 20 秒後重新整理。
- 重新整理時 `install` stage 的 `extract` 是 20/20 行，`copy_files` 是 13/13 行，沒有重複。
- 結束後逐行比對：12 個 task 全部相符，沒有重複或缺少。

**8. 錯誤處理（409、伺服器停止與復原）**
- **409：**
  - 按鈕在執行中是 disabled，所以我用 check 9 的做法觸發：頁面顯示已結束的 run 6，我用 `curl` 開 run 7，再按 `#install-btn`。
  - `#run-status` 顯示「無法開始安裝：已有一輪安裝正在執行（409）」，`data-kind=error`。
- **停止伺服器：**
  - 重新載入頁面接上執行中的 run 7，在 `configure` 階段用 SIGTERM 停掉伺服器。
  - `#run-status` 顯示「連線中斷，瀏覽器重新連線中…」，`data-kind=error`。
- **復原：**
  - 用同一個資料庫重啟後，在重啟後約 6 秒內頁面轉為 `failed`：`#run-status` 顯示「安裝失敗（E_INTERRUPTED）伺服器在安裝途中停止」。
  - `configure` stage 和 `start_service` task 是 `failed`，錯誤區顯示 `E_INTERRUPTED`、「伺服器在安裝途中停止」、「請重新安裝」，按鈕恢復可按。
- **重連路徑：**
  - 伺服器停止期間，`EventSource` 一直用同一個 `last_event_id=7.110` 重試，直到重啟後回 200 才收到補發的事件。
  - 這段期間沒有看到頁面自己重新發 `GET /install`，也就是說復原是靠 `EventSource` 自動重連（`retry: 3000`），不是靠 C4 的「`CLOSED` 後 3 秒重跑同步流程」。
  - 這條 `CLOSED` 分支我沒有觸發，所以沒有單獨驗證。

**9. 已知限制 C1**
- 頁面顯示已結束的 run 6，我用 `curl` 開 run 7。
- 3 秒後頁面完全沒有變化：`#run-status` 仍是「第 6 輪（全部成功）：安裝完成，全部成功」，所有 stage 都是 `succeeded`，按鈕可按。
- 按下 `#install-btn` 得到 409，`#run-status` 顯示「無法開始安裝：已有一輪安裝正在執行（409）」。
- 之後頁面仍停在 run 6 的狀態，按鈕仍可按，要重新整理才會看到 run 7。
- 這跟 SPEC 描述的 C1 完全一致。

**10. 文字安全**
- 靜態檢查：`app/static/index.html` 沒有 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`，所有內容都用 `textContent` 寫入（例如 line 111、251–253、299、342）。
- 我原本想用一個 mock 伺服器（`.t44-tmp/mock.py`，埠 18511）回傳含 `<b>`、`<img onerror>` 的資料來實際觀察，但執行該 mock 的指令需要核准，沒有被批准，所以沒有執行。
- 因此畫面上 `<` 是否原樣顯示，我沒有在瀏覽器裡觀察到。

附帶說明：`read_network_requests` 有幾筆 `/install/events` 被標成 503，包括 run 3、4、6 的串流和伺服器停止期間的重連。我沒有查出原因，推測是這個工具對被中斷的串流的回報方式，頁面行為全程正常。

## Deviations

沒有。

## 清理確認

- 我開的分頁（含第二個分頁）都已關閉。工作階段一開始建立的一個空白「New Tab」（`chrome://newtab/`）還在，我沒有關，因為它可能是群組裡唯一的分頁。
- 伺服器已停止：兩個伺服器程序都是用 SIGTERM 結束的（背景工作回報 exit 143）；埠檢查 `lsof -iTCP:18500-18599 -sTCP:LISTEN` 沒有輸出（exit 1），表示這個範圍的埠都沒有在監聽。
- `./.t44-tmp/` 已刪除，目錄清單裡沒有它。
- `install.db` 不存在（`ls install.db` 回 No such file or directory）。
