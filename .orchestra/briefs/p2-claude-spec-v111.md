# Brief T2.3b: SPEC v1.1 → v1.1.1 (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `docs/SPEC.md` (v1.1), `contracts/domain.pyi`, `contracts/openapi.yaml` and `AGENTS.md`. Work only inside this directory. You cannot run shell commands.

## Background
The user has **already decided** the four items below. Write them into the documents precisely; do not re-decide them and do not change anything else. If you notice another real defect, list it in your report instead of fixing it.

## Edits

**D1 — R10 item 6 (stage/task pairing).** A `task_*` or `log` event whose `(stage_id, task_id)` pair is not in the plan (R4) raises `ValueError`. This includes a `task_id` that exists but belongs to a different stage. Reword R10 item 6 accordingly and keep `domain.pyi` `apply_event` docstring consistent.

**D2 — R10, `run_started` contents.** `apply_event` is **not required** to check that `run_started.data.run_id` or `data.scenario` matches the snapshot or the event's `run_id` (the event's own `run_id` is already checked by item 3). Tests must not assert either way. Add this next to the existing "not required" sentence in R10.

**D3 — R10, ordering.** `apply_event` is **not required** to enforce that stages/tasks start in plan order, nor that only one stage/task is `running` at a time. Tests must not assert either way. Add next to the same sentence.

**D4 — R20 vs R16.** R20 says `/stats` is updated before the first block is sent. Add one sentence to R20: responses that are not counted per R16 (`404`, `204`, and the `retry`+`reset`-then-close response) do not update `/stats`. Wording only; meaning follows R16.

**Housekeeping.** Title → `v1.1.1`. In the appendix version table add a `v1.1.1` row, and add a `v1.1 → v1.1.1` changelog table (D1–D4, one row each, with R ids and files). `domain.pyi` header → v1.1.1; `openapi.yaml` `info.version` → 1.1.1 and its description's SPEC version. Keep Traditional Chinese prose, English identifiers, existing style; keep files syntactically valid.

## Final message (your report)
Reply in Traditional Chinese: for each item D1–D4, which file/section changed (one line each); any defects you noticed but did not fix; anything you were unsure about.
