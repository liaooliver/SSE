# T8.3 實作回報：Cloudflare Worker + Durable Object 版（`worker/`）

`worker/` 的移植已完成。`typecheck`、`lint`、`format:check` 都通過；自我檢查涵蓋 brief 第 6 步的所有項目，結果都符合規格。`npm test`／`npm run test:perf` 因為沒有測試檔而無法執行（exit 1），這是預期的。

## 1. 新增的檔案（只在 `worker/` 下）

- **設定檔**
  - `package.json`：版本和起點素材完全相同；加上 §9.2 的 scripts（含 `postinstall`）、`prettier` 欄位（`printWidth: 100`），並改了 `name`。
  - `package-lock.json`：從 `materials/toolchain/` 複製，只把根層的 `name` 改成和 `package.json` 一致，版本沒動。
  - `wrangler.jsonc`、`tsconfig.json`、`tsconfig.test.json`、`eslint.config.mjs`、`vitest.config.ts`、`.prettierignore`。
  - `.gitignore`：排除 `node_modules/`、`.wrangler/`、`.dev.vars`。
- **`src/`**
  - `domain.ts`：照 `contracts/domain.d.ts`，型別從合約 re-export，含 `SubscriberQueue`、`ValueError`、`KeyError`。
  - `contract-check.ts`：只有型別，沒有執行期程式碼。用 `typeof Domain` 對照 `typeof Contract`，`domain.ts` 和合約不一致時 typecheck 會失敗。
  - `index.ts`：驗證設定，用 `idFromName("install")` 取得 stub，原封不動轉送；同時再匯出 `InstallDO`。
  - `install-do.ts`：DO 本體，負責路由、各端點、alarm 模擬器，以及在 `blockConcurrencyWhile` 裡做 R25 復原和 `deleteAlarm`。
  - `store.ts`：SQLite。每個會產生事件的動作用一個 `transactionSync`；也負責模擬器的「一步」和 R25 收尾。
  - `broker.ts`：訂閱者集合、R23 設計 A、heartbeat。所有結束路徑都走同一個 `remove()`，可以重複呼叫。
  - `config.ts`：R3 的解析函式，Worker 和 DO 共用同一個。
  - `http.ts`：具名的狀態碼常數和回應 helper。
  - `logger.ts`：唯一呼叫 `console` 的地方（R28）。
- **頁面**：`public/index.html` 用 `cp` 複製，`cmp` 確認和 `app/static/index.html` 逐 byte 相同。

`src/` 下除了 §9.6 列出的四個檔案，我另外拆了 `store.ts`、`broker.ts`、`config.ts`、`http.ts`、`contract-check.ts`。§9.6 允許自由調整其他模組；依賴方向仍是 `index → install-do → (store/broker/config/http) → domain`。

## 2. §9.1 指令輸出

| 指令 | 結果 |
|---|---|
| `npm ci` | exit 0，`added 204 packages … found 0 vulnerabilities`；npm 11 警告 `esbuild`、`workerd`、`fsevents` 的 install scripts 不在 allowScripts 內 |
| `npm run typecheck` | exit 0，兩個 tsconfig 都通過；`tsconfig.test.json` 沒有測試檔也不報錯（include 裡有 `src/domain.ts`） |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0，`All matched files use Prettier code style!` |
| `npm test` | **exit 1**：`No test files found`（沒有測試檔，未能執行；scripts 沒改） |
| `npm run test:perf` | **exit 1**：同上 |

另外：在 `src/` 搜尋 `console.`，只出現在 `src/logger.ts`。

## 3. R23 spike 結果：採用設計 A

在 `.spike/` 寫了一個 DO，回應 body 是用 `CountQueuingStrategy({ highWaterMark: 1 })` 建立的 `ReadableStream`，用計時器 `enqueue`，記錄每次 `pull` 和每次 `enqueue` 前後的 `desiredSize`：

- **客戶端持續讀取**（100 B 和 64 KiB 的區塊都測過）：`pull` 會反覆被呼叫；每次 `enqueue` 之後 `desiredSize` 立刻回到 1。
- **客戶端暫停讀取**：
  - 100 B × 100：全部 `enqueue` 完，`desiredSize` 都還是 1，因為資料被下游緩衝吸收了。
  - 64 KiB 的區塊：大約 41 塊（約 2.7 MB）後，`desiredSize` 開始每塊遞減 1（最低到 −350），而且 `pull` 停止被呼叫。
- **暫停後恢復讀取**：`pull` 立刻恢復被呼叫（暫停 1500 ms，第一個新的 `pull` 在 1532 ms），`desiredSize` 回到正值。

結論：符合預期，有讀取時 `pull` 會被呼叫，`desiredSize` 會隨未讀區塊減少，所以採用設計 A。代價是本機在背壓生效前大約有 2.7 MB 的下游緩衝，SSE 小事件要累積很多筆才會溢位，這和 L8 的說法一致。spike 程式已刪除，沒有交付。

## 4. 乾淨 checkout 下 `npm ci && npx wrangler dev`

- 刪掉 `node_modules/`、`.wrangler/` 後，`npm ci` exit 0。
- 接著 `npx wrangler dev --port 18816`：大約 1 秒後 `GET /health` 回 `{"status":"ok"}`，`GET /` 回 200。用 18816 而不是 8787，是因為埠號限制。
- **關於 `postinstall`**：npm 11.19 確實不執行 `workerd`／`esbuild` 的 postinstall（有警告），所以依 §9.2 的條件加上了 `"postinstall": "npm rebuild esbuild workerd"`。但有兩點：
  - 在**加上它之前**，wrangler dev 一樣能起來。這台機器上 `node_modules/workerd/bin/workerd` 本身就是原生執行檔，所以 PoC §4 第 5 點說的「沒有 workerd 執行檔」在這裡沒有重現。
  - `npm rebuild` 一樣受 allowScripts 限制，會印出同樣的警告，所以這個 `postinstall` 在這台機器上很可能實際上什麼都沒做。

## 5. 自我檢查（`wrangler dev`，埠 18810–18823）

全部都是 PASS，除非另有註明：

- **頁面與基本端點**：`GET /` 是 200、`text/html; charset=utf-8`。`/install/plan`、`/install/scenarios` 的內容和順序正確。全新狀態下 `GET /install`、`/install/events`、`/install/logs` 都回 404，`/stats` 是 0。
- **R14 `POST /install`**：
  - `{`、`[]`、`{}`、`{"scenario":1}`、未知情境、不合法的 UTF-8 都回 422。
  - 有額外欄位時回 202。
  - 執行中再送回 409；同時送 10 個，剛好 1 個 202、9 個 409。
- **AC4／AC5／AC1（7 個情境，`SSE_LOG_INTERVAL` 0.02）**：
  - 事件扣掉 `seq`、log 的 `ts`、`run_started.run_id` 之後，完全等於 `scriptFor`；`seq` 剛好是 1..N；`run_started.run_id` 等於實際值。
  - 從快照開始套用 `applyEvent` 的結果，等於 `GET /install`。
  - 失敗情境的 `task_failed.data` 和 R5 表格相同。
  - 相鄰 log 的 `ts` 差 ≥ `log_interval`（20 ms 時實測 21 ms；1 ms 時實測 1 ms）。
- **R19／AC9 header**：`Content-Type`、`Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no` 都符合；**沒有 `Content-Encoding`**。第一個區塊是單獨的 `retry: 3000`。
- **AC7**：結束後用最後一個 id 重連（header 或 query 都一樣），回 204。
- **R15 `/install/logs`**：
  - `limit=7` 分頁讀完，`seq` 遞增、不重複；`until` 上限正確；item 欄位正確。
  - 這些 query 都回 422：空的、`run_id=0`、`abc`、`after=-1`、`limit=0`、`limit=1001`、`until=1.5`、`+1`、前後有空白、`2^53`、`after=`。
  - 別輪的 `run_id` 回 409。
- **R18 起點**：
  - query 是 `abc`、`1.`、`1.2.3`、空字串、`2^53.1` 時回 422。
  - 別輪的 id（不論這一輪執行中或已結束）回 `retry` + `reset`（沒有 `id`，`data.run_id` 正確），執行中時 1 秒內收到。
  - 執行中而 `n > L` 時回 `reset`。
  - header 不合法時從 seq 1 開始；header 合法時（含頭尾空白）優先於 query；header 超過 2^53−1 時視同沒帶。
- **AC1 中途同步**：快照 → 分頁補讀 → SSE 後綴，seq 合起來剛好是 1..202、沒有重複；套用之後等於結束後的快照。串流中 `/stats` 是 1。
- **AC3 類**：用 `node:http` 在 seq 40 銷毀 socket，帶 `Last-Event-ID` 重連後連續收到最後。
- **R22**（`SSE_LOG_INTERVAL` 3、heartbeat 0.5）：閒置時收到 10 個 ping；在客戶端量到，每個 ping 和前一次輸出的間隔最小 499 ms。
- **R24 斷線偵測**（heartbeat 0.5，一次只開一條連線）：`/stats` 在 813–1053 ms 內回到 0，預期上限是 2 s。
  - 我第一次的量法有誤（前一條連線還沒被偵測到就開始下一次），數字看起來忽高忽低，改成一次一條連線後結果穩定。
- **AC10 冒煙**（`SSE_SUBSCRIBER_QUEUE_SIZE` 1、`SSE_LOG_INTERVAL` 0）：一輪用了 5 條連線，表示真的被溢位踢掉過；seq 合起來剛好是 1..202，`/stats` 回到 0；重複 5 次都相同。
- **R3**：給三個不合法的值時，`/health`、`/stats`、`/install`、`/install/plan` 都回 500、`text/plain; charset=utf-8`，body 列出三個變數名稱；`GET /` 仍然 200。值是 `" 1e-3 "`（頭尾有空白）和 `+20` 時被接受。
- **R25／AC9 第 5 項**：
  - 用獨立程序群組啟動（`SSE_LOG_INTERVAL` 1）；快照有 task 是 `running` 之後，對整個群組送 SIGKILL，確認群組已空。
  - 用同一個 `--persist-to` 換新埠重啟後，`status=failed`，錯誤是 `["E_INTERRUPTED"]`；新程序 `/stats` 是 0；事件序列連續、以 `run_finished` 結尾。
- **觀察項（R24 關機）**：開著 SSE、一輪執行中時：
  - SIGTERM：客戶端在 0.09 s 結束，群組在 0.11 s 全部退出，沒有殘留 `workerd`；重啟後以 `E_INTERRUPTED` 收尾。
  - SIGINT：0.10 s／0.12 s，結果相同。
- **AC11 類**（20 個訂閱者，`SSE_LOG_INTERVAL` 0.005）：每個訂閱者都收到 202 筆；165 個樣本的 p50 是 1 ms、p95 是 2 ms、最大 5 ms。

**自我檢查中發現並修正的兩個 bug：**
1. **R15**：一開始 `queryInt(...) ?? 0` 會把不合法的值（`null`）吞掉、換成預設值；lint 抓到後已修正，並用上面的 422 測試確認。
2. **`log_interval=0` 時一輪會停住**：一輪停在 `last_seq` 74、狀態一直是 `running`。原因是在 `alarm()` 裡呼叫 `setAlarm(Date.now())`：處理期間時鐘是凍結的，新的 alarm 可能和正在處理的這一個是同一毫秒，平台把它當作沒改變，在 handler 返回後刪掉。修正：在 `alarm()` 裡安排的下一次至少比「現在」晚 1 ms；`POST` 時的第 0 步仍然是 `setAlarm(Date.now())`。修正後 `log_interval=0` 一輪約 1 秒跑完，連續 6 次都沒有停住。

**沒有驗證到的：**
- 真實瀏覽器的手動驗收（Phase 4）。
- 剛好用 8787 埠的啟動（埠號限制）。

## 6. CF-GAP／CF-CONFLICT／NEED DEPENDENCY

- **CF-GAP（R3/R14）**：「0 表示下一步的 alarm 設在『現在』」。在 `alarm()` 裡設成「現在」，在本機 workerd 會讓 alarm 被刪掉（見上面的 bug 2），所以實作改成「現在 + 1 ms」。外部看起來仍然是「盡快」，但和條文字面不同，請決定是否要在規格裡寫明。
- **CF-GAP（R1/AC12）**：在這台機器上（npm 11.19），沒有 `postinstall` 也能啟動，而 `npm rebuild` 本身也被 allowScripts 擋住。所以「必要時加 postinstall」這個前提在這裡沒有重現；我依 §9.2 的字面條件（npm 預設不執行 postinstall）保留了它。
- **NEED DEPENDENCY**：沒有。
- **CF-CONFLICT**：沒有。

## 7. 殘留檢查

- `pgrep -fl "wrangler|workerd"` 沒有輸出（`pgrep exit=1`）；`lsof -iTCP:18800-18999 -sTCP:LISTEN` 也沒有任何埠在 listen。
- `worker/.spike/`、`worker/.tmp/`、`worker/.wrangler/` 都已刪除，不存在。
- `worker/node_modules/` 還在：是乾淨 checkout 驗證時 `npm ci` 裝的，已被 `.gitignore` 排除，不提交。
- 沒有執行 login、deploy、`--remote`、`d1`，也沒有出現登入提示。除了 `npm ci` 從 registry 安裝之外沒有連網。
- 除了 `worker/` 以外沒有改任何檔案。唯一的例外：曾在專案根目錄誤建一個空目錄 `worker-cc-log`，在同一個指令裡就刪掉了。