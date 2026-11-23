# T8.1：Cloudflare Durable Object 可行性 PoC

你是 worker，只照這份說明做事。你的工作目錄是目前所在的資料夾（空的）。**所有檔案只寫在這個資料夾裡。**

## 背景

有一個「安裝進度即時串流」的 demo，原本是 FastAPI + SQLite + SSE。它要移植到 Cloudflare Workers，核心做法：

- **一個 Durable Object（DO）實例**取代原本的「行程內狀態」：
  - 用 DO 內建的 **SQLite 儲存**（`ctx.storage.sql`，`new_sqlite_classes` migration）存資料；
  - 用 **Alarm**（`ctx.storage.setAlarm` + `alarm()` 處理器）取代「背景 asyncio task + sleep」，每約 150 ms 推進一步模擬；
  - 在 DO 裡維護**多個 SSE 訂閱者**，寫入 SQLite 後再廣播給所有訂閱者；
  - 回應 `text/event-stream` 串流，**每 15 秒心跳**，並且**偵測客戶端斷線**後把它從訂閱者移除。
- 一個 Worker 前面把 HTTP 請求轉給 DO，並用 **Workers Static Assets** 提供 `index.html`。

Cloudflare 官方的 Python Worker 路線是：`workers-py`／`pywrangler`、`wrangler.jsonc` 要有 `"compatibility_flags": ["python_workers"]`、入口 `src/entry.py` 的 `WorkerEntrypoint`。**Python Workers 目前是 beta，Python 能不能定義 Durable Object、能不能用 SQLite storage／Alarm／串流 Response，我們不確定，這就是這次要查清楚的事。**

## 你要回答的問題

在**本機**（`wrangler dev`／`pywrangler dev`，不要用遠端模式）下，逐項驗證，每一項寫成「可行／不可行／有限制」並附**實際輸出**當證據：

| # | 項目 |
|---|---|
| P1 | 能定義 Durable Object 類別並從 Worker 取得 stub 呼叫（`env.<BINDING>.idFromName(...)` → `get(id)` → `fetch`） |
| P2 | DO 的 SQLite storage：建表、INSERT、SELECT、**同步交易**（TS 是 `ctx.storage.transactionSync`；Python 要查它對應的寫法），並確認**重啟 `wrangler dev` 後資料還在**（本機有持久化目錄就算） |
| P3 | **Alarm**：`setAlarm`，`alarm()` 觸發；在 `alarm()` 裡連續重設 150 ms 後的下一次，連跑 50 次，量實際間隔（本機） |
| P4 | **SSE 串流**：DO 回應 `Response(ReadableStream, text/event-stream)`，客戶端 `curl -N` 能逐筆收到；**兩個以上客戶端**同時訂閱，DO 內一次事件能廣播給全部 |
| P5 | **斷線偵測**：客戶端 Ctrl-C／關閉連線後，DO 能知道（例如寫入 stream 失敗、或 `request.signal` abort、或 `writer.closed`），並把它從訂閱者集合移除。給出**可靠的做法**，量測偵測延遲 |
| P6 | **15 秒心跳**能維持連線（DO 在串流上每 15 秒寫一個 `: ping` 註解行；可用 alarm 或 `setInterval`／等價物，指出哪種可行） |
| P7 | **Static Assets**：`wrangler.jsonc` 的 `assets` 設定服務 `public/index.html`；`/` 回 HTML、`/install*` 這類路徑交給 Worker（`run_worker_first` 或 `not_found_handling` 之類，指出正確設定） |
| P8 | 約束：DO 有哪些「長時間串流」的限制或陷阱（例如：有開著的 SSE 連線時 DO 會不會被回收／休眠、Alarm 會不會被打斷、CPU／Wall-clock 限制、免費方案是否可用 SQLite DO）— **請查官方文件並引用網址** |

## 做法與優先順序

1. **先試 Python**：用 `uv` 與 `pywrangler`（`uvx --from workers-py pywrangler init` 之類）。先查官方文件（`https://developers.cloudflare.com/workers/languages/python/` 及其子頁、`https://developers.cloudflare.com/durable-objects/`）確認 Python 是否支援 DO。官方文件、changelog、`workers-py`／`workers-runtime-sdk` 的原始碼或 PyPI 頁面都可以查（網路可用，只准讀 cloudflare.com、developers.cloudflare.com、pypi.org、npmjs.com、github.com 的公開頁面）。
2. Python 路線**任何一項**（P1–P6）做不到、或只能靠不穩定的 hack，就**改用 TypeScript** 把同樣 P1–P7 都驗一遍（`npm create cloudflare` 不要用互動式；手寫 `package.json`、`wrangler.jsonc`、`src/index.ts`，`npm i -D wrangler typescript @cloudflare/workers-types`）。
3. 兩條路線都要有結論：Python 的結論、TypeScript 的結論（若 Python 全部可行，TypeScript 只要簡短確認即可，不必全驗）。
4. 目錄：`py-poc/`、`ts-poc/` 各自獨立。每個 PoC 都要能用單一指令啟動並重現驗證（寫在各自的 `README.md`）。

## 可以做／不可以做

- **本機埠號只能用 18700–18799**（`wrangler dev --port 187xx`，inspector 埠請用 `--inspector-port 189xx`，不要佔 9229 之類的預設埠）。驗證完要把所有 `wrangler`／`workerd`／`node`／`pywrangler` 程序**停掉**，並確認沒有殘留（`pgrep -fl "wrangler|workerd"` 為空）。
- 可以 `npm install`、`uv`/`pip` 安裝套件（只裝在目前資料夾內：`node_modules/`、`.venv/`）。
- **絕對不要**執行：`wrangler login`、`wrangler deploy`、`pywrangler deploy`、`wrangler d1 create`、任何 `--remote` 的指令，或任何需要 Cloudflare 帳號／API token 的動作。**不要**讀取或寫入 `~/.wrangler`、`~/.config/.wrangler` 之外的使用者設定（本機 dev 自己會用到的 cache 沒關係）。遇到要登入的提示，就停下來，在回報裡寫明。
- 不要碰這個資料夾以外的任何路徑，也不要去找別的專案資料夾。
- 不要訪問任何不在上面白名單內的網站。

## 時間

最多 30 分鐘。超過就以目前已驗證的結果寫回報，沒驗證到的標「未驗證」。**不要編造結果**：每一項的結論必須對應到你實際執行的指令與輸出。

## 回報（最重要）

把最終回報寫成 `REPORT.md`（放在目前資料夾根目錄），內容：

1. **結論表**：P1–P8，Python／TypeScript 兩欄，每格「可行／不可行／有限制／未驗證」＋一句話。
2. **建議**：移植應該選哪個語言，理由（可靠度、程式量、型別／測試能力、冷啟動）。
3. **關鍵程式片段**：每個可行項目，貼出最小可行的程式碼（DO 類別骨架、SQL 寫法、alarm 寫法、SSE stream 寫法、斷線偵測寫法、assets 設定）。這些是下一個 worker 的起點。
4. **陷阱清單**：踩到的坑與解法（含 wrangler／workers-py 版本號、compatibility_date、必要 flag）。
5. **實測數字**：alarm 間隔（平均／最大）、斷線偵測延遲、心跳驗證結果。
6. **引用來源**：官方文件網址。
7. **殘留檢查**：你停了哪些程序、`pgrep` 結果。

回報只寫事實與程式片段，不要寫「應該可以」之類沒驗證的說法。
