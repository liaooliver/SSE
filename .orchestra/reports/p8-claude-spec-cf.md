# T8.2 回報（第一次執行寫完 SPEC-cloudflare 後遇網路中斷，resume 補完）

三個檔都寫好了。`SPEC-cloudflare.md` 我先 Read 確認過，內容完整，結尾有版本紀錄和「待決定」。不過我沒有辦法執行指令，所以 `domain.d.ts` 和 §9 寫的設定都**還沒跑過 `tsc` 或任何檢查**。

## 產出的檔案
- `docs/SPEC-cloudflare.md`（新檔，cf1.0）。這次另外修了 §0.1 一句：`domain.d.ts` 的 CF 專用名稱除了 `SubscriberQueue`，還有 `ValueError`、`KeyError`，原本漏寫了。
- `contracts/domain.d.ts`（新檔）：對應 `domain.pyi` 的全部 24 個名稱，另外加 `ValueError`、`KeyError`、`SubscriberQueue<T>`（`capacity`、`size`、`push(): boolean`、`shift()`）。
- `AGENTS.md`：新增 §9「TypeScript（`worker/`）」，§1–§8 一字未動。

我核對過，訂閱者佇列的說法在 `domain.d.ts`、R23、AC10、L8、F5 和 AGENTS §9 都一致：
- 佇列已經有 capacity 筆時，再 `push` 回 `false`，佇列內容不變；
- `shift` 依先進先出取出，空的時候回 `undefined`；
- 建構時容量不合法（例如 0、-1、1.5、NaN）會拋 `ValueError`。

## 修改／替換／不適用
- R1 替換：改成 Node ≥ 20 + `wrangler dev`，`wrangler.jsonc` 的必要設定固定下來。
- R2 替換：沒有 `create_app` 和 ASGI 了；測試只能用 HTTP、domain、程序控制、persist 目錄。
- R3 修改：只剩三個 `--var`；寫明字串解析規則；不合法時回 500（text/plain，內容列出變數名稱）。
- R13 修改：狀態和 `last_seq` 要在同一個 `transactionSync` 裡讀出。
- R14 修改：一次 alarm 走一「步」（1 個 log 加上後面的非 log 事件）；進度只看 `last_seq`，所以平台重試不會重複寫入；寫明 body 的解析規則。
- R15 修改：整數只接受 `^[0-9]+$` 而且 ≤ 2^53−1；`run_id ≥ 1`；先檢查 422，再判斷 404／409。
- R16 修改：訂閱者數就是 DO 記憶體集合的大小；已斷線但還沒偵測到的連線仍然計入。
- R17 修改：`/health` 會先驗證設定；回 200 代表 R25 復原已經完成。
- R20 修改：登記、讀重播、送第一個區塊在同一段沒有 `await` 的程式碼裡完成。
- R22 修改：heartbeat 用 DO 計時器觸發；ping 不經過佇列。
- R23 替換：`SubscriberQueue` 加上 `highWaterMark` 為 1 的串流；溢位時呼叫 `close()`。
- R24 修改：斷線時限改成 `2×heartbeat_interval + 1` 秒；關機改成對 `wrangler dev` 程序群組送訊號；`http.disconnect` 那部分不適用。
- R25 替換：改用 DO SQLite + `transactionSync`；復原在建構子裡做，並清掉 alarm。
- R28 替換：禁用 `console.*`，只有 `logger.ts` 可以用。
- R29 修改：`worker/` 依 AGENTS §9。
- AC3 修改：用真的 `wrangler dev`，銷毀 socket 來切斷 TCP。
- AC9 修改：改用新的時限；復原測試對程序群組送 SIGKILL 後，用同一個 `--persist-to` 重啟；另外檢查沒有 `Content-Encoding`。
- AC10 替換：`SubscriberQueue` 單元測試，加上佇列大小設 1 的 HTTP 冒煙測試（不斷言一定會被踢）。
- AC11 修改：用 `wrangler dev`，數字只代表本機。
- AC12 替換：`worker/` 下的 npm 指令，加上 `index.html` 逐 byte 比對。
- 不適用：沒有整條 R 不適用。§10 的 ASGI／lifespan 項目不適用；R24 的 ASGI 時限、R25 的 sqlite3／WAL／`to_thread` 不適用。

## CF-GAP／CF-CONFLICT
- **CF-CONFLICT-1**：定案的路由沒有 `/stats`，但 openapi 要求它存在。我暫時讓 `/stats` 也轉給 DO，並列進 `run_worker_first`，請確認。
- **CF-GAP-1**：超過 2^53−1 的整數（`parseEventId` 和 query 參數），選項有視為不合法、改用 bigint、用字串比較。
- **CF-GAP-2**：PoC 發現 npm 11 預設不跑 workerd 的 postinstall，所以 `npm ci && npx wrangler dev` 在乾淨環境可能起不來。
- **CF-GAP-3**：`wrangler dev` 收到 SIGINT／SIGTERM 後能不能 3 秒內退出，PoC 沒量過。
- **CF-GAP-4**：測試的 typecheck 需要 `@types/node`，但它不在允許的依賴清單裡。
- **CF-GAP-5**：R23 依賴 workerd 對 `ReadableStream` 呼叫 `pull`、更新 `desiredSize`，PoC 沒驗證過。

## SPEC.md 本身的缺陷（沒有改）
- R15 沒寫 `run_id ≥ 1`，但 openapi 有。整數邊界（空白、`+`、極大值）、重複的 query 參數、POST body 不是物件或 Content-Type 不對時怎麼處理，SPEC 都沒寫，只是隱含沿用 FastAPI 的行為。
- R14 沒說非 log 事件排在 log 間隔的前面還是後面。
- R23 的「超過 subscriber_queue_size」沒說清楚是第 N 筆還是第 N+1 筆算滿。
- §10 的「上限 ×3 + 200 ms」有沒有套用到 R24 的硬性時限，沒寫明。
- R10 第 9 項沒說 `bool` 算不算 `int`。

## brief 本身的不一致（照合約處理）
- brief 寫「R17、`/stats`」，但 `/stats` 是 R16，R17 是 `/health`。兩條我都處理了。
- brief 說「時間用 number（epoch 秒，和 pyi 一致）」，但 pyi 裡只有 ISO 字串 `ts`，沒有數值時間，所以我維持字串（F10）。

---

# T8.2b 回報（協調者決定 G1–G6 寫入，cf1.1）

協調者的六項決定都已寫進三個檔，`SPEC-cloudflare.md` 版本改為 **cf1.1**，「待決定」剩 **0 個**。我沒辦法執行指令，所以 `domain.d.ts` 只做了閱讀檢查，沒有跑過 `tsc`。

## 改了哪些條文

**`docs/SPEC-cloudflare.md`**
- **CF-CONFLICT-1（`/stats`）**：架構表的路由、R1 的 `run_worker_first`、R2 的轉送清單都列入 `/stats`。
- **CF-GAP-1（大整數）**：
  - R9 由「不變」改成「修改」，新條文寫明任一邊超過 2^53−1 就不合法，`parseEventId` 回 `null`。
  - R18 註明：query 回 422，header 視同沒帶。
  - R15 的參數超過時回 422。
  - L14 改寫成和 Python 版的三點差異。
- **CF-GAP-2（乾淨 checkout）**：
  - R1：乾淨 checkout 下啟動指令必須直接可用、不可更改；唯一解法是在根層 scripts 加 `"postinstall": "npm rebuild esbuild workerd"`。
  - AC12 新增「`npm ci` 後 `npx wrangler dev` 能起來，60 秒內 `/health` 回 200」的檢查項。
- **CF-GAP-3（關機時間）**：
  - R24 的 3 秒關機時限改成「不適用，改為觀察項」，只量測、寫進回報。
  - 新增 L15（關機時間不保證）。
- **CF-GAP-4（`@types/node`）**：AC12 寫明 typecheck 要 `tsconfig.json` 和 `tsconfig.test.json` 兩個都通過。
- **CF-GAP-5（串流背壓）**：
  - R23 改成四段：外部可觀察行為（不論設計 A 或 B 都要成立）、正式實作前必做的 spike、設計 A（預設）、設計 B（`desiredSize ≤ 0` 就算溢位，重播事件也佔容量）。
  - 寫明不論用哪一種設計，`SubscriberQueue` 合約和 AC10 的單元測試都不變。L8 同步更新。
- **其他**：
  - 版本紀錄加了 cf1.1 一列，以及決定明細 G1–G6。
  - §7 改名為「待決定與已決定」：7.1 是 0 個，7.2 每項保留原本的問題並寫出決定和新條文的位置。

**`contracts/domain.d.ts`**
- 開頭的「Pending」改成「已決定」。
- 型別對應規則第 6 條和 `parseEventId` 的說明加上「超過 2^53−1 就不合法」。
- `SubscriberQueue` 加註：不論 R23 用哪種設計，合約都不變。
- 版本改成 cf1.1。

**`AGENTS.md` §9**（Python 部分沒動）
- §9.1：寫明 `npm ci` 要在乾淨 checkout 下成功，typecheck 要兩個 tsconfig 都通過。
- §9.2：`typecheck` 的說明、`postinstall` 的使用條件、乾淨 checkout 可用的要求；`tsconfig.test.json` 的 `types` 用 `node`。
- §9.3：允許的依賴清單加入 `@types/node`。
- §9.5：加入 R23 spike 的要求。

## 有一個解讀需要確認
決定裡寫「AC9 必要項只留 SIGKILL 重啟復原」。我理解成只限縮**關機相關**的項目：header、`retry`、ping、斷線時限這四項仍然是必要項，SIGTERM／SIGINT 那項改成觀察項。如果原意是 AC9 整條只剩 SIGKILL 復原，請告訴我。

## `domain.d.ts` 閱讀檢查的結果
- 沒有發現無法成立或自相矛盾的宣告：
  - `export declare class ValueError extends Error` 和 `KeyError` 的寫法合法；
  - `SubscriberQueue` 裡的 `get size()`、`readonly capacity` 在 `declare class` 裡可以用；
  - 帶標籤的唯讀 tuple、字面值型別的 `RETRY_BLOCK`／`PING_COMMENT`、遞迴的 `JsonValue` 都合法；
  - `Event` 只在模組範圍內，不會和全域的 `Event` 合併。
- 順便修了一個衝突：§9.2 指定的 ESLint `stylisticTypeChecked` 預設 `array-type` 規則會擋 `ReadonlyArray<T>`，和我在 §9.4 寫的偏好相反。所以 d.ts、§0.3、§9.4 都統一改成 `readonly T[]`，型別意義完全相同。
- 刻意保留的一處：`JsonValue` 的物件部分仍用索引簽章，沒有改成 `Readonly<Record<...>>`。據我所知 TypeScript 會把在遞迴型別別名裡用 `Record` 判定為循環參照，但這點同樣沒有用 tsc 驗證過。這個檔在 `contracts/`，不在 `worker/` 的 lint 範圍內，所以不受影響。
