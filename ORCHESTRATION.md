# AI 協調計畫：FastAPI SSE Demo

## 角色

| 角色 | 擔任者 | 負責 | 可寫入 | 不可讀取 |
|---|---|---|---|---|
| 協調者 + 實作者 | Claude Code | 起草規格、派工、實作 `app/`、修 bug | 主 repo（`tests/` 除外） | 測試原始碼 |
| 測試作者 | Codex CLI | 只根據 `SPEC.md` 寫單元／整合／E2E 測試 | 測試工作區 | `app/`、主 repo |
| 測試驗證 + E2E + 驗收 | agy（Gemini 4 Neon High） | 審查測試、故意改壞程式做抽查、實際跑 E2E、最終驗收 | 驗收工作區、報告 | — |

## 工作區（隔離）

| 工作區 | 位置 | 裡面有什麼 | 誰用 |
|---|---|---|---|
| 主 repo | `~/Desktop/projects/SSE/` | `SPEC.md`、`app/`、`pyproject.toml`、`.orchestra/` | Claude |
| 測試工作區 | `$SCRATCH/tests-ws/` | 只有 `SPEC.md` 和 `tests/` | Codex |
| 驗收工作區 | `$SCRATCH/verify-ws/` | 每次重新組裝：主 repo 的 clean clone 加上 `tests/` | agy |

- Claude 和 Codex 之間的測試隔離是雙向的。Codex 的工作目錄裡沒有 app 程式碼，也不會被告知主 repo 的路徑。Claude 在檔案之間搬運時只用 `rsync`／`cp`，不讀測試原始碼。
- Claude 只看兩種跟測試有關的資訊：(a) Codex 的最終回報，內容只限「測試名稱 → 對應的需求 ID」；(b) agy 用「需求 ID + 預期行為 + 實際行為」描述的失敗報告。
- 每次外部 AI 跑完，都用 `git status`／`diff --stat` 檢查它沒有寫到允許範圍外的地方，越界就還原。

## 流程

| Phase | 內容 | 關卡 |
|---|---|---|
| 0 準備 | git init、uv 專案、`.orchestra/`、建立工作區 | — |
| 1 規格 | Claude 起草 `SPEC.md`（需求編號 R1…）→ Codex 和 agy 同時唯讀審閱 → Claude 合併 | **使用者核准** |
| 2 開發 | Claude 實作 `app/` ‖ Codex 在 `tests-ws` 寫測試（同時進行） | — |
| 3 驗證測試 | agy 在 `verify-ws`：需求涵蓋對照表、抓會隨機失敗的測試、故意改壞程式抽查、跑全部測試 → 把失敗分給對的人 | 測試全過 |
| 4 E2E（AI 自測） | 在全新的 `verify-ws` 用真的 uvicorn：(a) 跑 Codex 寫的自動化 E2E 測試；(b) agy 用 curl -N 做探索式 E2E：多個客戶端、斷線、帶 Last-Event-ID 重連、demo 頁面 | E2E 全過 |
| 5 驗收 | agy 從 clean clone 跑 `uv sync` → 完整測試 → 驗收報告；測試合併進主 repo | **交給使用者** |

## 失敗怎麼分給對的人（Phase 3/4）

| 判定 | 誰判定 | 交給誰 |
|---|---|---|
| 程式錯了 | agy | Claude（只收到行為描述） |
| 測試錯了 | agy | Codex |
| 規格模糊 | agy 或 Claude | 使用者 |

同一個問題最多來回 3 輪，之後交給使用者決定。

## 怎麼呼叫

- Codex 審閱：`codex exec -s read-only -C <dir> --skip-git-repo-check -o <report>`
- Codex 寫測試：`codex exec -s workspace-write -C $SCRATCH/tests-ws --skip-git-repo-check -o <report>`
- agy 審閱：`agy -p --mode plan --model gemini-4-neon-high`
- agy 驗證／E2E／驗收：在 `verify-ws` 執行 `agy -p --dangerously-skip-permissions --model gemini-4-neon-high`
- 能同時跑的就在背景同時跑。給它們的任務說明放 `.orchestra/briefs/`，回報放 `.orchestra/reports/`。
- 每個 phase 結束做一次 git commit。
