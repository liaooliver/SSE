# Brief T6.4: Real-browser visual E2E of the redesigned page (Browser worker)

You are the BROWSER TESTER worker. Your working directory contains the project:
- `app/`, including the page served at `GET /`, which was just restyled with Preline UI (Tailwind CSS);
- `frontend/`, the page's build source;
- `docs/SPEC.md` **v1.1.4** (the only source of truth for behaviour);
- `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`.

You check, in a real Chrome browser with the Claude in Chrome tools:
- **(1)** that the redesign looks correct and polished in every UI state;
- **(2)** that R26/R27 behaviour still works (a regression check; the user decided the redesign is visual only, E10).

## Rules
- **Browser:**
  - Call `tabs_context_mcp` first, then open new tabs with `tabs_create_mcp`. Never use, read or navigate the user's existing tabs.
  - Only visit `http://127.0.0.1:<port>/...` on servers you started.
  - Close every tab you opened at the end.
  - Do not trigger `alert`/`confirm`/`prompt` dialogs.
- **Server:**
  - Start it yourself in the background on `127.0.0.1`, port 18500–18599: `uv run --env-file ./.t64-tmp/env uvicorn app.main:app --host 127.0.0.1 --port <p>`.
  - `./.t64-tmp/env` contains `SSE_DB_PATH=./.t64-tmp/page.db` and `SSE_LOG_INTERVAL=0.3`, so runs are slow enough to watch. Check R3 for the exact names.
  - Restart it with other settings when needed.
  - Stop every server you started (`lsof -iTCP:<p> -sTCP:LISTEN`, then `kill <pid>`) and confirm the port is free.
- `curl` is allowed only against your own server, for example to act as another client.
- Do not modify any project file. Temporary files go in `./.t64-tmp/`; delete it at the end, and never create `./install.db`.
- If a browser tool fails 2–3 times in a row, stop and report instead of looping.
- Time limit: 45 minutes.

## Evidence (required; checks without evidence count as not done)
- **Folder:** absolute path `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.4/`. Write nothing else outside your working directory.
- **Screenshots:**
  - For every check, take at least 2: one before the action and one after the result appears, plus one for each key state change.
  - Use the `computer` `screenshot` action with `save_to_disk: true`, then copy the returned file with Bash to `<folder>/<checkID>-<nn>-<desc>.png`, for example `V3-02-dark-running.png`.
- **GIF:** record the whole session, or at least V2 + R2 + R5, with `gif_creator` (`download: true`), then move the downloaded GIF into the folder.
- **`INDEX.md`:** one line per file in the folder: check ID, time taken, and what the screen should show.
- **Report:** list the screenshot file names for each check.

## Part V: Visual checks
For each, look at the screenshot and judge:
- alignment and spacing;
- clipped or overflowing text;
- contrast;
- consistent use of colour for the four statuses;
- visible focus rings when tabbing.

Report problems as `VISUAL ISSUE` with the screenshot name, what is wrong and where.

| ID | State |
|---|---|
| V1 | Load with no run, light mode, window about 1280 px wide: all nodes `pending`, header with `#scenario`, `#install-btn`, `#run-status` |
| V2 | `success` run in progress: running stage and task (spinner/badge), auto-scrolling log, disabled `#install-btn`, `#follow-btn` on; then finished: `#run-status` success colour |
| V3 | Dark mode (`prefers-color-scheme: dark`) for V1, V2 and V4. If you cannot switch the OS theme, emulate it (for example with the DevTools Protocol `Emulation.setEmulatedMedia`, or a temporary override in the page via `javascript_tool` that does not change files), and say which method you used |
| V4 | Failing scenario (for example `checksum_mismatch`): red failed task and stage, red error log lines, error box with `message` and `hint`, `#run-status` failed colour |
| V5 | Narrow window, about 375 px wide (`resize_window`): no horizontal scrolling; header controls wrap cleanly; stage and task lists are readable (they may stack, stages first) |
| V6 | Keyboard: Tab through `#scenario`, `#install-btn`, the stage buttons, the task heads and `#follow-btn`. Each shows a visible focus ring |
| V7 | `#follow-btn` off (after clicking another stage) versus on; collapsed versus expanded task; empty log 「（尚無 log）」 state |

## Part R: Behaviour regression (R26, R27)
For each, give the steps, what you observed (DOM state via `read_page`/`find`, visible text) and a verdict: `OK` / `DEVIATION` / `NOT CHECKED` with the reason.

1. **R1. Load (R26, R27 載入時).**
   - The fixed ids exist: `#scenario` is a `<select>` with the R12 options, plus `#install-btn`, `#run-status`, `#stage-list`, `#task-list`, `#follow-btn`.
   - All nodes are `pending` with `data-status`.
   - The network requests list shows **no request leaving `127.0.0.1:<p>`**.
2. **R2. Install `success`.**
   - The button is disabled while running.
   - Auto-follow tracks the running stage.
   - The running task expands, appends log lines and auto-scrolls; it collapses when it succeeds.
   - On `run_finished`, the result appears in `#run-status` and the button is enabled again.
3. **R3. Collapsed finished task.** Clicking it shows its log with no new HTTP request (check the network requests).
4. **R4. Failure.** The failed task stays expanded and red, error lines are red, `message`/`hint` are shown, and after the run auto-follow picks the failed stage (C2).
5. **R5. Follow rules (C3).**
   - Clicking the shown stage keeps auto-follow.
   - Clicking another stage stops it.
   - `#install-btn` does not restore it; only `#follow-btn` does.
6. **R6. Mid-run join.** Start a run with `curl -X POST`, then open the page mid-run: earlier logs are present, there are no duplicates and live updates continue.
7. **R7. Server stop/restart (R27 錯誤與重試, R25).**
   - Stop the server mid-run: `#run-status` shows an error.
   - Restart it on the same DB: the page recovers and shows the `failed` state with `E_INTERRUPTED`, and the error message is cleared once reconnected.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line:
   - `T6.4: PASS` when there are no `DEVIATION`s, no `VISUAL ISSUE`s and no missing evidence;
   - otherwise `T6.4: FAIL (<n> deviations, <v> visual issues, <k> not checked)`.
2. A table `ID | check | verdict | screenshots`, then a short block per check.
3. Write each `DEVIATION` as R id + SPEC quote + expected + actual, and each `VISUAL ISSUE` as screenshot + what + where + suggested fix.
4. Your overall impression of the design quality, 2–4 sentences.
5. Cleanup confirmation:
   - tabs are closed;
   - the server is stopped (paste the port check);
   - `./.t64-tmp/` is deleted;
   - there is no `install.db`;
   - the evidence folder file count matches `INDEX.md`.
