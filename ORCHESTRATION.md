# AI 協調計畫：安裝進度即時串流

> 進度和協調者的職責說明請看 `PROGRESS.md`。本檔只描述「規則」，不記錄狀態。

## 角色

| 角色 | 擔任者 | 負責 | 可寫入 | 不可讀取 |
|---|---|---|---|---|
| **協調者（管理者）** | 使用者直接對話的 Claude Code session（不限定是哪一個 session） | 分派任務、追蹤進度、分配爭議、守關卡、維護 `PROGRESS.md` | 只能寫管理文件 | 測試原始碼 |
| 實作者 | Claude Code worker（`claude -p`） | 依照 SPEC 實作 `app/`，並修 bug | `impl-ws` | 測試 |
| 瀏覽器 E2E | Claude Code worker（`claude -p --chrome`，用使用者 Chrome 上的 Claude in Chrome 擴充功能） | **所有畫面上看得到的 E2E**（Phase 4）：頁面行為、斷線與恢復、伺服器重啟、多分頁同時看；每項檢查都要留截圖（見「E2E 證據規則」） | 回報、`.orchestra/evidence/<任務>/` | 測試原始碼 |
| 規格編輯 | Claude Code worker（`claude -p`） | 依照協調者的決定修改 `docs/SPEC.md` 和 `contracts/` | `spec-ws` | — |
| 測試作者 | Codex CLI | 只根據 SPEC 寫單元、整合、E2E 測試 | `tests-ws` | `app/`、主 repo |
| 測試驗證、E2E、驗收 | agy（Gemini，依模型政策） | 審查測試、故意改壞程式抽查、**只有畫面上看不到的 E2E**（SSE 原始格式、心跳、`Last-Event-ID` 標頭、延遲數字）、最終驗收 | `verify-ws`、回報、`.orchestra/evidence/<任務>/` | — |

協調者能做和不能做的事，以 `PROGRESS.md` 最上方的說明為準。

## 工作區（隔離，固定路徑，不會因為換 session 而消失）

`W = ~/.local/share/sse-orchestra`

| 工作區 | 位置 | 內容 | 誰用 |
|---|---|---|---|
| 主 repo | `~/Desktop/projects/SSE/` | SPEC、contracts、app、管理文件；`tests/` 到 Phase 5 才合併進來 | 協調者 |
| spec-ws | `$W/spec-ws/` | 只有 `docs/SPEC.md` 和 `contracts/` | Claude 規格編輯 |
| impl-ws | `$W/impl-ws/` | 用 `rsync` 從主 repo 複製，排除 `tests/`、`.orchestra/`、`CLAUDE.md`、`PROGRESS.md` | Claude 實作者 |
| tests-ws | `$W/tests-ws/` | 只有 `docs/SPEC.md`、`contracts/`、`tests/` | Codex |
| verify-ws | `$W/verify-ws/` | 每次重新組裝：主 repo 的 clean clone 加上 `tests-ws/tests/` | agy |

## 合約（兩邊共同遵守的唯一依據）

| 檔案 | 定義什麼 | 誰會用 |
|---|---|---|
| `docs/SPEC.md` | **行為**：輸入要得到什麼結果、邊界情況、錯誤怎麼處理 | 兩邊 |
| `contracts/openapi.yaml` | **HTTP 的形狀**：網址、參數、狀態碼、JSON 結構（SSE 事件格式寫在 SPEC） | 兩邊 |
| `contracts/domain.pyi` | **Python 的形狀**：測試可以直接 import 的商業邏輯函式，包含模組路徑、名稱、簽名 | 兩邊 |

- 測試只能 import `create_app`、`app`，以及 `domain.pyi` 裡列出的名稱。其他內部名稱一律不碰。
- 合約裡沒寫的，雙方都不能自己猜。測試者在回報裡寫 `CONTRACT GAP: ...`，實作者也不能自己多加測試會依賴的公開介面。缺口一律交給協調者，再由規格編輯 worker 補上，然後同時同步給兩邊。
- SPEC 和合約互相矛盾時，就是規格有缺陷，同樣交給協調者處理。

## 隔離（使用者決定：分開目錄 + 工具權限 + 事後稽核；不用容器）

| 層 | 作法 |
|---|---|
| 分開目錄 | 每個 worker 只拿到自己的工作區，也不告訴它其他工作區的路徑 |
| 工具權限：Claude 實作者 | **不設限**（`--dangerously-skip-permissions`，使用者決定 D2）。⚠️ 工具層沒有隔離，只能靠分開目錄、不告訴它路徑、事後稽核 |
| 工具權限：Claude 規格編輯 | `acceptEdits`，並禁用 Bash 和網路工具 |
| 工具權限：Codex | `-s workspace-write` 只限制寫入。⚠️ **讀取無法從技術上阻擋**，只能靠不告訴它路徑，再加上事後稽核 |
| 工具權限：agy | agy 負責驗證，本來就可以看到全部；加上 `--sandbox` 限制它的終端機 |
| 事後稽核 | worker 跑完後，搜尋它的執行紀錄，看有沒有出現其他工作區的路徑（Codex 看 log，Claude 看 `--output-format stream-json`）。有就判定越界、作廢這次產出 |

- 已知漏洞：Claude 實作者和 Codex 在技術上都讀得到其他工作區。所以每次跑完都**必須**做事後稽核（搜尋執行紀錄裡有沒有出現 `tests-ws`、`verify-ws`、`/tests/`），稽核不通過的產出一律作廢。
- 協調者看到的測試資訊只有兩種：(a) Codex 的「測試名稱 → 需求 ID」清單；(b) agy 用「需求 ID + 預期行為 + 實際行為」描述的失敗報告。退回給實作者時，也只轉交 (b)。
- 每個 worker 跑完，協調者都用 `git status`／`diff --stat` 做越界檢查，越界就還原。

## 流程

| Phase | 內容 | 關卡 |
|---|---|---|
| 0 準備 | git、uv、`.orchestra/`、工作區 | — |
| 1 規格 | 起草 → Codex 和 agy 同時唯讀審閱 → 規格編輯 worker 依協調者的決定合併，並產出 `contracts/` | **使用者核准** |
| 2 開發 | Claude worker 在 `impl-ws` 實作 ‖ Codex 在 `tests-ws` 寫測試（同時進行） | — |
| 2.5 合約檢查 | agy：用 `mypy stubtest` 比對 `app.domain` 和 `domain.pyi`；比對 `app.openapi()` 和 `openapi.yaml` 的網址、方法、狀態碼、必填欄位；確認測試只 import 合約裡有的名稱 | 合約一致 |
| 3 驗證測試 | agy 在 `verify-ws`：涵蓋對照表、隨機失敗、故意改壞程式抽查、跑全部測試 → 協調者把失敗分給對的人 | 測試全部通過 |
| 4 AI 自己跑 E2E | **Claude in Chrome worker**：在真瀏覽器裡驗證所有看得到的行為（頁面、斷線與恢復、伺服器重啟、多分頁），每項都截圖 ‖ **agy** 用全新的 `verify-ws` 和真的 uvicorn：只測畫面上看不到的（curl -N 原始串流、心跳、`Last-Event-ID`、效能），留原始輸出檔 | E2E 全部通過，**而且證據齊全** |
| 5 驗收 | agy 從 clean clone 跑 `uv sync` 和全部測試 → 協調者把測試合併進主 repo → 交付 | **交給使用者** |

## 失敗分給誰（Phase 3／4）

| 判定 | 誰判定 | 交給誰 |
|---|---|---|
| 程式錯了 | agy | Claude 實作 worker（只收到行為描述） |
| 測試錯了 | agy | Codex |
| 規格模糊 | agy 或協調者 | 使用者 → 規格編輯 worker |

同一個問題最多來回 3 輪，之後交給使用者決定。輪數記在 `PROGRESS.md`。

## 模型政策（使用者決定 D5）

協調者依照每個任務的難度挑模型，但**不得低於下限**，推理強度也一律**不低於 medium**。

| Worker | 下限 | 可以用的（由弱到強） | 不可以用的 |
|---|---|---|---|
| Claude（`claude -p`） | Sonnet 5.5 | `claude-sonnet-5-5` → `claude-opus-5-5` → `claude-fable-5-2` | Haiku |
| Codex | GPT-6.2 Sol | `gpt-6.2-sol` → `gpt-6.2-astra` | Luna、Terra、Reserve、舊世代 |
| agy | Gemini 4 Hydrogen | `gemini-4-hydrogen-{medium,high,xhigh}` → `gemini-4-neon-{medium,high,xhigh}` | Argon、3.8 Flash、gpt-oss、所有 `-low`；為了保持三家模型不同，agy 也不用 Claude 模型 |

強弱的依據：Gemini 4 是 Neon > Hydrogen > Argon（[Respan](https://www.respan.ai/articles/gemini-model-comparison)、[Valyu](https://www.valyu.ai/blogs/gemini-4-neon-vs-carbon-vs-hydrogen-vs-argon)）；GPT-6.2 是 Astra > Sol（[OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol)；Codex 本機的 `~/.codex/models_cache.json`）。

預設怎麼挑（協調者可以依情況調高）：

| 任務 | 模型 | 推理強度 |
|---|---|---|
| 規格編輯、產出合約檔 | `claude-opus-5-5` | high |
| 實作，以及第一次修 bug | `claude-opus-5-5` | high；第 2 輪以後調到 xhigh |
| Codex 寫測試 | `gpt-6.2-astra` | high |
| Codex 審閱 | `gpt-6.2-sol` | high |
| agy 審查測試、故意改壞程式抽查、E2E、驗收 | `gemini-4-neon-high` | high |
| agy 單純重跑測試 | `gemini-4-hydrogen-medium` | medium |
| 瀏覽器 E2E | `claude-sonnet-5-5` | high |

## 執行時間上限（D6）

每次執行最多 30 分鐘，超過就終止，並在 `PROGRESS.md` 記一筆。macOS 沒有內建 `timeout` 指令，所以改用 `perl -e 'alarm 1800; exec @ARGV' -- <cmd>`。

## 怎麼呼叫 worker

任務說明放 `.orchestra/briefs/<phase>-<worker>-<task>.md`，回報放 `.orchestra/reports/`。能同時跑的就放到背景同時跑。下面的 `T` 代表 `perl -e 'alarm 1800; exec @ARGV' --`。

| Worker | 指令 |
|---|---|
| Claude 實作者 | `cd $W/impl-ws && T claude -p "$(cat brief)" --model claude-opus-5-5 --effort high --dangerously-skip-permissions --append-system-prompt "You are a worker. Follow the brief only." --output-format stream-json --verbose > log` |
| Claude 規格編輯 | `cd $W/spec-ws && T claude -p "$(cat brief)" --model claude-opus-5-5 --effort high --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Glob,Grep" --disallowedTools "Bash,WebFetch,WebSearch" --output-format stream-json --verbose > log` |
| Claude 瀏覽器 E2E | `T claude -p "$(cat brief)" --chrome --model claude-sonnet-5-5 --effort high --dangerously-skip-permissions --output-format stream-json --verbose > log`（任務說明裡限定只能開 `http://127.0.0.1:<port>`，而且要開新分頁） |
| Codex 審閱 | `T codex exec -m gpt-6.2-sol -c model_reasoning_effort=high -s read-only -C $W/tests-ws --skip-git-repo-check -o report - < brief` |
| Codex 寫測試 | `T codex exec -m gpt-6.2-astra -c model_reasoning_effort=high -s workspace-write -C $W/tests-ws --skip-git-repo-check -o report - < brief` |
| agy 審閱 | `T agy -p "$(cat brief)" --mode plan --model gemini-4-neon-high > report` |
| agy 驗證／E2E／驗收 | `cd $W/verify-ws && T agy -p "$(cat brief)" --dangerously-skip-permissions --model gemini-4-neon-high > report` |

每個 phase 結束都做一次 git commit，並更新 `PROGRESS.md`。

## E2E 證據規則（使用者決定 E7）

使用者要能確認 agent 真的有跑 E2E，所以每個 E2E 任務都要留證據。證據放 `.orchestra/evidence/<任務 ID>/`，**只留在本機**（已加進 `.gitignore`，不 commit），清理時**不刪**。

**每份 E2E 任務說明都要寫進下面這些要求：**

- **瀏覽器 E2E worker（Claude in Chrome）**
  - 每一項檢查至少截 2 張：操作前一張、結果出現後一張；中間有關鍵狀態變化（例如「連線中斷」→「恢復」）也要截。
  - 截圖一律用 `computer` 的 `screenshot` 加上 `save_to_disk: true`，再用 Bash 把回傳的路徑複製成 `.orchestra/evidence/<任務>/<檢查ID>-<序號>-<說明>.png`（例如 `A1-02-sse-closed.png`）。
  - 整段操作用 `gif_creator` 錄成 GIF（`download: true`），下載後搬到同一個資料夾。
  - 證據資料夾裡要有 `INDEX.md`：每張圖一行，寫檢查 ID、截圖時間、畫面上應該看到什麼。
  - 回報裡每項檢查都要列出對應的截圖檔名。
- **agy（HTTP E2E）**
  - 畫面上看不到的檢查不用截圖，改存原始輸出：curl -N 收到的串流、uvicorn access log、pytest 輸出，每個檔案開頭寫指令和開始時間。
  - 同樣要有 `INDEX.md`，回報裡每項檢查列出對應的檔名。
- 任務說明裡提供的證據資料夾路徑是**絕對路徑**（worker 在外部工作區跑，路徑要指回主 repo 的 `.orchestra/evidence/<任務>/`）。

**協調者稽核：**

- `INDEX.md` 列的每個檔案都要存在，數量對得上檢查項目；缺證據的檢查一律算**沒做**，要重跑。
- 協調者實際打開至少 3 張截圖（或所有失敗項目的截圖），確認畫面內容和回報一致。
- 截圖時間要落在這次 worker 的執行時間內。
- 交付報告裡列出每個 E2E 任務的證據資料夾路徑，讓使用者自己看。

## 檔案清理（使用者要求：確定不需要的就刪）

- **保留**：`briefs/*.md`（任務說明）、`reports/*.md`（worker 的最終回報）、`evidence/`（E2E 截圖和原始輸出，只留本機、不 commit，見「E2E 證據規則」）。
- **事後稽核通過後就刪**：原始執行紀錄（`*.jsonl`、`*.log`、`*.err`）。刪之前先把 `result` 抽出來存成 `reports/<task>.md`。稽核**不通過**時保留紀錄當證據，記進 `PROGRESS.md`，等事情處理完再刪。
- **空檔案**直接刪。
- 工作區的快取（`.mypy_cache`、`.pytest_cache`、`.ruff_cache`、`__pycache__`）不搬回主 repo，用完就刪。
- 主 repo 的 `.gitignore` 要排除上面這些快取和原始紀錄。
