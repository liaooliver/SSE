# Brief T2.4: Align the test suite with SPEC v1.1.1 (Test author)

You are the same independent test author who wrote `tests/` from SPEC v1.0. The implementation still does not exist here, and you will never see it. The user has approved two rounds of contract fixes, partly in response to your own CONTRACT GAP / CONFLICT report. The documents in this workspace are now **SPEC v1.1.1** (approved; it is the only source of truth).

## Read first
- `docs/SPEC.md` — the appendix has two change tables: **`v1.0 → v1.1 變更明細`** (A1–C5) and **`v1.1 → v1.1.1 變更明細`** (D1–D4). Start there, then read each changed R/AC in full.
- `contracts/domain.pyi` and `contracts/openapi.yaml` — updated (type aliases, `script_for`/`ScriptStep`/`apply_event` docstrings, `until`, `InstallRequest`, `last_event_id`).
- `AGENTS.md` — unchanged apart from §5 project structure.

## Goal
Update `tests/` so that every test agrees with v1.1.1. In particular, check your tests against:
- **A1 / AC4**: the script's `run_started.data` is `{"scenario"}` only; compare after also removing `run_started.data.run_id`, and assert that it equals the actual run id.
- **A2 / R9**: whitespace around `last_event_id` is stripped before matching.
- **A3, D1–D3 / R10**: the full list of cases where `apply_event` must raise, and the explicit "not required — tests must not assert either way" cases (stage finishing with unfinished tasks; `run_started` data contents; plan order / single running). Remove any assertion on a "not required" case.
- **A4, D4 / R16, R20**: `/stats` counts only streaming connections; `404`, `204` and `retry`+`reset`-then-close responses are not counted.
- **B2+B3 / AC11** (perf): new procedure and latency sample definition.
- **B4 / AC1**: the precise seq accounting.
- **B5**: OpenAPI shapes of `until` and `POST /install` body.
- **C1–C4 / R27**: browser behaviour; only cover what is checkable over HTTP (the browser checklist is done by another agent later).
Also fill coverage gaps that the new wording now makes testable. Do not rewrite tests that are unaffected.

## Rules (unchanged from T2.2)
- Only import `create_app`, `app` (from `app.main`) and the names in `contracts/domain.pyi` (from `app.domain`). No other internal structure; no SQLite access except the SIGKILL-and-restart recovery test via restart only.
- Do not create `app/`, stubs or fakes. You cannot run the suite here.
- Dependencies: exactly the dev group in `pyproject.toml` plus the standard library. If you need more, write `NEED DEPENDENCY: <pkg> — <reason>`.
- Do not modify `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`.
- If v1.1.1 still does not define something a test needs, do not guess: skip that assertion and write `CONTRACT GAP: ...`; for contradictions write `CONTRACT CONFLICT: ...`.
- Time limit is 30 minutes.

## Checks you can run here (environment already synced; use `--offline`)
```
uv run --offline ruff format --check tests
uv run --offline ruff check tests
uv run --offline python -m compileall -q tests
```

## Final message (your report)
Reply in Traditional Chinese. **Do not paste test source code into the report** — the coordinator is not allowed to read it.
1. For each change item (A1–C5, D1–D4): which test node ids changed / were added / were removed, or "no change needed" with a one-line reason.
2. The full updated table: `test node id` → R-ids / AC-ids → marker (none / e2e / perf), and the total node counts.
3. Coverage: every R1–R29 and AC1–AC12, covered / partially / not covered, with reasons.
4. All remaining `CONTRACT GAP` / `CONTRACT CONFLICT` / `NEED DEPENDENCY` items.
5. The outputs of the three checks above.
