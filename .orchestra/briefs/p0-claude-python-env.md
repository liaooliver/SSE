# Brief: Python / FastAPI environment setup (Implementer worker)

You are a worker. Your working directory is a uv project (`pyproject.toml`, `.python-version` = 3.13) with an empty `app/` directory and a `SPEC.md` for context. Work only inside this directory. Do NOT write any tests and do NOT create a `tests/` directory — tests are written by a different, isolated agent.

## Goal
Set up a reproducible Python environment for a FastAPI Server-Sent Events demo, so that the implementation phase and the (separate) test phase can both start immediately.

## Do this
1. **Runtime dependencies** (`uv add`): `fastapi`, `uvicorn[standard]`. Do NOT add an SSE helper library; the implementation will use FastAPI/Starlette primitives.
2. **Dev dependency group** (`uv add --dev`): `pytest`, `pytest-asyncio`, `pytest-timeout`, `httpx`, `httpx-sse`, `ruff`, `mypy`.
3. **`pyproject.toml` configuration**:
   - Project description: "FastAPI Server-Sent Events demo".
   - `[tool.pytest.ini_options]`: `testpaths = ["tests"]`, `asyncio_mode = "auto"`, `asyncio_default_fixture_loop_scope = "function"`, default `timeout = 30`, and register markers `e2e` (starts a real uvicorn server) and `perf` (performance acceptance, R19). Add `addopts = "-m 'not perf'"` so perf tests run only when requested explicitly.
   - `[tool.ruff]`: `target-version = "py313"`, `line-length = 100`; `[tool.ruff.lint]` select `E`, `F`, `I`, `UP`, `B`, plus per-file `T201` enforced for `app/**` (R21).
   - `[tool.mypy]`: `python_version = "3.13"`, `strict = true`, `files = ["app"]`.
4. **Minimal app skeleton** (just enough to prove the environment works; the real implementation comes later):
   - `app/__init__.py` (empty)
   - `app/main.py` containing `create_app(heartbeat_interval: float | None = None, history_size: int | None = None, subscriber_queue_size: int | None = None) -> FastAPI` that returns a FastAPI app exposing only `GET /health` → `{"status": "ok"}`, plus a module-level `app = create_app()`. Parameters can be accepted and ignored for now, with a `# TODO(T2.1)` comment.
5. **`README.md`** (short): how to install (`uv sync`), run (`uv run uvicorn app.main:app --port 8000`), lint (`uv run ruff check .`), type-check (`uv run mypy`), test (`uv run pytest`, `uv run pytest -m e2e`, `uv run pytest -m perf`).
6. **Verify** and paste the real output of each command into your report:
   - `uv sync`
   - `uv run python -c "import fastapi, uvicorn, httpx, httpx_sse, pytest; print(fastapi.__version__)"`
   - `uv run ruff check .`
   - `uv run mypy`
   - Start `uv run uvicorn app.main:app --port 8765` in the background, `curl -s http://127.0.0.1:8765/health`, then stop the server and confirm the process is gone.
   - `uv run pytest` (expected: "no tests ran"; exit code 5 is acceptable here)

## Constraints
- Do not touch `SPEC.md`.
- Do not look outside this directory.
- Leave no background processes running.

## Final message (your report)
Reply in Traditional Chinese: files created or changed, the resolved versions of fastapi, uvicorn, pytest, and httpx-sse, the verification outputs from step 6, and any problems.
