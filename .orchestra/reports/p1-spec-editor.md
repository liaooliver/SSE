SPEC 已升到 v0.3，兩個合約檔也建好了。我沒有執行任何工具驗證：OpenAPI 沒用 linter 檢查，stub 也沒跑過 mypy，都只是靠人工比對。R1–R22 只改了 R2 的一句，其餘都是針對性編輯，沒有動到原文。

## 建立／修改的檔案
- **新增** `contracts/openapi.yaml`：OpenAPI 3.1，涵蓋全部 6 個端點。
  - `/events/*` 在 `text/event-stream` 底下用 `x-sse-events` 描述開頭的 retry 區塊、heartbeat、結束方式，以及各事件的 `data` schema。
  - `GET /` 另外用 `x-html-element-ids` 列出 R18 的元素 id。
  - 每個 operation 都用 `x-spec-refs` 標出對應的 R-id。
- **新增** `contracts/domain.pyi`：`app/domain.py` 的 stub，含 `__all__`，每個名稱的 docstring 都標了 R-id。
- **修改** `SPEC.md` → v0.3：
  - 新增 §0「合約檔」：合約檔管形狀、SPEC 管行為；兩邊矛盾時回報 `CONTRACT CONFLICT`。
  - 新增 §8「領域介面」R23–R28，每條都附輸入→輸出的範例表。
  - R2 加上 domain 的名稱。
  - §7 新增 CONTRACT GAP 規則。
  - 原 §8「不在範圍內」改編號為 §9，內容不變。
  - 附錄新增 v0.2 → v0.3 變更紀錄。

## `domain.pyi` 的公開名稱
| 名稱 | 用途 |
|---|---|
| `Message` | TypedDict `{id, user, text, ts}`，就是 R12 的 201 body，也是 R14 事件的 data（R23） |
| `InvalidMessageError` | `ValueError` 的子類別，由 `validate_message` 拋出（R25） |
| `RETRY_BLOCK` | `"retry: 3000\n\n"`（R6/R28） |
| `PING_COMMENT` | `": ping\n\n"`（R7/R28） |
| `parse_last_event_id(header)` | 依 R11 語法解析，結果是 `int` 或 `None`，任何輸入都不拋例外（R24） |
| `validate_message(user, text)` | 先去掉空白再檢查長度，回傳 `(user, text)` 或拋 `InvalidMessageError`（R25） |
| `select_replay(history, last_event_id)` | 從保留的歷史中挑出 `id > N` 的訊息；N 為 `None` 時回傳 `[]`（R26） |
| `clock_start_seq(count, last_event_id)` | Clock 續傳時從哪個 seq 開始；回傳 `None` 表示 HTTP 層回 204（R27） |
| `format_event(event, event_id, data)` | 產生 `id`/`event`/`data` 事件區塊，data 是單行 JSON（R28） |

`clock_start_seq` 不在必做清單裡，是我加的，因為 R11 的「N > count 回 204」是核心規則，值得直接做單元測試。

## 發現但沒有修正的缺陷／模糊處
1. **R12，lone surrogate**：`{"user":"\ud800",...}` 是合法 JSON，`str.strip()` 後長度也合法。但回應或 SSE 用 UTF-8 編碼時會失敗，可能回 500。應該補一條「含 lone surrogate 回 422」之類的規則。
2. **R12，body 本身不對**：
   - 最外層不是 object（`[]`、`"x"`、`null`）時，是否算「JSON 格式錯誤」？
   - Content-Type 不是 `application/json` 時怎麼處理？
   - JSON 物件有重複的鍵時怎麼處理？
3. **R11，「頭尾空白」沒有定義範圍**：R24 已經選定用 `str.strip()`，跟 R12 一致。變更紀錄標成「釐清（待核准）」，需要你確認。
4. **R11，數值沒有上限**：CPython 的 `int(str)` 超過 4300 位會拋 `ValueError`。R24 要求照樣回傳正確的整數，保留 R11 原意，並寫了實作注意事項。
5. **R11/R15，重複的 header**：同一個請求帶多個 `Last-Event-ID` 時怎麼處理，沒有規定。
6. **R4 的 422 body**：形狀沒有規定，合約寫明「不屬於合約，只斷言狀態碼」。另外，422 和 R11 的 204 該帶哪些 header，也沒有規定。
7. **R4 套到 `/events/messages`**：這個端點沒有任何參數，所以不會出現 422，OpenAPI 也就沒有列 422。請確認這是你要的。
8. **R9 的數字寫法**：`count=+5`、`05`、`5.0`、`1e1`，`interval=1e-2`、`" 1"` 這些合不合法沒有定義。測試作者碰到時應該回報 CONTRACT GAP。
9. **R3 的型別**：傳入 `history_size=True` 或 `5.0` 時算不算合法，沒有定義。
10. **R16**：Clock 回 204 時要不要計入 `active_streams`，沒有明說；照理不算。

## 不確定的地方
- **response 形狀刻意收緊**：`Message`、`Stats`、`Health`、`TickData`、`DoneData` 都設了 `additionalProperties: false`。如果你不希望禁止多出來的欄位，可以放寬。
- **R23 規定 HTTP 層必須呼叫 domain 函式**：這樣才能確保單元測試和 HTTP 測試驗證同一套規則，但這條無法用測試驗證。
- **`format_event` 欄位順序**：固定為 id、event、data，但 payload 的 JSON 序列化細節不屬於合約，測試必須用 `json.loads` 比對。這不改變 R5「線上格式不保證順序」的規定。
- **R12 不做 Unicode 正規化**：我寫明了這一點，也標成「待核准」。
- **domain 沒放的規則**：R3 的設定解析、R9 的參數驗證都還是只能透過 `create_app` 或 HTTP 測試。如果希望它們也能單元測試，可以再加。
- **FastAPI 內建端點**：`/docs`、`/openapi.json` 我允許保留，只是測試不得依賴，沒有要求關掉。