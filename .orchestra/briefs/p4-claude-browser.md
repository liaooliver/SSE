# Brief T4.4: Real-browser E2E of the install page (Browser worker)

You are the BROWSER TESTER worker. Your working directory contains the project: `app/` (including the page served at `GET /`), `docs/SPEC.md` **v1.1.2** (approved; the only source of truth), `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. You check the page described by **R26 and R27** in a real Chrome browser, using the Claude in Chrome tools. Judge only against the SPEC.

## Rules
- **Browser:**
  - Call `tabs_context_mcp` first, then open **one new tab** with `tabs_create_mcp`. Never use, read or navigate the user's existing tabs.
  - Only visit `http://127.0.0.1:<port>/...` for the server you started.
  - Close your tab at the end.
  - Do not trigger `alert`/`confirm`/`prompt` dialogs.
- **Server:**
  - Start it yourself in the background, bound to `127.0.0.1` with a port in the range 18500–18599. Run it as `uv run --env-file ./.t44-tmp/env uvicorn app.main:app --host 127.0.0.1 --port <p>`, where you write `./.t44-tmp/env` containing `SSE_DB_PATH=./.t44-tmp/page.db` and, for example, `SSE_LOG_INTERVAL=0.3`, so runs are slow enough to watch.
  - Restart it with other settings when a check needs that.
  - Before finishing, stop every server you started (find the PID with `lsof -iTCP:<p> -sTCP:LISTEN`, then `kill <pid>`) and confirm the port is free.
- Use `curl` only against your own server, to act as "another client" or to inspect responses.
- Do not modify anything outside `./.t44-tmp/`. Delete `./.t44-tmp/` at the end, and never create `./install.db`.
- If a browser tool fails 2–3 times in a row, stop and report what failed instead of looping.
- Time limit: 40 minutes.

## Checks (R26, R27, SPEC v1.1 C1–C4)
For each check, give the steps, what you observed in the page (DOM state via `read_page`/`find`, visible text, colors), and a verdict (`OK` / `DEVIATION` / `NOT CHECKED` with the reason).
1. **Load with no run (R27 載入時, R26):** the plan is drawn, all nodes are `pending`, and the fixed ids exist (`#scenario` is a `<select>` with the R12 options, `#install-btn`, `#run-status`, `#stage-list`, `#task-list`, `#follow-btn`). Stage and task nodes carry `data-stage-id`/`data-task-id` and a `data-status` with R10 values. Nothing loads from outside the origin; check the network requests if available.
2. **Install `success` (R27 按下安裝, 畫面):**
   - `#install-btn` is disabled while running.
   - Auto-follow tracks the running stage.
   - The running task expands, appends log lines and auto-scrolls; it collapses on `task_succeeded`.
   - `data-status` values update live.
   - On `run_finished`, `#run-status` shows the result and the button is enabled again.
3. **Collapsed task log (R27):** clicking a collapsed, finished task shows its log **without a new HTTP request** (check the network requests).
4. **Failure scenario (R27 `task_failed`):** run a failing scenario, for example `checksum_mismatch`.
   - The failed task and its stage turn red and the task stays expanded.
   - `level: "error"` log lines are red.
   - `message` and `hint` are shown below.
   - After the run, auto-follow picks the failed stage (C2).
5. **Follow rules (C3):**
   - Clicking the currently shown stage keeps auto-follow.
   - Clicking another stage stops it; the view stays put while the run moves on.
   - Pressing `#install-btn` does not restore auto-follow; only `#follow-btn` does.
6. **Mid-run join (R27 同步流程, AC1 by eye):**
   - Start a run with `curl -X POST`, then load the page mid-run. The page catches up: all earlier logs are present, there are no duplicate lines, and live updates continue.
   - Do the same with a second tab opened mid-run, then close that extra tab.
7. **Reload mid-run:** reload the page during a run. The state is rebuilt with no duplicated or missing log lines.
8. **Errors (R27 按下安裝 409/422, C4):**
   - While a run is going (started via `curl`), the page shows `409` handling in `#run-status` when install is attempted. If the button is disabled, explain how you triggered it, or mark this `NOT CHECKED`.
   - Stop the server mid-run: `#run-status` shows an error.
   - Restart the server on the same DB: within a few seconds (the 3 s retry) the page re-syncs and shows the recovered `failed` state with `E_INTERRUPTED` (R25).
9. **Known limitation C1 (R27 已知限制):** while the page is showing a finished run, start a new run via `curl`. Per the **known limitation C1**, the page is not expected to notice. Pressing `#install-btn` then gives `409` shown in `#run-status`. Record what happens and judge it against C1.
10. **Text safety (R26):** content is shown with `textContent`. If you can, observe it; for example, scenario labels or log text containing `<` render literally.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. Start with the summary line: `T4.4: PASS` if there are no deviations, or `T4.4: FAIL (<n> deviations, <k> not checked)`.
2. Give a table `# | check | R/C | verdict`, then a short block per check describing what you observed.
3. Write each `DEVIATION` as R id + SPEC quote + expected behaviour + actual behaviour, in words, including the DOM attribute values or text you saw.
4. Confirm the cleanup:
   - your tab is closed;
   - the server is stopped (paste the port check);
   - `./.t44-tmp/` is deleted;
   - no `install.db` exists.
