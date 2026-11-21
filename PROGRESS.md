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
| 目前 Phase | **5 驗收與交付** 🔵（Phase 4 ✅） |
| 規格版本 | 主 repo 是 `docs/SPEC.md` **v1.1.3**（合約 1.1.2）、`contracts/domain.pyi`、`contracts/openapi.yaml`（impl-ws、tests-ws、browser-ws 同步）；v1.0 決策紀錄在 `docs/plans/spec_v1_plan.md`。v0.2／v0.3 全部作廢 |
| 阻塞中 | 無 |
| 下一步 | 等 T5.4 → 稽核（只改 `docs/SPEC.md`、只用 Read/Edit/Glob/Grep、無外部路徑、diff 只有 R27＋標題＋附錄）→ 搬回主 repo，同步各工作區 → T5.3 交付報告定稿 → 結案 |

## Phase 總覽

| Phase | 名稱 | 狀態 | 關卡 |
|---|---|---|---|
| 0 | 準備 | ✅ 完成 | — |
| 0.5 | Agent 環境搭建（角色、隔離、合約機制、權限、模型） | ✅ 完成（使用者決定不跑冒煙測試） | — |
| 0.6 | Python／FastAPI 環境 | ✅ 完成（`667f7b2`） | 環境驗證通過 |
| 1 | 規格 | ✅ 完成（v1.0 定案，D1／D11） | **使用者核准** |
| 2 | 同時開發（實作 ‖ 測試） | ✅ 完成（合約檢查 T2.5r PASS） | — |
| 3 | 驗證測試、處理失敗 | ✅ 完成（T3 第 2 輪 PASS） | 測試全部通過 |
| 4 | AI 自己跑 E2E | 🔵 進行中 | E2E 全部通過 |
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
| T2.0 | 2 | 同步 SPEC 到 `tests-ws`、`impl-ws` | 協調者 | ✅ | `docs/SPEC.md` | — | 只搬檔案；兩邊都拿到 SPEC、contracts、SVG、AGENTS.md；`docs/plans/` 不給 |
| T2.1a | 2 | 實作後端：domain、SQLite、HTTP API、SSE（R1–R25、R28、R29） | Claude 實作者（opus-5-5／high） | ✅ | `briefs/p2-claude-impl-backend.md` | `reports/p2-impl-backend.md` | 稽核通過；34 輪、$2.77、10 分鐘；品質關卡＋stubtest 通過；回報 2 個 CONFLICT、3 個 GAP，等 T2.2 回來一起交給使用者 |
| T2.1b | 2 | 實作前端頁面（R26、R27） | Claude 實作者（opus-5-5／high） | ✅ | `briefs/p2-claude-impl-frontend.md` | `reports/p2-impl-frontend.md` | 稽核通過；25 輪、$1.62、6.5 分鐘；品質關卡通過；回報 5 個前端 GAP；「DevTools 離線 5 秒」headless 驗不到，留給 T4.4 |
| T2.2 | 2 | 寫單元、整合、E2E、效能測試 | Codex（gpt-6.2-astra／high） | ✅ | `briefs/p2-codex-tests.md` | `tests-ws/tests/`；`reports/p2-codex-tests.md` | 稽核通過；約 28 分鐘；54 個測試節點（47 一般、6 e2e、1 perf）；三項離線檢查通過；回報 3 個 CONFLICT、3 個 GAP；R27/R28/AC12 未涵蓋（留給瀏覽器驗收與 T2.5） |
| T2.3 | 2 | SPEC v1.0 → v1.1：寫入使用者對 A1–C5 的決定 | Claude 規格編輯（opus-5-5／high） | ✅ | `briefs/p2-claude-spec-v11.md` | `docs/SPEC.md`、`contracts/`、`AGENTS.md`；`reports/p2-spec-v11.md` | 稽核通過（只用 Read/Edit、只改 4 個檔、無外部路徑）；約 3 分鐘；diff 逐項符合 brief。已搬回主 repo 並同步 impl-ws／tests-ws。worker 另報 4 個未修缺陷（R10 task 與 stage 配對、run_started 內容不符、執行順序、R20 與 A4 的 /stats），待使用者決定 |
| T2.3b | 2 | SPEC v1.1 → v1.1.1：寫入使用者對 D1–D4 的決定 | Claude 規格編輯（opus-5-5／high） | ✅ | `briefs/p2-claude-spec-v111.md` | `docs/SPEC.md`、`contracts/`；`reports/p2-spec-v111.md` | 稽核通過（只用 Read/Grep/Edit、只改 3 個檔、無外部路徑）；diff 符合 D1–D4；已搬回主 repo 並同步。worker 另提：R10 沒規定 `run_finished.result` 要和節點狀態一致（未列入「不需要」）→ 暫不處理，T2.5 若出現測試與實作衝突再交使用者 |
| T2.4 | 2 | Codex 依 v1.1.1 對齊測試（A1–C5、D1–D4） | Codex（gpt-6.2-astra／high） | ✅ | `briefs/p2-codex-align.md` | `tests-ws/tests/`；`reports/p2-codex-align.md` | 稽核通過（只改 `tests/` 下 6 個檔、合約與設定 shasum 不變、無 `app/`、紀錄無外部路徑、回報無原始碼）；約 14 分鐘；74 個節點（67 一般、6 e2e、1 perf），新增 20 個、無移除；三項離線檢查通過。CONFLICT 1：R18 規定已結束輪次游標超前回 `204`，openapi `reset.when` 措辭少了「輪次執行中」限定；測試照 SPEC。GAP 0 |
| T2.5 | 2 | 合約檢查：stubtest、`app.openapi()` 對 `openapi.yaml`、測試 import 範圍 | agy（gemini-4-neon-high） | ✅ | `briefs/p2-agy-contract.md` | `verify-ws`；`reports/p2-agy-contract.md` | 稽核通過（verify-ws 對 baseline 無變更、`.t25-tmp/` 已刪、紀錄只出現 agy 自己的 `~/.gemini` 設定、回報無測試原始碼）。stubtest ✅、測試 import 範圍 ✅（只用 `create_app` 與 pyi 名稱）、收集 74 個節點 ✅。FAIL 9 項：8 項 impl（`info.version` 1.0.0、`last_event_id` 殘留 `pattern`、`/health` schema、多個 `minimum`／`minLength`／`format: date-time` 缺漏）→ T2.6；1 項 yaml（`reset.when` 措辭和 R18 不符；實作行為照 R18：已結束且 n ≥ L 回 204）→ 待使用者 E1。另：AGENTS.md §4 允許 `/health` 回裸 dict，和合約衝突 → 待使用者 E2。agy 的 `--mode auto` 這個帳號不能用，實際以預設模式＋`--sandbox` 執行 |
| T2.6 | 2 | 修 8 項 OpenAPI schema 偏差（只改 schema 標註，不改行為） | Claude 實作者（opus-5-5／high） | ✅ | `briefs/p2-claude-impl-contract-fix.md` | `impl-ws/app/`；`reports/p2-impl-contract-fix.md` | 權限收窄：acceptEdits＋Read/Edit/Write/Glob/Grep＋`Bash(uv:*)`。第一次跑到一半撞上用量上限（result 是上限訊息），用 `--resume` 同一 session 補完驗證和回報。稽核通過：只改 4 個檔（main.py、routers/install.py、routers/system.py、schemas.py），非 app 檔不變，紀錄無外部路徑；8 項全修，app/ 的 ruff／mypy／stubtest 通過，行為不變。已搬回主 repo。另報：全專案 ruff 在 `contracts/domain.pyi` 失敗（UP040×5＋格式）→ E3 |
| T2.7 | 2 | SPEC v1.1.1 → v1.1.2：寫入使用者對 E1–E3 的決定 | Claude 規格編輯（opus-5-5／high） | ✅ | `briefs/p2-claude-spec-v112.md` | `docs/SPEC.md`、`contracts/`、`AGENTS.md`；`reports/p2-spec-v112.md` | E1 `reset.when` 對齊 R18；E2 刪 AGENTS §4 的 `/health` 例外；E3 `domain.pyi` 五個別名加 `# noqa: UP040`＋理由、JsonValue 改單行。稽核通過（只用 Read/Grep/Glob/Edit、只改 4 個檔、無外部路徑），diff 符合 E1–E3。協調者發現 brief 本身有缺陷：pragma 理由用全形括號會觸發 RUF003 → resume 同一 session 改成半形 `(B1)`。已搬回主 repo 並同步 impl-ws、tests-ws（覆蓋前確認仍是 v1.1.1）。worker 另提：R18 表格第一列「`r ≠ R`，或 `n > L`，且這一輪還在執行」斷句有歧義，但下一列使行為唯一，不是真衝突 → 不處理 |
| T2.8 | 2 | 實作跟上 v1.1.2：`info.version` 1.1.2，並跑全專案品質關卡（首次驗 E3） | Claude 實作者（opus-5-5／high） | ✅ | `briefs/p2-claude-impl-v112.md` | `impl-ws/app/`；`reports/p2-impl-v112.md` | 稽核通過：只改 `app/main.py:31`（version 1.1.2）、非 app 檔不變、無外部路徑。全專案 ruff format／check、mypy、stubtest 全過（E3 實測有效）。已搬回主 repo |
| T2.5r | 2 | 重跑合約檢查（v1.1.2）＋全專案品質關卡 | agy（gemini-4-neon-high） | ✅ | `briefs/p2-agy-contract-r2.md` | `verify-ws`；`reports/p2-agy-contract-r2.md` | `CONTRACT CHECK: PASS`，0 偏差、無 GAP／CONFLICT。stubtest 過；OpenAPI 逐項只剩 artefact；E1 文字與 R18 一致；tests 只匯入 `create_app` 和 `domain.pyi` 的名稱、無 SQLite；收集 74（67＋6 e2e＋1 perf）；ruff format／check、mypy 全過。稽核通過：verify-ws 對 baseline 乾淨、無 install.db、log 無外部路徑、主 repo 無新檔 |
| T3.1 | 3 | 審查測試：涵蓋對照表、隨機失敗、空測試 | agy | ✅ | `briefs/p3-agy-verify.md`（T3.1–T3.3 合併一次跑） | `reports/p3-agy-verify.md` | D 部分：無空測試；涵蓋缺口 R14（非 log 事件不等待）、R15（執行中省略 until）、R19（reset 回應標頭）、R25（無 running task 的復原）、R26（textContent／addEventListener／close）；7 個時序敏感節點 → T3.6 |
| T3.2 | 3 | 故意改壞程式，看測試會不會失敗 | agy | ✅ | 同上 | 同上 | C 部分：10 個突變（R9、R10、R14、R15、R16、R18、R20、R22、R23、R25）全部被抓到，10/10 |
| T3.3 | 3 | 跑全部測試，判斷失敗出在哪 | agy | ✅ | 同上 | 同上（之後重跑存 `reports/p3-agy-run-N.md`） | `T3: FAIL`：71/73 通過，3 次結果一致（無 flaky），約 29 秒。2 個 IMPL BUG，都是 R10 第 9 項（`run_started` data 缺欄位／型別錯沒拋錯；`log` 的 `ts` 沒驗）→ T3.5。0 TEST BUG、0 歧義。稽核通過：verify-ws 乾淨、無 install.db、log 無外部路徑、報告無原始碼、主 repo 無新檔 |
| T3.4 | 3 | 把失敗分給對的人（最多 3 輪） | 協調者 | ✅ | T3.3 | 退回 T2.1／T2.2，或問使用者 | 看「重試計數」 |
| T3.5 | 3 | 修 R10 第 9 項：`apply_event` 依 R8 檢查所有事件 data 的欄位與型別 | Claude 實作者（opus-5-5／high） | ✅ | `briefs/p3-claude-impl-r10-data.md` | `impl-ws/app/`；`reports/p3-impl-r10-data.md` | 只給行為描述。稽核通過：只改 `app/domain.py`（新增依 R8 的欄位表＋`_validate_data`），非 app 檔不變、紀錄無外部路徑、無殘留暫存檔／install.db。9 種事件全驗、int 不收 bool、enum 限值；額外欄位維持忽略；R10「不需要」項目不動。ruff／mypy／stubtest 過；自我檢查 894 筆劇本事件 0 拋錯、147 個反例全拋、7 情境實跑與 R25 復原正常。worker 跑了幾個唯讀 `sed`／`cat`／`ls`（在 impl-ws 內，`Bash(uv:*)` 沒擋到，無害）。已搬回主 repo |
| T3.6 | 3 | 補涵蓋缺口、讓時序敏感的測試在慢機器上也穩定 | Codex（gpt-6.2-astra／high） | ✅ | `briefs/p3-codex-gaps.md` | `tests-ws/tests/`；`reports/p3-codex-gaps.md` | 稽核通過：只改 tests（test_http／test_stream／test_e2e，新增 page_script.py），其他檔不變、紀錄無外部路徑、報告無原始碼（協調者沒讀 log）。新增 `test_r14_nonlog_timing`、`test_r15_midrun_default_until`；reset 回應加驗 R19 標頭；`test_r26_html` 加 textContent／innerHTML／addEventListener／close 靜態檢查；R25 無 running task 的中斷點無法用公開介面固定 → 不可確定性測試。7 個時序節點改成「先確認前提、錯過就重建（最多 3 輪）」或放寬自選間隔，SPEC 上限不變。節點 76（69＋6 e2e＋1 perf），預設 75，估約 54 秒。刪除 Codex 在系統暫存區的 `t36-uv.*` 快取 |
| T3r2 | 3 | T3 第 2 輪：重跑＋審查新測試＋目標突變 | agy（gemini-4-neon-high） | ✅ | `briefs/p3-agy-verify-r2.md` | `reports/p3-agy-run-2.md` | `T3: PASS`：75/75 ×3（53／51／51 秒），無 flaky；新／改測試都判定只斷言 SPEC 要求且會失敗；7 個目標突變（R10#9、R14、R15、R19、R26、R20、R23）全殺。殘留小缺口（記錄、不再派）：R26 靜態正向檢查遇方括號索引會退讓（交 T4.4 瀏覽器）、R14 執行中跨 task 的 log↔task 事件間隔、R3 傳入 `bool`、R15 `after > until > 0`、R18 header 路徑的執行中 `n > L`、OpenAPI 全端點比對不在測試內（T2.5r 已人工比對）。稽核通過 |
| T4.1 | 4 | 對真的 uvicorn 跑自動化 E2E | agy | ✅ | `briefs/p4-agy-e2e.md`（T4.1–T4.3 合併）；全新的 `verify-ws` | `reports/p4-agy-e2e.md` | `T4: PASS`：6 個 e2e ×3 全過（約 16 秒）。稽核通過：verify-ws 乾淨、無 install.db、沒有殘留 uvicorn／18xxx 埠、log 無外部路徑、報告無原始碼、主 repo 無新檔 |
| T4.2 | 4 | 探索式 E2E：curl -N、多個客戶端、斷線重連、關機 | agy | ✅ | 同上 | 同上 | 10 項全 OK（附實際 header／SSE 行）：端點與 422／409、3 個 curl -N 並行（202 筆連續、/stats 1→2→3→0、gzip 下不壓縮）、header 與 query（含空白）重連無缺漏重複、R18 全部分支（協調者對照 R18 原文確認含「header 不合法視同沒帶」）、10 個並行 POST 恰 1 個 202、ping 間隔 0.5 秒、斷線 0.002 秒退訂、SIGINT／SIGTERM 0.25 秒退出並復原 E_INTERRUPTED、SIGKILL 復原且 run_id 遞增、logs 分頁串接 168 筆完全相符。R23 在 macOS loopback 因核心送出緩衝 128 KiB > 整輪 38 KiB 無法以真 TCP 觸發（AC10 已用 ASGI 涵蓋），正常客戶端不受影響 |
| T4.4 | 4 | 真瀏覽器 E2E（R26／R27） | Claude 瀏覽器 worker（`--chrome`） | ✅ | `briefs/p4-claude-browser.md`；`browser-ws`（主 repo HEAD 去掉協調者檔案，沒有 tests），伺服器由 worker 自己啟動 | `reports/p4-claude-browser.md` | D8 `T4.4: PASS`（0 偏差）：載入、安裝畫面（200 ms 取樣：跟隨／展開／捲動／收合全對）、點開收合 task 0 請求、失敗紅色與 message／hint、C2、C3、中途加入與第二分頁 168 行逐行相符、執行中重整、409、伺服器停止與 E_INTERRUPTED 復原、C1 都 OK。未完成：C4 的 `CLOSED` 分支沒觸發（伺服器停止時靠 EventSource 自動重連復原，沒有重跑同步流程）；R26 文字安全只做靜態檢查（mock 用 `python3` 被權限擋下，沒執行）→ T4.4b。稽核通過：只開 127.0.0.1:18510、自己開的 2 個分頁都關了（extension 群組自動建的空白 New Tab 留著）、伺服器已停、browser-ws 只多 `__pycache__`（已刪）、紀錄無外部路徑 |
| T4.4b | 4 | 瀏覽器補驗：C4 三種錯誤路徑、R26 文字安全實際觀察 | Claude 瀏覽器 worker（sonnet-5-5／high，`--chrome`） | ✅ | `briefs/p4-claude-browser-b.md` | `browser-ws`；`reports/p4-claude-browser-b.md` | mock 改用 `uv run python`，不加權限 `T4.4b: PASS`：A1（伺服器換空 DB → events 404 → CLOSED）顯示「SSE 連線已關閉，3 秒後重試」，3.0 秒後重跑同步，結果正確；A2（用故障注入 proxy 讓 `GET /install` 斷線）每 3.0 秒重試、移除故障後自行復原；B（mock 在所有字串欄位放 `<b>`／`<img onerror>`）全部原樣顯示、0 個 b/img 元素、title 沒被改。A3（串流中停伺服器再用同 DB 重啟）：顯示「連線中斷，瀏覽器重新連線中…」，不重跑同步流程，靠 EventSource 自動重連（`last_event_id=2.4` → 200）補齊並正確結束 → 是否符合 R27「網路錯誤 → 3 秒後重跑同步流程」屬 SPEC 歧義，交使用者（E4）。稽核通過：只連 127.0.0.1:18500–18502、分頁與 extension 自建的空白分頁都關了、伺服器已停、browser-ws 不變、紀錄無外部路徑 |
| T4.5 | 4 | SPEC v1.1.2 → v1.1.3：寫入 E4（R27 串流中斷靠 EventSource 自動重連，不必重跑同步流程） | Claude 規格編輯（opus-5-5／high） | ✅ | `briefs/p4-claude-spec-v113.md` | `docs/SPEC.md`；`reports/p4-spec-v113.md` | 稽核通過：只用 Read/Edit/Grep、只改 `docs/SPEC.md`（diff 只有標題、R27 一句、附錄版本列＋變更明細表）、無外部路徑。合約維持 1.1.2。已搬回主 repo（覆蓋前確認仍是 v1.1.2）並同步 impl-ws、tests-ws、browser-ws。worker 另提兩個非阻塞歧義 → E5、E6 |
| T4.3 | 4 | 效能驗收（AC11，`-m perf`） | agy | ✅ | 同上 | 同上 | perf ×3 全過（各約 1.5 秒；測試不印 p95） |
| T5.1 | 5 | 從 clean clone 開始，uv sync 之後跑全部測試 | agy（gemini-4-neon-high） | ✅ | `briefs/p5-agy-acceptance.md`；全新 `verify-ws`（主 repo 45fd779＋tests-ws/tests） | `reports/p5-agy-acceptance.md` | `T5.1: ACCEPT`。`uv sync --locked` 不改 lock（Python 3.13.9）；AC12 五指令全過；預設 75 passed ×3（約 51 秒，無 flaky）；perf ×3 全過；AC1–AC12 皆有對應節點；R27 v1.1.3 (a)(b)(c) 皆 OK；版本標示一致；`app/` 5 處 `# noqa: RUF001` 皆附理由。稽核通過：verify-ws 對 baseline 無變更、無 install.db、log 無外部路徑、主 repo 只多報告、無殘留 uvicorn |
| T5.2 | 5 | 把 `tests/` 合併進主 repo，並 commit | 協調者 | ✅ | T5.1 通過 | commit | 只搬檔案、不讀內容；`diff -rq` 確認主 repo `tests/` 與通過驗收的 verify-ws/tests、tests-ws/tests 完全相同（排除 `__pycache__`） |
| T5.3 | 5 | 交付報告給使用者 | 協調者 | 🔵 | 全部 | — | 附上 E2E 和驗收的證據；附 E5／E6 給使用者決定 |
| T5.4 | 5 | SPEC v1.1.3 → v1.1.4：寫入 E5（重連成功後恢復狀態）、E6（`GET /install` 的 404 不算錯誤） | Claude 規格編輯（opus-5-5／high） | 🔵 | `briefs/p5-claude-spec-v114.md` | `docs/SPEC.md`；`reports/p5-spec-v114.md` | 只改文件、合約維持 1.1.2；行為已由 T5.1 E 節靜態確認，不重跑驗收 |

## 重試計數（每個問題最多 3 輪，超過就交給使用者）

| 問題 | 輪數 | 最後處理 |
|---|---|---|
| R10 第 9 項 data 驗證（IMPL） | 1 | ✅ T3 第 2 輪確認已修 |
| T3 涵蓋缺口＋時序（TEST） | 1 | ✅ T3 第 2 輪確認 |

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
| E1–E3 | 合約檢查 T2.5 後續：E1 `reset.when` 對齊 R18、E2 刪 `/health` 例外、E3 `domain.pyi` 用 noqa → SPEC v1.1.2 | ✅ 2026-11-21 |
| E4 | R27 串流中斷時頁面靠 EventSource 自動重連、不重跑同步流程 → **算符合，並在 R27 補一句（SPEC v1.1.3）** | ✅ 2026-11-21 |
| E5 | R27：EventSource 自動重連成功後，`#run-status` 要不要清掉錯誤、改回「執行中」，SPEC 沒寫（T5.1 靜態確認：實作在 `open` 時恢復顯示輪次狀態，只是 SPEC 沒要求） | ✅ 2026-11-21 補進 SPEC（v1.1.4，只改文件） |
| E6 | R27：「錯誤與重試」字面上的「`409` 以外的錯誤」包含 `GET /install` 的 `404`，但「載入時」把 `404` 定義為「只顯示計畫」，字面互相衝突（實作與瀏覽器觀察都照「載入時」走） | ✅ 2026-11-21 寫明 404 不算錯誤（v1.1.4，只改文件） |

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
| 2026-11-20 23:30 | 使用者核准 Phase 2 派工計畫（T2.1 拆成後端／前端；`docs/plans/` 不給 worker；SPEC 標題小瑕疵留待下次補合約時修）。開始 T2.0 |
| 2026-11-20 23:35 | T2.0 完成；寫好 `briefs/p2-claude-impl-backend.md`、`p2-claude-impl-frontend.md`、`p2-codex-tests.md`；`tests-ws` 先做了 `uv sync --frozen`（Codex 沙盒不能連網）；同時在背景分派 T2.1a（Claude opus-5-5／high）與 T2.2（Codex gpt-6.2-astra／high） |
| 2026-11-20 23:46 | T2.1a 回報 success；稽核通過（紀錄裡的 `.orchestra` 只是工作區 `.gitignore` 的內容）；刪除原始紀錄和快取；派 T2.1b（背景） |
| 2026-11-20 23:49 | T2.1b 回報 success；稽核通過（只寫了 `app/routers/page.py`、`app/static/index.html`，並在 `main.py` 掛上 router）；刪除原始紀錄和快取；確認 `app/` 以外的檔案都沒被改；`impl-ws/app/` 搬回主 repo |
| 2026-11-20 23:52 | T2.2 回報 success（exit 0）；稽核通過：紀錄沒出現其他工作區或主 repo 路徑，只新增 `tests/` 下 13 個檔，合約與設定檔和主 repo 完全相同，沒有 `app/`；刪除原始紀錄；協調者只讀回報、沒讀測試原始碼 |
| 2026-11-20 約 23:54 | 合併決策清單交給使用者：A1–A4、B1–B6、C2–C5 全照建議；C1 維持現狀。寫 `briefs/p2-claude-spec-v11.md`，spec-ws 放入 SPEC、contracts、AGENTS.md，背景派 T2.3 |
| 2026-11-20 23:59 | T2.3 完成並稽核通過；結果存為 `reports/p2-spec-v11.md`，刪除 jsonl/err。v1.1 的 SPEC、contracts、AGENTS.md 搬回主 repo，並同步到 impl-ws、tests-ws（覆蓋前先確認它們仍是 v1.0）。worker 回報 4 個未修缺陷，交使用者決定 |
| 2026-11-21 約 00:00 | 使用者對 4 個缺陷全照建議（D1 拋錯；D2、D3 不要求；D4 R20 補一句）。寫 `briefs/p2-claude-spec-v111.md`，背景派 T2.3b |
| 2026-11-21 00:02 | T2.3b 完成並稽核通過，存 `reports/p2-spec-v111.md`，刪 jsonl/err；v1.1.1 搬回主 repo 並同步 impl-ws、tests-ws。寫 `briefs/p2-codex-align.md`，背景派 T2.4 |
| 2026-11-21 00:17 | T2.4 完成並稽核通過，存 `reports/p2-codex-align.md`；刪除原始紀錄、Codex 在 /private/tmp 留下的 uv／ruff 快取、tests-ws 的 `__pycache__`。修正日誌時間：23:49 起原本是估計值、跑在實際時間前面，已改成對照 commit 時間 |
| 2026-11-21 00:22 | 寫 `briefs/p2-agy-contract.md`。組 verify-ws：主 repo `3229abf` clone，移除 `.orchestra/`、`CLAUDE.md`、`PROGRESS.md`、`ORCHESTRATION.md`、`docs/plans/`（比照 impl-ws），重建 git 只留一個 baseline commit `dc386e4`（避免歷史洩漏實作與測試報告），加入 tests-ws/tests（diff 相同；SPEC/contracts/AGENTS/pyproject 和 tests-ws 一致）。`--dangerously-skip-permissions` 被 auto mode 擋下，改用 ORCHESTRATION 寫的 `--sandbox` 加 `--mode auto`，背景派 T2.5 |
| 2026-11-21 00:27 | T2.5 完成並稽核通過，存 `reports/p2-agy-contract.md`；刪除 log/err 和 verify-ws 的 `.mypy_cache`、`.venv`。8 項 impl 偏差依 AGENTS.md「衝突時以合約為準」直接退回實作者，寫 `briefs/p2-claude-impl-contract-fix.md`，背景派 T2.6。E1（`reset.when`）、E2（AGENTS §4 `/health`）屬規格／規範修改，交使用者決定 |
| 2026-11-21 08:45 | T2.6 完成（撞上限後 resume），稽核通過，4 個檔搬回主 repo；刪除 jsonl/err、impl-ws 的 `.mypy_cache`／`.ruff_cache`／`__pycache__`。使用者決定：E1 對齊 R18、E2 刪例外、E3 在 domain.pyi 用 noqa；`install.db` 刪除（之後每次 agy 跑完檢查主 repo 新檔）。寫 `briefs/p2-claude-spec-v112.md`，背景派 T2.7 |
| 2026-11-21 08:47 | T2.7 完成並稽核通過；resume 一次修正 pragma 括號；存 `reports/p2-spec-v112.md`（含追加修正），刪 jsonl/err。v1.1.2 搬回主 repo 並同步 impl-ws、tests-ws。寫 `briefs/p2-claude-impl-v112.md`，背景派 T2.8 |
| 2026-11-21 08:48 | T2.8 完成並稽核通過，`app/main.py` 搬回主 repo；刪 jsonl/err、impl-ws 快取 |
| 2026-11-21 08:56 | T2.5r 完成：`CONTRACT CHECK: PASS`（0 偏差）。稽核通過，主 repo 無新檔；存 `reports/p2-agy-contract-r2.md`，刪 log/err。Phase 2 結束。寫 `briefs/p3-agy-verify.md`（T3.1–T3.3 合併），重組 verify-ws、快照主 repo，背景派 T3 |
| 2026-11-21 09:12 | T3 完成並稽核通過（`T3: FAIL`，71/73，2 個 IMPL BUG 同屬 R10 第 9 項；突變 10/10；無 flaky）。存 `reports/p3-agy-verify.md`，刪 log/err 和 verify-ws 的 `.venv`／`.pytest_cache`。涵蓋缺口與時序風險比照 TEST BUG 交給 Codex。寫 `briefs/p3-claude-impl-r10-data.md`、`briefs/p3-codex-gaps.md`，快照 impl-ws／tests-ws，背景並行派 T3.5、T3.6 |
| 2026-11-21 09:15 | T3.5 完成並稽核通過，`app/domain.py` 搬回主 repo（先確認主 repo 仍是修改前版本）；存 `reports/p3-impl-r10-data.md`，刪 jsonl/err、impl-ws 快取。等 T3.6 |
| 2026-11-21 09:31 | T3.6 完成並稽核通過，存 `reports/p3-codex-gaps.md`；刪 log、tests-ws 快取、Codex 的 uv 暫存快取。tests 先留在 tests-ws（T5.2 才併入主 repo）。寫 `briefs/p3-agy-verify-r2.md`，以主 repo HEAD＋tests-ws/tests 重組 verify-ws，快照主 repo，背景派 T3 第 2 輪 |
| 2026-11-21 09:49 | T3 第 2 輪完成並稽核通過：`T3: PASS`。存 `reports/p3-agy-run-2.md`，刪 log/err、verify-ws 快取。Phase 3 結束；殘留小缺口記在 T3r2 列，不再派。寫 `briefs/p4-agy-e2e.md`（T4.1–T4.3 合併，T4.4 之後再跑以免影響效能量測），重組 verify-ws、快照主 repo，背景派 T4 |
| 2026-11-21 10:00 | T4 完成並稽核通過：`T4: PASS`（e2e ×3、探索 10 項、perf ×3）。存 `reports/p4-agy-e2e.md`，刪 log/err、verify-ws 快取。寫 `briefs/p4-claude-browser.md`，建 browser-ws，背景派 T4.4（使用者的 Chrome 開一個新分頁，只連 127.0.0.1:185xx） |
| 2026-11-21 10:12 | T4.4 完成並稽核通過（`T4.4: PASS`），存 `reports/p4-claude-browser.md`，刪 jsonl/err、browser-ws 的 `__pycache__`。C4 `CLOSED` 分支與 R26 實際觀察未完成 → 寫 `briefs/p4-claude-browser-b.md`，背景派 T4.4b |
| 2026-11-21 10:17 | T4.4b 完成並稽核通過（`T4.4b: PASS`），存 `reports/p4-claude-browser-b.md`，刪 jsonl/err。A3 的行為與 R27 字面可能有出入，屬 SPEC AMBIGUOUS，交使用者決定 E4 |
| 2026-11-21 20:02 | 使用者決定 E4：算符合，並在 R27 補一句（SPEC v1.1.3）。協調者判斷合約不受影響、維持 1.1.2（實作的 `info.version` 不用動）。寫 `briefs/p4-claude-spec-v113.md`，快照 spec-ws，背景派 T4.5 |
| 2026-11-21 20:06 | T4.5 完成並稽核通過，存 `reports/p4-spec-v113.md`，刪 jsonl/err。v1.1.3 搬回主 repo，同步 impl-ws、tests-ws、browser-ws。Phase 4 結束。記下 E5、E6（非阻塞，交付時問使用者）。下一步 T5.1 |
| 2026-11-21 20:06 | 寫 `briefs/p5-agy-acceptance.md`；以主 repo 45fd779＋tests-ws/tests 重組 verify-ws，快照主 repo，背景派 T5.1 |
| 2026-11-21 20:16 | T5.1 `ACCEPT`，稽核通過，存 `reports/p5-agy-acceptance.md`；刪 log/err、verify-ws 快取。T5.2：tests 併入主 repo（diff -rq 相同、未讀內容）並 commit。下一步 T5.3 |
| 2026-11-21 20:18 | 交付時問使用者 E5／E6：兩項都選補進 SPEC。寫 `briefs/p5-claude-spec-v114.md`，快照 spec-ws，背景派 T5.4 |
