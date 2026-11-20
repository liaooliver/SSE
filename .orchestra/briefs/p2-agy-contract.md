# Brief T2.5: Contract check (Verifier)

You are the VERIFIER for this project. Your working directory is a fresh clone of the project: the implementation `app/`, the approved spec `docs/SPEC.md` **v1.1.1**, the contracts `contracts/domain.pyi` and `contracts/openapi.yaml`, `AGENTS.md`, `pyproject.toml`, `uv.lock`, plus a test suite `tests/` written independently from the SPEC by a different author who never saw `app/`.

This task is **only the contract check** (phase 2.5). Do not run the full test suite and do not judge whether behaviour is correct — that is the next phase.

## Rules
- **Do not modify** `app/`, `tests/`, `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. Temporary files go only in `./.t25-tmp/`; delete that directory before you finish.
- Run `uv sync` first (network allowed). Use `uv run ...` for every tool.
- Stay inside this directory. Do not look at any other directory on this machine.
- **Your report must not contain test source code** (the coordinator is not allowed to read it). Refer to tests only by file name, pytest node id and imported names.
- If something cannot be decided from SPEC v1.1.1 + contracts, write `CONTRACT GAP: ...`; contradictions between documents → `CONTRACT CONFLICT: ...`. Do not guess and do not fix.
- Time limit 30 minutes.

## Checks

**1. `app.domain` vs `contracts/domain.pyi` (mypy stubtest).** Put a copy of the stub where stubtest finds it as the stub for `app.domain` (e.g. `./.t25-tmp/stubs/app/__init__.pyi` empty + `./.t25-tmp/stubs/app/domain.pyi` = copy of `contracts/domain.pyi`), then run `MYPYPATH=./.t25-tmp/stubs uv run python -m mypy.stubtest app.domain`. Paste the full output. For each error: name, what differs, and whether the implementation or the stub deviates from SPEC.

**2. `app.openapi()` vs `contracts/openapi.yaml`.** Generate the schema from `app.main.create_app(...)` (use a temporary DB path under `./.t25-tmp/`). Compare against the YAML for every path: HTTP method, path parameters, query parameters (name, required, type/constraints), request body (schema, required fields), response status codes and their media types, and the `components/schemas` referenced (field names, required, types). Treat SSE `text/event-stream` responses and FastAPI's automatic `422` sensibly — report them, but mark whether they are a real deviation or a FastAPI artefact. Also compare `info.version`. Output a table: `path method | item | yaml | generated | verdict (match / impl deviates / yaml deviates / artefact)`.

**3. Known wording conflict to adjudicate.** The test author reported: R18 says that when the run has already finished and the cursor is at or past the last seq (`n ≥ L`), the response is `204`; the `reset` description (`reset.when` or equivalent) in `openapi.yaml` describes "cursor ahead" as a reset case without restricting it to a run that is still running. Read SPEC R18 and the YAML, and state: does the conflict exist, what exactly does each say (quote the YAML and SPEC wording, not test code), and which behaviour does the implementation have (observe it over HTTP with a finished run, not by reading tests).

**4. Test import scope.** Confirm that `tests/` imports from `app` only `create_app` and `app` (from `app.main`) and names declared in `contracts/domain.pyi` (from `app.domain`), and nothing else from `app.*`; no direct SQLite access except via process restart. List every `app` import as `file → module → names`, and flag violations.

**5. Collection.** Run `uv run pytest --collect-only -q -m "e2e or perf or not e2e"` (or equivalent that selects all markers) and report the total node count and any collection/import error verbatim. The test author expects **74** nodes (67 unmarked, 6 `e2e`, 1 `perf`). Do not run the tests.

## Final message (your report)
Reply in Traditional Chinese, identifiers in English:
1. Summary line: `CONTRACT CHECK: PASS` or `CONTRACT CHECK: FAIL (<n> deviations)`.
2. Sections 1–5 as above, with the command outputs pasted (except test source).
3. A list of every deviation, each as: `[impl|yaml|pyi|SPEC] <where> — expected (with SPEC/contract reference) — actual`.
4. All `CONTRACT GAP` / `CONTRACT CONFLICT` items.
5. Confirm `./.t25-tmp/` was deleted and that `git status --short` shows no changes (paste it).
