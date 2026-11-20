v1.0 → v1.1 的修訂已寫入四個檔案：`docs/SPEC.md`、`contracts/domain.pyi`、`contracts/openapi.yaml` 和 `AGENTS.md`。我無法執行 shell，所以 YAML 驗證、stub 語法檢查、`stubtest` 和 AGENTS.md §1 的五個指令都**沒有跑過**，請在下一步實際驗證。

## 各項修改位置
- **A1**：SPEC R6 第 1 步說明劇本的 `run_started` 只帶 `{"scenario"}`，寫入時才加上 `run_id`；R6 標題括號補「不含 `run_id`」。AC4 另外扣掉 `run_started.data.run_id`，並要求它等於實際的 `run_id`，需求欄加上 R8。`domain.pyi` 的 `ScriptStep` 和 `script_for` docstring 同步更新。
- **A2**：`openapi.yaml` 移除 `last_event_id` 的 `pattern`（`Last-Event-ID` 本來就沒有）。兩個參數的 description 都寫明依 R9 解析、先去掉頭尾空白。
- **A3**：SPEC R10 改成編號清單，列出全部 9 種要拋 `ValueError` 的情況。另寫明 stage 結束時不需要檢查 task 是否都已結束，測試不可以對這點做斷言。`domain.pyi` 的 `apply_event` docstring 同步更新。
- **A4**：SPEC R16 只計算正在重播或接收即時事件的連線；`404`、`204`、送出 `retry`+`reset` 後就關閉的回應都不計入。
- **B1**：`domain.pyi` 的五個別名改成 `X: TypeAlias = ...`。`JsonValue` 的遞迴部分用字串前向參照，並 import `TypeAlias`。
- **B2+B3**：SPEC §9 的 AC11 照指定內容重寫。
- **B4**：SPEC §9 的 AC1 照指定內容重寫。
- **B5**：`openapi.yaml` 的 `until` 改成 `anyOf: [integer ≥ 0, null]`，沒有固定預設。`POST /install` 的 body 改成 `$ref` 指向新增的 `components.schemas.InstallRequest`，欄位和 required 不變。
- **C1**：SPEC R27 新增「已知限制」一項，§11 不在範圍內也補上這一點。
- **C2**：SPEC R27「畫面」底下新增沒有 stage 在執行時的選擇規則。
- **C3**：同一處新增：點目前顯示的 stage 不會停止自動跟隨；只有 `#follow-btn` 能恢復，按下 `#install-btn` 不會。
- **C4**：SPEC R27 新增「錯誤與重試」一項。
- **C5**：`AGENTS.md` §5 加上 `routers/page.py` 和 `static/index.html`。
- **Housekeeping**：
  - SPEC 標題改為 v1.1，拿掉「待使用者核准」。
  - 附錄版本表加上 v1.1 一列，並新增「v1.0 → v1.1 變更明細」表，A1–C5 各一列，寫明影響的 R／AC。
  - `openapi.yaml` 的 `info.version` 改為 1.1.0，`domain.pyi` 檔頭改為 v1.1。

## 有發現但沒有修的問題
1. **R10 的 task 不屬於它的 stage**：如果 task 事件的 `task_id` 存在，但屬於 `stage_id` 以外的 stage，算不算「不存在的 task id」？目前沒寫明，建議改成「(stage_id, task_id) 這一對不在計畫中」。
2. **R10 的 `run_started` 內容不符**：`run_started.data.run_id` 或 `scenario` 和快照不一致時要不要拋錯，目前沒有規定。
3. **R10 的執行順序**：沒有規定「同時只能有一個 stage／task 是 `running`」，也沒有規定要照計畫順序。照目前的規則，跳著啟動 stage 或 task 都不會拋錯。
4. **R20 和 A4 的 `/stats`**：R20 寫「更新 `/stats`，然後才送出第一個區塊」，但 `reset` 的回應也會先送 `retry` 區塊。照 A4，這種回應不計入，可是 R20 本身沒有把 `reset` 的情況排除在外。建議在 R20 補一句。

## 不確定的地方
1. **AC1 第 (1) 點**：原文寫「收到的事件從快照狀態開始套用」，但補讀的 log 的 seq ≤ S，用 `apply_event` 套用一定會因為 seq 不符而失敗。所以我寫成「對 SSE 收到的後綴套用」。我認為這是唯一行得通的解讀，但嚴格說是我自己做的釐清。
2. **C2 的範圍**：我寫成「自動跟隨時如果沒有 stage 正在執行」，因為停止自動跟隨時，所選的 stage 是使用者點的那個。brief 原文沒有這個前提。
3. **C4 的條件範圍**：「這一輪還在執行」我只套用在 `EventSource` 變成 `CLOSED` 這個條件上，網路錯誤和非 `409` 錯誤不受限制，照 brief 的語序判斷。
4. **B5 的 `InstallRequest`**：保持和原本的 inline 物件一樣，沒有加 `additionalProperties`，因為 R14 說額外欄位直接忽略。FastAPI 實際產生的 schema 會多出 `title` 等欄位，我沒有加。
