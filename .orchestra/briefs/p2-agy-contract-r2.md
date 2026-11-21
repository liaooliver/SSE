# Brief T2.5r: Contract check, second round (Verifier)

You are the VERIFIER for this project. Your working directory is a fresh copy of the project: the implementation `app/`, the approved spec `docs/SPEC.md` **v1.1.2**, the contracts `contracts/domain.pyi` and `contracts/openapi.yaml`, `AGENTS.md`, `pyproject.toml`, `uv.lock`, plus a test suite `tests/` written independently from the SPEC by a different author who never saw `app/`.

A previous contract check found 9 deviations. They have been fixed (see the SPEC appendix `v1.1.1 → v1.1.2 變更明細` for the contract side). This round repeats the contract check from scratch and adds the project-wide quality gate. Do not run the test suite itself and do not judge behaviour beyond what is asked — that is the next phase.

## Rules
- **Do not modify** `app/`, `tests/`, `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. Temporary files go only in `./.t25-tmp/`; delete that directory before you finish.
- **Never write outside this directory.** Whenever you construct the app, always pass `db_path` under `./.t25-tmp/` (the default `./install.db` must never be created, here or anywhere else). Do not start servers.
- Run `uv sync` first. Use `uv run ...` for every tool.
- Stay inside this directory. Do not look at any other directory on this machine.
- **Your report must not contain test source code** (the coordinator is not allowed to read it). Refer to tests only by file name, pytest node id and imported names.
- Undecidable from SPEC v1.1.2 + contracts → `CONTRACT GAP: ...`; contradictions between documents → `CONTRACT CONFLICT: ...`. Do not guess and do not fix.
- Time limit 30 minutes.

## Checks

**1. stubtest.** Copy `contracts/domain.pyi` to `./.t25-tmp/stubs/app/domain.pyi` with an empty `./.t25-tmp/stubs/app/__init__.pyi`, then `MYPYPATH=./.t25-tmp/stubs uv run python -m mypy.stubtest app.domain`. Paste the output; explain any error.

**2. `app.openapi()` vs `contracts/openapi.yaml`.** Generate the schema from `app.main.create_app(db_path="./.t25-tmp/openapi.db")`. Compare every path: method, path/query parameters (name, required, type/constraints), request body, response status codes and media types, referenced component schemas (field names, required, types, constraints such as `minimum`, `minLength`, `format`, `const`, `additionalProperties`), and `info.version`. Mark FastAPI artefacts (`anyOf` with null versus `type: [x, "null"]`, inline versus split components, the automatic `422` body, SSE response headers not declared, `minimum: 1.0` versus `1`) as `artefact`, not deviations. Table: `path method | item | yaml | generated | verdict (match / impl deviates / yaml deviates / artefact)`.

**3. E1 wording.** Confirm that `x-sse-events.control.reset.when` and the `GET /install/events` `204` description in `openapi.yaml` now agree with SPEC R18 (quote both). No HTTP observation needed this time.

**4. Test import scope.** Confirm that `tests/` imports from `app` only `create_app` and `app` (from `app.main`) and names declared in `contracts/domain.pyi` (from `app.domain`); no other `app.*` modules; no direct SQLite access. List every `app` import as `file → module → names`, and flag violations.

**5. Collection.** `uv run pytest --collect-only -q -m "e2e or perf or not e2e"`: total node count and any collection/import error verbatim. Expected **74** (67 unmarked, 6 `e2e`, 1 `perf`). Do not run the tests.

**6. Project-wide quality gate (AGENTS.md §1, without pytest).** Run and paste:
```
uv run ruff format --check .
uv run ruff check .
uv run mypy
```

## Final message (your report)
Reply in Traditional Chinese, identifiers in English:
1. Summary line: `CONTRACT CHECK: PASS` or `CONTRACT CHECK: FAIL (<n> deviations)`.
2. Sections 1–6 with the command outputs pasted (no test source).
3. Every deviation: `[impl|yaml|pyi|SPEC] <where> — expected (with reference) — actual`.
4. All `CONTRACT GAP` / `CONTRACT CONFLICT` items.
5. Confirm `./.t25-tmp/` was deleted, no `install.db` exists, and `git status --short` is empty (paste it).
