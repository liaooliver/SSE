## 環境設定報告

環境已設定完成,所有驗證都通過。

### 建立或變更的檔案
- `pyproject.toml`:
  - 新增依賴與 dev 群組。
  - 描述改為 "FastAPI Server-Sent Events demo"。
  - 新增 pytest、ruff、mypy 設定。
- `uv.lock`:由 `uv add` 產生。
- `app/__init__.py`:空檔。
- `app/main.py`:`create_app(...)` 只提供 `GET /health`,並有模組層級的 `app = create_app()`。三個參數目前被接受但忽略,並附 `# TODO(T2.1)` 註解。
- `README.md`:包含安裝、執行、lint、型別檢查、測試指令。
- 未建立 `tests/`,也未動 `SPEC.md`。

### 解析後版本
| 套件 | 版本 |
|---|---|
| fastapi | 0.165.0 |
| uvicorn | 0.54.0 |
| pytest | 9.2.0 |
| httpx-sse | 0.4.3 |

另外 pytest-asyncio 為 1.5.0,pytest-timeout 為 2.4.0,ruff 為 0.17.6,mypy 為 2.4.1。

### 驗證輸出
- **`uv sync`**:`Resolved 39 packages in 4ms` / `Audited 37 packages in 5ms`
- **import 檢查**:印出 `0.165.0`
- **`uv run ruff check .`**:`All checks passed!`
- **`uv run mypy`**:`Success: no issues found in 2 source files`
- **uvicorn(port 8765)**:
  - `curl -s http://127.0.0.1:8765/health` 回傳 `{"status":"ok"}`。
  - 用 `pkill` 停止後,`pgrep` 找不到程序(輸出 "process gone")。
  - 再 curl 時 port 已關閉(輸出 "port closed")。
  - 沒有遺留背景程序。
- **`uv run pytest`**:`collected 0 items`,exit code 為 5(符合預期)。

### 注意事項
- **T201 設定方式**:`select` 全域包含 `T201`,再用 `[tool.ruff.lint.per-file-ignores]` 讓 `tests/**` 忽略它。這樣 `app/**` 會強制 T201(R21),但測試仍可使用 `print`。
- **pytest 警告**:因為 `tests/` 尚不存在,pytest 出現 `PytestConfigWarning: No files were found in testpaths`。測試階段建立 `tests/` 後就會消失。