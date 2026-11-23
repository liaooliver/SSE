已啟動 B.1（連續 3 次 `npm test`）與 B.2（連續 3 次 `npm run test:perf`）背景執行，等待完成通知後再繼續進行 D 突變抽查與彙整。
已啟動 D.1–D.6 共 6 項突變抽查背景執行（每項跑完皆自動還原 `worker/src`），等待完成通知。
等待 D.2 補充突變測試（同時停用 `cancel` 與 `enqueue` 例外退訂路徑）完成。
T8: FAIL

---

## 1. A. 品質關卡與乾淨環境（AC12）

| 項目 | 結果 | 摘要 | 證據檔 |
|---|---|---|---|
| A.1 品質關卡 | **FAIL** | 刪除 `worker/node_modules/`、`worker/.wrangler/` 後依序執行：`npm ci`（exit 0）、`npm run typecheck`（exit 0，兩個 tsconfig 均過）、**`npm run lint`（exit 1，23 個錯誤）**、`npm run format:check`（exit 0）。失敗原因：`worker/eslint.config.mjs` 將 `projectService.allowDefaultProject` 只設為 `["eslint.config.mjs", "vitest.config.ts"]` 且 `tsconfig.json` 僅包含 `src/` 與 `../contracts/domain.d.ts`，導致 `worker/tests/` 下全部 23 個 `.ts` 檔皆報 `Parsing error: ... was not found by the project service`（`defaultProject: "tsconfig.test.json"` 只對符合 `allowDefaultProject` 的檔案生效）。 | [A1-npm-ci.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A1-npm-ci.txt)、[A1-typecheck.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A1-typecheck.txt)、[A1-lint.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A1-lint.txt)、[A1-format-check.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A1-format-check.txt) |
| A.2 乾淨 checkout 啟動 | **PASS** | 以獨立暫存目錄啟動 `npx wrangler dev --port 18001 --inspector-port 18401 --persist-to <tmp>`：`GET /health` 於 1496 ms 內回 `200`（`{"status":"ok"}`），`GET /` 回 `200` `text/html; charset=utf-8`（79737 chars）；結束後以程序群組訊號停止，確認群組內無殘留程序。 | [A2-clean-wrangler-dev.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A2-clean-wrangler-dev.txt) |
| A.3 `index.html` 逐 byte 比對 | **PASS** | `cmp worker/public/index.html app/static/index.html` exit 0，兩者均為 80151 bytes，SHA-256 同為 `9aed92c47b6c879a3e0253cf2317f0d18fa53c53c59b62fd3b533100711008da`。 | [A3-index-html-cmp.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A3-index-html-cmp.txt) |
| A.4 `console.` 與 `package.json` | **PASS** | `worker/src/` 內 `console.` 僅出現在 [logger.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/src/logger.ts)（4 處），`worker/tests/` 內 0 處；[package.json](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/package.json) 無 `dependencies`，8 個 `devDependencies` 均精確釘選（無 `^`、`~`）且皆在 `AGENTS.md` §9.3 允許清單內。 | [A4-console-and-pkg.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/A4-console-and-pkg.txt) |

---

## 2. B. 測試結果與失敗判定

### B.1 `npm test` 連跑 3 次（含 flaky 偵測）

| 次數 | 結果 | 測試檔（passed / total） | 測試案例（passed / total） | 總耗時 | 證據檔 |
|---|---|---|---|---|---|
| Run 1 | **FAIL**（exit 1） | 16 / 17（`tests/e2e/defaults.test.ts` suite 失敗） | 22 / 22 | 59.23 s | [B1-npm-test-run1.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B1-npm-test-run1.txt) |
| Run 2 | **PASS**（exit 0） | 17 / 17 | 22 / 22 | 58.71 s | [B1-npm-test-run2.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B1-npm-test-run2.txt) |
| Run 3 | **PASS**（exit 0） | 17 / 17 | 22 / 22 | 58.31 s | [B1-npm-test-run3.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B1-npm-test-run3.txt) |

- **Flaky 測試**：`tests/e2e/defaults.test.ts`（第 1 次在 `afterAll` 清理程序群組時失敗，第 2、3 次通過）。

### B.2 `npm run test:perf` 連跑 3 次與獨立 p95 佐證

| 次數 | 結果 | 測試檔／案例 | 總耗時 | 證據檔 |
|---|---|---|---|---|
| Perf Run 1 | **PASS**（exit 0） | 1 / 1 檔、1 / 1 測試 | 2.07 s | [B2-test-perf-run1.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B2-test-perf-run1.txt) |
| Perf Run 2 | **PASS**（exit 0） | 1 / 1 檔、1 / 1 測試 | 1.98 s | [B2-test-perf-run2.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B2-test-perf-run2.txt) |
| Perf Run 3 | **PASS**（exit 0） | 1 / 1 檔、1 / 1 測試 | 2.07 s | [B2-test-perf-run3.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B2-test-perf-run3.txt) |

- 預設 vitest reporter 未印出 `annotate()` 內的 p95 數值，故另於 `127.0.0.1:18003`（inspector `18403`、`SSE_LOG_INTERVAL=0.005`、20 訂閱者）連測 3 輪作為獨立佐證（[B2-perf-independent-p95.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B2-perf-independent-p95.txt)）：
  - Round 1：20 訂閱者全收滿 202 筆、166 筆就緒後 log 樣本，p50 = **1 ms**、p95 = **2 ms**、max = **3 ms**
  - Round 2：20 訂閱者全收滿 202 筆、166 筆樣本，p50 = **1 ms**、p95 = **2 ms**、max = **6 ms**
  - Round 3：20 訂閱者全收滿 202 筆、166 筆樣本，p50 = **1 ms**、p95 = **2 ms**、max = **2 ms**
  - 遠低於 AC11 的 200 ms 上限。

### B.3 失敗清單與判定

1. **`npm run lint`（AC12／R29、`AGENTS.md` §9.1–§9.2）— IMPL BUG（設定缺陷）**
   - 預期行為：在 `worker/` 下執行 `npm run lint`（`eslint .`）必須涵蓋 `src/` 與 `tests/` 且 exit 0。
   - 實際行為：`worker/eslint.config.mjs` 的 `projectService` 未納管 `tsconfig.test.json` 對應的 `tests/**/*.ts`，導致全部 23 個測試檔案出現解析錯誤並回傳 exit 1。
2. **`tests/e2e/defaults.test.ts` Run 1 `afterAll` 失敗（R2／AC12、`AGENTS.md` §9.7）— TEST BUG**
   - 預期行為：測試結束時對 `wrangler dev` 程序群組送出 `SIGTERM` 並確認群組內無殘留程序後刪除暫存 persist 目錄，不應因 macOS 程序群組狀態過渡而拋出未預期例外或殘留暫存目錄。
   - 實際行為：在 `defaults.test.ts` 的測試案例本身通過後，`afterAll` 輪詢程序群組存活狀態時，`process.kill(-pid, 0)` 在 macOS 上對退出中／zombie 狀態的程序群組間歇回傳 `EPERM`；測試 helper 只攔截 `ESRCH` 而未處理 `EPERM`，導致整個 suite 以 `Error: kill EPERM` 失敗，且因清理函式未以 `try/finally` 包裹刪除暫存目錄，同步在 `worker/` 內遺留了未追蹤的 `.test-state-35yiFP/` 目錄。

---

## 3. 測試品質審查結論

整體測試設計紮實、嚴格對應規格需求，但測試 harness 存在 2 項可信度／穩定性缺陷：

- **無空測試或永遠通過的斷言**：所有 unit、e2e、perf 測試皆有實質狀態／事件／header 斷言。其中 `tests/e2e/shutdown.test.ts` 沒有 `expect` 呼叫是刻意符合 `SPEC-cloudflare` R24／AC9「關機時限為觀察項，不作通過條件」的規定，改以 vitest `annotate()` 記錄數據（以 verbose reporter 實測驗證：`SIGTERM` SSE 3 ms／群組 25 ms、`SIGINT` SSE 7 ms／群組 53 ms，均無殘留程序；見 [B2-shutdown-verbose.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/B2-shutdown-verbose.txt)）。
- **無固定 sleep 猜時間**：啟動就緒皆輪詢 `GET /health`，串流就緒皆等待 `retry: 3000\n\n` 區塊，輪詢工具具備總逾時與單輪逾時控制。
- **無違規存取內部狀態**：未直接讀寫 persist 目錄內容，也未 import `src/domain.ts` 以外的模組（僅 `page.test.ts` 依 AC12 允許例外讀取兩份 `index.html` 比對位元組）。
- **待修缺陷（均位於測試 helper）**：
  1. 程序群組結束偵測在 macOS 未處理 `EPERM`（造成 Run 1 flaky）。
  2. 暫存 persist 目錄建立於 repo 內的 `worker/.test-state-*` 且未用 `try/finally` 確保刪除，一旦停止程序拋錯便會污染 git 工作區。
  3. 在 `heartbeat.test.ts` 等待 `/stats` 歸零的輪詢迴圈中，將剩餘時間直接傳作 `fetch` timeout，臨近期限時會拋出通用 `TimeoutError` 而非自訂逾時訊息（於 D.2b 觀察到）。

---

## 4. C. 合約檢查

- **偏差清單**：**0 偏差**。
- **C.1 `domain.ts` vs `contracts/domain.d.ts`**：`contracts/domain.d.ts` 共匯出 27 個名稱（5 type、9 interface、3 class、4 const、6 function），[domain.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/src/domain.ts) 全部具備，且 `npm run typecheck`（含 [contract-check.ts](file:///Users/oliver/.local/share/sse-orchestra/verify-ws/worker/src/contract-check.ts)）exit 0（[C1-domain-exports.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/C1-domain-exports.txt)）。
- **C.2 已比對的端點清單**（以獨立 `wrangler dev --port 18002 --inspector-port 18402` 實測成功與錯誤路徑，核對狀態碼、`Content-Type`、header、`additionalProperties: false`、`minimum`、`minLength` 與事件 schema；[C2-openapi-http-check.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/C2-openapi-http-check.txt)）：
  - `GET /health`（200 `application/json` `{status:"ok"}`；`POST` → 405）
  - `GET /stats`（200 `application/json` `{subscribers:0}`；`POST` → 405）
  - `GET /install/plan`（200 `application/json`，4 stages 結構嚴格符合；`POST` → 405）
  - `GET /install/scenarios`（200 `application/json`，7 scenarios 順序與型別符合；`POST` → 405）
  - `GET /`（200 `text/html; charset=utf-8`，含 6 個必填元素 ID；未知靜態路徑 → 404）
  - `GET /install`（未執行前 → 404；執行後 200 `Snapshot`，含 `TaskError` 非空欄位驗證）
  - `POST /install`（422 含壞 JSON／缺欄／型別錯／未知情境；202 `{run_id, scenario}` 忽略額外欄位；執行中 → 409）
  - `GET /install/logs`（未執行前 → 404；422 含缺 `run_id`、`run_id=0`、`limit=0/1001`、`after=-1`；200 分頁 `next_after` 非 null 與尾頁 `null`；錯誤 `run_id` → 409）
  - `GET /install/events`（未執行前 → 404；無效 query → 422；200 SSE 含 `retry: 3000`、R19 header、無 `Content-Encoding`、各事件 payload 與 `x-sse-events` 一致；異輪起點 → `retry` + 無 `id` 之 `reset`；已結束且 `r=R, n>=L` → 204 空 body）
- **C.3 測試 import 掃描**：`worker/tests/` 所有指向 `src/` 的 import 均只匯入 `src/domain` 且全數為 `contracts/domain.d.ts` 所列名稱，**0 違規**（[C3-test-imports.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/C3-test-imports.txt)）。

---

## 5. D. 突變抽查結果（6 項）

所有突變於測試後皆已用 `git checkout -- worker/src` 還原（每個證據檔皆記錄 `RESTORED_DIFF_LEN: 0`）：

| # | 突變內容 | 最小測試集 | 是否被抓到 | 說明 | 證據檔 |
|---|---|---|---|---|---|
| D.1 | R18：已結束且 `r = R, n ≥ L` 跳過回傳 204、改續串流 200 | `tests/e2e/cursors.test.ts` | **被抓到**（exit 1） | 斷言收到 200 而非預期 204。 | [D1-mutation-r18-204.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D1-mutation-r18-204.txt) |
| D.2 | R16／R24：訂閱者斷線時 `cancel` 回呼不移除訂閱者 | `tests/e2e/heartbeat.test.ts` | **未被抓到**（exit 0） | 原因為**規格黑箱邊界與雙重退訂路徑重疊（非缺少斷言）**：`SPEC-cloudflare` R24 要求實作同時處理 `cancel` 回呼與 `enqueue` 例外，且禁止測試直接存取 DO 內部（R2）。斷線後 workerd 在第 2 次寫入觸發 `cancel` 並取消串流，即使 `cancel` 改為空操作，下一次 heartbeat（500 ms 後）呼叫 `controller.enqueue` 仍會拋出例外並由 `enqueue-error` 路徑移除訂閱者，總耗時仍在 R24 放寬後的上限（`3 × (2 × 0.5 s + 1 s) + 0.2 s = 6.2 s`）之內。另做補充突變 **D.2b**（同時停用 `cancel` 與 `enqueue-error` 退訂），`heartbeat.test.ts` **有抓到並失敗**（exit 1），證明測試確實能偵測「斷線完全不退訂」，只是在黑箱 HTTP 與放寬時限下無法單獨區分兩條退訂路徑。 | [D2-mutation-r16-r24-cancel.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D2-mutation-r16-r24-cancel.txt)、[D2b-mutation-r16-r24-both-paths.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D2b-mutation-r16-r24-both-paths.txt) |
| D.3 | R25：DO 啟動時跳過中斷復原（僅建表） | `tests/e2e/recovery.test.ts` | **被抓到**（exit 1） | 重啟後快照 `status` 維持 `"running"` 而非 `"failed"`。 | [D3-mutation-r25-recovery.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D3-mutation-r25-recovery.txt) |
| D.4 | R7／R10：產生失敗情境事件時於 `task_failed` 讓 `seq` 跳號 +1 | `tests/e2e/scenarios.test.ts` | **被抓到**（exit 1） | 斷言 `seq` 連續性失敗（預期 39、實得 40）。 | [D4-mutation-r7-r10-seq-gap.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D4-mutation-r7-r10-seq-gap.txt) |
| D.5 | R23：`SubscriberQueue.push` 滿載時改回傳 `true` | `tests/unit/queue.test.ts` | **被抓到**（exit 1） | 斷言滿載 `push` 應回傳 `false`，實得 `true`。 | [D5-mutation-r23-queue-push.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D5-mutation-r23-queue-push.txt) |
| D.6 | R19：`Cache-Control` 移除 `no-transform` | `tests/e2e/defaults.test.ts` | **被抓到**（exit 1） | `Feed.ready()` 斷言 `Cache-Control` 缺少 `no-transform`。 | [D6-mutation-r19-headers.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/D6-mutation-r19-headers.txt) |

---

## 6. 殘留檢查與證據檔案清單

- **殘留程序檢查**：`pgrep -fl "wrangler|workerd|vitest"` 為空（無任何殘留程序）。
- **工作區狀態**：已移除 `worker/node_modules/`、`worker/.wrangler/`、`worker/.test-state-*` 及暫存產物，`git status` 為 `nothing to commit, working tree clean`，`git diff` 為空（見 [Z-cleanup-and-residual.txt](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/Z-cleanup-and-residual.txt)）。
- **證據目錄**：`/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/`（索引見 [INDEX.md](file:///Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.5/INDEX.md)），共 27 個檔案：
  - `INDEX.md`
  - `A1-npm-ci.txt`、`A1-typecheck.txt`、`A1-lint.txt`、`A1-format-check.txt`
  - `A2-clean-wrangler-dev.txt`、`A3-index-html-cmp.txt`、`A4-console-and-pkg.txt`
  - `B1-npm-test-run1.txt`、`B1-npm-test-run2.txt`、`B1-npm-test-run3.txt`
  - `B2-test-perf-run1.txt`、`B2-test-perf-run2.txt`、`B2-test-perf-run3.txt`、`B2-perf-independent-p95.txt`、`B2-shutdown-verbose.txt`
  - `C1-domain-exports.txt`、`C2-openapi-http-check.txt`、`C3-test-imports.txt`
  - `D1-mutation-r18-204.txt`、`D2-mutation-r16-r24-cancel.txt`、`D2b-mutation-r16-r24-both-paths.txt`、`D3-mutation-r25-recovery.txt`、`D4-mutation-r7-r10-seq-gap.txt`、`D5-mutation-r23-queue-push.txt`、`D6-mutation-r19-headers.txt`
  - `Z-cleanup-and-residual.txt`
