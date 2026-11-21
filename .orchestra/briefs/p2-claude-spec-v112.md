# Brief T2.7: SPEC v1.1.1 → v1.1.2 (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `docs/SPEC.md` (v1.1.1), `contracts/domain.pyi`, `contracts/openapi.yaml` and `AGENTS.md`. Work only inside this directory. You cannot run shell commands.

## Background
A contract check found the three issues below. The user has **already decided** each one. Write the decisions precisely; do not re-decide them and do not change anything else. If you notice another real defect, list it in your report instead of fixing it.

## Edits

**E1 — `openapi.yaml` `x-sse-events.control.reset.when` vs SPEC R18.** The current text is `when: start point belongs to another run or is ahead of the run (R18)`. It omits R18's condition: a start point ahead of the last event (`n > L`) causes `reset` **only while the run is still running**. When the run has finished and `r = R`, `n ≥ L`, the response is `204` instead (R18). Rewrite `when` so it states exactly R18's reset cases (start point in another run — whether the current run is running or finished; or `n > L` while the run is still running), and that the finished-run `n ≥ L` case is `204`, not reset. Check that the `204` response description on `GET /install/events` is consistent with R18 (`n ≥ L`, not only `n = L`); adjust wording only if it is not. SPEC R18 itself does not change.

**E2 — `AGENTS.md` §4 `/health` exception.** §4 currently says bare `dict` is not used as a public API shape, "`/health` 這種極小端點除外，但仍要標 `dict[str, str]`". This conflicts with `openapi.yaml`, which defines `/health` `200` as a strict object (`additionalProperties: false`, `required: [status]`, `status: const "ok"`). Remove the `/health` exception so every JSON endpoint uses a Pydantic model or explicit response type that produces the contract schema. Keep the rest of the sentence's meaning.

**E3 — `contracts/domain.pyi` vs project-wide ruff.** After the B1 change (classic `X: TypeAlias = ...` because `mypy stubtest` cannot handle PEP 695 `type` aliases), `ruff check .` reports `UP040` on the five aliases `JsonValue`, `EventType`, `Status`, `RunStatus`, `LogLevel`, and `ruff format --check .` wants `JsonValue` on one line. Fix it like this:
- Put the `JsonValue` alias on **one line, without the surrounding parentheses**: `JsonValue: TypeAlias = str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None`
- Add a trailing pragma on the **first line of each of the five alias statements** (for the multi-line `EventType`, that is the line ending in `Literal[`), with the code and the reason on the same line, as `AGENTS.md` requires: `  # noqa: UP040  stubtest 不支援 PEP 695（B1）`
- Change nothing else in the stub: names, values and order stay the same.

**Housekeeping.** Title → `v1.1.2`. In the appendix version table add a `v1.1.2` row (contract check T2.5 follow-up), and add a `v1.1.1 → v1.1.2 變更明細` table (E1–E3, one row each, with R ids and files). `domain.pyi` header → v1.1.2. `openapi.yaml` `info.version` → `1.1.2` and its description's SPEC version. Keep Traditional Chinese prose, English identifiers and the existing style. Keep both contract files syntactically valid (YAML, Python stub).

## Final message (your report)
Reply in Traditional Chinese: for each item E1–E3, which file and section changed, with the exact new text (one or two lines each); any defects you noticed but did not fix; anything you were unsure about.
