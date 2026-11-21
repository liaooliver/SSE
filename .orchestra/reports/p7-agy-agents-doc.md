已完成 [docs/ai-agents.html](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/docs/ai-agents.html)（單一可離線開啟的 HTML 文件，無外部資源、支援淺色／深色模式與 390 px 窄螢幕閱讀），並於 [.t7-evidence/T7.2/INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/.t7-evidence/T7.2/INDEX.md) 留存 headless Chrome 截圖證據。未修改任何其他既有檔案（`git status --short` 僅顯示 `?? .t7-evidence/` 與 `?? docs/ai-agents.html`）。

---

### 1. 章節清單與內嵌 SVG 圖表（12 節、6 張圖）

| 章節 | 標題 | 內嵌 SVG 圖表 |
|---|---|---|
| §1 | 概觀：一位使用者、一位協調者，指揮三家模型 | —（2×2 角色總覽卡片＋協調者鐵律） |
| §2 | 整體架構圖 | **圖 1**：多 AI Agent 協作整體架構（主架構圖） |
| §3 | 角色與權限分工 | —（6 角色權限表＋雙盲分工原因說明） |
| §4 | 隔離與事後稽核機制 | **圖 2**：三層隔離與事後稽核補償機制 |
| §5 | 一個任務的生命週期 | **圖 3**：單一任務完整生命週期（＋真實 worker 呼叫指令） |
| §6 | Phase 0–6 流程與關卡 | **圖 4**：Phase 0–6 流程、並行步驟與關卡設計 |
| §7 | 失敗怎麼分派與真實案例 | **圖 5**：失敗判定與分派流程（上限 3 輪＋3 個真實案例） |
| §8 | 模型政策與推理強度（D5） | —（下限／禁用表＋任務預設模型表） |
| §9 | E2E 證據規則（E7） | —（瀏覽器／agy 證據規範表＋協調者稽核步驟） |
| §10 | 實際數據與使用者決策紀錄 | —（33 筆任務紀錄表＋D1–D12 / E1–E10 決策表） |
| §11 | 實戰經驗與教訓 | —（9 條具體教訓，皆附原始紀錄出處） |
| §12 | 這兩份文件是怎麼產生的（Phase 7） | **圖 6**：Phase 7 雙作者並行撰寫、交叉審閱與整合流程 |

---

### 2. 各圖表與數據表之資料來源

- **圖 1（整體架構圖）**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md)（角色、工作區、合約、`.orchestra/` 交換目錄）、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md)（`browser-ws`、同步規則與 Phase 5 合併 `tests/`）
- **圖 2（隔離與事後稽核）**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L42-L55)、[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L147-L153)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L86-L95)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L187-L195)
- **圖 3（任務生命週期）與呼叫指令**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L103-L153)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L86-L88)
- **圖 4（Phase 0–6 流程圖）**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L57-L68)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L44-L57)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L165-L220)
- **圖 5（失敗分派流程圖）與 3 個案例**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L69-L77)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L95-L119)、[materials/reports/p3-agy-verify.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p3-agy-verify.md)、[materials/reports/p4-claude-browser-b.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p4-claude-browser-b.md)、[materials/reports/p6-claude-browser.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p6-claude-browser.md)、[materials/reports/p6-impl-fix1.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p6-impl-fix1.md)、[materials/reports/p6-claude-browser-recheck.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p6-claude-browser-recheck.md)
- **圖 6（Phase 7 流程圖）**：依本任務 brief（T7.2）對 Phase 7 的定義繪製
- **角色與權限表（§3）**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L7-L14)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L8-L19)
- **模型政策雙表（§8）**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L79-L101)
- **E2E 證據規則表（§9）**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L123-L146)、[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L108-L111)、[materials/evidence-index/T6.3-INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/evidence-index/T6.3-INDEX.md)、[materials/evidence-index/T6.4-INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/evidence-index/T6.4-INDEX.md)
- **實際數據表與決策表（§10）**：[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L60-L145) 及對應之 `materials/reports/*.md`（`p2-impl-backend.md`、`p2-impl-frontend.md`、`p2-codex-tests.md`、`p2-codex-align.md`、`p2-agy-contract.md`、`p2-agy-contract-r2.md`、`p3-agy-verify.md`、`p3-agy-run-2.md`、`p4-agy-e2e.md`、`p4-claude-browser.md`、`p4-claude-browser-b.md`、`p5-agy-acceptance.md`、`p6-impl-preline.md`、`p6-agy-regression.md`、`p6-agy-regression-r2.md`、`p6-claude-browser.md`、`p6-impl-fix1.md`、`p6-claude-browser-recheck.md`）
- **經驗與教訓（§11）**：[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md)、[materials/git-log.txt](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/git-log.txt)、[materials/reports/p2-codex-tests.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p2-codex-tests.md)、[materials/reports/p4-agy-e2e.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p4-agy-e2e.md)、[materials/reports/p6-agy-regression.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p6-agy-regression.md)、[materials/reports/p6-claude-browser.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p6-claude-browser.md)、[materials/reports/p6-claude-browser-recheck.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/reports/p6-claude-browser-recheck.md)

---

### 3. `grep` 檢查結果

1. **`grep -nE 'https?://|<link|src=|@import|url\(' docs/ai-agents.html`**（共 60 行命中，**0 外部資源**）：
   - **6 處 SVG `xmlns`**（L737、L992、L1086、L1211、L1351、L1973）：皆為內嵌 `<svg xmlns="http://www.w3.org/2000/svg">`，為標準 XML 命名空間宣告，不發送任何網路請求。
   - **54 處內部 SVG 箭頭參照**（`marker-start="url(#m*)"`／`marker-end="url(#m*)"`）：皆為指向同一 SVG `<defs>` 內箭頭記號（`#m1-arrow`～`#m6-arrow-ok`）的頁內 fragment 參照，非外部 URL。
   - `<link`、`src=`、`@import`、外部 `https://`／`http://` 資源：**皆為 0 處**。
2. **`grep -n '/Users/' docs/ai-agents.html`**：空輸出（**0 命中**）。另額外檢查個人帳號／信箱關鍵字亦為 **0 命中**。

---

### 4. 截圖檔名與檢查結果（存放於 `.t7-evidence/T7.2/`）

所有截圖均已以 headless Google Chrome 158 擷取並逐張目視檢查（期間修正了圖 1 箭頭壓到交換區標題、圖 2 右欄文字貼邊、§1 卡片 3+1 不平衡改為 2×2，以及 §10 精簡表 ID／日期欄換行斷字問題），索引見 [.t7-evidence/T7.2/INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/.t7-evidence/T7.2/INDEX.md)：

- `agents-1280-light-1-overview-arch.png`（1280 px 淺色：頂部列、標題、目錄、§1、§2 圖 1、§3）
- `agents-1280-light-2-iso-lifecycle-phase.png`（1280 px 淺色：§4 圖 2、§5 圖 3、§6 圖 4）
- `agents-1280-light-3-failure-models-e7.png`（1280 px 淺色：§7 圖 5 與案例、§8、§9）
- `agents-1280-light-3b-data-tables.png`（1280 px 淺色：§10 任務數據表與 D*/E* 決策表）
- `agents-1280-light-4-data-lessons-p7.png`（1280 px 淺色：§11 教訓、§12 圖 6、頁尾）
- `agents-1280-dark-1-overview-arch.png`（1280 px 深色：頂部列、目錄、§1、§2 圖 1）
- `agents-1280-dark-2-lessons-p7.png`（1280 px 深色：§11、§12 圖 6、頁尾）
- `agents-390-light-top.png`（390 px 淺色：透過 390 px 同源 `srcdoc` iframe 實測，確認 `scrollWidth === 390` 無水平捲動）
- `agents-390-light-p7.png`（390 px 淺色：§12、圖 6 容器內橫向捲動、頁尾）

---

### 5. `materials/` 中發現的矛盾或不清楚之處

1. **Phase 4 狀態欄未同步更新**：[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L54) 的 Phase 總覽表仍把 Phase 4 標為 `🔵 進行中`，但同檔 [L39](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L39) 寫「全部完成 ✅」、[L209](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L209) 已記「Phase 4 結束」，且 Phase 5、6 皆已完成。
2. **工作區清單兩檔不一致且漏列 `browser-ws`**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L22-L28) 列出 5 個工作區（漏了 `browser-ws`）；[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L158-L163) 僅列 4 個工作區（漏了 `spec-ws` 與 `browser-ws`），但實務派工與日誌均有使用 `spec-ws` 與 `browser-ws`。
3. **agy 旗標與逾時上限在規則檔與實戰間有落差**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L50) 寫 `--sandbox`、同檔 [L119](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L119) 卻寫 `--dangerously-skip-permissions`，而 [materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L86) 與 [L195](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L195) 記載因帳號不支援 `--mode auto`，實際以「預設模式＋`--sandbox`」執行。此外，D6 訂執行上限為 30 分鐘（`alarm 1800`），但 [materials/briefs/p6-agy-regression.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/briefs/p6-agy-regression.md#L25) 寫 `Time limit: 45 minutes`。
4. **Claude 實作者權限實務上曾收窄**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L47)（D2）寫實作者完全不設限，但 T2.6 與 T3.5 實際改用 `acceptEdits`＋`Bash(uv:*)`（[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L87) 與 [L95](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L95)）。
5. **T6.4 耗時紀錄自相矛盾**：[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L111) 記為 `12 分、$1.73`，與 [materials/evidence-index/T6.4-INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/evidence-index/T6.4-INDEX.md#L3) 括號內的 `21:09–21:21` 相符（12 分鐘），但該行文字同時寫了 `Whole session ≈ 20 min`（本文件 §10 採用 `PROGRESS.md` 的 12 分鐘）。
6. **`README.md` 與 `ORCHESTRATION.md` Phase 表未追上最新版本**：[README.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/README.md#L3) 仍標示 `docs/SPEC.md (v1.0)`（實際已至 v1.1.4）；[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L59-L67) 的流程表未補入 Phase 0.5、0.6 與 Phase 6。
7. **T6.4b 證據未錄 GIF 且部分檢查為單張截圖**：[materials/ORCHESTRATION.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/ORCHESTRATION.md#L130-L132)（E7）要求每項至少 2 張截圖並錄製 GIF，但複驗任務 `T6.4b` 的 [materials/evidence-index/T6.4b-INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/evidence-index/T6.4b-INDEX.md) 僅存 6 張 PNG（多數項目各 1 張）且未錄 GIF。
8. **工作日誌時間序有一處倒置**：[materials/PROGRESS.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/materials/PROGRESS.md#L179-L180) 依序記載 `22:55` 後接 `22:48`（反映獨立 agy session 與協調者並行時補登）。
