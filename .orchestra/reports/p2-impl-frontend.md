我做好了 `GET /` 前端頁面，品質關卡四個指令都通過。頁面在真的 uvicorn 加 headless Chrome 上實際跑過各主要流程，結果都正確。只有一項沒驗到：DevTools 離線模擬沒有切斷已經開著的 SSE 連線，所以「離線 5 秒再恢復」改用重啟伺服器來驗。

## 改了哪些檔案
- **新增** `app/static/index.html`：單一 HTML 頁面，CSS 和 JS 都寫在頁內，沒有 CDN、字型或外部腳本，全程不用 `innerHTML`。
- **新增** `app/routers/page.py`：`GET /` 用 `asyncio.to_thread` 讀檔，以 `HTMLResponse` 回傳，`Content-Type` 是 `text/html; charset=utf-8`。
- **修改** `app/main.py`：只加了 import 和 `app.include_router(page.router)`，後端行為沒動。

## R26／R27 各項怎麼做
- **元素與屬性**：六個 id 都有。stage `<li>` 帶 `data-stage-id`/`data-status`，task `<li>` 帶 `data-task-id`/`data-status`，狀態值和 R10 相同。顯示內容一律用 `textContent`。
- **具名事件**：9 種事件加上 `reset` 都用 `addEventListener` 監聽；收到 `run_finished` 或 `reset` 時呼叫 `close()`。
- **載入時**：同時讀 `/install/plan` 和 `/install/scenarios`，畫出計畫後跑同步流程；`GET /install` 回 404 時所有節點都是 `pending`。
- **同步流程**：快照 → 用 `next_after` 分批補讀 `after=0…until=S` → 開 `EventSource("/install/events?last_event_id=<run_id>.<S>")`。用 `generation` 計數讓舊的流程作廢；只套用 `seq` 大於已套用最大值的事件；log 另外依 seq 去重。
- **按下安裝**：`POST /install` 回 202 後重跑同步流程；409 和 422 在 `#run-status` 顯示紅字錯誤。POST 進行中或這一輪執行中時，`#install-btn` 是 disabled。
- **`reset`／補讀遇到 409**：關閉目前連線，重跑同步流程。
- **左右版面與自動跟隨**：左邊 `#stage-list`，右邊 `#task-list` 顯示所選 stage 的 task。自動跟隨的對象依序是：執行中的 stage → 失敗的 stage → 最後一個非 pending 的 stage → 第一個 stage。點其他 stage 會停止跟隨，按 `#follow-btn` 才恢復。
- **執行中的 task**：`task_started` 時展開，log 逐行追加並捲到最底；`task_succeeded` 時收合。每個 task 的 DOM 節點都保留在記憶體裡，點開只切換顯示，不發請求。
- **`task_failed`**：task 和它的 stage 標紅並保持展開，`level: "error"` 的 log 是紅字，下方顯示錯誤代碼、`message` 和 `hint`。
- **`run_finished`**：`#run-status` 顯示結果，失敗時附上錯誤代碼和訊息；安裝按鈕恢復可按。

## 品質關卡輸出
```
$ uv sync
Resolved 39 packages in 4ms
Audited 37 packages in 5ms
$ uv run ruff format --check .
16 files already formatted
$ uv run ruff check .
All checks passed!
$ uv run mypy
Success: no issues found in 12 source files
```
依照指示，沒有寫測試，也沒有建立 `tests/`，所以沒跑 `uv run pytest`。

## 手動檢查
- **curl**：`/` 回 200，`content-type: text/html; charset=utf-8`，內容和檔案完全相同，六個 id 各出現一次。沒有任何一輪時快照回 404；重複 POST 回 409；未知情境回 422；用舊的 run_id 補讀回 409；跑完後用最後的 id 連線回 204；用舊一輪的 id 連線收到 `retry` 和 `reset`。
- **headless Chrome 實測**（透過 CDP 操作）：
  - `disk_full` 從頭跑：自動跟隨正確；點 `prepare` 後停止跟隨，按 `#follow-btn` 恢復。點開已收合的 `check_os` 看到 8 行 log，Network **0 個請求**。最後 `install`／`copy_files` 標紅、錯誤行紅字、錯誤區塊三行都出現，按鈕恢復可按。
  - 安裝到一半重新整理：請求依序是 `/install` → `/install/logs?…&until=58` → `/install/events?last_event_id=3.58`。跑完共 **168 行，0 行重複**，全部是 succeeded。
  - 執行中 `kill -9` 伺服器再重啟：瀏覽器自己帶 `Last-Event-ID` 重連，畫面補上 `E_INTERRUPTED` 的失敗狀態。
  - 重啟後在瀏覽器重連前，用另一個客戶端開新的一輪：頁面收到 `reset`，自動重新同步到第 6 輪。
  - 頁面上的 422 和 409 都在 `#run-status` 顯示紅字。
- **離線測試沒驗到**：CDP 的離線模擬在 headless Chrome 不會切斷已經開著的 SSE 連線，所以「DevTools 離線 5 秒」這項要人工在真的瀏覽器再驗一次。
- 我啟動的 uvicorn 和 Chrome 都已經停掉，暫存檔都已經刪除，沒有留下 `install.db`。

## CONTRACT GAP／CONFLICT
- **CONTRACT GAP: 頁面不知道別人開了新的一輪** — 這一輪已經結束時，同步流程照規定開的 EventSource 會拿到 204 並永久停止。如果之後另一個客戶端開了新的一輪，這個頁面收不到通知，按鈕仍然可按，按下去只會顯示 409，要重新整理才會跟上。我照規格只顯示錯誤，沒有額外自動重新同步。
- **CONTRACT GAP: 沒有 stage 在執行時要顯示哪一個** — 規格沒寫，我選了「失敗的 → 最後一個非 pending 的 → 第一個」。
- **CONTRACT GAP: 「點了其他 stage」的範圍** — 點目前正在顯示的那個 stage 不算，不會停止跟隨。按下安裝也不會自動恢復跟隨，只有 `#follow-btn` 能恢復。
- **CONTRACT GAP: 其他錯誤怎麼處理** — 規格沒寫同步時遇到網路錯誤或非 409 的錯誤，或 EventSource 在執行中變成 CLOSED 時要怎麼辦。我的做法是在 `#run-status` 顯示錯誤，3 秒後重跑同步流程。
- **CONTRACT GAP: 檔案位置** — AGENTS.md §5 的結構沒有列靜態檔的位置，我放在 `app/static/index.html`。