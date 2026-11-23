# T8.5 第 2 輪：重驗 `worker/`（只重跑受修正影響的部分）

你是驗證者，工作目錄是專案根目錄（verify-ws，git 乾淨）。背景與規格依據和第 1 輪相同（`docs/SPEC.md`、`docs/SPEC-cloudflare.md`、`contracts/`、`AGENTS.md` §9）。

第 1 輪結果：lint 沒涵蓋 `tests/`（已修：只改了 `worker/eslint.config.mjs`）；測試 helper 在清理 `wrangler dev` 程序群組時偶發 `EPERM`、暫存目錄建在 repo 內、逾時訊息不清楚（已修：只改了 `worker/tests/`）。`worker/src/` 沒有任何改動，所以 C（合約比對）與 D（突變）不必重跑。

證據放 `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/`（絕對路徑，不存在就建立），格式同第 1 輪（每檔開頭寫指令與開始時間，附 `INDEX.md`）。

## 檢查項目

1. **A（AC12）**：刪掉 `worker/node_modules/`、`worker/.wrangler/` 後，在 `worker/` 下依序跑並存輸出：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run format:check`。**四個都要 exit 0**。另外確認 lint **真的有檢查 `tests/`**：暫時在 `worker/tests/` 下加一個含 `console.log` 的臨時檔，`npm run lint` 必須失敗，之後刪除該檔。
2. **B（穩定性是重點）**：`npm test` 連跑 **5 次**，記錄每次通過／失敗數、耗時；任何一次失敗都要附失敗訊息與判定（IMPL BUG／TEST BUG／SPEC AMBIGUOUS，附 R-id 與行為描述，**不要貼測試原始碼**）。`npm run test:perf` 連跑 3 次。
3. **清理檢查**：每次 `npm test` 結束後確認：(a) 沒有殘留的 `wrangler`／`workerd` 程序（`pgrep -fl "wrangler|workerd"`）；(b) `worker/` 底下沒有 `.test-state-*` 或其他新增的未追蹤檔案（`git status --short`）；(c) 系統暫存目錄（`$TMPDIR`）下沒有殘留的測試用 persist 目錄（比對測試前後的清單，列出差異）。
4. 讀 `git diff <baseline> -- worker/tests/helpers` 以外你認為相關的部分，審查這次 helper 修正本身有沒有引入新問題（例如把等待上限放得過大而讓測試失去意義、吞掉真正的錯誤）。只寫結論與行為描述。

## 限制

與第 1 輪相同：埠號只用 18000–18399（inspector 18400–18499）；不修改 `worker/src/`、`worker/tests/`、`docs/`、`contracts/`、`AGENTS.md` 的最終內容；絕對不要 `wrangler login`／`deploy`／`--remote`／`d1`；不要上網（`npm ci` 除外）；結束時 `git status` 乾淨、無殘留程序、`node_modules`／`.wrangler` 已刪；每次執行上限 30 分鐘（`npm test` 約 1 分鐘，5 次要在背景跑、設逾時）。

## 回報

第一行是 `T8r2: PASS` 或 `T8r2: FAIL`（1 全過、2 五次 `npm test` 全過且 perf 全過、3 沒有殘留才算 PASS）。接著依序：1 的四個結果＋lint 探測、2 的 5 次結果與 3 次 perf、3 的殘留檢查、4 的審查結論、證據檔清單。不要貼測試原始碼。
