已在 [worker/tests/](/Users/oliver/.local/share/sse-orchestra/tests-ws/worker/tests) 交付 **23 個檔案**。Vitest 成功收集 **23 項測試**，型別、格式與型別感知 ESLint 檢查全部通過。工作區沒有 Worker 實作，因此沒有執行測試案例，也沒有 AC11 延遲或關機時間的實測值。本機專用設定、stub 和快取均已清除。

### 交付檔案與測試對照

路徑均相對於 `worker/tests/`。另有五個共用檔案：`helpers/catalog.ts`、`helpers/data.ts`、`helpers/server.ts`、`helpers/stream.ts`、`helpers/sync.ts`。

| 測試檔案 | 收集到的測試名稱（省略 ID 前綴） | R-id／AC-id |
|---|---|---|
| `unit/domain.test.ts` | 計畫與情境逐欄符合規格順序 | R4、R5 |
| `unit/domain.test.ts` | 七種劇本的順序、行數、訊息與終點 | R6、R10 |
| `unit/domain.test.ts` | 事件 ID 僅接受安全的 ASCII 十進位整數對 | R9 |
| `unit/domain.test.ts` | 每一筆合法轉移都回傳正確快照並保留舊值 | R10 |
| `unit/domain.test.ts` | 拒絕錯誤序號、輪次、目標、狀態與資料欄位 | R8、R10 |
| `unit/domain.test.ts` | SSE 欄位、跳脫字元與控制區塊 | R19、R20、R22 |
| `unit/queue.test.ts` | 有界 FIFO 在溢位時保留內容，訂閱者彼此獨立 | R23、AC10 |
| `e2e/http.test.ts` | 初始狀態、驗證順序與並行安裝 | R1–R3、R11–R18、AC8 |
| `e2e/defaults.test.ts` | 未指定設定時相鄰 log 至少相隔 150 毫秒 | R3、R14 |
| `e2e/invalid-config.test.ts` | 無效設定列出所有錯誤並保留靜態首頁 | R2、R3、R17 |
| `e2e/invalid-single.test.ts` | 單一非有限設定即回報錯誤 | R3、R17 |
| `e2e/invalid-syntax.test.ts` | 部分可解析的字串仍須逐一報錯 | R3 |
| `e2e/live-logs.test.ts` | 即時 log 可補讀，同一步的非 log 事件一併提交 | R13–R15、R25 |
| `e2e/cursors.test.ts` | 換輪、重播、重設與游標優先序 | R9、R14–R16、R18–R21、AC6 |
| `e2e/scenarios.test.ts` | 七個情境的完整劇本、失敗位置及 EOF | R5–R8、R10、R13、R16、R18–R21、AC4、AC5、AC7 |
| `e2e/sync.test.ts` | 七個情境各在十個進度點重建 | R13、R15、R18、R20、R27、AC1、AC2 |
| `e2e/reconnect.test.ts` | 三十次切斷 TCP 後接回完整後綴 | R13、R15、R18、R20、AC1、AC3 |
| `e2e/heartbeat.test.ts` | 心跳、即時補讀與斷線退訂 | R14、R16、R18–R20、R22、R24、R25、AC9 |
| `e2e/recovery.test.ts` | SIGKILL 後同目錄重啟並一次補齊中斷事件 | R16、R17、R25、AC9 |
| `e2e/shutdown.test.ts` | 觀察 SIGTERM 與 SIGINT 的串流及群組結束時間 | R24、AC9 觀察項 |
| `e2e/small-queue.test.ts` | 容量一的連線可補齊整輪 | R16、R18、R20、R23、R24、AC10 |
| `e2e/page.test.ts` | 靜態首頁的元素、內嵌資源與產物位元組 | R26、AC12 |
| `perf/fanout.test.ts` | 本機二十個訂閱者的完整序列與 log 延遲 p95 | R20、R23、AC11 |

### 離線檢查

以下指令均在 `worker/` 執行，exit code 全為 `0`。

| 指令 | 實際結果 |
|---|---|
| `npx tsc -p tsconfig.check.json` | 無輸出。以 `contracts/domain.d.ts` 完成嚴格型別檢查。 |
| `npx prettier --print-width 100 --check tests` | `Checking formatting...`<br>`All matched files use Prettier code style!` |
| `npx eslint --config .local/eslint.config.mjs tests` | 無輸出。啟用了 `strictTypeChecked`、`stylisticTypeChecked`、`no-console` 與 `prefer-readonly`。 |
| `npx vitest list --config .local/vitest.config.mjs --configLoader runner --no-staticParse tests` | 使用暫時的 domain stub 載入測試模組，列出上表 23 項。 |

### 涵蓋限制與規格差異

- **R1、R28、R29、AC12** 的完整專案驗收仍待整合。依離線限制未執行 `npm ci`。本工作區只提供工具鏈，因此正式的 `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run test:perf` 及乾淨 checkout 啟動檢查均未執行。AC12 的 HTML 逐 byte 斷言已交付。
- **R26、R27** 已涵蓋靜態 HTML 與 HTTP 同步流程。畫面跟隨、捲動、錯誤呈現及瀏覽器原生 `EventSource` 重連仍屬手動驗收。
- **R2、R14、R20、R22–R25** 以公開介面檢查可觀察結果。DO 內部交易、alarm 與計時器清理無法直接觀察。R23 的設計 A／B spike 屬實作者交付項。
- `CF-CONFLICT: AGENTS.md §9.7 要求就緒時 /health 回 200，R3 要求無效設定時回 500。` 無效設定測試以含指定變數名稱的 `500` 判定程序已可受測，其餘測試等候 `200`。
- `CF-GAP` 無新增項目。

### 最容易做錯的五個行為

1. `last_event_id` query 格式錯誤時，即使 header 合法也應回 `422`。格式錯誤的 header 則視同未提供。
2. 同輪游標超前時，執行中的輪次送 `retry`、無 `id` 的 `reset`，然後關閉。已結束的同輪在游標等於或超過末筆時回 `204`。
3. `retry` 必須是第一個獨立區塊。從快照序號接上重播及即時事件後，整輪序號必須連續且各出現一次。
4. TCP 斷線後，訂閱數須在 R24 時限內回到連線前的值；`reset`、`204` 與已交付 `run_finished` 的連線都不應留在 `/stats`。
5. 有執行中 task 時遭 SIGKILL，沿用同一 persist 目錄重啟後，第一次 `/health` 回 `200` 時，快照就應已是 `failed`，並能重播 `E_INTERRUPTED` 收尾事件。