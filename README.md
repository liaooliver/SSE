# FastAPI Server-Sent Events demo

- Install: `uv sync`
- Run: `uv run uvicorn app.main:app --port 8000`
- Lint: `uv run ruff check .`
- Type-check: `uv run mypy`
- Test: `uv run pytest` (unit), `uv run pytest -m e2e` (real uvicorn server), `uv run pytest -m perf` (performance acceptance)
