# Brief T3.5: `apply_event` must validate event `data` (Implementer worker)

You are the IMPLEMENTER worker. Your working directory contains the project: `app/` (your implementation), `docs/SPEC.md` **v1.1.2** (approved), `contracts/domain.pyi`, `contracts/openapi.yaml`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. Work only inside this directory. You may run only `uv ...` commands in the shell.

## Background
An independent verifier ran the test suite (written from the SPEC by someone who never saw `app/`). Everything passed except two cases, both the same requirement. You will not see the tests; the behaviour is described below.

## The bug (SPEC R8, R10 item 9)
R10: 「遇到下列任何一種情況，`apply_event` 一律拋出 `ValueError`：…… 9. `data` 缺少欄位，或欄位的型別不對（依 R8）。」 R8 gives the `data` shape of every event type.

Observed:
1. **`run_started`** — `data` missing `run_id` or `scenario`, or with a wrong type (for example `run_id` as a string or as a `bool`, `scenario` as an integer), is accepted: `apply_event` returns a new snapshot instead of raising `ValueError`.
2. **`log`** — `data` missing `ts`, or with `ts` not a string (for example an integer), is accepted. The other `log` fields are already validated.

## Do
- Make `apply_event` raise `ValueError` for a missing field or a wrong-typed field, per R8, for **every** event type, not only the two above. Re-check all nine types against the R8 table: `run_started`, `stage_*`, `task_started`/`task_succeeded`, `log`, `task_failed`, `run_finished`.
- `int` fields must reject `bool` (in Python `bool` is a subclass of `int`). Enumerated fields (`level`, `result`) must reject values outside R8's set.
- Keep R10's explicit "not required" cases unchanged. Do **not** start checking whether `run_started` `data.run_id`/`data.scenario` match the snapshot or the event `run_id`, whether all tasks finished when a stage finishes, or plan order or a single `running` node. Presence and type checks only.
- Extra fields in `data` are not mentioned by R8/R10. Leave the current behaviour for extra fields as it is, and note in your report what it is.
- Make sure every event the app itself writes still passes: the script events with `run_id` added to `run_started` (R6, R8), log lines with `ts` (R7), and the startup-recovery events (R25). A real run of each of the 7 scenarios must still complete.

## Do not
- Change HTTP behaviour, status codes, wire format, SSE logic, or the public signatures in `contracts/domain.pyi`.
- Modify `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`, or create `tests/`. Add no dependencies.

## Verify before reporting (paste outputs)
```
uv run ruff format --check .
uv run ruff check .
uv run mypy
```
Also run stubtest as before: copy `contracts/domain.pyi` to `./.t35-tmp/stubs/app/domain.pyi` plus an empty `__init__.pyi`, and run `python -m mypy.stubtest app.domain` with `MYPYPATH` set via a `uv run python` subprocess. Then run a short `uv run python` self-check with these steps:
1. For each of the 7 scenarios, fold `script_for(...)` through `apply_event`, adding `run_id`, `seq` and `ts` as the app does, and confirm that no event raises.
2. For each event type, check that deleting each R8 field, or replacing it with a wrong type, raises `ValueError`.
3. Print the counts.

Any app instance you construct must use `db_path` under `./.t35-tmp/`. Delete `./.t35-tmp/` afterwards, and never create `./install.db`.

## Final message (your report)
Reply in Traditional Chinese, covering:
- the files and functions you changed;
- what the validation now checks for each event type;
- the extra-field behaviour;
- all outputs above;
- any `CONTRACT GAP` / `CONTRACT CONFLICT`.
