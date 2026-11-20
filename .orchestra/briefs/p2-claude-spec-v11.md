# Brief T2.3: SPEC v1.0 → v1.1 contract fixes (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `docs/SPEC.md` (v1.0), `contracts/domain.pyi`, `contracts/openapi.yaml` and `AGENTS.md`. Work only inside this directory. You cannot run shell commands.

## Background
An implementer and an isolated test author built code and tests from v1.0 and reported gaps/conflicts. The user has **already decided** every item below. Your job is to write those decisions into the documents precisely — not to re-decide them. Do not change the meaning of anything not listed here. If you find another real defect, list it in your report instead of fixing it.

## Edits (each item = a user decision)

**A1 — `run_started` in the script (R6, R8, AC4, `domain.pyi` `script_for`).** `script_for(scenario_id)` has no run id. The script's `run_started` step carries data `{"scenario": <id>}` only; the stored/streamed event carries `{"run_id", "scenario"}` (R8 unchanged), with `run_id` added when the run is written. AC4: compare after removing `seq`, log `ts`, **and `run_started.data.run_id`**; `run_id` must equal the run's actual id. Update the `script_for` docstring too.

**A2 — R9 whitespace vs OpenAPI pattern.** SPEC wins: whitespace around the value is stripped before matching. Remove the `pattern` from the `last_event_id` query parameter (and from `Last-Event-ID` if present) in `openapi.yaml`; say in its description that it is parsed per R9 (stripped first).

**A3 — R10 invalid sequences.** Add an explicit list. `apply_event` raises `ValueError`, in addition to the existing cases (illegal node transition, `seq != last_seq + 1`, `run_id` mismatch), when:
- the first event of a run is not `run_started`, or `run_started` appears anywhere other than first;
- any event arrives after the run has finished (`run_finished` already applied);
- a `stage_*` start/finish refers to an unknown stage id; a `task_*` or `log` event refers to an unknown stage/task id;
- a `task_*` or `log` event belongs to a stage that is not `running`;
- a `log` event belongs to a task that is not `running`;
- a `data` field is missing or has the wrong type.
State explicitly that `apply_event` is **not required** to check that all tasks of a stage are finished when the stage finishes (tests must not assert either way).

**A4 — R16 `/stats` counting.** `subscribers` counts only connections that are replaying or receiving live events. Responses that end without streaming — `404`, `204`, and the `retry`+`reset`-then-close response — are not counted.

**B1 — `domain.pyi` type aliases.** `mypy stubtest` cannot handle PEP 695 `type X = ...` aliases. Rewrite `JsonValue`, `EventType`, `Status`, `RunStatus`, `LogLevel` as classic aliases (`X: TypeAlias = ...`; a recursive alias may use string forward references). Same meaning, same names.

**B2 + B3 — AC11 wording.** As written, AC11 is impossible (no run → `404`; a finished run's stream closes). New AC11: real uvicorn, `log_interval=0.005`; start a `success` run, then 20 subscribers subscribe from the beginning; every subscriber must receive the complete event sequence; the latency sample is the **`log` events** produced after all 20 subscribers have received `retry` (only `log` carries `ts`); for each such log, latency = `ts` → the moment the 20th subscriber has parsed it; p95 < 200 ms.

**B4 — AC1 seq counting.** Make AC1 precise: the snapshot's `last_seq = S` covers the prefix `1..S`. The client's events = the non-log events of the prefix (represented by the snapshot) + the log events fetched by catch-up + the SSE suffix. Their seqs, combined, must be exactly `1..last_seq` with no duplicates.

**B5 — OpenAPI matches the generated schema.** In `GET /install/logs`, `until` becomes `anyOf: [{type: integer, minimum: 0}, {type: "null"}]` (its default is the request-time `last_seq`, so no fixed default). The `POST /install` request body becomes `$ref: '#/components/schemas/InstallRequest'` with a new component `InstallRequest` having the same fields/required as today's inline object.

**C1 — page does not learn of a new run (R27, known limitation).** Keep current behaviour: after a run ends, the page stops listening; if another client starts a new run, the page only shows the `409` when its install button is pressed, and the user must reload. Record this as a known limitation (R27 note and/or §11 不在範圍內).

**C2–C4 — R27 page details.**
- C2: when no stage is running, the selected stage is: the failed stage → otherwise the last non-`pending` stage → otherwise the first stage.
- C3: clicking the stage that is already displayed does not stop auto-follow; only `#follow-btn` resumes auto-follow (pressing install does not).
- C4: on a network error, a non-`409` error during sync, or the `EventSource` becoming `CLOSED` while the run is still running: show the error in `#run-status` and rerun the sync flow after 3 seconds.

**C5 — static file location (AGENTS.md §5).** Add `app/static/index.html` (the R26 page) and `routers/page.py` to the project structure.

**Housekeeping.** Title → `v1.1` and remove "待使用者核准" (it is approved). Append a `v1.0 → v1.1` changelog table to the appendix, one row per item above (A1…C5), with the R/AC ids touched. Keep SPEC prose in Traditional Chinese, identifiers in English, consistent with the existing style. Keep `openapi.yaml` valid OpenAPI 3.1 YAML and `domain.pyi` valid Python stub syntax.

## Final message (your report)
Reply in Traditional Chinese: for each item A1–C5, which file/section changed (one line each); any defects you noticed but did not fix; anything you were unsure about.
