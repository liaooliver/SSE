T7.3: 0 must-fix, 4 should-fix, 5 nit

## 檢視問題清單

1. **[SHOULD]** **位置**：系統架構／圖 1（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L91-L133)）
   - **問題**：圖 1 左上方方塊寫「`瀏覽器頁面｜選情境、啟動、同步`」、中上方方塊寫「`FastAPI 路由｜page · install · system`」，但 `FastAPI 路由` 僅有一條「啟動」箭頭連往 `Runtime`，未畫出「同步」（快照與日誌補讀）讀取 `SQLite / Store` 以及 `system` 路由讀取 `Broker` 的資料流，也沒畫回傳方向。
   - **正確事實**：`GET /install`（快照）與 `GET /install/logs`（分頁補讀）直接經 `runtime.store` 讀取 SQLite（[install.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/install.py#L97-L103)、[install.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/install.py#L126-L141)）；`GET /stats` 直接讀取 `runtime.broker.count`（[system.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/system.py#L11-L14)）。
   - **建議修改**：在圖 1 補上 `FastAPI 路由` 與 `SQLite / Store` 之間的「快照／補讀」路徑（以及 `HTTP` 雙向或回傳箭頭），並視版面決定是否簡註 `GET /stats` 讀取 `Broker` 計數，使圖面與方塊副標一致。

2. **[SHOULD]** **位置**：重試與恢復流程 → 使用者按下安裝，建立新的一輪／圖 7（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L394-L395)）
   - **問題**：圖 7 右下節點副標寫「`較大 run_id；從 seq = 1 同步`」。此說法容易誤導讀者以為頁面收到 `202` 後直接從 `seq = 1`（例如 `?last_event_id=R.1`）開流。
   - **正確事實**：後端寫入 `run_started`（`seq = 1`）後即啟動背景 `_simulate` 任務才回傳 `202`（[runtime.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/runtime.py#L122-L132)）；頁面收到 `202` 後呼叫 `sync()`，先以 `GET /install` 取得當下快照的 `last_seq = S`（`S ≥ 1`，此時模擬器可能已推進超過 1），再補讀 `0 < seq ≤ S` 的日誌並以 `?last_event_id=<run_id>.<S>` 開流（[index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L490-L527)、[index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L576-L582)）。這也才與圖 3 圖說「S 取決於快照讀取時機」一致。
   - **建議修改**：將圖 7 右下節點副標改為「`較大 run_id（seq 由 1 起算）；頁面重跑 sync`」。

3. **[SHOULD]** **位置**：測試與驗證／分類表格與五道關卡段落（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L456-L471)）
   - **問題**：測試摘要表遺漏了各測試檔實際標註並驗證的部分 R-id／AC-id，且五道關卡段未標出對應的 `R28–R29` 與 `AC12`，也未說明 `R27` 的覆蓋方式。
   - **正確事實**：
     - [test_domain.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_domain.py#L97-L98) 的 `test_r6_script` 亦標註 `AC5`；
     - [test_http.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_http.py#L17-L18) 的 `test_r9_r14_r15_r18_openapi` 亦標註 `R9`；
     - [test_stream.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_stream.py#L26-L27)、[L175-L176](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_stream.py#L175-L176)、[L201-L202](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_stream.py#L201-L202)、[L243-L246](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_stream.py#L243-L246)、[L278-L281](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_stream.py#L278-L281) 亦涵蓋 `R3、R5、R10、R14` 及部分 `AC9`；
     - [test_e2e.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_e2e.py#L35-L36)、[L85-L86](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_e2e.py#L85-L86)、[L142-L143](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_e2e.py#L142-L143) 亦涵蓋 `R7–R8、R10、R13、R15–R16、AC1`；
     - 五道品質關卡對應 [SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L190-L191) `R28–R29` 與 [SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L208) `AC12`，而 `R27` 頁面互動行為由 [SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L210-L214) Phase 4 瀏覽器手動驗收覆蓋（`test_e2e.py` 僅透過 [page_script.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/page_script.py#L49-L52) 靜態檢查 `R26`）。
   - **建議修改**：補齊表格內各檔遺漏的 R-id／AC-id，並在五道關卡段落註明對應 `R28–R29、AC12` 以及 `R27` 採瀏覽器手動驗收。

4. **[SHOULD]** **位置**：重試與恢復流程 → 連線掉了，安裝繼續（圖 5，[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L346-L347)）與頁面自己重試（圖 8，[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L423-L429)）
   - **問題**：
     1. 圖 5 寫「`瀏覽器重新連線｜帶 Last-Event-ID，以已收序號為界`」，未提及若在開流後、收到第一筆具 `id` 的事件前即斷線的情況。
     2. 圖 8 第三列只寫「`補讀遇到 409，或收到 reset` → `立即重跑 sync`」，漏了 `onEvent` 的立即重同步分支（雖然第 5 節 [L235](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L235) 有說明）。
   - **正確事實**：
     1. 尚未收到任何帶 `id` 事件前斷線，瀏覽器重連同一 URL `/install/events?last_event_id=<run_id>.<S>`（不帶 `Last-Event-ID` 標頭，由查詢參數決定起點；見 [index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L530)、[SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L137)）。
     2. `onEvent` 遇到無效 `lastEventId`、輪次不符或 `JSON.parse` 失敗時也會立即呼叫 `resync()`（[index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L452-L465)）。
   - **建議修改**：在第 8(a) 節補一句「若斷線前尚未收到任何事件，重連時沿用原本的 `last_event_id` 查詢參數」，並在圖 8 第三列或圖說補註 `onEvent` 輪次不符／解析失敗亦觸發立即 `sync`。

5. **[NIT]** **位置**：本文目錄與第 5 節標題（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L64)、[L201](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L201)）
   - **問題**：目錄第 5 項寫「`SSE 串流與續傳`」，正文 `<h2>` 寫「`SSE 在這個專案的應用`」，其餘 10 節目錄與標題文字皆完全一致。
   - **正確事實**：Writer's brief 第 5 節標題為「SSE 在這個專案的應用」。
   - **建議修改**：將目錄第 5 項改為「`SSE 在這個專案的應用`」。

6. **[NIT]** **位置**：模組說明表格（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L143-L144)、[L150](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L150)）
   - **問題**：
     - `app/runtime.py` 的「誰使用」寫「工廠、生命週期、安裝路由」，漏了監控路由；
     - `app/domain.py` 的「主要入口或類別」未列 `parse_event_id`、`RETRY_BLOCK`、`PING_COMMENT`；
     - `app/routers/install.py` 的「誰使用」未列 `app/main.py` 與 `app/routers/system.py`。
   - **正確事實**：[system.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/system.py#L5) 匯入 `app.routers.install.RuntimeDep` 並在 [L12-L14](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/system.py#L12-L14) 讀取 `Runtime`；[install.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/install.py#L8) 呼叫 `parse_event_id`；[sse.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/sse.py#L14) 匯入 `RETRY_BLOCK`、`PING_COMMENT`；[main.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/main.py#L32) 掛載 `install.router`。
   - **建議修改**：於這三列補上上述呼叫者與公開符號。

7. **[NIT]** **位置**：資料模型與狀態機／圖 2（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L193-L195)）與重試與恢復流程／圖 8（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L437)）
   - **問題**：圖 2 的 `running → succeeded` 與 `running → failed` 兩條邊未標註事件名稱（僅 `pending → running` 標了「開始」）；另圖 2 與圖 8 的 `<figcaption>` 中 `run_finished`、`CONNECTING` 未以 `<code>` 包裹。
   - **正確事實**：狀態轉移由 `*_started`、`*_succeeded`、`*_failed` 與 `run_finished` 觸發（[domain.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/domain.py#L376-L490)）；共用格式規範要求事件名與程式識別字放在 `<code>` 內。
   - **建議修改**：在圖 2 分岔箭頭旁標註終態事件名，並將圖 2、圖 8 `<figcaption>` 內的 `run_finished`、`CONNECTING` 包入 `<code>`。

8. **[NIT]** **位置**：SSE 在這個專案的應用 → 快照切在哪裡，串流就從哪裡接手（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L224)）
   - **問題**：內文寫「`伺服器先將訂閱者加入佇列`」，字面上像把訂閱者本身放進同一個佇列。
   - **正確事實**：`Broker.subscribe()` 是為每位訂閱者建立各自的有界 `asyncio.Queue` 並把該 `Subscriber` 加入 `_subscribers` 集合（[broker.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/broker.py#L32-L47)），與圖 1 及第 11 節說法一致。
   - **建議修改**：改寫為「`伺服器先登記訂閱並建立專屬佇列`」。

9. **[NIT]** **位置**：系統架構（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L134)）與前端（[technical.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/technical.html#L444-L446)）
   - **問題**：第 2 節說明設定優先順序但未列出四個環境變數名稱與完整預設值；第 9 節僅點到 `#follow-btn`，未一併列出 R26 的六個固定元素 ID。
   - **正確事實**：四個設定為 `SSE_DB_PATH`（`./install.db`）、`SSE_LOG_INTERVAL`（`0.15`）、`SSE_HEARTBEAT_SECONDS`（`15.0`）、`SSE_SUBSCRIBER_QUEUE_SIZE`（`1000`）（[runtime.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/runtime.py#L69-L85)、[SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L37-L42)）；六個固定 DOM ID 為 `#scenario`、`#install-btn`、`#run-status`、`#stage-list`、`#task-list`、`#follow-btn`（[SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L168)、[index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L118-L125)）。
   - **建議修改**：可分別用一句話或精簡清單補註，方便新開發者查閱。

---

## 已核對正確的內容摘要

- **格式與隱私規範**：`grep -nE 'https?://|<link|src=|@import|url\(' docs/technical.html` 僅命中 8 個內嵌 `<svg xmlns="http://www.w3.org/2000/svg" ... --end:url(#tipN)>`，零外部資源、無 `<script>`；`grep -n '/Users/' docs/technical.html` 為空，無個資／姓名／email；11 個 CSS token 皆定義於 `:root` 並於 `@media(prefers-color-scheme:dark)` 重設；頁首含標題、副標、`2026-11-21` 與相對連結 `ai-agents.html`；頁尾列明資料來源；全部 8 張 SVG 皆有 `viewBox`、`width="100%"`、`role="img"`、`aria-label`、箭頭 marker，在 1280 px 下最小渲染字級為 14.16–15.97 px（> 12 px）、無任何文字重疊或超出 viewBox；在 390 px 實測 `scrollWidth === 390` 無橫向捲動；深淺色主題皆清晰可讀。
- **第 1 節（專案在做什麼）**：4 階段×3 工作、168 行正常日誌、7 種情境之 `id`／標籤／`fail_task_id`／失敗前正常行數／`error_code`（核對 [domain.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/domain.py#L153-L241)、[SPEC.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/docs/SPEC.md#L46-L69)）、啟動指令與單一 worker 限制皆正確。
- **第 2 節（系統架構）**：`create_app` 不做 I/O、`lifespan` 建立並掛載 `app.state.runtime`、設定優先順序、`GET /health`、`GET /stats` 以及先 `subscribe()` 再 `read_after()` 導致 `404`/`204`/`reset` 分支判斷期間短暫計數的實作細節（核對 [main.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/main.py#L12-L35)、[install.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/install.py#L168-L190)）皆完全準確。
- **第 3 節（模組說明）**：完整覆蓋 `app/` 與 `frontend/` 全部 19 個檔案，包含空檔 `__init__.py`、`log_interval` 預設 0.15 秒、`asyncio.to_thread`、`put_nowait` 溢位踢除、`EventStreamResponse` 三任務並行清理等細節（核對 `app/*.py`、`app/routers/*.py`、`frontend/*`）。
- **第 4 節（資料模型與狀態機）**：`runs`／`events` 表結構與複合主鍵 `(run_id, seq)`、`initial_snapshot` 與 `apply_event` 驗證條件與 `ValueError`、`<run_id>.<seq>` ASCII 十進位規則（核對 [store.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/store.py#L25-L39)、[domain.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/domain.py#L252-L490)）皆準確。
- **第 5 節（SSE 在這個專案的應用）**：選擇 SSE 的理由、回應標頭（`text/event-stream`、`Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no`、不壓縮）、`retry: 3000`、9 種事件與實際 `format_event` 輸出範例（含無空格精簡 JSON 與結尾空行）、`: ping` 與預設 15 秒心跳、快照 `S`／分頁 `after < seq ≤ until`（預設 500、上限 1,000）／先訂閱後重播並以 `seq ≤ last_sent` 去重、游標優先序與 5 種邊界回應表（核對 [sse.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/sse.py#L18-L68)、[install.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/routers/install.py#L158-L197)、[openapi.yaml](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/contracts/openapi.yaml#L99-L132)）皆正確。
- **第 6 節（正常流程）**：`success` 情境各階段序號區間 `1`、`2–35`、`36–89`、`90–165`、`166–201`、`202` 與總數拆解 `2 + 8 + 24 + 168 = 202` 經逐筆驗算完全吻合 [domain.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/domain.py#L153-L182)。
- **第 7 節（失敗流程）**：`disk_full` 之 `copy_files`（40 行、23 行正常、第 24 行 `error` 文字「磁碟空間不足，/opt 剩餘 0 MB」）、`error_code`／`message`／`hint`（含「請釋放至少 2 GB 空間後重新安裝」）、後續 `register` 與 `configure` 維持 `pending`、前端紅字／錯誤框／C2 自動跟隨與圖 4 對應關係皆正確。
- **第 8 節（重試與恢復流程）**：`CONNECTING` 顯示「連線中斷，瀏覽器重新連線中…」並於 `open` 清除、`Store.recover` 補 `E_INTERRUPTED`（「伺服器在安裝途中停止」、「請重新安裝」）且不額外寫錯誤 log、`POST /install` 原子交易與 C1 跨分頁限制、固定 3 秒重試無指數退避、`init` vs `sync` 入口差異、`GET /install` 404 與 `GET /install/logs` 404 差異、已結束輪次 `204` 不重試、`generation` 世代防護（核對 [store.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/store.py#L41-L45)、[L233-L270](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/app/store.py#L233-L270)、[index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L479-L612)）皆準確。
- **第 9 節（前端）**：`Promise.all` 啟動、狀態物件名稱（`run`、`stageStatus`、`taskState`、`lastApplied`、每工作 `seqs`）、C2／C3 規則、展開收合不發請求且失敗工作實作上可手動點擊收合、`aria-expanded`／`data-status`／`textContent`、Tailwind CSS／CLI `4.3.5` 與 Preline `5.1.0` 版本、`build.mjs` 安全檢查與不載入 Preline JS（核對 [package.json](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/package.json#L10-L14)、[build.mjs](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/build.mjs#L24-L45)、[index.html](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/frontend/src/index.html#L224-L227)）皆準確。
- **第 10 節（測試與驗證）**：五類測試檔案名稱與驗證方式、AC11 條件（20 訂閱者、0.005 秒間隔、全員收 `retry` 後計時、p95 < 200 ms）、`AGENTS.md §1` 五道關卡指令與 `pyproject.toml` 預設 `-m 'not perf'`（故預設含 `e2e`）（核對 [pyproject.toml](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/pyproject.toml#L27)、[test_perf.py](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/tests/test_perf.py#L24-L69)）皆正確。
- **第 11 節（經驗分享與設計取捨）**：6 則設計取捨（在 5–8 則範圍內）皆有明確程式碼與 SPEC 依據，敘事清晰、無臆測。

---

## 渲染證據截圖

所有截圖與索引已儲存於 [INDEX.md](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/.t7-evidence/T7.3/INDEX.md)：
- [review-1280-light.png](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/.t7-evidence/T7.3/review-1280-light.png)（1280 px 淺色全頁）
- [review-1280-dark.png](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/.t7-evidence/T7.3/review-1280-dark.png)（1280 px 深色全頁）
- [review-390-light.png](file:///Users/oliver/.local/share/sse-orchestra/docs-tech-ws/.t7-evidence/T7.3/review-390-light.png)（390 px 淺色全頁，實測 `scrollWidth === 390` 無橫向捲動）
