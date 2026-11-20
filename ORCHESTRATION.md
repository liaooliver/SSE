# AI 協調計畫：FastAPI SSE Demo

> 進度和協調者的職責說明請看 `PROGRESS.md`。本檔只描述「規則」，不記錄狀態。

## 角色

| 角色 | 擔任者 | 負責 | 可寫入 | 不可讀取 |
|---|---|---|---|---|
| **協調者（管理者）** | 使用者直接對話的 Claude Code session（不限定是哪一個 session） | 分派任務、追蹤進度、分配爭議、守關卡、維護 `PROGRESS.md` | 只能寫管理文件 | 測試原始碼 |
| 實作者 | Claude Code worker（`claude -p`） | 依照 SPEC 實作 `app/`，並修 bug | `impl-ws` | 測試 |
| 規格編輯 | Claude Code worker（`claude -p`） | 依照協調者的決定修改 `SPEC.md` | `SPEC.md` | — |
| 測試作者 | Codex CLI | 只根據 SPEC 寫單元、整合、E2E 測試 | `tests-ws` | `app/`、主 repo |
| 測試驗證、E2E、驗收 | agy（Gemini 4 Neon High） | 審查測試、故意改壞程式抽查、跑 E2E、最終驗收 | `verify-ws`、回報 | — |

協調者能做和不能做的事，以 `PROGRESS.md` 最上方的說明為準。

## 工作區（隔離，固定路徑，不會因為換 session 而消失）

`W = ~/.local/share/sse-orchestra`

| 工作區 | 位置 | 內容 | 誰用 |
|---|---|---|---|
| 主 repo | `~/Desktop/projects/SSE/` | SPEC、app、管理文件；`tests/` 到 Phase 5 才合併進來 | 協調者 |
| impl-ws | `$W/impl-ws/` | 用 `rsync` 從主 repo 複製，排除 `tests/`、`.orchestra/`、`CLAUDE.md`、`PROGRESS.md` | Claude worker |
| tests-ws | `$W/tests-ws/` | 只有 `SPEC.md` 和 `tests/` | Codex |
| verify-ws | `$W/verify-ws/` | 每次重新組裝：主 repo 的 clean clone 加上 `tests-ws/tests/` | agy |

- 測試和實作雙向隔離：Codex 拿不到 app，也不知道主 repo 的路徑；Claude worker 拿不到測試；協調者只搬檔案、不讀測試。
- 協調者看到的測試資訊只有兩種：(a) Codex 的「測試名稱 → 需求 ID」清單；(b) agy 用「需求 ID + 預期行為 + 實際行為」描述的失敗報告。退回給實作者時，也只轉交 (b)。
- 每個 worker 跑完，協調者都用 `git status`／`diff --stat` 做越界檢查，越界就還原。

## 流程

| Phase | 內容 | 關卡 |
|---|---|---|
| 0 準備 | git、uv、`.orchestra/`、工作區 | — |
| 1 規格 | 起草 → Codex 和 agy 同時唯讀審閱 → 規格編輯 worker 依協調者的決定合併 | **使用者核准** |
| 2 開發 | Claude worker 在 `impl-ws` 實作 ‖ Codex 在 `tests-ws` 寫測試（同時進行） | — |
| 3 驗證測試 | agy 在 `verify-ws`：涵蓋對照表、隨機失敗、故意改壞程式抽查、跑全部測試 → 協調者把失敗分給對的人 | 測試全部通過 |
| 4 AI 自己跑 E2E | agy 用全新的 `verify-ws` 和真的 uvicorn：自動化 E2E、curl -N 探索、斷線重連、關機、真瀏覽器、效能 | E2E 全部通過 |
| 5 驗收 | agy 從 clean clone 跑 `uv sync` 和全部測試 → 協調者把測試合併進主 repo → 交付 | **交給使用者** |

## 失敗分給誰（Phase 3／4）

| 判定 | 誰判定 | 交給誰 |
|---|---|---|
| 程式錯了 | agy | Claude 實作 worker（只收到行為描述） |
| 測試錯了 | agy | Codex |
| 規格模糊 | agy 或協調者 | 使用者 → 規格編輯 worker |

同一個問題最多來回 3 輪，之後交給使用者決定。輪數記在 `PROGRESS.md`。

## 怎麼呼叫 worker

任務說明放 `.orchestra/briefs/<phase>-<worker>-<task>.md`，回報放 `.orchestra/reports/`。能同時跑的就放到背景同時跑。

| Worker | 指令 |
|---|---|
| Claude 實作者 | `cd $W/impl-ws && claude -p "$(cat brief)" --append-system-prompt "You are a worker. Follow the brief only." <權限見 D2> > report` |
| Claude 規格編輯 | 同上，但 cwd 是主 repo 的副本，只允許寫入 `SPEC.md` |
| Codex 審閱 | `codex exec -s read-only -C $W/tests-ws --skip-git-repo-check -o report - < brief` |
| Codex 寫測試 | `codex exec -s workspace-write -C $W/tests-ws --skip-git-repo-check -o report - < brief` |
| agy 審閱 | `agy -p "$(cat brief)" --mode plan --model gemini-4-neon-high > report` |
| agy 驗證／E2E／驗收 | `cd $W/verify-ws && agy -p "$(cat brief)" --dangerously-skip-permissions --model gemini-4-neon-high > report` |

每個 phase 結束都做一次 git commit，並更新 `PROGRESS.md`。
