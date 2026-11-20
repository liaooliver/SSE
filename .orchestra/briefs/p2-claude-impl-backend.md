# Brief T2.1a: Implement the backend (Implementer worker)

You are a worker. Your working directory is a uv project (Python 3.13, FastAPI). Work only inside this directory and do not look outside it.

## Read first
- `docs/SPEC.md` v1.0 — the behaviour. **It is approved by the user**; ignore the "待使用者核准" wording in its title.
- `contracts/openapi.yaml` — HTTP shapes (SSE `data` schemas are under `x-sse-events`).
- `contracts/domain.pyi` — the exact public names/signatures `app/domain.py` must provide.
- `install-progress-sequence.svg` — the sequence diagram the SPEC is based on.
- `AGENTS.md` — coding standards and the definition of done.

## Goal
Implement everything in the SPEC **except the frontend page** (R26/R27 are a separate later task):
- `app/domain.py`: every name in `contracts/domain.pyi`, with identical signatures (it will be checked with `mypy stubtest`). R4–R10.
- `app/main.py`: `create_app(...)` with the **R2 signature** (the current file still has an old placeholder signature — replace it), config precedence and validation (R3), module-level `app = create_app()`, lifespan (DB open, schema, R25 startup recovery), all HTTP endpoints R11–R17, and the SSE endpoint R18–R24.
- SQLite persistence R25 (stdlib `sqlite3`, WAL, no sync DB calls inside `async def`, sequential writes so `seq` stays contiguous). Core invariant: events are written to SQLite **before** being broadcast.
- Further modules under `app/` are fine; keep the design simple (AGENTS.md: no speculative abstractions).
- For `GET /` (R26) you may leave it unimplemented; the next task adds it.

## Rules
- **Do not write tests and do not create a `tests/` directory.** Tests are written by a separate, isolated agent who only sees the SPEC and contracts. For your own sanity checks use throwaway commands (`uv run python -c ...`, a background `uv run uvicorn ...` plus `curl -N`), then delete any scratch files and stop every process you started.
- Do not add public interfaces beyond the contracts. Do not change `docs/SPEC.md`, `contracts/`, `AGENTS.md`, or the lint/type settings in `pyproject.toml`.
- No new dependencies (FastAPI already brings Pydantic and Starlette). If you truly need one, write `NEED DEPENDENCY: <pkg> — <reason>` in the report instead.
- If the SPEC/contracts are missing something you need, or contradict each other, do not guess silently: choose the most conservative reading, keep going, and list it as `CONTRACT GAP: ...` or `CONTRACT CONFLICT: ...` in the report.
- Time limit is 30 minutes. If you are running out of time, leave the code in a state where the quality gate passes and list what is unfinished.

## Definition of done
Run AGENTS.md §1 (skip `uv run pytest`, there are no tests here) and paste the real output:
```
uv sync
uv run ruff format --check .
uv run ruff check .
uv run mypy
```
A later phase compares `app.domain` against `contracts/domain.pyi` with `mypy stubtest` and `app.openapi()` against `contracts/openapi.yaml`, so match names, signatures, paths, status codes and required fields exactly.

## Final message (your report)
Reply in Traditional Chinese:
1. Files created/changed, and a short description of the architecture (modules, how events flow DB → broadcast → subscribers).
2. Which R-ids are implemented, partially implemented, or not implemented.
3. The quality-gate outputs.
4. Your manual sanity checks and their results.
5. All `CONTRACT GAP` / `CONTRACT CONFLICT` / `NEED DEPENDENCY` items, each with the reading you chose.
