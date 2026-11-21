T7.6: 25 fixed, 0 rejected, 0 skipped

已完成 [docs/ai-agents.html](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/docs/ai-agents.html) 的交叉審閱整合與版面重繪，僅修改 `docs/ai-agents.html` 並將新截圖與量測紀錄存於 [.t7-evidence/T7.6/](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/.t7-evidence/T7.6/INDEX.md)，未更動 [docs/technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/docs/technical.html) 或 [REVIEW.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/REVIEW.md)。

---

### 1. 審閱發現處理對照表（25 項全數經來源查證後修正）

| 編號 | 級別 | 處理狀態 | 實際修改內容 |
|---|---|---|---|
| 1 | MUST | 已修正 | 重繪圖 1：移除 `.orchestra/briefs/` 直連 `.orchestra/reports/` 的箭頭，改畫「協調者 → `briefs/` → 5 類 worker → `reports/` → 協調者」，並自 `verify-ws/` 與 `browser-ws/` 另接虛線匯流排至主 repo 的 `evidence/<任務>/`；將合約檔名更正為 `contracts/openapi.yaml` 與 `contracts/domain.pyi`。 |
| 2 | MUST | 已修正 | 重排六張 SVG 的 `viewBox`（圖 1 為 `880×780`，圖 2–6 為 `840×…`）並提高字級至 ≥ `13`–`13.5`。1280 px 寬下以無頭 Chrome 實測各圖最小渲染字級：**圖 1 `13.00 px`、圖 2 `13.11 px`、圖 3 `13.11 px`、圖 4 `13.11 px`、圖 5 `13.11 px`、圖 6 `13.11 px`**（均 ≥ `12 px`，見 [layout-check.json](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/.t7-evidence/T7.6/layout-check.json)）。 |
| 3 | MUST | 已修正 | 將 §1、§2、§3、§4 超出證據的表述改為可查證用語（如「分開的工作區目錄」「未放入 `app/`／`tests/`」「規則禁止跨區讀取」「該次紀錄掃描與快照比對未發現越界存取或修改」），並將「幾乎都會被順手糊弄過去」「從源頭杜絕」改寫為設計目的。 |
| 4 | MUST | 已修正 | §5 呼叫指令補齊實作者的 `--append-system-prompt`、規格編輯與瀏覽器 E2E 的 `--verbose`，補列 `agy` 審閱的 `--mode plan`，並將 `ORCHESTRATION.md:119` 的 `--dangerously-skip-permissions` 規則範例與 `T2.5` 實戰的預設模式＋`--sandbox` 分開標明。 |
| 5 | MUST | 已修正 | §5 正文與圖 3 將 `perl -e 'alarm 1800;…'` 標為 `D6` 預設 30 分鐘政策範例，註明各任務 brief 另有 20／40／45 分鐘時限且管理紀錄未逐次記載外層實際 `alarm` 秒數。 |
| 6 | MUST | 已修正 | 重繪圖 3：從步驟 5（事後稽核）分出「不通過 → 作廢、還原越界改動、保留 log、登記 `PROGRESS.md`」，從步驟 6（查驗 E2E 證據）分出「缺證據 → 視為沒做、補跑」，使清理與提交只接在通過路徑；步驟 9 註明規則為各 Phase 結束提交，實戰亦有 `T2.1a`＋`T2.1b` 合併於同一筆 commit 的例子。 |
| 7 | MUST | 已修正 | 重繪圖 4：關卡 4 改註「當時未立 E7，僅留文字回報」，並於 Phase 5（20:20 交付）與 Phase 6（20:50 開始）之間新增獨立里程碑節點「`20:40 立 E7` → `20:50 決策 E8–E10`」。 |
| 8 | MUST | 已修正 | 圖 4 與 §6 整理清單區分「明文記載同步啟動」（`T1.2 ‖ T1.3`、`T2.1a ‖ T2.2`、`T3.5 ‖ T3.6`、`T6.3 ‖ T6.4`、`T6.3 重跑 ‖ T6.4b`）與「可確認執行重疊／交錯」（補上 `T2.1b` 在 `T2.2` 回報前完成；`T6.1` 與 `T6.2` 僅記同於 20:50 備妥 brief 並於 20:51／21:10 先後完成，不宣稱「三度並行」）。 |
| 9 | MUST | 已修正 | 重繪圖 5 與修訂 §7：於入口與歧義分支標明規格模糊可由 `agy` 或協調者判定；重驗節點分出三個正確出口——「重驗通過 → 結案通過」、「未通過且仍有輪次（已用 `< 3` 輪）→ 再派工（實作第 2 輪起 `xhigh`）」、「未過且滿 3 輪 → 停止自動重試、交由使用者直接裁決」，消除第 3 輪失敗多繞一圈的邊界錯誤。 |
| 10 | MUST | 已修正 | §9 更正 `T6.4` 證據說明：採 `T6.4-INDEX.md` 的 **50 個 PNG 檔名**（註明 `R1-*`／`R2-*` 複製自對應 `V` 截圖）＋1 支 44 幀 GIF＋`INDEX.md` 共 52 檔，並明註回報正文第 5 行誤寫為 49 張 PNG 與索引不一致。 |
| 11 | MUST | 已修正 | §9 分開說明 `E7` 通用規則、`T6.4` 的 GIF 最低範圍（`V2`、`R2`、`R5`）與 `T6.4b` 僅要求量測、截圖與 `INDEX.md`（無 GIF、交付 6 張 PNG）；時間戳查驗改明載 `E7` 核對截圖時間、HTTP 輸出另須於檔首記錄指令與開始時間。 |
| 12 | MUST | 已修正 | §10 `T1.2` 列改為「`needs-changes`（進度表記 23 條，所附回報可數 22 條）」。 |
| 13 | MUST | 已修正 | §10 將未於進度或回報記載模型的 `T3`（`T3.1`–`T3.3`）、`T4.1`–`T4.3`、`T6.3 重跑`（以及 `T1.2`、`T1.3`、`T1.8`、`T4.4`）全數標為「模型未記錄」；全文（含圖 4 與 §10）移除未見於來源的 `T6.3r2`，改用來源稱呼 `T6.3 重跑` 並標註證據 `T6.3b`。 |
| 14 | MUST | 已修正 | §10 表欄改為「紀錄耗時／worker 對話回合／費用」，將 `T2.1a`、`T2.1b`、`T6.1` 改寫為「34 回合」「25 回合」「86 回合（`turns`）」以避免與修正輪次混淆；`T2.8` 改為「對齊 v1.1.2；首次驗證 `E3`，專案 Ruff、mypy 與 `stubtest` 通過」。 |
| 15 | MUST | 已修正 | §10 `E10` 決策改寫為「保留既有元素、`id`、可見文字、R27 行為，以及規格或腳本依賴的屬性（外觀 `class` 改由 Preline／Tailwind 取代）」。 |
| 16 | MUST | 已修正 | §11 教訓 5 改明寫 `verify-ws` 的 git 索引（與 `HEAD`）在當次仍對應改版前基準 commit，並分兩句區分首輪 `T6.3`（備份＋`cmp`／`shasum`）與 `T6.3 重跑`（備份＋`git diff --no-index --exit-code`／`shasum -a 256`）。 |
| 17 | MUST | 已修正 | §11 教訓 9 將 R23 觀察限定於 `T4.2` 這次 macOS loopback 單輪測試，並分開交代 `T6.1`（暫停該頁 Dark Reader 樣式、CSSOM 淺色模擬、375 px 同源 iframe）、`T6.4`（375 px iframe 與頁內 CSSOM 覆寫）與 `T6.4b`（發現 Tailwind 深色規則置於 `@layer` 內而改採遞迴覆寫）。 |
| 18 | MUST | 已修正 | 依更新後的 `materials/PROGRESS.md` 與 `materials/reports/p7-*` 更新頁首、§1、§10 數據表（補入 `T7.1`–`T7.7` 實際模型與紀錄）與決策表（補入 `E11`），並在 §12 與圖 6 準確呈現：`T7.1`–`T7.4` 已完成（附實際審閱統計與模型）、本檔為 `T7.6` 整合產出（不臆測 `T7.5` 統計）、僅剩 `T7.7` 待協調者合併提交。同時全面校對 `materials/PROGRESS.md` 行號引用。 |
| 19 | MUST | 已修正 | 全文正文、表格、徽章與圖說將技術識別字、檔名、CLI 旗標、模型名（`Sonnet 5.5`、`GPT-6.2 Sol`、`Gemini 4 Hydrogen`、`Haiku` 等）與英文字面狀態（`PASS`、`FAIL`、`ACCEPT`、`needs-changes`、`CONFLICT`、`GAP`、`log.ts` 等）統一以 `<code>` 包裹，中文自然語言狀態維持純文字。 |
| 20 | SHOULD | 已修正 | 重繪圖 1 並為派工（藍）、回報（綠）、證據（橘虛線）保留獨立走線通道，拉開「對話／關卡」與方框間距、縮短交換區標題避開垂直箭頭，並將 `PROGRESS.md`／`ORCHESTRATION.md` 與底部「同步原則」拆行，實測零文字溢位與零線穿標題。 |
| 21 | SHOULD | 已修正 | 圖 2 補入瀏覽器 worker 的權限限制（專用新分頁、限 `127.0.0.1` 本機、結束關分頁），並將 `grep` 改為帶單引號的可執行格式 `grep -nE 'tests-ws\|verify-ws\|/tests/' <log>`。 |
| 22 | SHOULD | 已修正 | §1「協調者的鐵律」補上 `X1`（規則定案前 `T0.1`／`T1.1`／`T1.4`）、`X3`（使用者指示 `T0.7`）與 `X5`（使用者直接指定 `agy` session 完成 `T1.8` SPEC v1.0）三項歷史例外；圖 1 的 `tests-ws/` 與 §3 補註正式測試任務另同步 `AGENTS.md`、`pyproject.toml` 等支援檔。 |
| 23 | SHOULD | 已修正 | §7 案例一補充 R25（無執行中 task 的中斷復原）因無法經公開介面固定中斷點而由 `T3.6` 記為無法做確定性測試；案例三限定 `17 / 17 px` 為無錯誤框時（實質內距 `16 / 16 px`），另補有錯誤框時量得 `17 / 12 / 17 px`。 |
| 24 | SHOULD | 已修正 | §10 明確標註 `T2.3b` 的 `D1`–`D4` 為 `docs/SPEC.md:263-270` 的 v1.1.1 變更明細編號，與使用者決策表的 `D1`–`D4`（`materials/PROGRESS.md:133-140`）為兩套編號；將原合併的 `E1–E3` 拆成 `E1`、`E2`、`E3` 一項一行，並新增 `E11`。 |
| 25 | NIT | 已修正 | 移除頁首額外英文標語 `Multi-Agent Engineering Playbook`，並移除重複日期，全頁頁首僅於頂部列保留一處 `<time datetime="2026-11-21">2026-11-21</time>`，讓手機首屏更快進入標題與目錄。 |

---

### 2. 與 `docs/technical.html` 的一致性調整與核對結果

- **已對齊項目：**
  - **語言與色系宣告**：`<html lang="zh-Hant-TW">`，於 `:root` 與 `@media (prefers-color-scheme: dark)` 補齊 `color-scheme: light` / `dark`，維持完全一致的 11 個必備 CSS token（`--bg`、`--surface`、`--text`、`--muted`、`--border`、`--accent`、`--ok`、`--warn`、`--err`、`--info`、`--code-bg`）及一致的字型變數名 `--sans`、`--mono`。
  - **頁首、導覽與頁尾**：頁首包含標題、一行副標、單一日期 `2026-11-21` 及相對切換導覽 `technical.html ⇄ ai-agents.html`；頁尾含「資料來源」清單、成套連結與「回到目錄 ↑」。
  - **圖說樣式**：六張 SVG 均採用 `<figure>`＋`<figcaption>圖 N：…</figcaption>`，且圖說內檔名與識別字皆包在 `<code>` 內。
  - **跨檔事實核對**：比對兩份文件對應用名稱、SPEC v1.1.4／合約 1.1.2 版本、7 種情境與 202 筆事件／168 行日誌、Tailwind CSS／CLI `4.3.5` 與 Preline `5.1.0`、預設排除 `perf` 的測試結構、以及 `E4`–`E6`／`E_INTERRUPTED` 行為描述，**未發現任何事實矛盾**。
- **無法在本任務自行修改的細微差異（交由 T7.5 處理）：**
  - [docs/technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/docs/technical.html#L57) 目前頁首導覽文字為 `多代理協作文件 →` 而非共享規則中的 `technical.html ⇄ ai-agents.html`（但連結目標 `ai-agents.html` 正確）；依任務規定不得修改 `docs/technical.html`，留待 `T7.5` 同步對齊。

---

### 3. `grep`、錨點與 HTML 結構檢查結果

1. **`grep -nE 'https?://|<link|src=|@import|url\(' docs/ai-agents.html`**：共命中 **65 行**，**0 筆外部資源**：
   - **6 筆**（L741、L1014、L1116、L1265、L1431、L2128）：內嵌 `<svg xmlns="http://www.w3.org/2000/svg">` 標準 XML 命名空間宣告，不發送任何網路請求。
   - **59 筆**：全數為各 SVG 內部箭頭標記參照（`marker-start="url(#m1-…)"`／`marker-end="url(#m1-…)"` 至 `#m6-…`），皆指向同頁 `<defs>` 節點。
   - `<link`、`src=`、`@import`、其他 `http(s)://` 或外部 `url(`：**皆為 0 筆**。
2. **`grep -n '/Users/' docs/ai-agents.html`**：空輸出（**0 筆**）。
3. **頁內錨點檢查**：全文 14 處 `href="#…"`（涵蓋 13 個不重複目標：`toc`、`s1`–`s12`），**缺失目標 0 筆**。
4. **HTML 結構檢查**：`<h1>` 恰好 **1 個**；Python `HTMLParser` 驗證全部標籤正確配對、無未閉合或錯位標籤（`Tag errors: []`）。
5. **版面與字級實測（Headless Chrome）**：390 px 淺色與深色下 `documentElement.scrollWidth` 與 `body.scrollWidth` 均為 `390`；六張 SVG 的 `outOfViewBox` 與 `rectOverflows` 皆為空，1280 px 最小渲染字級為 `13.00–13.11 px`。

---

### 4. 截圖與證據檔名（`.t7-evidence/T7.6/`）

完整索引見 [.t7-evidence/T7.6/INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-agent-ws/.t7-evidence/T7.6/INDEX.md)：

- **全頁截圖**：`agents-1280-light.png`、`agents-1280-dark.png`、`agents-390-light.png`、`agents-390-dark.png`
- **手機首屏截圖**：`mobile-top-light.png`、`mobile-top-dark.png`
- **各圖裁切（淺色與深色）**：`figure-1-light.png`～`figure-6-light.png`、`figure-1-dark.png`～`figure-6-dark.png`
- **版面量測與索引**：`layout-check.json`、`INDEX.md`
