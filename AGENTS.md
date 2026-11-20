# AGENTS.md — 程式碼規範（所有 AI worker 共用）

本檔是**寫程式的規範**，適用於 Claude、Codex、agy 所有 worker。
規格（要做什麼）看 `SPEC.md` 和 `contracts/`；本檔只管「怎麼寫」。
兩者衝突時以 `SPEC.md`／`contracts/` 為準，並在回報中指出衝突。

## 1. 完成的定義（每次交付前必須全部通過，並把輸出貼進回報）

```bash
uv sync
uv run ruff format --check .
uv run ruff check .
uv run mypy
uv run pytest            # 有 tests/ 時
```

- 不要只說「應該可以」；沒有跑過就說沒跑過。
- 不准用 `# noqa`、`# type: ignore` 讓檢查過關，除非同一行附上錯誤代碼和理由，例如
  `# type: ignore[attr-defined]  # starlette 型別缺漏，見 issue #123`。
- 不准修改 `pyproject.toml` 的 lint／型別設定來讓自己的程式過關。覺得規則不合理就在回報裡提出。

## 2. 工具

| 工具 | 用途 | 規則 |
|---|---|---|
| uv | 依賴與虛擬環境 | 只用 `uv add` / `uv add --dev`；不用 pip；`uv.lock` 要一起交付 |
| Ruff | lint + 格式化 | 設定在 `pyproject.toml`，不另開設定檔 |
| mypy | 型別檢查（strict + pydantic plugin） | CI 唯一的型別關卡 |
| pytest | 測試 | `asyncio_mode = auto`；`-m e2e` 真的 uvicorn、`-m perf` 效能 |

不准新增依賴，除非任務說明允許。需要時在回報寫 `NEED DEPENDENCY: <套件> — <理由>`。

## 3. 型別

- 所有函式（含巢狀函式、端點、fixture 以外的 helper）都要標**參數和回傳型別**。
- **禁止 `Any`**（mypy 已開 `disallow_any_explicit`）。外部輸入先當 `object`，驗證後再收窄。
- 用現代語法：`list[str]`、`dict[str, int]`、`X | None`；不用 `typing.List`、`Optional`、`Union`。
- 從 `collections.abc` import `AsyncIterator`、`Callable`、`Sequence` 等，不從 `typing`。
- 結構化資料：
  - 跨 HTTP 邊界 → Pydantic v2 `BaseModel`
  - 純領域邏輯內部 → `@dataclass(frozen=True, slots=True)` 或 `TypedDict`（以 `contracts/domain.pyi` 為準）
- 常數用 `Final`；固定字串集合用 `Literal` 或 `enum.StrEnum`。
- 不用 `cast()` 掩蓋型別問題；真的需要時附註理由。

## 4. FastAPI 寫法

- **App 工廠**：`create_app(...)` 建立 app，模組層級 `app = create_app()`。不在 import 時做 I/O。
- **啟動／關閉**：用 `lifespan`（`@asynccontextmanager`），不用已棄用的 `@app.on_event`。
  共享狀態放 `app.state` 或由 lifespan 建立的物件，不用模組層級的可變全域變數。
- **參數宣告一律用 `Annotated`**：
  ```python
  @router.get("/events/clock")
  async def clock(
      count: Annotated[int, Query(ge=1, le=100)] = 10,
      last_event_id: Annotated[str | None, Header()] = None,
  ) -> StreamingResponse: ...
  ```
- **依賴注入**：共享資源（broker、設定）用 `Depends`，並定義型別別名
  `BrokerDep = Annotated[Broker, Depends(get_broker)]`。
- **回應**：JSON 端點用 Pydantic model 或明確的回傳型別，讓 FastAPI 自動產生 schema；
  不回傳裸的 `dict` 當作公開 API 形狀（`/health` 這種極小端點除外，但仍要標 `dict[str, str]`）。
- **狀態碼**：用 `status.HTTP_201_CREATED` 等常數，不寫魔術數字。
- **錯誤**：用 `HTTPException` 或註冊 exception handler；不吞例外、不用裸 `except:`。
- **async 規則**：
  - `async def` 裡不能呼叫阻塞函式（`time.sleep`、同步檔案／網路 I/O）。Ruff `ASYNC` 會擋。
  - 背景 task 要有人持有參考並在關閉時取消；不留孤兒 task。
  - 處理 `asyncio.CancelledError` 時清理完要重新拋出，不可吞掉。
- **SSE**：串流用 async generator；客戶端斷線時要停止產生並釋放資源（見 SPEC）。

## 5. 專案結構

```
app/
  main.py        # create_app、lifespan、掛 router；不放商業邏輯
  domain.py      # 純邏輯：不 import fastapi、不做 I/O（依 contracts/domain.pyi）
  routers/       # 只處理 HTTP：解析輸入 → 呼叫 domain/服務 → 組回應
  schemas.py     # Pydantic request/response model
  broker.py      # 執行期狀態（訂閱者、歷史）等有狀態元件
tests/           # 由測試作者負責；實作者不得建立或讀取
contracts/       # 合約檔（唯讀，只有規格編輯 worker 能改）
```

- 依賴方向：`routers → domain / broker`，`domain` 不依賴任何其他 app 模組。
- 公開介面只有 `create_app`、`app`、以及 `contracts/domain.pyi` 列出的名稱。
  其他模組名稱可以自由調整，但不得讓測試依賴它們。

## 6. 風格

- 格式交給 `ruff format`，不手動排版爭論。行寬 100。
- 命名：模組／函式／變數 `snake_case`，類別 `PascalCase`，常數 `UPPER_SNAKE`；內部 helper 加底線前綴。
- 函式短小、單一職責；早回傳取代深層巢狀。
- 公開函式寫 docstring，說明行為並引用 SPEC 的 R-id（例如 `"""R11: ..."""`）。
- 不留註解掉的程式碼、不留 `print`（用 `logging`）、不留未說明的 `TODO`（要寫 `TODO(<任務ID>)`）。
- 不寫「為了以後可能用到」的抽象或設定；只做 SPEC 要求的事。

## 7. 測試（測試作者適用）

- 只根據 `SPEC.md` 與 `contracts/` 寫；只能 import `create_app`、`app`、`domain.pyi` 列出的名稱。
- 每個測試名稱或 docstring 標出需求 ID；回報附「測試名稱 → R-id」對照表。
- HTTP 測試用 `httpx.AsyncClient(transport=ASGITransport(app=...))`；SSE 解析可用 `httpx-sse`。
- 不用 `sleep` 猜時間；用 `create_app` 的參數縮短間隔，所有等待都要有逾時。
- 合約不夠用時不要猜：回報 `CONTRACT GAP: <缺什麼> — <為什麼需要>`。

## 8. 回報格式

每次結束都回報：改了哪些檔案、第 1 節所有指令的實際輸出、沒做完或不確定的地方。
