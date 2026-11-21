已完成 [安裝進度即時串流技術文件](docs/technical.html)。全文共 11 節、8 張內嵌 SVG，可離線開啟。除技術文件與驗證證據外，既有專案檔案均未修改。

### 章節、圖表與依據

| 章節 | 圖表或內容 | 圖的主要來源 |
|---|---|---|
| 1. 專案在做什麼 | 七種模擬情境與各自的失敗位置 | — |
| 2. 系統架構 | 圖 1：從瀏覽器啟動安裝，再由 SQLite 歷史與即時佇列接回 SSE | `app/main.py`、`app/routers/`、`app/runtime.py`、`app/store.py`、`app/broker.py`、`app/sse.py`、`frontend/src/index.html` |
| 3. 模組說明 | 後端、路由、前端來源及建置產物的責任、入口與呼叫者 | — |
| 4. 資料模型與狀態機 | 圖 2：輪次、階段與工作的起始及終止狀態 | `docs/SPEC.md` R10、`contracts/domain.pyi`、`app/domain.py` |
| 5. SSE 在這個專案的應用 | 圖 3：從 `POST /install`、快照與日誌補讀，到 `run_finished` 的時序；附實際編碼的事件範例 | `contracts/openapi.yaml`、`app/routers/install.py`、`app/runtime.py`、`app/store.py`、`app/broker.py`、`app/sse.py`、`frontend/src/index.html` |
| 6. 正常流程 | 依序號拆解成功輪次的 202 筆事件，對照圖 3 | `app/domain.py`、`docs/SPEC.md` R4、R6 |
| 7. 失敗流程 | 圖 4：從磁碟不足的第 24 行錯誤日誌，到工作、階段與整輪失敗 | `app/domain.py`、`frontend/src/index.html`、`docs/SPEC.md` R5–R6、R27 |
| 8. 重試與恢復流程 | 圖 5：網路斷線與瀏覽器重連 | `frontend/src/index.html`、`app/routers/install.py`、`app/sse.py` |
| 同上 | 圖 6：伺服器重啟後，以 `E_INTERRUPTED` 收尾 | `app/main.py`、`app/runtime.py`、`app/store.py` |
| 同上 | 圖 7：重新安裝，或因已有安裝執行中而回 `409` | `app/store.py`、`app/routers/install.py`、`frontend/src/index.html` |
| 同上 | 圖 8：首次載入失敗、同步失敗、立即重同步與空資料庫的不同處理 | `frontend/src/index.html`、`docs/SPEC.md` R13、R15、R18、R27 |
| 9. 前端 | 自動跟隨、手動選取、工作展開與收合、單檔建置 | — |
| 10. 測試與驗證 | 五類測試、需求編號及五道關卡 | — |
| 11. 經驗分享與設計取捨 | 六項取捨，涵蓋快照邊界、事件 ID、SQLite、去重、慢速訂閱者與代理緩衝 | — |

### 截圖與離線檢查

已用無頭 Chrome 開啟本機 HTML，檢視八張圖並修正手機目錄的文字間距。390 像素視窗的文件寬度實測也是 390 像素，寬圖表可在各自容器內捲動。

[桌面淺色截圖](.t7-evidence/T7.1/tech-1280.png) · [手機淺色截圖](.t7-evidence/T7.1/tech-390.png) · [桌面深色截圖](.t7-evidence/T7.1/tech-1280-dark.png) · [證據索引](.t7-evidence/T7.1/INDEX.md)

指定的 `grep` 共命中 8 行：92、177、237、294、336、359、385、407。每行對應一張 SVG，包含 `xmlns` 命名空間與 `url(#tip1)` 至 `url(#tip8)` 的圖內箭頭參照。瀏覽器實測外部資源請求為零。

### 五道關卡

| 指令 | 實際輸出摘要 |
|---|---|
| `uv sync` | `Attempted to create a NULL object.`，`uv` 在初始化 macOS 系統組態時中止 |
| `uv run ruff format --check .` | `31 files already formatted` |
| `uv run ruff check .` | `All checks passed!` |
| `uv run mypy` | `Success: no issues found in 12 source files` |
| `uv run pytest` | `6 failed, 69 passed, 1 deselected in 35.56s` |

後四項使用既有專案環境的暫存副本，以 `UV_NO_SYNC=1` 執行。六項失敗都是端對端測試，均在 `tests/server.py:36` 綁定本機 TCP 埠時收到 `PermissionError`，因此這次無法驗證真正的 TCP 行為。被排除的一項是預設不執行的效能測試。[完整關卡與 grep 輸出](.t7-evidence/T7.1/checks.txt)

### 規格與實作的疑點

- **失敗工作的展開狀態。** R27 寫「保持展開」。頁面收到 `task_failed` 時確實會展開，但使用者之後仍可點標題手動收合。
- **訂閱數的短暫差異。** R16、R20 規定 `404`、`204`、`reset` 不計入 `/stats`。實作先登記訂閱，再非同步讀取資料庫決定回應，並行查詢可能短暫看到尚待判斷的連線。
- **錯誤欄位數。** AC5 寫 `task_failed.data` 有四個字串欄位；R8 與 OpenAPI 實際列出五個。文件依合約列出 `stage_id`、`task_id`、`error_code`、`message`、`hint`。
- **版本與交叉連結。** `README.md` 仍標示規格 v1.0，本文採用 `docs/SPEC.md` v1.1.4。頁首已放入 `ai-agents.html` 的相對連結，目前工作副本尚無該檔。