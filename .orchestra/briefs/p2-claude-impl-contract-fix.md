# Brief T2.6: Fix OpenAPI contract deviations (Implementer worker)

You are the IMPLEMENTER worker. Your working directory contains the project: `app/` (your earlier implementation), `docs/SPEC.md` **v1.1.1** (approved), `contracts/domain.pyi`, `contracts/openapi.yaml`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. Work only inside this directory. You may run only `uv ...` commands in the shell.

## Background
A verifier compared `create_app(...).openapi()` with `contracts/openapi.yaml`. `mypy stubtest` against `contracts/domain.pyi` passed. The schema deviations below are all on the implementation side. `AGENTS.md` (top) says that when it conflicts with `contracts/`, the contract wins.

## Fix exactly these (contract location in parentheses)
1. `info.version` is `"1.0.0"` → must be `"1.1.1"` (`openapi.yaml` `info.version`).
2. `GET /install/events` query `last_event_id` emits `pattern: "^[0-9]+\.[0-9]+$"` (via `json_schema_extra`) → remove it from the schema. The contract has no pattern (SPEC v1.1 A2). **Behaviour must stay per R9/R18**: strip surrounding whitespace, then parse; an invalid value → `422`.
3. `GET /health` `200` schema is `{type: object, additionalProperties: {type: string}}` → must be `{type: object, additionalProperties: false, required: [status], properties: {status: {type: string, const: ok}}}` (`openapi.yaml` `/health`). Response body stays `{"status": "ok"}` (R17).
4. `InstallStarted.run_id` (`POST /install` `202`) → `minimum: 1`.
5. `Snapshot.run_id` and `Snapshot.last_seq` → `minimum: 1`.
6. `TaskError.error_code`, `message`, `hint` → `minLength: 1`.
7. `LogItem.seq` and `LogItem.line_no` → `minimum: 1`; `LogItem.ts` → `format: date-time`. **The serialised `ts` string must not change** (R7 format); only the schema annotation.
8. `Stats.subscribers` → `minimum: 0`.

Check each against the exact YAML wording before editing. Things the verifier classed as FastAPI artefacts (`anyOf` with null versus `type: [x, "null"]`, components split into `PlanStage`/`StageOut`/…, the `422` `HTTPValidationError` body, SSE response headers not declared) are **not** to be changed.

## Do not
- Change any HTTP behaviour, status code, wire format or SSE logic. In particular the `reset` / `204` logic already follows SPEC R18 — leave it.
- Modify `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`, or create `tests/`.
- Add dependencies.

## Verify before reporting (paste outputs)
```
uv run ruff format --check .
uv run ruff check .
uv run mypy
```
Plus stubtest exactly as before (put a copy of `contracts/domain.pyi` as `app/domain.pyi` in a temporary stub dir, e.g. `./.t26-tmp/stubs/`, then `MYPYPATH=./.t26-tmp/stubs uv run python -m mypy.stubtest app.domain`). Then generate `create_app(db_path="./.t26-tmp/x.db").openapi()` with `uv run python -c ...` and show, for each item 1–8, the generated fragment next to the YAML requirement. Delete `./.t26-tmp/` afterwards. There is no test suite here; do not write one.

## Final message (your report)
Reply in Traditional Chinese: for each item 1–8, the file/line changed and the before → after schema fragment; the outputs above; anything you could not match exactly and why (`CONTRACT GAP` / `CONTRACT CONFLICT` if applicable).
