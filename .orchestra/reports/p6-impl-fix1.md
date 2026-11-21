# T6.1-fix1 回報

已修好：沒有錯誤框時，log 框上下的間距現在一樣（1280 px 寬下都是 16 px）。顯示錯誤框時，log 框和錯誤框之間仍是 12 px，沒變。只改了兩個 class 字串，script 邏輯沒動。

## 1. 根因
跟協調者的推測一樣。`taskBody` 用了 `space-y-3`。在 Tailwind v4 裡，它會給「最後一個以外的每個子元素」加上 `margin-bottom: 0.75rem`。`.task-body` 的子元素是 `ol.log` 和 `div.error-box`，錯誤框就算被 `hidden` 了，在 DOM 裡仍然是最後一個子元素。所以 `.log` 一直帶著 12 px 的下邊距：下方 = 16 px 內距 + 12 px = 28 px，上方只有 16 px。修正前在瀏覽器量到 `.log` 的 `marginBottom` 是 12 px，修正後是 `0px`。

## 2. Diff（`frontend/src/index.html`，只改 class 字串）
```diff
-    taskBody: "task-body space-y-3 border-t border-card-divider p-3 sm:p-4",
+    taskBody: "task-body border-t border-card-divider p-3 sm:p-4",
@@
-    errorBox: "error-box flex gap-x-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm"
+    errorBox: "error-box mt-3 flex gap-x-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm"
```
做法是把間距從 log 的下邊距搬到錯誤框的 `mt-3` 上。錯誤框隱藏時是 `display:none`，它的 margin 就不會佔空間；顯示時同樣是 12 px。`frontend/src/input.css` 沒改，id、屬性、文字都沒動。

## 3. Build
- 第 1 次 `shasum -a 256`：`9aed92c47b6c879a3e0253cf2317f0d18fa53c53c59b62fd3b533100711008da`
- 第 2 次 `shasum -a 256`：`9aed92c47b6c879a3e0253cf2317f0d18fa53c53c59b62fd3b533100711008da`（兩次一樣）
- `app/static/index.html`：80151 bytes（原本 80114 bytes）

## 4. Gate 輸出
```
uv sync                    → Resolved 39 packages in 5ms / Audited 37 packages in 5ms
uv run ruff format --check → 17 files already formatted
uv run ruff check .        → All checks passed!
uv run mypy                → Success: no issues found in 12 source files
uv run pytest              → collected 0 items, exit=5（沒有 tests/，所以沒有測試；另有 PytestConfigWarning: No files were found in testpaths）
```

## 5. 量測（`getBoundingClientRect`，1280 px，Chrome 深色模式）
Server 跑在 `127.0.0.1:18642`，`SSE_DB_PATH` 在 `mktemp -d` 的資料夾裡，跑的情境是 `dependency_missing`。上方間距已扣掉 1 px 的 `border-t`。

| 狀態 | 修正前（上 / 下） | 修正後（上 / 下） |
|---|---|---|
| succeeded `check_os`（8 行 log） | 16 / 28 px | 16 / 16 px |
| pending `fetch_manifest`（空 log「（尚無 log）」） | 16 / 28 px | 16 / 16 px |
| failed `check_deps`（顯示錯誤框） | 上 16、log→錯誤框 12、錯誤框→底 16 px | 16 / 12 / 16 px（沒變） |

量完已關掉我開的兩個分頁、停掉 server，並刪掉暫存資料夾。沒有產生 `./install.db`。

## 6. 截圖
存在 `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.1/`，`INDEX.md` 已各加一行：
- `fix1-01-succeeded-task-log.png`
- `fix1-02-empty-log.png`
- `fix1-03-failed-task-errorbox.png`

## 7. 不確定的地方
- **淺色模式沒在瀏覽器裡實際看。** Chrome 跟著系統設定是深色，我沒有改系統設定，所以三張截圖都是深色，也就是說選拍的深色那張已經在裡面。淺色和深色只差 `dark:` 的顏色和 `ring` 外框，`ring` 不影響版面，所以淺色的間距應該一樣。
- **375 px 寬沒有量。** 窄螢幕下內距是 `p-3`（12 px），照同樣的道理，上下應該都是 12 px。
- 截圖原本是 JPEG，我用 `sips` 轉成 PNG。
- 已刪除 `.mypy_cache`、`.ruff_cache`、`.pytest_cache` 和兩個 `__pycache__`，`frontend/node_modules/` 保留。