# T8.2b：把協調者對 CF-CONFLICT／CF-GAP 的決定寫進文件

依下列決定修改 docs/SPEC-cloudflare.md、contracts/domain.d.ts、AGENTS.md（仍只准改這三個檔；SPEC.md、openapi.yaml、domain.pyi 不可改）。把「待決定」裡對應的項目改成「已決定」並寫出新條文，版本改為 cf1.1，版本紀錄加一列。

- CF-CONFLICT-1：`/stats` 也轉給 DO。R1／架構表的路由與 `run_worker_first` 清單都要列入 `/stats`。
- CF-GAP-1：選 (a)。超過 2^53−1 的整數一律不合法：`parseEventId` 回 `null`（query → 422，header → 視同沒帶）；R15 的參數 → 422。把和 Python 版的差異寫成已知差異。`domain.d.ts` 維持 `number`。
- CF-GAP-2：實作者必須讓「乾淨 checkout 執行 `cd worker && npm ci && npx wrangler dev --port 8787`」直接可用，啟動指令不改。若 npm 預設不執行 workerd／esbuild 的 postinstall，解法是在 `worker/package.json` 的根層 scripts 加 `postinstall`，執行 `npm rebuild esbuild workerd`。R1 與 AGENTS §9 寫明這點，並把「乾淨 checkout 下 `npm ci` 後 `npx wrangler dev` 能起來」列為 AC12 的檢查項。
- CF-GAP-3：選 (c)。`wrangler dev` 的關機時間只量測並寫進回報，不當通過條件；AC9 必要項只留「SIGKILL 後以同一個 `--persist-to` 重啟，R25 收尾出現 `E_INTERRUPTED`」。R24 的 3 秒關機時限改成「不適用於 Cloudflare 版，改為觀察項」。
- CF-GAP-4：選 (a)。允許 `@types/node`（devDependency、精確版本釘選），以 `tsconfig.test.json` 檢查 `tests/`；把它加進 AGENTS §9 的允許依賴清單，並在 `package.json` 的 `typecheck` 說明兩個 tsconfig 都要通過。
- CF-GAP-5：選 (a)。實作者在做正式實作之前，先寫一個小 spike 驗證「`Response` body 的 `ReadableStream`、`highWaterMark: 1`、`pull`／`desiredSize` 在 workerd 的實際行為」，把結果寫進實作回報。若不符合預期才改用 (b)（`desiredSize ≤ 0` 即溢位）。在 SPEC-cloudflare 寫明：無論實作用哪一種，R23 的外部可觀察行為（佇列滿時結束該連線並更新 `/stats`、其他訂閱者不受影響、可用 `Last-Event-ID` 補齊）與 `SubscriberQueue` 單元合約不變。

另外請：
1. 檢查 `domain.d.ts` 裡是否有任何在 TypeScript 無法成立或自相矛盾的宣告（你不能執行 tsc，用閱讀檢查：`readonly`、字面值 union、`declare` 的用法、例外類別的 `extends Error`）。
2. 最終回覆簡短列出：改了哪些條文、仍然未決定的項目（應該是 0 個）。
