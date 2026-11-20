# Brief T2.2: Write the test suite (Test author)

You are the independent test author. Your working directory contains only the specification and contracts. **The implementation does not exist here, and you will never see it.** Your tests must be derived from the documents alone, so that they judge the implementation as a black box.

## Read first
- `docs/SPEC.md` v1.0 — the behaviour. **It is approved by the user**; ignore the "待使用者核准" wording in its title. §9 (acceptance criteria) and §10 (test guidance) are written for you.
- `contracts/openapi.yaml` — HTTP shapes (SSE `data` schemas are under `x-sse-events`).
- `contracts/domain.pyi` — the public Python names you may import from `app.domain`.
- `install-progress-sequence.svg` — the sequence diagram the SPEC is based on.
- `AGENTS.md` — coding standards (§ on tests applies to you).
- `pyproject.toml` — pytest config, markers `e2e` and `perf`, and the available dev dependencies.

## Goal
Write the full test suite under `tests/`:
- **Unit**: `app.domain` names (R4–R10): plan, scenarios, scripts, event id format/parse, `initial_snapshot`, `apply_event`, `format_event`.
- **Integration**: drive the app directly through the ASGI interface as described in R2 and §10 (send `lifespan.startup`/`lifespan.shutdown`; provide your own `receive`/`send`; `http.disconnect`; a blocking `send` for the slow-subscriber case). Cover R3, R11–R25 and AC1, AC2, AC4–AC8, AC10.
- **E2E** (`@pytest.mark.e2e`): real `uvicorn` subprocess, single worker, OS-assigned port, readiness via `GET /health` (R17), no fixed sleeps. Cover AC3, AC9 (including the SIGKILL-and-restart recovery test, the only allowed exception for touching the SQLite file — via restart only, never reading/writing tables), R24 timing, and the `GET /` page basics of R26 that are checkable over HTTP (status, content type, required element ids, no external resources).
- **Perf** (`@pytest.mark.perf`): AC11.
- Every test name or docstring must carry the R-id/AC-id it checks. Use `tmp_path` for `db_path`; timing assertions per §10 (strict lower bound, upper bound ×3 + 200 ms). No randomness without a fixed seed.

## Rules
- Only import `create_app`, `app` (from `app.main`) and the names listed in `contracts/domain.pyi` (from `app.domain`). Do not depend on any other internal structure, and do not read/write the SQLite file except as allowed above.
- **Do not create an `app/` directory, stubs, or fakes of the implementation** in this workspace. You cannot run the suite here; that happens later in another environment.
- Allowed dependencies are exactly the dev group in `pyproject.toml` (`pytest`, `pytest-asyncio`, `pytest-timeout`, `httpx`, `httpx-sse`, `ruff`, `mypy`) plus the standard library. Do not add any; if you need one, write `NEED DEPENDENCY: <pkg> — <reason>` in the report.
- Do not modify `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`. Shared fixtures go in `tests/conftest.py`.
- If the SPEC/contracts do not define something a test needs, do not guess: skip that assertion and write `CONTRACT GAP: ...`; for contradictions write `CONTRACT CONFLICT: ...`.
- The browser checklist in §9 ("瀏覽器手動驗收") is done by another agent in a later phase; you do not need to cover it.
- Time limit is 30 minutes.

## Checks you can run here (the environment is already synced; use `--offline`)
```
uv run --offline ruff format --check tests
uv run --offline ruff check tests
uv run --offline python -m compileall -q tests
```

## Final message (your report)
Reply in Traditional Chinese. **Do not paste test source code into the report** — the coordinator is not allowed to read it.
1. A table: `test node id` → R-ids / AC-ids → marker (none / e2e / perf).
2. Coverage: every R1–R29 and AC1–AC12, marked covered / partially covered / not covered, with a reason for anything not fully covered.
3. All `CONTRACT GAP` / `CONTRACT CONFLICT` / `NEED DEPENDENCY` items.
4. The outputs of the three checks above.
