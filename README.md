# Install progress streaming (FastAPI + SSE)

Spec: `docs/SPEC.md` (v1.0) · Contracts: `contracts/` · Design notes: `docs/plans/spec_v1_plan.md`

- Install: `uv sync`
- Run: `uv run uvicorn app.main:app --port 8000`
- Lint: `uv run ruff format --check . && uv run ruff check .`
- Type-check: `uv run mypy`
- Test: `uv run pytest` (unit), `uv run pytest -m e2e` (real uvicorn server), `uv run pytest -m perf` (performance acceptance, AC11)
