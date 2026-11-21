# Brief T3 round 2: Re-verify after fixes (Verifier)

You are the VERIFIER for this project. Your working directory is a fresh copy of the project:
- the implementation `app/`;
- the approved spec `docs/SPEC.md` **v1.1.2**;
- `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`;
- the test suite `tests/`, written independently from the SPEC by an author who never saw `app/`.

The SPEC is the only source of truth.

## What changed since round 1
In round 1, 71/73 passed and there was no flakiness. All 10 of 10 deliberate mutations were killed. Since then:
- **Implementation fix (R8, R10 item 9):** `apply_event` should now raise `ValueError` when an event's `data` is missing a field or has a wrong-typed field (per R8), for every event type. The round-1 failures were `tests/test_domain.py::test_r10_payload_fields[run_started]` and `[log]`.
- **Test changes, made by the test author from a coverage audit:**
  - New `tests/test_http.py::test_r14_nonlog_timing`: R14 「其他事件不額外等待」.
  - New `tests/test_stream.py::test_r15_midrun_default_until`: R15, omitting `until` while the run is running.
  - `tests/test_stream.py::test_r16_r20_excluded_responses` and `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall` now also check the R19 headers on the `retry`+`reset` response.
  - `tests/test_e2e.py::test_r26_html` now also statically checks the served HTML for the R26 rules (`textContent` not `innerHTML`, `addEventListener` for named events, `close()` on `run_finished`/`reset`, no external resources).
  - These timing-sensitive tests were hardened by checking their preconditions and retrying setup, without changing SPEC-derived bounds: `test_ac3_tcp_reconnect`, `test_ac1_ac2_midrun_sync[*]`, `test_r18_ac6_cursor_and_reinstall`, `test_r20_replay_live_overlap`, `test_r16_r20_r22_r24_heartbeat_disconnect[*]`, `test_r18_r20_r25_live_cursor`, `test_ac9_tcp_headers_ping_disconnect`, and `test_r3_r14_log_interval` (a no-op assertion was removed).

## Rules
- **Do not commit or keep any change** to `app/`, `tests/`, `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml` or `uv.lock`. Mutations are temporary: restore with `git checkout -- app/` after each one, and confirm at the end that `git status --short` is empty.
- Temporary files go only in `./.t3-tmp/`; delete it before you finish. Never write outside this directory. If you construct the app yourself, always pass a `db_path` under `./.t3-tmp/`. The default `./install.db` must never be created.
- Run `uv sync` first, and use `uv run ...` for every tool. Stay inside this directory.
- **Your report must not contain test source code or implementation source code.** The coordinator forwards your findings to people who must not see the other side's code. Describe everything as **requirement id + expected behaviour + actual behaviour**, and refer to tests only by pytest node id.
- `perf` tests are excluded; `e2e` tests are included.
- The time limit is 45 minutes.

## A. Run the suite
1. Run `uv run pytest -q -rA --durations=5`. The default selection is everything except `perf`; 75 nodes are expected. Paste the summary line, the failed/errored node ids, the total wall time and the 5 slowest nodes.
2. Run it **two more times**, and report any node whose result differs between runs (flaky).

## B. Classify every failure
Use `IMPL BUG` / `TEST BUG` / `SPEC AMBIGUOUS`, exactly as in round 1:
- R/AC id;
- SPEC quote;
- expected behaviour;
- actual behaviour, in words only.

## C. Judge the changed tests against the SPEC
For each new or changed test listed above, say whether it:
- **(a)** asserts only what the SPEC requires, without over-constraining the implementation (for example, the R26 static checks must not demand one particular code shape beyond the SPEC wording; the R14 non-log timing tolerance must be reasonable);
- **(b)** can actually fail when the requirement is broken.

Then confirm with **targeted mutations**, one at a time, restoring after each:
1. R10 item 9: remove the `data` field/type validation for one event type.
2. R14: add an extra wait (about the log interval) before a non-log event.
3. R15: make an omitted `until` mean "no upper bound" instead of the `last_seq` at request time.
4. R19: drop one required header (for example `X-Accel-Buffering`) from the `retry`+`reset` response only.
5. R26: switch one place in the page script from `textContent` to `innerHTML`.
6. Repeat 2 mutations from round 1 of your choice (for example R20 boundary dedup and R23 slow subscriber) to confirm the hardened tests still kill them.

For each mutation, report: the R id, the change in words, the command, whether it was killed, and the killing node ids.

## D. Remaining coverage notes
Briefly list any requirement still not meaningfully tested, beyond the items already declared not testable:
- R25 recovery with no `running` task;
- WAL mode / event loop not blocked;
- the R22 data-vs-heartbeat tie;
- browser-only behaviour: R27, C1–C4.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line: `T3: PASS` (all 75 pass, no flaky, all targeted mutations killed, no TEST BUG) or `T3: FAIL (<n> impl bugs, <m> test bugs, <k> ambiguous, <f> flaky, <s> survived mutations)`.
2. Section A outputs.
3. Section B findings.
4. Section C: a per-test verdict, then the table `# | R id | mutation (words) | killed? | killing node ids`.
5. Section D.
6. Confirm that `./.t3-tmp/` is deleted and no `install.db` exists anywhere in this directory, and paste `git status --short`, which must be empty.
