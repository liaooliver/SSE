# T2.6 回報：OpenAPI 合約偏差修正

8 項都已修正，生成的 schema 與 `contracts/openapi.yaml` 一致（例外見第 4 節）。`app/` 本身的 ruff、mypy、stubtest 都通過。但全專案的 `uv run ruff format --check .` 和 `uv run ruff check .` **沒有通過**，失敗全部來自唯讀的 `contracts/domain.pyi`（見第 3 節的 CONTRACT CONFLICT）。

## 1. 逐項修改（before → after）

| # | 檔案:行 | before | after（生成結果） | YAML 要求 |
|---|---|---|---|---|
| 1 | `app/main.py:31` | `"version": "1.0.0"` | `"version": "1.1.1"` | `version: 1.1.1` |
| 2 | `app/routers/install.py:160`（並刪除常數 `_EVENT_ID_PATTERN`） | `{"anyOf":[{"type":"string"},{"type":"null"}],"pattern":"^[0-9]+\\.[0-9]+$",...}` | `{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Last Event Id"}` | `schema: {type: string}`，沒有 pattern（null 的 anyOf 屬 FastAPI 產物） |
| 3 | `app/routers/system.py:6,18,20`；`app/schemas.py:131-134` 新增 `Health(_Out)`，欄位 `status: Literal["ok"]` | `{"additionalProperties":{"type":"string"},"type":"object"}` | `$ref Health` → `{"properties":{"status":{"type":"string","const":"ok"}},"additionalProperties":false,"type":"object","required":["status"]}` | `type: object, additionalProperties: false, required: [status], properties: {status: {type: string, const: ok}}` |
| 4 | `app/schemas.py:101`（`InstallStarted.run_id`） | `{"type":"integer"}` | `{"type":"integer","minimum":1.0}` | `{type: integer, minimum: 1}` |
| 5 | `app/schemas.py:78,81`（`Snapshot.run_id`、`last_seq`） | `{"type":"integer"}` ×2 | `{"type":"integer","minimum":1.0}` ×2 | `minimum: 1` ×2 |
| 6 | `app/schemas.py:52-54`（`TaskError` 三個欄位） | `{"type":"string"}` ×3 | `{"type":"string","minLength":1}` ×3 | `{type: string, minLength: 1}` ×3 |
| 7 | `app/schemas.py:108,111,114`（`LogItem`） | `seq`/`line_no`: `{"type":"integer"}`；`ts`: `{"type":"string"}` | `seq`/`line_no`: `{"type":"integer","minimum":1.0}`；`ts`: `{"type":"string","format":"date-time"}` | `minimum: 1`；`format: date-time` |
| 8 | `app/schemas.py:128`（`Stats.subscribers`） | `{"type":"integer"}` | `{"type":"integer","minimum":0.0}` | `{type: integer, minimum: 0}` |

其他改動：
- `app/schemas.py:3,5,10-13`：import 補上 `Annotated`、`Field`，並新增兩個別名 `_Positive = Annotated[int, Field(ge=1)]` 和 `_NonEmpty = Annotated[str, Field(min_length=1)]`。
- 這兩個別名刻意不用 PEP 695 的 `type` 語法。第一版用了 `type`，pydantic 會多產生 `_Positive`、`_NonEmpty` 兩個 `$ref` 元件，所以改成一般賦值；改完後 components 裡沒有多出元件。

**行為確認**：用 `TestClient` 臨時跑過，沒有寫測試檔。
- `GET /health` → `200 {"status":"ok"}`
- `last_event_id`：`"abc"`、`" 1.x "`、`"1."` → `422`；`" 1.1 "` → `404`（空資料庫）。所以仍是先去空白再解析，符合 R9/R18。第 2 項本來就只是 `json_schema_extra`，不參與驗證。
- `LogItem` 序列化後的 `ts` 字串不變：`"ts":"2026-11-21T10:00:00.123Z"`。
- `reset`／`204`／SSE 邏輯沒有動。

## 2. 指令輸出

**`uv run ruff format --check .`**（已刪除 `.t26-tmp/` 後重跑）
```
unformatted: File would be reformatted
  --> contracts/domain.pyi:37:24
   |
36 |
   - JsonValue: TypeAlias = (
   -     str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None
   - )
37 + JsonValue: TypeAlias = str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None
38 | EventType: TypeAlias = Literal[
   |

1 file would be reformatted, 15 files already formatted
```

**`uv run ruff check .`**（`--output-format concise`）
```
contracts/domain.pyi:37:1: UP040 Type alias `JsonValue` uses `TypeAlias` annotation instead of the `type` keyword
contracts/domain.pyi:40:1: UP040 Type alias `EventType` uses `TypeAlias` annotation instead of the `type` keyword
contracts/domain.pyi:51:1: UP040 Type alias `Status` uses `TypeAlias` annotation instead of the `type` keyword
contracts/domain.pyi:52:1: UP040 Type alias `RunStatus` uses `TypeAlias` annotation instead of the `type` keyword
contracts/domain.pyi:53:1: UP040 Type alias `LogLevel` uses `TypeAlias` annotation instead of the `type` keyword
Found 5 errors.
5 unsafe fixes available with `--fix --unsafe-fixes`.
```

**只檢查 `app/`**：`uv run ruff format --check app && uv run ruff check app`
```
12 files already formatted
All checks passed!
```

**`uv run mypy`**
```
Success: no issues found in 12 source files
```

**stubtest**：把 `contracts/domain.pyi` 複製成 `./.t26-tmp/stubs/app/domain.pyi`，在 `MYPYPATH=./.t26-tmp/stubs` 下跑 `python -m mypy.stubtest app.domain`。因為只能執行 `uv` 指令，環境變數改由 `uv run python` 的 subprocess 設定。
```
Success: no issues found in 1 module
stubtest exit = 0
```

**清理**：`./.t26-tmp/` 已刪除，確認 `exists: False`。

## 3. CONTRACT CONFLICT

`ruff format --check .` 和 `ruff check .` 的失敗全部來自 `contracts/domain.pyi`：
- 第 37 行的格式問題；
- 第 37、40、51、52、53 行的 UP040（`TypeAlias` 應改用 `type` 關鍵字）。

這個檔案對我是唯讀的，我也不能為了過關去改 `pyproject.toml`。需要規格編輯 worker 處理，兩種做法：
- 修改 `contracts/domain.pyi`；
- 或讓 ruff 排除 `contracts/`。

另外要注意：若改成 `type` 語法，要確認 stubtest 仍然通過。

## 4. 無法完全照字面一致的地方

- **`minimum` 是浮點數**：組件 schema 裡的 `minimum` 輸出為 `1.0`／`0.0`，YAML 寫的是 `1`／`0`。這是 FastAPI 產生組件 schema 時的處理方式，同一 app 的 query 參數（`/install/logs` 的 `run_id`）輸出就是 `1`。兩者數值相等，JSON Schema 語意相同，所以沒有改。
- **新增約束會在建構 model 時驗證**：第 4–8 項用 `Field(ge=…, min_length=…)`，所以 `Snapshot`、`LogItem` 等 model 建構時會實際檢查這些約束。依 SPEC，這些值本來就保證是 ≥1 或非空，正常資料下行為不變；萬一資料違規，回應會變成 500，而不是把違規值送出去。
- **`/health` 不再回傳裸 `dict`**：依合約改用 `Health` model。AGENTS.md 允許這個端點用 `dict[str, str]`，但合約優先。

依 brief 指示，沒有建立測試套件；FastAPI 產物類差異（null 的 anyOf、組件拆分、422 body、SSE header）都沒有動。
