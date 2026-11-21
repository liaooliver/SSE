## T3.5 回報

現在 `apply_event` 會檢查九種事件的 `data`，缺欄位或型別不對都拋 `ValueError`（依 R8）。下面的檢查全部通過；7 個情境實際跑完、啟動復原也都正常。沒有跑 `pytest`，因為這份工作區沒有 `tests/`，依規定我也不能建立。

### 改了哪些檔案、哪些函式
只改了 `app/domain.py`：
- **新增 `_DATA_SCHEMA`**：照 R8 表格，為每種事件列出必填欄位和型別。
- **新增 `_field_ok`**：判斷單一欄位的型別。
- **新增 `_validate_data`**：逐一檢查欄位，缺少或型別錯就拋 `ValueError`。
- **`apply_event`**：先檢查 `run_id` 和 `seq`，接著呼叫 `_validate_data`，然後才做狀態機。docstring 已補上這條規則。`run_finished` 那段改成直接讀已驗證過的 `result`，行為不變。
- **`_validate_log`**：只留下原本就有的 `line_no >= 1` 檢查；`level` 和 `text` 改由共用的檢查處理。

公開簽章、HTTP、SSE、wire format 都沒動。

### 每種事件現在檢查什麼

| type | 必填欄位與型別 |
|---|---|
| `run_started` | `run_id: int`（不收 `bool`）、`scenario: str` |
| `stage_started` / `stage_succeeded` / `stage_failed` | `stage_id: str` |
| `task_started` / `task_succeeded` | `stage_id: str`、`task_id: str` |
| `log` | `stage_id`、`task_id`、`text`、`ts` 都是 `str`；`line_no: int`（不收 `bool`，且原本就要求 ≥ 1）；`level` 只能是 `"info"` 或 `"error"` |
| `task_failed` | `stage_id`、`task_id`、`error_code`、`message`、`hint` 都是 `str` |
| `run_finished` | `result` 只能是 `"succeeded"` 或 `"failed"` |

R10 說「不需要檢查」的部分維持不變：
- 不比對 `run_started` 的 `data.run_id`／`data.scenario` 和快照是否相符。
- stage 結束時不檢查底下的 task 是否都已結束。
- 不檢查計畫順序，也不檢查是否只有一個 `running`。

### 多出來的欄位
維持原本的行為：**忽略，不拋錯**。自我檢查裡加了 `extra_field` 測過，事件照常套用。

### 實際輸出
```
$ uv run ruff format --check .
16 files already formatted
$ uv run ruff check .
All checks passed!
$ uv run mypy
Success: no issues found in 12 source files
```

**stubtest**：把 `contracts/domain.pyi` 和空的 `__init__.pyi` 複製到 `./.t35-tmp/stubs/app/`，用 `uv run python` 的子程序設定 `MYPYPATH` 執行：
```
stubtest exit: 0
Success: no issues found in 1 module
```

**自我檢查**（同一次 `uv run python` 執行）：
```
  fold success: 202 events, final status=succeeded
  fold network_unreachable: 41 events, final status=failed
  fold dependency_missing: 32 events, final status=failed
  fold checksum_mismatch: 90 events, final status=failed
  fold disk_full: 140 events, final status=failed
  fold permission_denied: 186 events, final status=failed
  fold service_timeout: 203 events, final status=failed
positive: 7 scenarios, 894 events folded, 0 raised
  run_started: 2 fields checked
  stage_started: 1 fields checked
  stage_succeeded: 1 fields checked
  stage_failed: 1 fields checked
  task_started: 2 fields checked
  task_succeeded: 2 fields checked
  log: 6 fields checked
  task_failed: 5 fields checked
  run_finished: 1 fields checked
negative cases: 147/147 raised ValueError
  real run success: status=succeeded last_seq=202
  real run network_unreachable: status=failed last_seq=41
  real run dependency_missing: status=failed last_seq=32
  real run checksum_mismatch: status=failed last_seq=90
  real run disk_full: status=failed last_seq=140
  real run permission_denied: status=failed last_seq=186
  real run service_timeout: status=failed last_seq=203
  recovery: before stop status=running last_seq=9; after restart status=failed last_seq=12
ALL OK
```

各段說明：
- **第 1 步（劇本套用）**：7 個情境的 `script_for(...)` 依照 app 的做法補上 `run_id`、`seq`、`ts` 後逐筆 `apply_event`，894 筆全部沒有拋錯。
- **第 2 步（反向檢查）**：每種事件的每個欄位都測了「刪掉」和「換成錯誤型別」。錯誤型別包含 `bool` 填進 `int` 欄位、整數填進 `str` 欄位、`level`／`result` 填集合以外的值。147 個案例全部拋出 `ValueError`。
- **實際執行**：`create_app(db_path=./.t35-tmp/run.db)`，透過 lifespan 加 `ASGITransport` 打 `POST /install`，7 個情境都跑到正確的結束狀態，`last_seq` 等於劇本長度。
- **R25 啟動復原**：先讓一輪跑到 `last_seq=9` 時關閉 app，再用同一個 db 重開。補上 `task_failed`、`stage_failed`、`run_finished` 三筆事件後變成 `failed`、`last_seq=12`，全部通過新的驗證。

結束後已刪除 `./.t35-tmp/`，並確認 `./install.db` 從未建立。

### 其他
- 自我檢查腳本只能透過 `uv run python -c "...runpy..."` 執行，因為 `uv run python .t35-tmp/check.py` 找不到 `app` 模組，而設定 `PYTHONPATH` 的寫法不在允許的指令範圍內。
- 沒有 `CONTRACT GAP` 或 `CONTRACT CONFLICT`。
