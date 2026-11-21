# Brief T4.4b: Two follow-up browser checks (Browser worker)

You are the BROWSER TESTER worker. Your working directory contains the project: `app/` (including the page served at `GET /`), `docs/SPEC.md` **v1.1.2** (approved; the only source of truth), `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. A previous browser session checked R26/R27 and found no deviations. Two items were left unobserved, and this session checks only those two. Judge against the SPEC only.

## Rules (same as before)
- **Browser:**
  - Call `tabs_context_mcp` first, then open **one new tab** with `tabs_create_mcp`. Never use, read or navigate any other tab.
  - Only visit `http://127.0.0.1:<port>/...` on servers you started.
  - Close your tab at the end. Do not trigger `alert`/`confirm`/`prompt`.
- **Servers:**
  - Bind servers to `127.0.0.1`, ports 18500–18599, and start them in the background.
  - Run the app as `uv run --env-file ./.t44b-tmp/<name>.env uvicorn app.main:app --host 127.0.0.1 --port <p>`. Each env file sets `SSE_DB_PATH` under `./.t44b-tmp/` and an `SSE_LOG_INTERVAL` (for example `0.3`).
  - Run any helper script as `uv run python ./.t44b-tmp/<script>.py`. Plain `python3` is not permitted.
  - Stop every server you started: find it with `lsof -tiTCP:<p> -sTCP:LISTEN`, stop it with `kill <pid>`, and confirm the port range is free.
- Use only `uv`, `curl`, `lsof` and `kill` in the shell, one simple command per call; avoid `$?`, `$(...)` and pipes into other interpreters.
- Write files only in `./.t44b-tmp/`. Delete it at the end, and never create `./install.db`.
- If a browser tool fails 2–3 times in a row, stop and report.
- Time limit: 25 minutes.

## Check A: R27 errors and retry (SPEC v1.1 C4)
R27: 「發生網路錯誤、同步流程中遇到 `409` 以外的錯誤，或這一輪還在執行時 `EventSource` 變成 `CLOSED`：在 `#run-status` 顯示錯誤，3 秒後重新執行同步流程。」

Trigger each case and record, for each, the `#run-status` text, the timing, and the requests made (`read_network_requests`). In particular, record whether `GET /install` is requested again about 3 s after the error.
1. **`EventSource` becomes `CLOSED` while the run is running:**
   - Start a run and load the page so it is streaming.
   - Stop the server, then start a server on the **same port but a new, empty DB**. Its `GET /install/events` returns `404`, which closes the `EventSource` per the WHATWG spec.
   - Expected: an error in `#run-status`, then about 3 s later a re-sync (`GET /install` → `404` → the plan with all nodes `pending`).
2. **Sync-flow error that is not a `409`:**
   - With the page open on a finished run, stop the server and reload the page. `GET /install` then fails with a network error.
   - Observe the error text and whether it retries about every 3 s.
   - Start the server again on the original DB, and confirm the page recovers by itself without a manual reload.
3. **Network error during a live stream (for the record):** stop the server mid-run and restart it on the same DB. Record what the page does: whether it shows the error, whether it re-runs the sync flow after about 3 s or relies on the `EventSource` auto-reconnect, and the end state. Do not classify this one; just report the facts precisely.

## Check B: R26 text safety, observed in the browser
R26: 「一律用 `textContent` 顯示內容，不用 `innerHTML`。」
- Write a small mock server at `./.t44b-tmp/mock.py` using only the Python standard library, and run it with `uv run python`, bound to `127.0.0.1` on a port in 18500–18599.
- It serves the real `app/static/index.html` at `/`, plus JSON for `/install/plan`, `/install/scenarios`, `/install` and `/install/logs` with the shapes from `contracts/openapi.yaml`.
- Put markup in the string fields, for example `<b>BOLD</b><img src=x onerror="document.title='PWNED'">`. Use it in stage and task names, scenario labels, log text, and the error `message`/`hint` of a failed task.
- `/install/events` may return `204`.
- Load the page and check that:
  - the markup appears as literal text;
  - no `<b>` or `<img>` element was created inside `#stage-list`, `#task-list`, `#scenario` or `#run-status` (inspect the DOM);
  - `document.title` is not `PWNED`.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line: `T4.4b: PASS` or `T4.4b: FAIL (<n> deviations)`.
2. Check A: for each of A1–A3, the steps, the observed `#run-status` texts with approximate timestamps, the request sequence, the end state, and a verdict for A1–A2 (`OK` / `DEVIATION`). A3 is facts only.
3. Check B: the observations and a verdict.
4. Each `DEVIATION` as: R id, SPEC quote, expected behaviour, actual behaviour.
5. Cleanup:
   - your tab is closed;
   - the servers are stopped (paste the port check);
   - `./.t44b-tmp/` is deleted;
   - no `install.db` exists.
