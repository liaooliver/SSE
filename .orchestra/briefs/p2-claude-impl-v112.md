# Brief T2.8: Follow SPEC v1.1.2 (Implementer worker)

You are the IMPLEMENTER worker. Your working directory contains the project: `app/`, `docs/SPEC.md` **v1.1.2** (approved), `contracts/domain.pyi`, `contracts/openapi.yaml`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. Work only inside this directory. You may run only `uv ...` commands in the shell.

## What changed in v1.1.2
Read the appendix table `v1.1.1 → v1.1.2 變更明細` in `docs/SPEC.md` (E1–E3). E1 (a `reset.when` wording fix in `openapi.yaml`) and E3 (`# noqa: UP040` pragmas in `domain.pyi`) need no code change. E2 removes the `/health` bare-`dict` exception from `AGENTS.md` §4; `/health` already uses a `Health` model, so check it still complies.

## Do
1. Set the generated OpenAPI `info.version` to `"1.1.2"` (it must equal `contracts/openapi.yaml` `info.version`).
2. Nothing else in `app/` unless a check below fails because of `app/`.

## Do not
- Change behaviour, status codes, wire format or schemas.
- Modify `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`, or create `tests/`.

## Verify (paste full outputs)
```
uv run ruff format --check .
uv run ruff check .
uv run mypy
```
These are project-wide, so they now include `contracts/domain.pyi`. If they fail **only** on `contracts/`, do not edit it; paste the output and report it as `CONTRACT CONFLICT`.
Also run stubtest as before (copy `contracts/domain.pyi` to `./.t28-tmp/stubs/app/domain.pyi` plus an empty `__init__.pyi`, set `MYPYPATH` via a `uv run python` subprocess), and print `create_app(db_path="./.t28-tmp/x.db").openapi()["info"]["version"]`. Delete `./.t28-tmp/` afterwards.

## Final message (your report)
Reply in Traditional Chinese: the change made (file and line), all outputs above, and any `CONTRACT GAP` / `CONTRACT CONFLICT`.
