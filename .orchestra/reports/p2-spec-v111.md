D1–D4 和版本號都已寫進三份文件，其他內容沒有改。我不能跑 shell，所以 YAML 和 `.pyi` 的語法沒有用工具驗證過。我只改了字串和 docstring，沒動結構和縮排，照理不會壞，但這點沒有實際檢查。

## 各項改了哪裡

- **D1**：`docs/SPEC.md` §3 R10 第 6 項改成：`task_*`／`log` 事件的 `(stage_id, task_id)` 組合不在計畫（R4）裡就拋出 `ValueError`，包含 task id 存在但屬於另一個 stage 的情況。`contracts/domain.pyi` 的 `apply_event` docstring 也改成同樣意思。
- **D2**：`docs/SPEC.md` R10 在原本那句「不需要」後面加一段：不需要檢查 `run_started` 的 `data.run_id`／`data.scenario` 是否相符，並註明事件本身的 `run_id` 已由第 3 項檢查，測試不可斷言。`domain.pyi` 的 `apply_event` docstring 另加一段 "Not required"，裡面有這一條。
- **D3**：`docs/SPEC.md` R10 同一處再加一段：不需要強制 stage／task 依計畫順序開始，也不需要檢查同一時間只有一個是 `running`，測試不可斷言。`domain.pyi` 的 "Not required" 段也有這一條。
- **D4**：`docs/SPEC.md` §5 R20 段尾加一句：依 R16 不計入的回應（`404`、`204`，以及送出 `retry` 和 `reset` 後就關閉的回應）不更新 `/stats`。

**版本號**：
- `SPEC.md` 標題改成 v1.1.1，附錄版本表加了 v1.1.1 一列，也加了「v1.1 → v1.1.1 變更明細」表（D1–D4 各一列，有寫 R-id 和檔案）。
- `domain.pyi` 檔頭改成 SPEC v1.1.1。
- `openapi.yaml` 的 `info.version` 改成 `1.1.1`，說明裡的 SPEC 版本也改成 v1.1.1。

## 注意到但沒修的問題

1. **R10 沒規定 `run_finished.data.result` 要和各 stage／task 的狀態一致。** 例如還有 task 是 `failed` 卻收到 `result: "succeeded"`，或還有 stage 是 `running` 時就收到 `run_finished`。是否要拋出 `ValueError` 沒寫，也沒列進「不需要」的清單，測試作者可能各自猜。
2. **R10 第 1 項沒說 `run` 的狀態怎麼由事件決定。** 狀態機只講到 `running → succeeded | failed`，沒明講要由 `run_finished.data.result` 決定。目前大家都會這樣讀，但沒寫成文字。

## 不確定的地方

- **D2、D3 的放法**：我把它們寫成和原本那句「不需要」並列的兩段，句尾都沿用「測試不可以對這一點做任何斷言（拋出或不拋出都可以）」。如果你希望合併成一段或改成清單，可以再調整。
- **D4 在變更表的欄位**：「影響的 R」我填了 R16、R20。實際只改了 R20 的文字，列 R16 是因為意思以 R16 為準。
