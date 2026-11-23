# T8.4：為 Cloudflare Worker + Durable Object 版寫測試

你是測試作者。你的工作目錄是專案根目錄（tests-ws）。**所有檔案只寫在這個資料夾裡。**

## 目標

為「TypeScript 的 Cloudflare Worker + Durable Object 版」（實作在 `worker/`，**你看不到也不要找實作**）寫測試，放在 `worker/tests/`。測試只根據：

1. `docs/SPEC.md`（v1.1.4，行為基準）
2. `docs/SPEC-cloudflare.md`（cf1.1，逐條列出和 SPEC.md 不同之處；**衝突時以它為準**；它的 R 逐條處置表告訴你每一條 R／AC 在這個版本變成什麼）
3. `contracts/openapi.yaml`、`contracts/domain.d.ts`（`domain.pyi` 的 TS 版，含 `SubscriberQueue`）
4. `AGENTS.md` **§9（尤其 §9.2 的 scripts／tsconfig／vitest 設定、§9.7 測試規則）**。**請逐字照做。**

## 參考素材

- `tests/`（Python）是**前一版（FastAPI）的測試**，也是你之前寫的。可以讀來參考「每條 R／AC 怎麼驗證」並把邏輯移植成 TypeScript；但這次的測試介面不同（沒有 `create_app`、沒有直接 ASGI 呼叫、沒有 SQLite 檔），一切以 SPEC-cloudflare 為準。**不要修改或交付 `tests/`（Python）。**
- `worker/package.json`、`worker/node_modules/`：我預先裝好的**本機工具鏈**（wrangler、typescript、vitest、eslint、typescript-eslint、prettier、`@cloudflare/workers-types`、`@types/node`，精確版本）。它只是讓你離線檢查用，**不是交付物**。你的沙盒不能連網，不要執行 `npm install`。

## 要寫的測試

放在 `worker/tests/`，結構依 AGENTS §9.6／§9.7：

- `tests/unit/`：`domain` 純函式（只能從 `../../src/domain` import `contracts/domain.d.ts` 列出的名稱，**包含 `SubscriberQueue`** 的單元測試，對應 AC10 的替代做法）。
- `tests/e2e/`：真的 `wrangler dev`。**每個測試檔自己啟動一個**，方式照 §9.7（空的 `--persist-to` 暫存目錄、作業系統分配埠、`--var` 傳設定、`detached` 程序群組、輪詢 `GET /health` 就緒、結束時對群組 SIGTERM→SIGKILL 並確認沒有殘留）。涵蓋 SPEC-cloudflare 逐條處置表中所有「不變／修改／替換」的 R 和 AC（AC1–AC9、AC12），包含：R18 全部分支、R16 `/stats`、R19 標頭與不壓縮、R20 `retry` 區塊先送、R22 heartbeat、R23 的 HTTP 冒煙（`subscriber_queue_size=1`，不斷言一定被踢）、R24 斷線後訂閱者數在 `2×heartbeat+1` 秒內回到原值（用 `--var` 把 heartbeat 縮短）、R25 SIGKILL 後以同一個 `--persist-to` 重啟出現 `E_INTERRUPTED`、R3 設定值不合法時的行為、R26 頁面靜態檢查（可直接用 HTTP 取得的 HTML 判斷的部分）、AC12 的 `index.html` 與 `../app/static/index.html` 逐 byte 相同比對。
- `tests/perf/`：AC11（20 個訂閱者、p95 < 200 ms，只代表本機）。
- `tests/helpers/`：啟動／停止 wrangler dev、SSE 解析器、切斷 TCP（`node:http` + `agent: false` + 銷毀 socket）等。不新增依賴。
- 每個測試的名稱或上方註解標出 R-id／AC-id。時間斷言依 SPEC.md §10（下限嚴格，上限 ×3 + 200 ms）；所有等待都要有逾時；不用 `sleep` 猜時間。
- 每個 e2e 測試檔要把 vitest 的逾時寫在檔內（`test(..., { timeout })` 或 `describe` 層級），不要依賴你看不到的 `vitest.config.ts`。

## 離線檢查（你能做、也必須做的）

實作不在你的工作區，所以 e2e／unit 都**跑不起來**，這是預期的。你必須做：

1. **型別檢查**：寫一個**本機專用**的 `worker/tsconfig.check.json`（不交付）：開 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`noFallthroughCasesInSwitch`、`noEmit`，`types: ["node"]`，用 `paths` 把 `../../src/domain` 之類的匯入映射到 `contracts/domain.d.ts`，只涵蓋 `tests/`。`npx tsc -p worker/tsconfig.check.json` 必須通過。
2. **Prettier**：`printWidth: 100`（和交付設定一致），`npx prettier --check worker/tests` 通過。
3. **ESLint（盡力）**：你可以寫本機專用的 flat config（不交付），用 typescript-eslint 的 `strictTypeChecked` + `stylisticTypeChecked`、`no-console`，檢查 `worker/tests`；若因為缺少實作而無法跑型別感知規則，說明原因即可。
4. **收集檢查**：能列出所有測試名稱就列出（例如用你自己的本機 stub 讓 vitest 收集；stub 不交付，放在 `worker/.local/`，完成後刪掉）。

## 限制

- 只准新增或修改 `worker/tests/`，以及上面標明「本機專用、不交付」的檔案。**不可以修改** `docs/`、`contracts/`、`AGENTS.md`、`tests/`（Python）、`pyproject.toml`。完成時把本機專用檔案（`tsconfig.check.json`、eslint 設定、`.local/`）都刪掉，只留 `worker/tests/`。
- 測試只能存取系統：HTTP、`wrangler dev` 程序的啟動／訊號、`domain.d.ts` 的名稱、`--persist-to` 目錄**不可以讀寫內容**（只有 AC12 的 `index.html` 比對可以讀檔）。
- 規格和合約不夠用時不要猜：回報 `CF-GAP: <缺什麼> — <為什麼需要>`；互相矛盾回報 `CF-CONFLICT: …`。
- 不可以碰這個資料夾以外的路徑；不可以上網。
- 本機埠號：測試用作業系統分配的埠，不寫死埠號。

## 回報

最終回覆簡短列出：
1. 交付的檔案清單（`worker/tests/` 下）。
2. **測試名稱 → R-id／AC-id 對照表**（一行一個）。
3. 沒有涵蓋的 R／AC 與原因。
4. 離線檢查的指令與結果（tsc、prettier、eslint、收集）。
5. 所有 `CF-GAP`／`CF-CONFLICT`。
6. 你判斷「實作者最容易做錯」的 5 個行為（只寫行為，不寫實作）。

不要貼大段原始碼。
