T7.4: 19 must-fix, 5 should-fix, 1 nit

已逐節審閱 [docs/ai-agents.html](/Users/oliver/.local/share/sse-orchestra/docs-agent-ws/docs/ai-agents.html)。12 節與 6 張必備圖均有出現。圖 1 缺少 worker 回報與證據的產出路徑，圖 5 的重試上限畫錯。原始 HTML 未修改，所有新增檔案都在 `.t7-evidence/T7.4/`。

## 發現

1. **MUST｜整體架構，圖 1，第 774、783–815 行。** `.orchestra/briefs/` 直接指向 `.orchestra/reports/`，五類 worker 都沒有回報箭頭。`evidence/` 也只有指向協調者的線，`contracts/{openapi,pyi}` 則寫錯檔名。請畫成協調者 → briefs → worker → reports，另從 E2E worker 接到主 repo 的 evidence，再標出實際檔名 `contracts/openapi.yaml` 與 `contracts/domain.pyi`。`materials/ORCHESTRATION.md:24–36,109–119,125–138`

2. **MUST｜六張圖，第 495–505 行。** 例如圖 1 的「`主 Repo`」下方路徑宣告 `font-size="11.5"`，縮放後約 10.4 px。1280 px 下，圖 1 至圖 6 的最小實際字級依序約為 **10.0、10.4、10.4、10.0、10.7、10.7 px**。請依共享格式的 12 px 下限重排各圖，再以瀏覽器量測縮放後的字級。`.t7-evidence/T7.4/layout-check.json`

3. **MUST｜整體架構、角色與隔離，第 732、976–979、1073 行。** 「五個物理隔離的工作區」、「Codex 看不到 `app/`」、「實作者從頭到尾沒看過 `test_domain.py`」與「仍能完整掌控邊界」超出證據。資料只證明分開目錄、禁止跨區讀取，以及該次稽核未發現外部路徑。請改用「工作區未放入對方原始碼」「規則禁止讀取」「紀錄掃描與快照比對未發現越界」等可查證描述，並將「幾乎都會被順手糊弄過去」「從源頭杜絕」改為設計目的。`materials/ORCHESTRATION.md:42–55`、`materials/PROGRESS.md:95–96`

4. **MUST｜任務生命週期，第 1177–1199 行。** 「實際呼叫 Worker 的指令（摘自……）」省略實作者的 `--append-system-prompt`、規格編輯與瀏覽器命令的 `--verbose`，也漏列 agy 審閱的 `--mode plan`。agy 驗證範例則使用 T2.5 的實際 `--sandbox`，與規則檔第 119 行的 `--dangerously-skip-permissions` 不同。請保留影響執行或稽核的旗標，並標明規則範例與 T2.5 的實際啟動方式。`materials/ORCHESTRATION.md:109–119`、`materials/PROGRESS.md:86,195`

5. **MUST｜任務生命週期，圖 3，第 1081、1106–1108 行。** 「每一個 worker 任務」都「統一用」30 分鐘逾時的說法過度確定。D6 記錄的是 30 分鐘政策，T4.4 brief 寫 40 分鐘，T4.1–T4.3 與 T6.4 brief 寫 45 分鐘。這些 brief 也無法證實外層實際設了多少秒。請將 `alarm 1800` 標為政策範例，註明任務說明有不同時限。`materials/ORCHESTRATION.md:103–109`、`materials/briefs/p4-claude-browser.md:18`、`materials/briefs/p4-agy-e2e.md:20`、`materials/briefs/p6-claude-browser.md:27`

6. **MUST｜任務生命週期，圖 3，第 1125–1171 行。** 圖中雖寫「不通過則作廢＋留 log」，箭頭仍一路通往清理與提交。「每個任務／Phase」也暗示每項任務都各自提交。請把稽核失敗接到保留紀錄與登記，把缺證據接到補跑，清理與提交只接在通過路徑。規則要求各 Phase 結束提交，實際也有 T2.1a 與 T2.1b 合在同一筆 commit 的例子。`materials/ORCHESTRATION.md:121,140–152`、`materials/git-log.txt:31`

7. **MUST｜Phase 流程，圖 4，第 1298、1311 行。** 「後續 Phase 6 補 E7」把規則成立的時間放錯，也容易讓讀者誤以為 Phase 6 補出了 Phase 4 的證據。Phase 5 在 20:20 交付，E7 於 20:40 成立，Phase 6 於 20:50 開始。請把 E7 標在 Phase 5 與 6 之間，並註明 Phase 4 當時只剩文字回報。`materials/PROGRESS.md:213–215`、`materials/git-log.txt:3–4`

8. **MUST｜Phase 流程，圖 4 與並行清單，第 1315、1334–1336 行。** 「三度並行」把 T6.1 與 T6.2 的同步啟動寫成已證實。日誌記載共同備妥 brief 與各自完成時間，沒有明記這組同時啟動。後兩組有明文。另，T2.1b 在 T2.2 回報前已完成，也應標在 Phase 2 的重疊區間。請標出有紀錄的同步啟動和可確認的執行重疊。`materials/PROGRESS.md:186–189,215–220`

9. **MUST｜失敗分派，圖 5，第 1346、1366–1416 行。** 「`≤ 3 輪：重組並重驗`」配「`> 3 輪`」會在第三輪仍失敗時再繞一圈，而且圖中沒有驗證通過的出口。「由 agy 或瀏覽器 E2E 提出分類」也漏掉協調者可判定規格歧義。請畫出「重驗通過 → 結案」「未通過且已用完 3 輪 → 使用者」「未通過且仍有輪次 → 再派工」，並在歧義分支標明 agy 或協調者可判定。`materials/ORCHESTRATION.md:69–77`、`materials/PROGRESS.md:101–102,114–119,207`

10. **MUST｜E2E 證據，第 1578 行。** 「49 張 PNG＋1 支 44 幀 GIF＋`INDEX.md` 共 52 檔」加總為 51。實際索引列出 **50 個 PNG 檔名、1 個 GIF、1 個 `INDEX.md`**，其中有複製供不同檢查引用的圖片。請採用索引的 50 個 PNG 檔案數，或只列可共同核對的總數 52，並註明回報正文的 49 與索引不一致。`materials/evidence-index/T6.4-INDEX.md:4–57`、`materials/reports/p6-claude-browser.md:5,82`

11. **MUST｜E2E 證據，第 1541、1559、1580 行。** 「在 Phase 6 全面落實」掩蓋了補驗與通用規則的差異。T6.4 brief 允許 GIF 至少覆蓋 V2、R2、R5，T6.4b brief 要求截圖與索引，交付共 6 張，沒有 GIF。E7 明定核對的是截圖時間，HTTP 輸出另須在檔首寫指令與開始時間。請分別寫出通用規則、T6.4 的 GIF 範圍與 T6.4b 的截圖要求。`materials/ORCHESTRATION.md:129–145`、`materials/briefs/p6-claude-browser.md:29–36`、`materials/briefs/p6-claude-browser-recheck.md:23–34`、`materials/reports/p6-claude-browser-recheck.md:25`

12. **MUST｜實際數據，第 1618 行。** 「23 意見」符合進度表，但所附 Codex 回報只有 22 筆 `[SEVERITY: …]` 條目，第 23 行是 `VERDICT`。請標明「進度表記 23 條，所附回報可數 22 條」，或只列雙方一致的 `needs-changes`。`materials/PROGRESS.md:66`、`materials/reports/p1-codex-spec-review.md:1–23`

13. **MUST｜實際數據，第 1737、1769、1854–1857 行。** 首輪 T3、T4.1–T4.3、T6.3 重跑都填了 `gemini-4-neon-high`。這些執行的進度與回報未列實際模型，政策預設不足以證實選型。`T6.3r2` 也未見於管理紀錄，來源稱「T6.3 重跑」，證據目錄為 `T6.3b`。請保留 agy，模型標為未記錄，並使用來源中的任務稱呼。`materials/PROGRESS.md:91–99,103,110–111,219–220`、`materials/reports/p6-agy-regression-r2.md:1–3`

14. **MUST｜實際數據，第 1651、1659、1720、1819 行。** 「34 輪」「25 輪」「86 輪」在同篇文章會被理解為修正輪次，T6.1 原文明寫 `86 turns`。另，「首次全專案關卡」忽略 T2.6 早已跑過全專案 Ruff 並發現失敗。請將表欄寫成「耗時／worker 對話回合／費用」，T2.8 寫成「首次驗證 E3，專案 Ruff、mypy 與 stubtest 通過」。`materials/PROGRESS.md:80–81,87–89,108`、`materials/reports/p2-impl-contract-fix.md:76–82`、`materials/reports/p2-impl-v112.md:8–29`

15. **MUST｜使用者決策，第 1906 行。** 「既有元素 id、屬性、文字與 R27 行為全數不動」把所有屬性都納入保留範圍，實際上改版與 fix1 都改了 `class`。請寫成保留既有元素、ID、可見文字、R27 行為及規格或腳本依賴的屬性。`materials/PROGRESS.md:144,219`、`materials/briefs/p6-agy-regression.md:40–47`、`materials/reports/p6-impl-fix1.md:8–16`

16. **MUST｜經驗與教訓，第 1938 行。** 「改以建置前備份搭配 `cmp`／`shasum`／`git diff --no-index`」把兩次驗證的方法合寫成首輪操作。首輪記載備份、`cmp` 與 `shasum`，重跑才明記 `git diff --no-index --exit-code`。請分兩句說明，並把 `git diff` 的比較基準寫成索引在當次仍對應改版前版本。`materials/reports/p6-agy-regression.md:99–101`、`materials/reports/p6-agy-regression-r2.md:114–116`

17. **MUST｜經驗與教訓，第 1954 行。** 「開著 Dark Reader，逼得瀏覽器 E2E……遞迴覆寫」把不同任務的觀察串成一件事。T6.1 暫停 Dark Reader 的頁內樣式，T6.4 因視窗限制用 375 px iframe，T6.4b 才記載因 Tailwind 把深色規則放在 `@layer` 中而遞迴覆寫。同段「真 TCP 無法觸發 R23」也應限於這次 macOS loopback 單輪測試。請分別交代任務、限制與觀測結果。`materials/reports/p6-impl-preline.md:77–80`、`materials/reports/p6-claude-browser.md:7–12`、`materials/reports/p6-claude-browser-recheck.md:15`、`materials/reports/p4-agy-e2e.md:279–292`

18. **MUST｜頁首與 Phase 7，圖 6，第 661、1963–1968 行。** 「Phase 7 雙作者交叉成稿」「皆以 headless Chrome……截圖」與「各自……完成修訂」把委託流程表述為已完成。T7.2／T7.4 brief 證實分工與順序，目前工作區只有 `docs/ai-agents.html`，相對連結的目標 `docs/technical.html` 尚未出現。請在定稿前將文字和圖 6 標為流程，合併時再確認兩個檔案、雙向連結及證據。`materials/PROGRESS.md:220`、`docs/ai-agents.html:642–644`

19. **MUST｜共享格式，全文。** 「`PASS`」狀態目前直接放在 `<span>`，模型表的 `Sonnet 5.5`、`GPT-6.2 Sol` 及教訓中的 `log.ts` 等識別字也有裸排。請依共享格式，在 HTML 正文與表格中用 `<code>` 標記技術識別字、檔名及字面狀態，保留自然語言的中文判定。`docs/ai-agents.html:1427,1466,1472,1650,1754`

20. **SHOULD｜整體架構，圖 1，第 775–801、807–815、899–902 行。** 兩種主題都可看到派工垂直線穿過「隔離工作區層」標題，回報斜線穿過「稽核＋讀回報」。右側 `PROGRESS.md、ORCHESTRATION.md` 和底部「同步原則」也跨出各自框線。請替箭頭留獨立通道，並將兩段長標籤拆行後再檢視。`.t7-evidence/T7.4/figure-1-light.png`、`.t7-evidence/T7.4/figure-1-dark.png`

21. **SHOULD｜隔離與稽核，圖 2，第 1018–1048 行。** `grep tests-ws|verify-ws|/tests/` 看起來能直接執行，未加引號的 `|` 會被 shell 當管線。工具權限一欄也少了瀏覽器 worker 的限制。請改用「搜尋 `tests-ws`、`verify-ws`、`/tests/`」或 `grep -nE 'tests-ws|verify-ws|/tests/' <log>`，並補上瀏覽器專用新分頁與 localhost 範圍。`materials/ORCHESTRATION.md:46–55,115`、`materials/briefs/p4-claude-browser.md:5–16`

22. **SHOULD｜角色與權限，第 723–724、863–866、929–967 行。** 「協調者的鐵律」宜補上歷史例外，否則讀者很難理解協調者早期親自起草、使用者指示下由協調者完成 T0.7，以及指定 agy session 直接重寫 v1.0。重用工作區時，圖 1 的 `tests-ws` 也應交代正式測試任務另取得 `AGENTS.md`、`pyproject.toml` 等支援檔。`materials/PROGRESS.md:73–79,150–162,185–186`、`materials/plans/spec_v1_plan.md:3–7,15–21`

23. **SHOULD｜失敗案例，第 1427、1439 行。** 「R14／R15／R19／R26 涵蓋缺口」少交代 R25 為何未派出可確定重現的測試。「上下留白皆為 17/17 px」宜限定為無錯誤框時，另寫有錯誤框時量得 `17 / 12 / 17 px`。這兩個補充能解釋團隊如何處理測不到的分支與不同量測條件。`materials/PROGRESS.md:91,96`、`materials/reports/p6-claude-browser-recheck.md:5–16`

24. **SHOULD｜實際數據與決策，第 1680、1876–1906 行。** T2.3b 的「D1–D4」指 SPEC v1.1.1 的四項修訂，緊接的決策表又用 D1–D4 指規格核准、權限、隔離與合約。請標明兩套 ID 的來源，並依 brief 將合併的 `E1–E3` 拆成一項一行。`docs/SPEC.md:263–270`、`materials/PROGRESS.md:125–138,192`

25. **NIT｜頁首，第 647、655、659 行。** `Multi-Agent Engineering Playbook` 是額外英文標語，日期也出現兩次。可移除標語並保留一處 `2026-11-21`，讓手機首屏更快進入標題與目錄。來源為共享格式的頁首及語言要求。`.t7-evidence/T7.4/mobile-top-light.png`

## 已核實

- **概觀與模型政策。** 使用者直接對話的 Claude Code session 擔任協調者。Claude 實作、Codex 獨立撰寫測試、agy 驗證的分工成立。§8 的三家模型下限、禁用名單、七組任務預設與 `medium` 底線均符合規則檔。`materials/CLAUDE.md:3–10`、`materials/ORCHESTRATION.md:7–14,79–101`
- **關卡、案例與數字。** T2.5r 為 0 偏差，T3 首輪 71/73、第二輪 75/75 ×3 且 7 項突變全數抓到，Phase 4 先完成 agy 效能檢查才啟動瀏覽器，T5.1 為 `ACCEPT`，Phase 6 fix1 後兩路重驗通過。所列六筆有紀錄的費用合計 **$13.13**。`materials/PROGRESS.md:80–81,90–111,204–211,218–220`
- **版本與離線格式。** SPEC v1.1.4、合約與 OpenAPI `info.version` 1.1.2 相符。外部資源 `grep` 命中 59 行，為 6 行 SVG `xmlns` 與 53 行同頁 `url(#…)` 箭頭標記。`grep -n '/Users/'` 空輸出，亦未發現人名、帳號或電子郵件。`docs/SPEC.md:1,243`、`app/main.py:31`
- **版面。** 390 px 下兩種主題的頁寬與捲動寬均為 390 px，寬表格與 SVG 在容器內捲動。深色 tokens 確實套用，六張 SVG 均有 `viewBox`、`width="100%"`、圖說及無障礙名稱。相對連結標記已存在，目標檔案待合併。`.t7-evidence/T7.4/layout-check.json`、`docs/ai-agents.html:8–53,642–644`

## 截圖與檢查輸出

桌面版 Chrome 在沙盒內以狀態 `134` 中止。我改用本機 Chromium Headless Shell 的單程序模式，取得並檢視兩種寬度、兩種主題及六張圖的裁切。檔名與內容見 [INDEX.md](/Users/oliver/.local/share/sse-orchestra/docs-agent-ws/.t7-evidence/T7.4/INDEX.md)。

- 全頁 `review-1280-light.png`、`review-1280-dark.png`、`review-390-light.png`、`review-390-dark.png`
- 手機頁首 `mobile-top-light.png`、`mobile-top-dark.png`
- 各圖裁切 `figure-1-light.png` 至 `figure-6-light.png`，以及 `figure-1-dark.png` 至 `figure-6-dark.png`

`uv sync`、`uv run ruff format --check .`、`uv run ruff check .`、`uv run mypy` 均在證據目錄內的暫存副本執行，四項皆退出 `101`，共同輸出為 `Attempted to create a NULL object.` 與 `Tokio executor failed, was there a panic?: Any { .. }`。離線重試 `uv sync` 退出 `2`，輸出 `No interpreter found for Python 3.13 in managed installations or search path`。工作區沒有 `tests/`，因此未執行 `uv run pytest`。