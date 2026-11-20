# 協調者進度表：安裝進度即時串流（原 FastAPI SSE Demo）

> ## ⚠️ 給協調者：你是管理者，不親自執行任何任務
>
> 你的工作只有這幾件：**分派任務、追蹤進度、分配爭議給對的人處理、守住關卡、更新這份文件**。
> 寫程式、寫測試、改規格、跑測試、做 E2E，全部交給 worker 去做。
>
> **你可以做的事**
> - 撰寫和更新管理文件：本檔、`ORCHESTRATION.md`、`.orchestra/briefs/*`、`.orchestra/decisions.md`
> - 啟動或停止 worker（`claude -p`、`codex exec`、`agy -p`），並閱讀它們的**回報**
> - 搬運檔案（`rsync`／`cp`），以及做越界檢查（`git status`、`git diff --stat`、`pgrep`）
> - 依照 worker 的結果 commit、還原越界的改動
> - 在關卡前向使用者報告、等待核准，並問使用者規格上不清楚的地方
>
> **你不可以做的事**
> - 編輯 `app/`、`tests/`、`SPEC.md`、`pyproject.toml` 這類交付物（規格要改，就寫好任務說明，交給規格編輯 worker）
> - 自己跑 pytest、uvicorn、curl 來驗證（那是 agy 的工作）
> - **閱讀測試原始碼**（`tests-ws/tests/`、`verify-ws/tests/`）。你只看 Codex 的「測試名稱 → 對應的需求 ID」清單，以及 agy 的行為描述報告
> - 替使用者核准關卡
>
> 如果發現自己正在動手做事，就停下來，把它寫成任務說明，交給對的 worker。

---

## 接手檢查清單（每次開新 session 時照做）

1. 讀完本檔，再讀 `ORCHESTRATION.md`（角色、隔離方式、怎麼呼叫 worker）
2. 執行 `pgrep -fl "codex exec|agy -p|claude -p"`，確認有沒有還在跑的 worker
3. 看「工作日誌」的最後一筆，以及「下一步」
4. 用 `git log --oneline` 確認最新的 commit 和日誌一致
5. 從「下一步」接著做。做任何動作之前，先在日誌記一筆

---

## 目前狀態

| 項目 | 值 |
|---|---|
| 目前 Phase | **1 規格** 完成，準備進入 **2 同時開發** |
| 規格版本 | 主 repo 是 `docs/SPEC.md` v1.0、`contracts/domain.pyi`、`contracts/openapi.yaml`；決策紀錄在 `docs/plans/spec_v1_plan.md`。v0.2／v0.3 全部作廢 |
| 阻塞中 | 無 |
| 下一步 | ① commit 這次的文件改動 ② T2.0 同步 `docs/SPEC.md`、`contracts/`、`AGENTS.md`、`install-progress-sequence.svg` 到 `impl-ws` 與 `tests-ws` ③ 同時在背景分派 T2.1（Claude 實作）與 T2.2（Codex 寫測試）|

## Phase 總覽

| Phase | 名稱 | 狀態 | 關卡 |
|---|---|---|---|
| 0 | 準備 | ✅ 完成 | — |
| 0.5 | Agent 環境搭建（角色、隔離、合約機制、權限、模型） | ✅ 完成（使用者決定不跑冒煙測試） | — |
| 0.6 | Python／FastAPI 環境 | ✅ 完成（`667f7b2`） | 環境驗證通過 |
| 1 | 規格 | ✅ 完成（v1.0 定案，D1／D11） | **使用者核准** |
| 2 | 同時開發（實作 ‖ 測試） | ⬜ 未開始 | — |
| 3 | 驗證測試、處理失敗 | ⬜ 未開始 | 測試全部通過 |
| 4 | AI 自己跑 E2E | ⬜ 未開始 | E2E 全部通過 |
| 5 | 驗收、交付 | ⬜ 未開始 | **交給使用者** |

狀態符號：⬜ 未開始 · 🔵 進行中 · 🟡 等待關卡／決策 · 🔁 退回重做 · ✅ 完成 · ❌ 失敗

## 任務清單

| ID | Phase | 任務 | 負責 | 狀態 | 輸入 | 輸出／回報 | 備註 |
|---|---|---|---|---|---|---|---|
| T0.1 | 0 | git、uv 骨架、`.orchestra/` | 協調者 | ✅ | — | commit `4ff1059` | 角色定案前由協調者執行（見 X1） |
| T1.1 | 1 | 起草 SPEC v0.1 | 協調者 | ✅ | — | `docs/SPEC.md` | 角色定案前由協調者執行（見 X1） |
| T1.2 | 1 | 規格審閱（從測試的角度） | Codex | ✅ | `p1-codex-spec-review.md` | `reports/p1-codex-spec-review.md` | 23 條意見，needs-changes |
| T1.3 | 1 | 規格審閱（SSE 協定和 E2E 的角度） | agy | ✅ | `p1-agy-spec-review.md` | `reports/p1-agy-spec-review.md` | 15 條意見，needs-changes |
| T1.4 | 1 | 合併成 v0.2 | 協調者 | ✅ | T1.2、T1.3 | commit `d3b469d` | 角色定案前由協調者執行（見 X1）；處理紀錄在 SPEC 附錄 |
| T0.2 | 0.5 | 協調者只做管理、進度表、`CLAUDE.md` 分流 | 協調者 | ✅ | — | commit `a1724b5` | |
| T0.3 | 0.5 | 隔離方式和合約機制寫進 `ORCHESTRATION.md` | 協調者 | ✅ | D3、D4 | `ORCHESTRATION.md` | |
| T0.4 | 0.5 | 權限、模型政策、時間上限寫進 `ORCHESTRATION.md` | 協調者 | ✅ | D2、D5、D6、D8 | `ORCHESTRATION.md` | |
| T0.5 | 0.5 | 環境冒煙測試 | — | ➖ 取消 | — | — | D7：使用者決定直接開始 |
| T0.6 | 0.6 | uv 依賴套件、pytest／ruff／mypy 設定、只有 `/health` 的骨架、README | Claude 實作者（sonnet-5-5／medium） | ✅ | `briefs/p0-claude-python-env.md` | `reports/p0-python-env.md`；已搬回主 repo（`667f7b2`） | 開發用套件也要寫進 Codex 的任務說明，讓它知道可以用哪些 |
| T0.7 | 0.6 | `AGENTS.md` 程式規範，加嚴 ruff／mypy 設定 | 協調者（使用者指示） | ✅ | 網路查證的最佳實務 | commit `667f7b2`；已複製到 `impl-ws` | 見 X3；ruff format、ruff check、mypy 全部通過 |
| T1.5 | 1 | 使用者核准 SPEC | 使用者 | ✅ | `docs/SPEC.md` v1.0 + `contracts/` | — | D1：使用者核准 v1.0 |
| T1.6 | 1 | SPEC v0.3：`contracts/openapi.yaml`、`domain.pyi`、領域介面 | Claude 規格編輯（opus-5-5／high） | ➖ 作廢 | `briefs/p1-claude-spec-editor-v03.md` | `spec-ws/`；`reports/p1-spec-editor.md` | 主軸改變（X2、X5），內容不再適用；`spec-ws` 的檔案已刪除 |
| T1.8 | 1 | 以 SVG 為主軸重寫 SPEC v1.0，加上 `contracts/` | agy session（使用者直接指定） | ✅ | 使用者回答 Q0–Q6、OQ1–OQ3 | `docs/SPEC.md` v1.0（R1–R29、AC1–AC12）、`contracts/domain.pyi`、`contracts/openapi.yaml`、`docs/plans/spec_v1_plan.md` | 見 X5；`app/main.py` 的 `create_app` 還是舊簽名，留給 T2.1 |
| T1.7 | 1 | 審閱 v1.0 和合約（唯讀） | Codex ‖ agy | ➖ 取消 | T1.8 | — | D11：使用者決定不用跑審閱，直接推進 |
| T2.0 | 2 | 同步 SPEC 到 `tests-ws`、`impl-ws` | 協調者 | ⬜ | `docs/SPEC.md` | — | 只搬檔案 |
| T2.1 | 2 | 實作 `app/` | Claude worker | ⬜ | SPEC v1.0 | `impl-ws/app/` → 搬回主 repo | 看不到測試；先把 `create_app` 改成 R2 的新簽名；`impl-ws`／`tests-ws` 裡的 SPEC 是舊版，要在 T2.0 重新同步 |
| T2.2 | 2 | 寫單元、整合、E2E 測試 | Codex | ⬜ | SPEC | `tests-ws/tests/` | 只看得到 SPEC；回報只交「測試名稱 → 需求 ID」對照 |
| T3.1 | 3 | 審查測試：涵蓋對照表、隨機失敗、空測試 | agy | ⬜ | `verify-ws` | `reports/p3-agy-test-audit.md` | |
| T3.2 | 3 | 故意改壞程式，看測試會不會失敗 | agy | ⬜ | `verify-ws` | 同上 | |
| T3.3 | 3 | 跑全部測試，判斷失敗出在哪 | agy | ⬜ | `verify-ws` | `reports/p3-agy-run-N.md` | 用「需求 ID + 預期 + 實際」描述 |
| T3.4 | 3 | 把失敗分給對的人（最多 3 輪） | 協調者 | ⬜ | T3.3 | 退回 T2.1／T2.2，或問使用者 | 看「重試計數」 |
| T4.1 | 4 | 對真的 uvicorn 跑自動化 E2E | agy | ⬜ | 全新的 `verify-ws` | `reports/p4-agy-e2e.md` | pytest `-m e2e` |
| T4.2 | 4 | 探索式 E2E：curl -N、多個客戶端、斷線重連、關機 | agy | ⬜ | 同上 | 同上 | |
| T4.4 | 4 | 真瀏覽器 E2E（R26／R27） | Claude 瀏覽器 worker（`--chrome`） | ⬜ | 同上，伺服器由 agy 或任務說明啟動 | `reports/p4-claude-browser.md` | D8 |
| T4.3 | 4 | 效能驗收（AC11，`-m perf`） | agy | ⬜ | 同上 | 同上 | |
| T5.1 | 5 | 從 clean clone 開始，uv sync 之後跑全部測試 | agy | ⬜ | git clone | `reports/p5-agy-acceptance.md` | |
| T5.2 | 5 | 把 `tests/` 合併進主 repo，並 commit | 協調者 | ⬜ | T5.1 通過 | commit | 只搬檔案，不讀內容 |
| T5.3 | 5 | 交付報告給使用者 | 協調者 | ⬜ | 全部 | — | 附上 E2E 和驗收的證據 |

## 重試計數（每個問題最多 3 輪，超過就交給使用者）

| 問題 | 輪數 | 最後處理 |
|---|---|---|
| — | — | — |

## 等使用者決定的事

| ID | 問題 | 狀態 |
|---|---|---|
| D1 | 是否核准 SPEC（改為 v1.0） | ✅ 2026-11-20 |
| D11 | 規格審閱（T1.7） → **跳過，直接推進至 Phase 2** | ✅ 2026-11-20 |
| D12 | SPEC 位置 → **移至 `docs/SPEC.md`** | ✅ 2026-11-20 |
| D9 | 專案主軸 → **以 `install-progress-sequence.svg` 為準，舊規格全部清空**；事件由內建的模擬安裝 API 產生（Stage → Task → Log）；計畫在安裝前就知道；失敗時停下並標紅；排除建議是模擬的；前端左側 Stage、右側 Task 並逐行顯示 log；使用 SQLite，重新安裝時清掉上一輪 | ✅ 2026-11-20 |
| D10 | 失敗觸發 → **下拉選單選情境**（1 種成功 + 6 種失敗）；**不做**卡住模擬；SPEC 由**這個 agy session** 直接改；計畫文件放在專案的 `docs/plans/` | ✅ 2026-11-20 |
| D2 | Claude 實作 worker 的權限 → **完全不設限**（風險：工具層沒有隔離，必須靠事後稽核） | ✅ 2026-11-20 |
| D3 | 隔離強度 → **分開目錄 + 工具權限**（不用容器） | ✅ 2026-11-20 |
| D4 | 合約範圍 → **`openapi.yaml` 和 `domain.pyi` 都要** | ✅ 2026-11-20 |
| D5 | 模型 → 協調者依任務挑選；下限是 Claude Sonnet 5.5、agy Gemini 4 Hydrogen、Codex GPT-6.2 Sol；推理強度不低於 medium（詳見 `ORCHESTRATION.md`） | ✅ 2026-11-20 |
| D6 | 每次執行的時間上限 → 30 分鐘（預設值，使用者沒有異議） | ✅ 2026-11-20 |
| D7 | 環境冒煙測試 → **不跑，直接開始** | ✅ 2026-11-20 |
| D8 | 真瀏覽器 E2E → **Claude Code worker 用 Claude in Chrome 擴充功能** | ✅ 2026-11-20 |

## 偏差紀錄

| ID | 內容 | 處置 |
|---|---|---|
| X1 | T0.1、T1.1、T1.4 是協調者在「協調者只管理」這條規則定案之前親自做的 | 保留成果；從 Phase 2 開始嚴格遵守管理者規則 |
| X3 | T0.7（`AGENTS.md`、`pyproject.toml` 設定、把 T0.6 搬回主 repo）是使用者指示由協調者親自做，沒有派 worker | 使用者核准，保留成果 |
| X4 | 22:33 有另一個協調者 session 同時在跑（commit `c36be5f`：刪除原始 log、新增回報）。T0.6 的原始 log 因此被刪掉，沒能做越界稽核 | 已通知使用者停掉另一個 session；T0.6 只產出骨架，風險低，保留成果 |
| X2 | `install-progress-sequence.svg` 被 `git add -A` 一起 commit 進 `a1724b5`，當時被誤判成「跟專案無關」 | **更正**：使用者確認這張 SVG 是規格主軸（D9）。之後同步 SPEC 時，SVG 也要一起放進各工作區。之後仍然只 `git add` 指定的路徑 |
| X5 | SPEC v1.0 和 `contracts/` 是使用者直接指定的 agy session 撰寫的，沒有經過「Claude 規格編輯 worker」，也沒有走 brief／report 流程 | 使用者核准（D10）；T1.7 照常交給 Codex ‖ agy 做唯讀審閱，彌補少掉的獨立檢查 |

## 工作區

| 名稱 | 路徑 | 裡面有什麼 | 給誰用 |
|---|---|---|---|
| 主 repo | `~/Desktop/projects/SSE/` | SPEC、app、管理文件 | 協調者（只做管理動作） |
| impl-ws | `~/.local/share/sse-orchestra/impl-ws/` | 主 repo 的副本（含 `AGENTS.md`），**排除** `tests/`、`.orchestra/`、`CLAUDE.md` | Claude worker |
| tests-ws | `~/.local/share/sse-orchestra/tests-ws/` | 只有 `docs/SPEC.md`、`contracts/`、`AGENTS.md`、`pyproject.toml` 和 `tests/` | Codex |
| verify-ws | `~/.local/share/sse-orchestra/verify-ws/` | 每次重新組裝：clean clone 加上 tests | agy |

## 工作日誌

| 時間 | 事件 |
|---|---|
| 2026-11-20 21:31 | Phase 0 完成（`4ff1059`） |
| 2026-11-20 21:35 | 同時在背景分派 T1.2（Codex）和 T1.3（agy） |
| 2026-11-20 21:40 | 兩份審閱都回來了，都是 needs-changes；合併成 v0.2（`d3b469d`） |
| 2026-11-20 21:41 | 使用者下令全部終止；確認沒有 worker 還在執行 |
| 2026-11-20 21:45 | 使用者規定協調者只做管理；實作改由 Claude worker 負責；工作區從 session 暫存目錄搬到 `~/.local/share/sse-orchestra/`；建立本檔和 `CLAUDE.md` |
| 2026-11-20 22:15 | D3、D4 決定；`ORCHESTRATION.md` 新增合約和隔離章節；備妥 T1.6 的任務說明和 `spec-ws`（未分派）；使用者確認目前仍在環境搭建階段，新增 Phase 0.5 |
| 2026-11-20 22:30 | D2、D5–D8 決定；查證模型強弱並寫入模型政策；Phase 0.5 完成；分派 T1.6（Claude 規格編輯，opus-5-5／high，背景執行） |
| 2026-11-20 22:40 | 使用者要求先搭好 Python／FastAPI 環境；確認環境設定已在 `dda5a75` commit；分派 T0.6（背景執行）；發現 X2 |
| 2026-11-20 22:45 | T1.6 回報（v0.3、合約檔、10 個模糊處），越界稽核通過；T0.6 回報，驗證全部通過 |
| 2026-11-20 22:50 | 使用者要求查證 FastAPI 最佳實務並規劃程式規範；發現另一個協調者 session（X4） |
| 2026-11-20 22:55 | 依使用者指示由協調者親自做 T0.7：T0.6 搬回主 repo，新增 `AGENTS.md`，加嚴 ruff／mypy（`667f7b2`，X3）；Phase 0.6 完成 |
| 2026-11-20 22:48 | agy session 和使用者討論 SPEC：發現 SPEC v0.2（Clock／聊天）和 SVG（安裝進度）是兩個不同的產品 |
| 2026-11-20 23:07 | 使用者決定 D9、D10：清空舊規格，以 SVG 為主軸；T1.6 作廢 |
| 2026-11-20 23:15 | T1.8 完成：`SPEC.md` v1.0、`contracts/domain.pyi`、`contracts/openapi.yaml`、`docs/plans/spec_v1_plan.md`；`README.md`、`ORCHESTRATION.md` 的名稱和 R-id 一併更新 |
| 2026-11-20 23:16 | 使用者指示「只整理文件，不開始執行」：還原 `app/main.py`、`pyproject.toml` 的改動；`spec-ws` 的 v0.3 暫時不刪；沒有 commit |
| 2026-11-20 23:20 | 使用者指示：① commit 文件改動 ② 刪除 spec-ws 作廢的 v0.3 ③ 跳過 T1.7 審閱（D11）④ SPEC.md 移至 docs/SPEC.md（D12）。Phase 1 完成 |
