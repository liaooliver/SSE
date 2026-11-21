T2.8 做完了。產生的 OpenAPI `info.version` 現在是 `"1.1.2"`，跟 `contracts/openapi.yaml` 一致，所有檢查都通過。

## 修改內容
- **`app/main.py:31`**：`FastAPI(..., version="1.1.1", ...)` 改成 `version="1.1.2"`。
- 其他檔案都沒有動。行為、狀態碼、wire format、schema 都沒變。
- **E2 確認**：`/health`（`app/routers/system.py:17-20`）回傳 `Health` Pydantic model（`app/schemas.py:131`），不是裸 `dict`，符合新版 AGENTS.md §4，不用改。

## 檢查輸出
```
$ uv sync
Resolved 39 packages in 14ms
Audited 37 packages in 9ms

$ uv run ruff format --check .
16 files already formatted

$ uv run ruff check .
All checks passed!

$ uv run mypy
Success: no issues found in 12 source files
```

## stubtest 與 OpenAPI 版本
我用一個 `uv run python` 腳本做了以下步驟：
1. 把 `contracts/domain.pyi` 複製到 `./.t28-tmp/stubs/app/domain.pyi`，再建一個空的 `__init__.pyi`。
2. 用 subprocess 設定 `MYPYPATH`，執行 `python -m mypy.stubtest app.domain`。
3. 印出 `create_app(db_path="./.t28-tmp/x.db").openapi()["info"]["version"]`。
4. 刪掉 `./.t28-tmp/`。

```
stubtest exit: 0
Success: no issues found in 1 module

info.version: 1.1.2
.t28-tmp exists after cleanup: False
```

## 其他
- **CONTRACT CONFLICT**：無。檢查範圍已經包含 `contracts/domain.pyi`，三項都沒有報錯。
- **CONTRACT GAP**：無。
- 專案裡沒有 `tests/`，依規定沒跑 `uv run pytest`。
