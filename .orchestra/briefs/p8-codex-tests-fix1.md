# T8.4-fix1：測試 helper 的穩定性問題

你是測試作者，工作目錄是專案根目錄（tests-ws）。前一次你交付了 `worker/tests/`。驗證者在真實環境跑出下列問題（只有行為描述，請自己找出原因並修正）。**只准修改 `worker/tests/`。**

## 問題

1. **間歇性失敗（`npm test` 連跑 3 次，第 1 次失敗、後 2 次通過）**：某個 e2e 測試檔的案例本身通過，但 `afterAll` 清理 `wrangler dev` 程序群組時整個 suite 以 `Error: kill EPERM` 失敗。驗證者的判斷：macOS 上對正在結束（或剛結束、zombie 狀態）的程序群組呼叫 `process.kill(-pgid, 0)` 會間歇性回 `EPERM`，helper 只把 `ESRCH` 當成「已經不存在」。
   - 期待：清理程序在這種過渡狀態下**不得拋出不相干的例外**；要用有上限的重試／寬限時間判斷群組是否已結束（`EPERM` 視為「還沒完全結束」，到期限仍然存在就送 SIGKILL，最後仍無法確認結束才報錯，並且錯誤訊息要說明是哪個群組、等了多久）。
2. **暫存目錄汙染 repo**：失敗時在 `worker/` 底下遺留未追蹤的 `.test-state-*` 目錄。
   - 期待（`AGENTS.md` §9.7）：`--persist-to` 的暫存目錄建在作業系統的暫存位置（`os.tmpdir()` 底下，`mkdtemp`），**不是 repo 內**；不論測試或清理成功或失敗，都要在 `finally` 中刪除（刪除失敗不可蓋掉原本的錯誤）。
3. **逾時錯誤訊息不清楚**：某個等待 `/stats` 歸零的輪詢，把「剩餘時間」直接當成單次 `fetch` 的逾時，接近期限時會拋出通用的 `TimeoutError`，看不出是在等什麼。
   - 期待：所有等待都用你自己的逾時機制，逾時訊息要寫明「在等什麼、等了多久、最後觀察到的值」。單次 `fetch` 的逾時要有固定上限，不要被剩餘時間縮到很短。
4. 請順便**檢查所有 helper 與測試檔**有沒有同樣類型的問題（其他地方的 `ESRCH`-only 判斷、其他遺留在 repo 內的檔案、其他通用逾時訊息），一併修正。

## 離線檢查（和上次相同）

你的工作區仍然沒有實作，測試跑不起來。請重做並確認通過：本機專用的 `worker/tsconfig.check.json`（strict 全開、`types: ["node"]`、`paths` 映射到 `contracts/domain.d.ts`）的 `tsc`、`prettier --print-width 100 --check worker/tests`、型別感知 ESLint（`strictTypeChecked` + `stylisticTypeChecked`、`no-console`、`prefer-readonly`，本機專用設定）、vitest 收集。完成後刪除所有本機專用檔案，只留 `worker/tests/`。
**新要求**：`npm run lint` 最終會用 `eslint .` 在 `worker/` 下涵蓋 `tests/`（型別感知），所以你的 ESLint 檢查必須用和它相同的規則集合，且 exit 0。

## 限制

只改 `worker/tests/`；不修改 `docs/`、`contracts/`、`AGENTS.md`、`tests/`（Python）。不可以碰這個資料夾以外的路徑、不可以上網、不新增依賴。

## 回報

簡短列出：改了哪些檔案、每個問題怎麼修（行為層面）、第 4 項額外發現了什麼、離線檢查結果。
