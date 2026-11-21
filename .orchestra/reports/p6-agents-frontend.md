# T6.2 回報：在 AGENTS.md 加入 `frontend/` 說明

只改了 `AGENTS.md`，`docs/SPEC.md` 和 `contracts/` 都沒動。這次是文件修改，§1 的指令跟它無關；我也無法執行 shell，所以一個都沒跑。

## 新增或修改的行

**§2 工具表（在 pytest 那列下面新增一列）：**
```
| Node / npm | 只用於建置前端 | 只在 `frontend/` 裡用 `npm ci`、`npm run build`；版本精確釘選，`package-lock.json` 要一起交付；執行 app 與測試不需要 |
```

**§5 專案結構：`static/index.html` 的註解改成：**
```
    index.html   # R26 頁面的建置產物，由 frontend/ 產生（單一 HTML，不依賴外部資源）；不得手動編輯
```

**§5 專案結構：在 `broker.py` 和 `tests/` 之間新增：**
```
frontend/        # R26 頁面的建置來源；只有改頁面時需要 Node
  package.json   # 精確釘選 tailwindcss、@tailwindcss/cli、preline 版本；`build` script
  package-lock.json  # 鎖定檔，要一起交付
  src/index.html # 頁面模板（markup + inline script）；頁面唯一的來源
  src/input.css  # Tailwind + Preline 匯入、自訂 CSS
  build.mjs      # 跑 Tailwind CLI，把 CSS inline 進模板，寫出 ../app/static/index.html
  README.md      # 建置與修改頁面的說明
```

**§5 樹狀圖下方的條列（加在原有兩條之後）：**
```
- 要改頁面：編輯 `frontend/src/`，在 `frontend/` 裡跑 `npm run build`，並把原始碼和產生的
  `app/static/index.html` 一起 commit。
```

## 注意到但沒修的問題

1. **生成檔可能過期，沒有任何檢查擋住**：§1「完成的定義」沒有檢查 `app/static/index.html` 和 `frontend/src/` 是否一致。有人只改了 `src/` 卻沒重新 build，仍然能通過所有檢查。依 E9，§1 不應該要求 Node，所以我沒有加。如果要補，可以考慮另外開一個非必要的 CI 步驟。
2. **§2「不准新增依賴」是否也管 npm 套件，沒有寫清楚**：照字面看，它只針對 `uv`／Python 依賴。我沒有修改那一句。
3. **`frontend/node_modules/` 不該 commit**：這條規則沒有寫進 AGENTS.md，應該由 `.gitignore` 處理。這不在本次範圍內，這個目錄也不是 git repo，所以我沒有確認。Ruff 預設就會排除 `node_modules`，lint 應該不受影響。

## 不確定的地方

- **新條列的位置**：我把它放在 §5 既有兩條之後，沒有放在樹狀圖正下方，這樣原有條列的順序不變。如果要它緊接著樹狀圖，把它移到第一條即可。
- **`package-lock.json` 的註解對不齊**：檔名太長，註解沒辦法和其他行對齊到同一欄，所以我改用兩個空格隔開。
- **SPEC 不需要修改**：R26 只要求最後送出的頁面不依賴外部資源，而 CSS 會 inline，所以 E8–E10 都符合現行 SPEC。SPEC 裡的 C5 只說 §5 要列出 `app/static/index.html` 和 `routers/page.py`，這兩項都還在，沒有衝突。
