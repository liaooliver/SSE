# Brief T4: End-to-end, exploratory and performance testing on a real server (Verifier)

You are the VERIFIER for this project. Your working directory is a fresh copy of the project:
- the implementation `app/`;
- the approved spec `docs/SPEC.md` **v1.1.2**;
- `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`;
- an independently written test suite `tests/`.

Phase 3 has passed: all 75 default tests pass, with no flakiness, and targeted mutations are killed. This phase checks the system **as a user and operator would**, against a real `uvicorn`. The SPEC is the only source of truth.

## Rules
- **Do not commit or keep any change** to `app/`, `tests/`, `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`.
- Everything temporary goes in `./.t4-tmp/`: databases, logs, scripts, captured streams. Always set `SSE_DB_PATH` (or pass `db_path`) to a file under `./.t4-tmp/`. The default `./install.db` must never be created.
- **Servers:**
  - Bind servers only to `127.0.0.1`, on ports in the range 18000–18999.
  - Before you finish, stop every server and background client you started, and confirm that no `uvicorn` process you started is still running.
  - Never touch processes you did not start.
- Run `uv sync` first. Use `uv run ...` for Python tools; `curl` is allowed. Stay inside this directory, and do not open a browser (another agent does that).
- **Do not paste test source code or implementation source code into your report.** Describe each finding as **requirement id + expected behaviour (with a SPEC quote) + actual behaviour**, with the command you ran and the relevant raw output, such as HTTP headers or SSE lines. Refer to tests only by node id.
- Time limit: 45 minutes.

## T4.1 Automated E2E
1. Run `uv run pytest -q -rA -m e2e` **3 times**. Report the summary lines, any failing node, and any flakiness.

## T4.2 Exploratory E2E against `uv run uvicorn app.main:app --host 127.0.0.1 --port <p>`
Use short `SSE_LOG_INTERVAL` values (or the SPEC's configuration names; check R3) so runs finish quickly. For each check, give the command, the observation, and a verdict (`OK` / `DEVIATION`).
1. **Plain endpoints (R11–R17, R26):**
   - `GET /health`, `/install/plan`, `/install/scenarios`, `/install` (before any run: `404`), `/stats`, and `/`, showing headers and bodies.
   - `GET /install/events` with no run: per SPEC.
   - Invalid inputs: `POST /install` with a bad body, an unknown scenario or bad JSON (`422`). `GET /install/logs` with a bad `limit`, `after` or `until` (`422`), and with the wrong `run_id` (`409`).
2. **Live stream with `curl -N`:**
   - Start a run, then attach 3 concurrent `curl -N` clients at different moments.
   - Check R19 headers, including no compression even with `Accept-Encoding: gzip`.
   - Check that the first block is `retry: 3000`, that ids are `<run_id>.<seq>`, and that seq is contiguous with no duplicates per client.
   - Check that each stream ends after `run_finished` (R21), and that `/stats` counts rise and fall correctly (R16).
3. **Reconnect (R18, AC3 by hand):**
   - Cut a `curl` mid-run, then reconnect with `Last-Event-ID: <last id>`, and also with `?last_event_id=` plus surrounding whitespace.
   - Confirm the stream continues with no gap and no duplicate.
   - Try the R18 cases:
     - an id from an older run (`reset`);
     - `n > L` while running (`reset`);
     - after the run finishes, `n = L` and `n > L` (`204`);
     - a malformed id (`422`).
4. **Concurrency (R14, AC8):** fire about 10 `POST /install` requests in parallel. Exactly one `202` is expected, and the rest `409`. While running, `POST` again (`409`). After it finishes, a new `POST` gives a larger `run_id`.
5. **Heartbeat (R22):** with a long log interval, an idle stream receives `: ping` at roughly `heartbeat_interval`.
6. **Disconnect (R24):** kill a `curl` client. `/stats.subscribers` should return to its previous value within 2 s.
7. **Shutdown (R24):** with SSE clients attached mid-run, send SIGINT to the server, and in a second trial SIGTERM. The server should exit within 3 s and the clients' streams should end. Restart on the same DB: `GET /install` shows `failed` with `E_INTERRUPTED` (R25, AC9).
8. **Crash recovery (R25):** SIGKILL the server mid-run, restart on the same DB, and repeat the check. Confirm `run_id` keeps increasing after restart (R14).
9. **Logs paging (R15):** page through a finished run with small `limit`, and check that `next_after` chains to the full log set with no gap or overlap. While running, omitting `until` stops at the current `last_seq`.
10. **Slow subscriber (R23), if practical:** set a small subscriber queue size. A client that does not read (for example a stalled `curl` with a tiny receive buffer, or a Python client that stops reading) is disconnected, and other clients are unaffected. If you cannot make this deterministic, say so.

## T4.3 Performance (AC11)
Run `uv run pytest -q -rA -m perf` **3 times**. Report the summary, and the p95 latency if the test prints it. Do not run anything else heavy at the same time.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. Start with the summary line: `T4: PASS`, meaning e2e all pass ×3, no deviations, and perf passes ×3. Otherwise write `T4: FAIL (<n> deviations, <f> failing/flaky nodes, perf <pass|fail>)`.
2. T4.1 results.
3. T4.2: a table `# | check | R/AC | verdict`, then a block for each check with commands and key raw output (headers or SSE lines, trimmed).
4. Each `DEVIATION` classified as `IMPL BUG` / `TEST BUG` / `SPEC AMBIGUOUS`, with an R id, a SPEC quote, the expected behaviour and the actual behaviour.
5. T4.3 results.
6. Confirm the cleanup:
   - `./.t4-tmp/` is deleted;
   - no `install.db` exists anywhere here;
   - no server you started is still running (paste the check);
   - `git status --short` is empty (paste it).
