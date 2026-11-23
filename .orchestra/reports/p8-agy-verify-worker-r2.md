正在背景執行 5 次 `npm test`（每次結束後檢查程序／未追蹤檔／`$TMPDIR` 差異）與 3 次 `npm run test:perf`，等待完成通知後再整理證據與回報。
T8r2: PASS

## 1. A（AC12）品質關卡與 lint 探測

刪除 `worker/node_modules/`、`worker/.wrangler/` 後，在 `worker/` 下依序執行：

| 指令 | Exit Code | 結果摘要 | 證據 |
|---|---:|---|---|
| `npm ci` | 0 | 204 packages，4s，`postinstall` 成功重建 `esbuild`/`workerd` | [A1-npm-ci.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-npm-ci.txt) |
| `npm run typecheck` | 0 | `tsconfig.json` 與 `tsconfig.test.json` 皆通過 | [A1-typecheck.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-typecheck.txt) |
| `npm run lint` | 0 | `eslint .` 0 errors、0 warnings | [A1-lint.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-lint.txt) |
| `npm run format:check` | 0 | `prettier --check .` 全部符合格式 | [A1-format-check.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-format-check.txt) |

- **lint 探測（`tests/` 涵蓋確認）**：於 `worker/tests/` 建立臨時檔 `__lint_probe_tmp.ts`（含單行 `console.log`），執行 `npm run lint` 立即失敗（exit 1，報 `1:1 error Unexpected console statement no-console`），隨即刪除該臨時檔並確認 `git status` 乾淨。見 [A1-lint-probe.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-lint-probe.txt)。

## 2. B 穩定性與效能重跑

### `npm test` 連續 5 次

| 次數 | Exit Code | Test Files | Tests | Vitest 耗時 | 實測總耗時 | 證據 |
|---|---:|---|---|---:|---:|---|
| Run 1 | 0 | 17 passed / 0 failed | 22 passed / 0 failed | 58.38s | 58.64s | [B1-npm-test-run1.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run1.txt) |
| Run 2 | 0 | 17 passed / 0 failed | 22 passed / 0 failed | 59.26s | 59.52s | [B1-npm-test-run2.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run2.txt) |
| Run 3 | 0 | 17 passed / 0 failed | 22 passed / 0 failed | 59.07s | 59.31s | [B1-npm-test-run3.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run3.txt) |
| Run 4 | 0 | 17 passed / 0 failed | 22 passed / 0 failed | 57.74s | 57.97s | [B1-npm-test-run4.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run4.txt) |
| Run 5 | 0 | 17 passed / 0 failed | 22 passed / 0 failed | 58.94s | 59.18s | [B1-npm-test-run5.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run5.txt) |

5 次全數通過，0 失敗，未再出現第 1 輪的 `EPERM`。

### `npm run test:perf` 連續 3 次

| 次數 | Exit Code | Test Files | Tests | Vitest 耗時 | 實測總耗時 | 證據 |
|---|---:|---|---|---:|---:|---|
| Run 1 | 0 | 1 passed / 0 failed | 1 passed / 0 failed | 1.79s | 2.06s | [B2-test-perf-run1.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B2-test-perf-run1.txt) |
| Run 2 | 0 | 1 passed / 0 failed | 1 passed / 0 failed | 1.78s | 2.00s | [B2-test-perf-run2.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B2-test-perf-run2.txt) |
| Run 3 | 0 | 1 passed / 0 failed | 1 passed / 0 failed | 1.76s | 2.01s | [B2-test-perf-run3.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B2-test-perf-run3.txt) |

## 3. 清理與殘留檢查

詳細逐次記錄見 [B3-cleanup-checks.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B3-cleanup-checks.txt)、[B3-tmpdir-before.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B3-tmpdir-before.txt)、[B3-tmpdir-after.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B3-tmpdir-after.txt) 與 [Z-cleanup-and-residual.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/Z-cleanup-and-residual.txt)。

- **(a) 殘留程序**：5 次 `npm test`、3 次 `npm run test:perf` 及最終清理後，`pgrep -fl "wrangler|workerd"`（最終另含 `vitest`）全數為空。
- **(b) repo 內未追蹤檔案**：每次跑完與結束時 `git status --short` 皆為空，`worker/` 下無 `.test-state-*`；結束時 `worker/node_modules/` 與 `worker/.wrangler/` 已刪除，`git diff` 為空。
- **(c) 系統暫存目錄（`$TMPDIR`）差異**：
  - **測試用 persist 目錄（`wrangler-test-state-*`）**：每次執行後皆為 **0 筆殘留**，全部被測試 helper 正常移除。
  - **非 persist 的系統／工具差異（如實列出）**：每輪 `npm test` 前後比對皆新增 2 個 `miniflare-<32 hex>` 目錄（5 輪共 10 個；3 輪 `test:perf` 皆為 0 個），以及 Run 1 期間系統自行移除了 1 個無關項目 `MSau_56691`。抽查該 `miniflare-*` 目錄內部僅含空的 `email-store/`，屬於 Miniflare 自身執行期暫存目錄，在 AC9 復原／關機測試對程序群組發送 `SIGKILL` 時因程序無法執行退出 hook 而留下（並非測試 helper 建立的 `--persist-to` 狀態目錄，且原本測試前 `$TMPDIR` 即已有 10 個同類目錄）。

## 4. Helper 與設定修正審查結論（`2033c63..c34d702`）

整體結論：**未引入新缺陷，未放寬受測系統的規格時限，也沒有吞掉真正錯誤**。逐項行為審查如下：

1. **ESLint 設定（[eslint.config.mjs](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/eslint.config.mjs)）**：將 `no-console` 與 `prefer-readonly` 套用至全域，並讓 `src/**/*.ts` 與 `tests/**/*.ts` 明確使用 `tsconfig.json`／`tsconfig.test.json`，僅對工具設定檔啟用 `projectService`，修正了第 1 輪漏驗 `tests/` 的問題，且維持 `src/logger.ts` 的唯一豁免。
2. **`EPERM` 與程序群組清理（[server.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/tests/helpers/server.ts)）**：
   - 送訊號／探測程序群組遇到 `EPERM` 時，**不會**將其當作「群組已退出」而吞掉，而是視為「尚無法確認退出」繼續輪詢；若 5 秒寬限期內仍未轉為 `ESRCH`，會升級為 `SIGKILL` 並再等待至總計 10 秒上限（與修改前相同的 5s + 5s 預算），逾時仍拋出包含 `EPERM` 觀察訊息的逾時錯誤。
   - `dispose()` 改以 `try / finally` 確保即使程序群組停止失敗仍會嘗試移除暫存 persist 目錄，且任一或兩者失敗時皆完整拋出（多錯以 `AggregateError` 保留，不遺失原始原因）；`start()` 啟動失敗後的清理錯誤也以 `AggregateError` 合併回報。
   - 細微邊界觀察（非缺陷）：若極端情況下首次送出 `SIGTERM`/`SIGINT` 即發生 `EPERM`，函式不會立刻重送該訊號，而是等待 5 秒寬限期後升級 `SIGKILL`；在實務上 macOS 的 `EPERM` 發生於群組退出競態，且升級 `SIGKILL` 仍保證不會遺留程序。
3. **等待上限與逾時診斷（[wait.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/tests/helpers/wait.ts)、[data.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/tests/helpers/data.ts)、[stream.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/tests/helpers/stream.ts) 及相關 e2e／perf 檔）**：
   - R24 斷線退訂（`upper(2 * heartbeat + 1000)`，並自斷線時刻起算）、R23 小佇列重連總時限（45s）與清零時限（`upper(2000)`）、AC9 復原等待（10s）、`/health` 就緒上限（60s）均維持原值，未放寬任何規格斷言。
   - 唯一上調的是 `perf/fanout.test.ts` 的 Vitest 測試逾時由 60s 調至 70s，目的是略高於內部 SSE 讀取器 60s 上限，避免 Vitest 通用逾時先觸發而遮蔽詳細的 SSE 最後觀察區塊；AC11 的效能判定（`p95 < 200 ms`）完全未動。
   - `until()` 輪詢僅捕捉並重試單次請求的 `WaitTimeout`（並保留最近觀察與錯誤訊息於最終逾時報錯中），其他斷言失敗、HTTP 狀態錯誤或資料格式錯誤皆直接向上拋出，不會吞錯。
   - `server.request()` 將有限回應本文讀取納入單次請求時限並結合外部 `AbortSignal`，搭配 `withFeed()` 追蹤最後收到的 SSE 區塊，使逾時訊息具可診斷性且在逾時時確實中止底層請求／銷毀 socket。

## 5. 證據檔清單

皆位於 `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/`：

- [INDEX.md](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/INDEX.md)
- [A1-npm-ci.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-npm-ci.txt)
- [A1-typecheck.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-typecheck.txt)
- [A1-lint.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-lint.txt)
- [A1-format-check.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-format-check.txt)
- [A1-lint-probe.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/A1-lint-probe.txt)
- [B1-npm-test-run1.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run1.txt)
- [B1-npm-test-run2.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run2.txt)
- [B1-npm-test-run3.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run3.txt)
- [B1-npm-test-run4.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run4.txt)
- [B1-npm-test-run5.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B1-npm-test-run5.txt)
- [B2-test-perf-run1.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B2-test-perf-run1.txt)
- [B2-test-perf-run2.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B2-test-perf-run2.txt)
- [B2-test-perf-run3.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B2-test-perf-run3.txt)
- [B3-cleanup-checks.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B3-cleanup-checks.txt)
- [B3-tmpdir-before.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B3-tmpdir-before.txt)
- [B3-tmpdir-after.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/B3-tmpdir-after.txt)
- [Z-cleanup-and-residual.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5r2/Z-cleanup-and-residual.txt)
