已修正 `worker/tests/` 的 8 個檔案。四項離線檢查均以 exit 0 完成，本機專用設定與模擬測試檔已刪除。

| 問題 | 修正後的行為 |
|---|---|
| 程序群組清理 | 收到 `EPERM` 會繼續輪詢，收到 `ESRCH` 才確認群組已退出。等候 5 秒後仍無法確認，就送 `SIGKILL` 再等最多 5 秒。最終錯誤會列出 PGID、實際等待時間與最後探測結果。 |
| 暫存目錄 | `mkdtemp` 在 `os.tmpdir()` 下建立 `--persist-to` 目錄，復原測試重啟時沿用同一目錄。`finally` 一律嘗試刪除；若停止程序與刪除目錄均失敗，會保留兩個錯誤。 |
| `/stats` 逾時 | 單次 `fetch` 有固定 5 秒上限，整體截止時會取消進行中的請求。錯誤會列出預期訂閱數、已等多久，以及最後讀到的訂閱數。 |
| 全面檢查 | 也修正了本機埠分配、`/health` 就緒、復原快照及 SSE 讀取的逾時診斷。小佇列的多次重連共用同一截止時間，效能測試則預留時間讓 SSE 讀取器先回報具體錯誤。 |

**變更檔案**（相對於 `worker/tests/`）

- `helpers/`：新增 `wait.ts`，修改 `server.ts`、`data.ts`、`stream.ts`
- `e2e/`：`heartbeat.test.ts`、`recovery.test.ts`、`small-queue.test.ts`
- `perf/`：`fanout.test.ts`

**離線驗證**

| 檢查 | 實際結果 |
|---|---|
| `tsc -p tsconfig.check.json` | exit 0，無輸出 |
| `prettier --print-width 100 --check worker/tests` | exit 0，`All matched files use Prettier code style!` |
| 在 `worker/` 執行 `eslint --config eslint.check.mjs .` | exit 0，無輸出。已啟用 `strictTypeChecked`、`stylisticTypeChecked`、`no-console`、`prefer-readonly` |
| Vitest 靜態收集 | exit 0，18 個測試檔、23 個案例 |
| 清理與逾時的離線模擬 | `Tests 4 passed (4)` |

工作區缺少 Worker 實作，因此未執行真實 Wrangler e2e、效能測試或連續三次 `npm test`。