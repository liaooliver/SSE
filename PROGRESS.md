# 協調者進度表：FastAPI SSE Demo

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
| 目前 Phase | **1 規格：等待使用者核准** |
| 規格版本 | `SPEC.md` v0.2（commit `d3b469d`） |
| 阻塞中 | ⛔ 使用者核准 SPEC v0.2；⛔ D2 實作 worker 的權限 |
| 下一步 | 使用者核准之後：同步 SPEC 到 `tests-ws`，然後同時分派 T2.1（實作）和 T2.2（測試） |

## Phase 總覽

| Phase | 名稱 | 狀態 | 關卡 |
|---|---|---|---|
| 0 | 準備 | ✅ 完成 | — |
| 1 | 規格 | 🟡 等待關卡 | **使用者核准** |
| 2 | 同時開發（實作 ‖ 測試） | ⬜ 未開始 | — |
| 3 | 驗證測試、處理失敗 | ⬜ 未開始 | 測試全部通過 |
| 4 | AI 自己跑 E2E | ⬜ 未開始 | E2E 全部通過 |
| 5 | 驗收、交付 | ⬜ 未開始 | **交給使用者** |

狀態符號：⬜ 未開始 · 🔵 進行中 · 🟡 等待關卡／決策 · 🔁 退回重做 · ✅ 完成 · ❌ 失敗

## 任務清單

| ID | Phase | 任務 | 負責 | 狀態 | 輸入 | 輸出／回報 | 備註 |
|---|---|---|---|---|---|---|---|
| T0.1 | 0 | git、uv 骨架、`.orchestra/` | 協調者 | ✅ | — | commit `4ff1059` | 角色定案前由協調者執行（見 X1） |
| T1.1 | 1 | 起草 SPEC v0.1 | 協調者 | ✅ | — | `SPEC.md` | 角色定案前由協調者執行（見 X1） |
| T1.2 | 1 | 規格審閱（從測試的角度） | Codex | ✅ | `p1-codex-spec-review.md` | `reports/p1-codex-spec-review.md` | 23 條意見，needs-changes |
| T1.3 | 1 | 規格審閱（SSE 協定和 E2E 的角度） | agy | ✅ | `p1-agy-spec-review.md` | `reports/p1-agy-spec-review.md` | 15 條意見，needs-changes |
| T1.4 | 1 | 合併成 v0.2 | 協調者 | ✅ | T1.2、T1.3 | commit `d3b469d` | 角色定案前由協調者執行（見 X1）；處理紀錄在 SPEC 附錄 |
| T1.5 | 1 | 使用者核准 SPEC | 使用者 | 🟡 | `SPEC.md` v0.2 | — | 如果要再改，交給規格編輯 worker |
| T2.0 | 2 | 同步 SPEC 到 `tests-ws`、`impl-ws` | 協調者 | ⬜ | `SPEC.md` | — | 只搬檔案 |
| T2.1 | 2 | 實作 `app/` | Claude worker | ⬜ | SPEC | `impl-ws/app/` → 搬回主 repo | 看不到測試；需要先決定 D2 |
| T2.2 | 2 | 寫單元、整合、E2E 測試 | Codex | ⬜ | SPEC | `tests-ws/tests/` | 只看得到 SPEC；回報只交「測試名稱 → 需求 ID」對照 |
| T3.1 | 3 | 審查測試：涵蓋對照表、隨機失敗、空測試 | agy | ⬜ | `verify-ws` | `reports/p3-agy-test-audit.md` | |
| T3.2 | 3 | 故意改壞程式，看測試會不會失敗 | agy | ⬜ | `verify-ws` | 同上 | |
| T3.3 | 3 | 跑全部測試，判斷失敗出在哪 | agy | ⬜ | `verify-ws` | `reports/p3-agy-run-N.md` | 用「需求 ID + 預期 + 實際」描述 |
| T3.4 | 3 | 把失敗分給對的人（最多 3 輪） | 協調者 | ⬜ | T3.3 | 退回 T2.1／T2.2，或問使用者 | 看「重試計數」 |
| T4.1 | 4 | 對真的 uvicorn 跑自動化 E2E | agy | ⬜ | 全新的 `verify-ws` | `reports/p4-agy-e2e.md` | pytest `-m e2e` |
| T4.2 | 4 | 探索式 E2E：curl -N、多個客戶端、斷線重連、關機、真瀏覽器 | agy | ⬜ | 同上 | 同上 | 瀏覽器部分如果 agy 做不到，交給 Claude worker 用 Chrome 做 |
| T4.3 | 4 | 效能驗收（R19，`-m perf`） | agy | ⬜ | 同上 | 同上 | |
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
| D1 | 是否核准 SPEC v0.2 | 🟡 等待 |
| D2 | 實作 worker（`claude -p`）在 `impl-ws` 裡要用 `--dangerously-skip-permissions` 自動核准，還是限制只能用 `acceptEdits` 加上 `uv` 指令 | 🟡 等待 |

## 偏差紀錄

| ID | 內容 | 處置 |
|---|---|---|
| X1 | T0.1、T1.1、T1.4 是協調者在「協調者只管理」這條規則定案之前親自做的 | 保留成果；從 Phase 2 開始嚴格遵守管理者規則 |

## 工作區

| 名稱 | 路徑 | 裡面有什麼 | 給誰用 |
|---|---|---|---|
| 主 repo | `~/Desktop/projects/SSE/` | SPEC、app、管理文件 | 協調者（只做管理動作） |
| impl-ws | `~/.local/share/sse-orchestra/impl-ws/` | 主 repo 的副本，**排除** `tests/`、`.orchestra/`、`CLAUDE.md` | Claude worker |
| tests-ws | `~/.local/share/sse-orchestra/tests-ws/` | 只有 `SPEC.md` 和 `tests/` | Codex |
| verify-ws | `~/.local/share/sse-orchestra/verify-ws/` | 每次重新組裝：clean clone 加上 tests | agy |

## 工作日誌

| 時間 | 事件 |
|---|---|
| 2026-11-20 21:31 | Phase 0 完成（`4ff1059`） |
| 2026-11-20 21:35 | 同時在背景分派 T1.2（Codex）和 T1.3（agy） |
| 2026-11-20 21:40 | 兩份審閱都回來了，都是 needs-changes；合併成 v0.2（`d3b469d`） |
| 2026-11-20 21:41 | 使用者下令全部終止；確認沒有 worker 還在執行 |
| 2026-11-20 21:45 | 使用者規定協調者只做管理；實作改由 Claude worker 負責；工作區從 session 暫存目錄搬到 `~/.local/share/sse-orchestra/`；建立本檔和 `CLAUDE.md` |
