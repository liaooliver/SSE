# T8.5：驗證 Cloudflare Worker + Durable Object 版（`worker/`）

你是驗證者。你的工作目錄是專案根目錄（verify-ws，git 已有一個 baseline commit，等一下做完要保持乾淨）。

## 背景

`worker/` 是把 Python 版（`app/`）移植成 TypeScript Cloudflare Worker + Durable Object 的新實作；`worker/tests/` 是另一位作者**只根據規格**寫的測試。你要確認實作符合規格、測試可信。規格依據：

- `docs/SPEC.md`（v1.1.4，行為基準）、`docs/SPEC-cloudflare.md`（cf1.1，逐條列出差異，**衝突時以它為準**）
- `contracts/openapi.yaml`（HTTP 形狀）、`contracts/domain.d.ts`（`worker/src/domain.ts` 必須提供的名稱）
- `AGENTS.md` §9（TypeScript 規範、完成的定義、測試規則）

`app/`、`tests/`（Python）是前一版，**不是這次的驗證對象，不要修改**。

## 證據

證據放在 `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/`（絕對路徑；不存在就建立）：每個檢查存原始輸出檔（檔案開頭寫指令與開始時間），並寫 `INDEX.md`：每個檔案一行，說明檢查 ID 與內容。回報裡每項檢查列出對應檔名。

## 檢查項目

### A. 品質關卡與乾淨環境（AC12）

1. 刪掉 `worker/node_modules/`、`worker/.wrangler/`（若存在），在 `worker/` 下依序執行並存輸出：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run format:check`。四個都必須 exit 0。
2. 乾淨 checkout 下 `npx wrangler dev --port <18000–18399 的埠> --persist-to <新的空暫存目錄>`：輪詢 `GET /health` 在 60 秒內回 200，且 `GET /` 回 200 `text/html`。結束後停掉整個程序群組（用 `detached` 或 `setsid` 之類方式，確認沒有殘留 `workerd`／`wrangler`）。
3. `worker/public/index.html` 與 `app/static/index.html` 逐 byte 相同（`cmp`）。
4. 確認 `worker/src/` 下 `console.` 只出現在 `logger.ts`；`worker/package.json` 的 `dependencies` 為空、devDependencies 版本沒有 `^`／`~`。

### B. 測試

1. `npm test`（unit + e2e）連跑 **3 次**，記錄每次的通過／失敗數與時間；不同次結果不同就是 flaky，要列出是哪些測試。
2. `npm run test:perf` 連跑 3 次，記錄結果（p95 數字測試不印的話，用你自己的量法補一個佐證）。
3. 失敗的測試逐一判定：**IMPL BUG**（實作不符規格）、**TEST BUG**（測試斷言了規格沒要求的東西，或本身有錯）、**SPEC AMBIGUOUS**（規格模糊或自相矛盾）。判定要寫「R-id／AC-id＋預期行為＋實際行為」，**不要貼測試原始碼**。你可以讀測試和實作，但**回報裡不可以出現測試原始碼**。
4. 審查測試品質：有沒有空測試、永遠通過的斷言、依賴固定 sleep、依賴規格沒有保證的內部行為（例如直接讀 persist 目錄）。

### C. 合約檢查

1. `domain.ts` 與 `contracts/domain.d.ts`：`npm run typecheck` 已含對照；另外列出 `domain.d.ts` 的每個匯出名稱，確認 `domain.ts` 都有（`grep`／小腳本皆可）。
2. HTTP 形狀：自己啟動一次 `wrangler dev`，對 `contracts/openapi.yaml` 的**每個端點**實際送請求（成功與至少一個錯誤路徑），比對狀態碼、`Content-Type`、JSON 欄位與型別（必填欄位、`minimum`／`minLength` 等標註所代表的行為）。列出偏差；沒有偏差也要列「已比對的端點清單」。
3. 測試只 import `contracts/domain.d.ts` 列出的名稱（掃 `worker/tests/` 的 import）。

### D. 故意改壞實作，看測試會不會失敗（突變抽查）

在 `worker/src/` 做下列 6 個**暫時**修改，每個改完就跑能涵蓋它的最小測試集（找得到對應的測試就只跑那幾個檔），確認測試**失敗**（被抓到）；跑完用 `git checkout -- worker/src` 還原，再做下一個：

1. R18：已結束且 `r = R`、`n ≥ L` 的連線改成不回 204（例如改回 200 並繼續串流）。
2. R16／R24：訂閱者在客戶端斷線時不退訂（`cancel` 不移除）。
3. R25：DO 啟動時不做中斷復原。
4. R7／R10：產生事件時讓 `seq` 偶爾跳號（例如失敗情境的 `task_failed` 多加 1）。
5. R23：`SubscriberQueue.push` 滿了仍回傳 `true`（不報溢位）。
6. R19：回應標頭拿掉 `no-transform`，或加上 `Content-Encoding`。

沒被抓到的突變要列出，並說明是缺少測試還是規格沒要求。

## 限制

- 本機埠號只能用 **18000–18399**（inspector 用 18400–18499）。所有程序結束後都要停掉，用 `pgrep -fl "wrangler|workerd|vitest"` 確認為空；`worker/node_modules/`、`worker/.wrangler/`、`.vitest` 之類的產物最後要刪掉，**除了證據以外，工作區必須回到 baseline**（`git status` 乾淨、`git diff` 無內容）。
- 不可以修改 `worker/src/`、`worker/tests/`、`docs/`、`contracts/`、`AGENTS.md` 的最終內容（突變只是暫時的，一定要還原）。
- **絕對不要**執行 `wrangler login`、`wrangler deploy`、任何 `--remote`、`wrangler d1`，不要碰 Cloudflare 帳號。
- 不要上網（`npm ci` 從 registry 安裝除外）。不要讀取這個資料夾以外的專案目錄。
- 每次執行時間上限 30 分鐘；e2e 測試每個檔案都會啟動一個 `wrangler dev`，整個 `npm test` 可能要好幾分鐘，請在背景跑並設逾時，不要重複啟動多組。

## 回報

最終回覆第一行是 `T8: PASS` 或 `T8: FAIL`（A、B 全過、C 無偏差、D 全部被抓到才算 PASS），之後依序：

1. A 的 4 項結果。
2. B 的 3 次 `npm test`（通過／失敗／時間）與 3 次 perf；失敗清單與判定（IMPL BUG／TEST BUG／SPEC AMBIGUOUS，附 R-id 與行為描述）。
3. 測試品質審查結論。
4. C 的偏差清單（沒有就寫「0 偏差」）與已比對端點清單。
5. D 的 6 個突變各自結果。
6. 殘留檢查（`pgrep`、`git status`）與證據檔案清單。

不要貼測試原始碼。
