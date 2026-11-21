# Brief T3.6: Close coverage gaps and harden timing (Test author)

You are the same independent test author who wrote `tests/`. You still have not seen, and will never see, the implementation. The documents here are **SPEC v1.1.2** (approved; the only source of truth), `contracts/domain.pyi`, `contracts/openapi.yaml`, `AGENTS.md`.

## Background
An independent verifier ran your suite against the implementation three times:
- 71 of 73 passed. The 2 failures (`test_r10_payload_fields[run_started]` and `[log]`) were judged **implementation bugs**, so leave those tests alone.
- No test was flaky across the three runs, and no test was judged wrong.
- The verifier made 10 deliberate bugs in the implementation, and your suite caught all 10.

The verifier then audited the suite against the SPEC. Its findings below are about your tests and the SPEC only.

## 1. Coverage gaps (add tests where the SPEC makes it checkable over the public interface)
For each item below, decide from the SPEC text whether it can be tested **deterministically** within your rules. If it can, add or extend a test. If not, write one line explaining why, and the reason will be recorded.
- **R14 「其他事件不額外等待」**: today only the spacing between log lines is bounded. Nothing bounds the time between non-log events, for example `run_started` → `stage_started` → `task_started` → first log, or the events across a task/stage boundary, when `log_interval` is large enough to detect an extra wait.
- **R15 `until` default 「預設為請求當下的 `last_seq`」**: omitting `until` is only tested after the run has finished. Nothing tests omitting `until` **while the run is running**. Mid-run syncs always pass `until` explicitly.
- **R19 headers on the `reset` response**: tests check its `200`, `retry` block, `reset` event and close, but not its `Content-Type` / `Cache-Control` (`no-cache`, `no-transform`) / `X-Accel-Buffering: no` / no compression. R19 says these apply to a `200` response. Decide whether the SPEC applies them to the `retry`+`reset` response too.
- **R25 startup recovery with no `running` task**: both recovery tests interrupt while a task is `running`. Nothing covers interruption when no task is running, for example only `run_started` written, or between two tasks with only the stage `running`. Only add a test if you can reach that state deterministically through the public interface and a restart. Otherwise explain.
- **R26 page requirements beyond ids**: 「一律用 `textContent` 顯示內容，不用 `innerHTML`」 and 「用 `addEventListener("<type>")` 監聽具名事件；收到 `run_finished` 或 `reset` 時呼叫 `close()`」. Nothing checks these, and nothing checks that inline scripts load no external resources. Add static checks on the served HTML only where the SPEC wording makes them unambiguous. Keep the checks robust to formatting, and do not require one particular code shape beyond what the SPEC says. Page *behaviour* stays with the later browser phase.

Not testable black-box under your rules, so do nothing for these: WAL mode, event loop not blocked (R25), and the R22 tie between a data event and a heartbeat.

## 2. Timing robustness (keep what each test proves; make it hold on a slower or loaded machine)
The verifier flagged these as possibly flaky on a slower machine. Its reasons are paraphrased:
- `tests/test_e2e.py::test_ac3_tcp_reconnect`: 30 rounds of a short `network_unreachable` run at `log_interval=0.01` (~0.25–0.3 s per run). A small delay after `POST /install` can leave the run already finished, or past the 3rd-from-last normal log, when the snapshot is taken. The test then fails on status not `running`, or on an empty random cut range.
- `tests/test_stream.py::test_ac1_ac2_midrun_sync[*]`: `log_interval=0.001`, and requires at least 1 of 10 syncs to see `running`. For short scenarios, slow scheduling can make all 10 land after the run ends.
- `tests/test_stream.py::test_r18_ac6_cursor_and_reinstall`: `dependency_missing` at `log_interval=0.06` (~1.1–1.2 s). A stall longer than that makes the `n > L` case get `204` instead of `reset`.
- `tests/test_stream.py::test_r20_replay_live_overlap`: `network_unreachable` at `log_interval=0.02` (~0.5 s). The run may end before there are 3 events past the replay boundary.
- `tests/test_stream.py::test_r16_r20_r22_r24_heartbeat_disconnect[env|explicit]`: heartbeat 0.06 s, interval 0.25 s, and an upper bound of ≤ 0.38 s between blocks. A CPU pause above ~0.25 s fails it.
- `tests/test_stream.py::test_r18_r20_r25_live_cursor`: requires the `retry` block within 0.2 s.
- `tests/test_e2e.py::test_ac9_tcp_headers_ping_disconnect`: polls `/stats` in a tight loop with no sleep while waiting for unsubscribe.

Prefer making preconditions explicit over loosening assertions:
- choose a longer scenario or a larger `log_interval`;
- wait on observed progress rather than wall-clock guesses;
- retry the setup when a precondition was missed, rather than failing;
- add a short sleep to polling loops;
- keep upper bounds that come from the SPEC (for example R24's 1 s / 2 s / 3 s) and widen only margins you chose yourself.

Keep the default (non-perf) suite reasonably fast. Today it takes ~30 s, so stay under ~60 s.

Minor: in `test_r3_r14_log_interval` the lower-bound check for the first log can never fail. Fix it only if it is trivial.

## Rules (unchanged)
- Only import `create_app`, `app` (from `app.main`) and the names in `contracts/domain.pyi` (from `app.domain`). Do not use any other internal structure and do not access SQLite directly.
- Do not create `app/`, stubs or fakes. You cannot run the suite here.
- Dependencies: exactly the dev group in `pyproject.toml` plus the standard library. If you need more, write `NEED DEPENDENCY: <pkg> — <reason>`.
- Do not modify `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`.
- Do not change tests that are unaffected, and do not weaken any assertion the SPEC requires.
- If the SPEC does not define something a test needs, do not guess: skip that assertion and write `CONTRACT GAP: ...`. For contradictions, write `CONTRACT CONFLICT: ...`.
- Time limit is 30 minutes.

## Checks you can run here (environment already synced; use `--offline`)
```
uv run --offline ruff format --check tests
uv run --offline ruff check tests
uv run --offline python -m compileall -q tests
```

## Final message (your report)
Reply in Traditional Chinese. **Do not paste test source code into the report**, because the coordinator is not allowed to read it.
1. Section 1: for each gap, list the node ids added or changed and the R/AC ids, or "not testable" with the reason.
2. Section 2: for each flagged node, say in words what you changed (no code), and whether any SPEC-derived bound changed (it should not).
3. Give the full updated table: `test node id` → R-ids / AC-ids → marker (none / e2e / perf), plus the total node counts (unmarked / e2e / perf).
4. List all `CONTRACT GAP` / `CONTRACT CONFLICT` / `NEED DEPENDENCY` items.
5. Paste the outputs of the three checks above.
