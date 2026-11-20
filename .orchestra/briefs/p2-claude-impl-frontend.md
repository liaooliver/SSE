# Brief T2.1b: Implement the frontend page (Implementer worker)

You are a worker. Your working directory is a uv project (Python 3.13, FastAPI) whose backend was implemented in the previous task. Work only inside this directory and do not look outside it.

## Read first
- `docs/SPEC.md` v1.0 — especially §7 (R26, R27), and §9's browser checklist ("瀏覽器手動驗收"). **The SPEC is approved by the user**; ignore the "待使用者核准" wording in its title.
- `contracts/openapi.yaml`, `install-progress-sequence.svg` (stage 1 of the diagram is the R27 sync flow), `AGENTS.md`.
- The existing code under `app/` (the backend you must integrate with, without changing its behaviour).

## Goal
Implement `GET /` (R26) and the page behaviour (R27):
- One self-contained HTML page: no CDN, fonts or external scripts. Served with `Content-Type: text/html; charset=utf-8`.
- Exact element ids: `#scenario`, `#install-btn`, `#run-status`, `#stage-list`, `#task-list`, `#follow-btn`; `data-stage-id` / `data-task-id` / `data-status` attributes as specified.
- `textContent` only, never `innerHTML`. Named events via `addEventListener`; `close()` on `run_finished` / `reset`.
- Sync flow: snapshot → paginated log catch-up (`after=0` up to `until=S`) → `EventSource` with `last_event_id=<run_id>.<S>`; apply only events with `seq` greater than the highest applied; restart the flow on `reset` or on `409` during catch-up.
- Layout: stages on the left, tasks of the selected stage on the right; auto-follow the running stage until the user clicks another stage, resume with `#follow-btn`. Running task expanded with auto-scrolling log lines, collapsed on success; reopening a collapsed task shows its log with **no new request**. Failed task and its stage red and expanded, `level: "error"` lines red, `message` and `hint` shown. Install button disabled while running; errors (`409`/`422`) shown in `#run-status`.
- Keep the page plain and readable; a small amount of inline CSS is fine.

## Rules
- **Do not write tests and do not create a `tests/` directory.** Sanity-check with a background `uv run uvicorn ...` and `curl`; stop every process you started and delete scratch files.
- Do not change backend behaviour or public interfaces; do not change `docs/SPEC.md`, `contracts/`, `AGENTS.md`, or lint/type settings. No new dependencies.
- Missing or contradictory requirements: choose the most conservative reading and report `CONTRACT GAP: ...` / `CONTRACT CONFLICT: ...`.
- Time limit is 30 minutes.

## Definition of done
Run and paste the real output:
```
uv sync
uv run ruff format --check .
uv run ruff check .
uv run mypy
```

## Final message (your report)
Reply in Traditional Chinese: files created/changed; how each R27 bullet is implemented (one line each); quality-gate outputs; manual checks; all `CONTRACT GAP` / `CONTRACT CONFLICT` items.
