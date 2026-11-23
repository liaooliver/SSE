# T8.3-fix1：`npm run lint` 沒有涵蓋 `tests/`

驗證者回報（行為描述）：

- 在乾淨環境執行 `cd worker && npm ci && npm run lint`，**exit 1，23 個錯誤**。全部是同一種：`worker/tests/` 底下每個 `.ts` 檔都出現 `Parsing error: ... was not found by the project service`。
- 原因（驗證者的判斷）：`eslint.config.mjs` 的 `projectService` 只讓 `eslint.config.mjs`、`vitest.config.ts` 走預設專案，而 `tsconfig.json` 只包含 `src/` 和 `../contracts/domain.d.ts`；`tests/` 屬於 `tsconfig.test.json`，型別感知的 lint 找不到它。
- 期待行為（`AGENTS.md` §9.1、§9.2）：`npm run lint`（`eslint .`）必須同時涵蓋 `src/` 和 `tests/`，兩邊都用型別感知規則（`strictTypeChecked` + `stylisticTypeChecked`、`no-console`、`prefer-readonly`），exit 0。

## 要做的事

1. 只修 `worker/eslint.config.mjs`（必要時微調 `tsconfig.test.json` 的 `include`，但**不可以放寬任何規則**、不可以加檔案層級的 `eslint-disable`、不可以把 `tests/` 加進 ignore）。規則集合和嚴格度和現在完全相同，只是讓 `tests/**/*.ts` 找得到對應的 tsconfig。
2. 你的工作區沒有 `tests/`。請自己建一個**臨時**的 `worker/tests/_probe.test.ts`（內容簡單，只要用到 `node:child_process` 之類會用到 `@types/node` 的 import 與一個 `describe/it`，並寫得符合現有的 lint 規則），用它確認：(a) 設定修好後 `npm run lint` 能解析並檢查它、exit 0；(b) 故意加入一行違反規則的程式（例如 `console.log`、`any`）時 lint 會失敗（證明 `tests/` 真的被檢查）。**驗證完把 `_probe.test.ts` 和 `tests/` 資料夾刪掉。**
3. 重跑並回報：`npm run typecheck`、`npm run lint`、`npm run format:check`。
4. 順便確認：`npm run lint` 在 `tests/` 不存在時（現在你的工作區的狀態）不會因為設定而失敗。

## 限制

不要修改 `worker/` 以外的任何東西、`worker/src/`、`AGENTS.md`、`docs/`、`contracts/`。埠號與網路限制和原本相同；這個任務不需要啟動 `wrangler dev`。結束時確認 `worker/tests/` 與 `.tmp/` 不存在。

## 回報

簡短：改了哪些檔案、改了什麼（一兩句）、三個指令的結果、(a)(b) 驗證結果、探針已刪除。
