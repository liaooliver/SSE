T6.4: FAIL (0 deviations, 1 visual issue, 0 not checked)

The R26/R27 behaviour is intact, and the redesign looks good in every state. The only defect is a small padding asymmetry in the log box.

Evidence is in `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.4/`: 52 files, all listed in `INDEX.md`. That is 49 PNGs, 1 GIF (`T6.4-session.gif`, 44 frames, covers V2, R2 and R5) and `INDEX.md`.

## Methods and limits
- **Dark mode:** the browser's OS theme is dark, so V3 and the shots labelled dark are native dark.
- **Light mode:** I emulated it with a temporary in-page override through `javascript_tool`. It sets every `@media (prefers-color-scheme: dark)` rule to `not all` and `color-scheme: light`. No project file was changed.
- **375 px:** Chrome's minimum window width is 500 px, so `resize_window` could not go lower.
  - V5-01/02 are the real window at 500 px.
  - V5-03/04 are a 375 px same-origin iframe of the live page. The page's `scrollWidth` was 375 and no element overflowed.
- **Click timing:** my tool calls are slower than the 0.3 s log interval. The click to expand a pending task during a run (`success` run) missed. I got the 「（尚無 log）」 state after a fast-failing run instead.

## Results
| ID | Check | Verdict | Screenshots |
|---|---|---|---|
| V1 | Light, no run, 1280 px | OK | V1-01, V1-02 |
| V2 | `success` run in progress and finished | OK | V2-01…V2-04 |
| V3 | Dark for V1, V2, V4 | OK | V3-01…V3-04, V4-03…V4-06 |
| V4 | Failing scenario | OK | V4-01…V4-06 |
| V5 | Narrow window | OK (375 px via iframe) | V5-01…V5-04 |
| V6 | Keyboard focus rings | OK | V6-01…V6-07 |
| V7 | Follow off/on, collapsed/expanded, empty log | OK | V7-01…V7-04 |
| R1 | Load | OK | R1-01, R1-02 |
| R2 | Install `success` | OK | R2-01…R2-03 |
| R3 | Collapsed finished task | OK | R3-01, R3-02 |
| R4 | Failure | OK | R4-01, R4-02, V4-03, V4-05 |
| R5 | Follow rules | OK | R5-01…R5-05 |
| R6 | Mid-run join | OK | R6-01, R6-02 |
| R7 | Server stop/restart | OK | R7-01…R7-03 |

## Check notes
- **V1:** all nodes are `pending`. The header shows the `#scenario` select, `#install-btn` and `#run-status`, which sits on its own row under the header at 1280 px.
- **V2:** the running stage has a spinner badge. The log auto-scrolls, `#install-btn` is disabled and the follow badge shows 「自動跟隨中」. At the end `#run-status` turns green and the button is enabled.
- **V3 and V4:** both modes use consistent colours for the four statuses (grey pending, blue running, green succeeded, red failed). The failed task and stage, the red error log line and the error box with code, message and hint all show up in dark.
- **V5:** the header controls wrap cleanly at 500 px and 375 px. Stages stack above tasks and the log lines wrap.
- **V6:** the Tab order is select, install, the four stage buttons, `#follow-btn`, then the task heads. Each shows a clear blue ring.
- **V7:** the follow badge flips between 「自動跟隨中」 and an outline 「恢復自動跟隨」. The empty log shows 「（尚無 log）」.
- **R1:**
  - The fixed ids exist and `#scenario` is a `<select>` with the 7 R12 options.
  - All stage and task nodes carry `data-status="pending"`.
  - The page's requests were `/`, `/install/plan`, `/install/scenarios` and `/install` (404), all to `127.0.0.1:18500`. The `chrome-extension://` and `data:` entries come from the Claude extension, not the page.
- **R2:**
  - Install is disabled while running and follow tracks the running stage.
  - The running task expands, appends log lines and auto-scrolls, then collapses on success.
  - `run_finished` shows the result and re-enables the button.
- **R3:** expanding a collapsed finished task showed its 10 log lines, and the network list had 0 new requests.
- **R4:**
  - The failed task stays expanded and red, with the red error line and `message`/`hint` shown.
  - With `network_unreachable`, follow was on and the failed stage 下載套件 was selected automatically after the failure, including a failure with 0 normal log lines.
  - A reload also lands on the failed stage.
- **R5:**
  - Clicking the shown stage kept follow on.
  - Clicking another stage turned it off, and `#install-btn` did not restore it. The view stayed on 準備環境 while 下載套件 ran in the next run.
  - `#follow-btn` restored it.
- **R6:** a `curl` run was joined mid-run. Every task's line count equalled its plan count with no duplicates (168 log lines across 12 tasks), and live updates continued to the green finish.
- **R7:**
  - After stopping the server mid-run, `#run-status` showed 「連線中斷，瀏覽器重新連線中…」.
  - After restarting on the same DB, within about 1 second the page showed run 6 `failed` with `E_INTERRUPTED` and 「伺服器在安裝途中停止」, and the error message was cleared.
  - `GET /install` confirmed `status: failed` with `E_INTERRUPTED`.

## Visual issue
- **VISUAL ISSUE (minor):** the log box has uneven padding in its task card.
  - Screenshots: V2-01, V3-02, R3-02, V7-03 (V7-03 only shows the empty-log box).
  - Where: the log `<pre>` inside any expanded task card. There is about 16 px above the black box but about 28 px below it. In R3-02 the box ends at y≈495 and the card at y≈524.
  - Suggested fix: remove the extra bottom margin or padding under the log block, so the top and bottom padding match.
- **Not a defect, for the record:** in the 500 px window the long error text in `#run-status` breaks at a hyphen (`core-` / `2.4.1.pkg`) in V5-01.

## Design quality
The page looks coherent and polished in both themes. The status badges are clear, spinners and the follow badge communicate state well, and the focus rings are strong. The error box and red log line make a failure obvious at a glance. Narrow layouts stack sensibly with no horizontal scroll.

## Cleanup
- **Tabs:** both tabs I opened are closed, and the tab group is gone.
- **Server:** stopped.
  ```
  port check:
  (port 18500 free)
  ```
- **Temp files:** `./.t64-tmp/` is deleted.
- **`install.db`:** it does not exist.
- **Evidence count:** the folder has 52 files and `INDEX.md` lists 52.
- **Side effect:** `uv sync` created `./.venv`, which was not there before. I left it in place and changed no project file.