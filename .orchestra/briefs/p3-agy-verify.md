# Brief T3: Verify the test suite and run it (Verifier)

You are the VERIFIER for this project. Your working directory is a fresh copy of the project: the implementation `app/`, the approved spec `docs/SPEC.md` **v1.1.2**, the contracts `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`, and a test suite `tests/` written independently from the SPEC by a different author who never saw `app/`. The contract check (stubtest, OpenAPI, test import scope, quality gate) has already passed.

Your job is to judge **both** sides: whether the tests are trustworthy, and whether the implementation passes them. The SPEC is the only source of truth.

## Rules
- **Do not commit or keep any change** to `app/`, `tests/`, `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. Mutations in part C are temporary: restore with `git checkout -- app/` after each one, and confirm `git status --short` is empty at the end.
- Temporary files go only in `./.t3-tmp/`; delete it before you finish. Never write outside this directory. If you construct the app yourself, always pass `db_path` under `./.t3-tmp/` (the default `./install.db` must never be created).
- Run `uv sync` first; use `uv run ...` for every tool. Stay inside this directory.
- **Your report must not contain test source code or implementation source code** (the coordinator forwards your findings to people who must not see the other side's code). Describe everything as **requirement id + expected behaviour + actual behaviour**, and refer to tests only by pytest node id.
- `perf` tests are excluded here (they belong to a later phase). `e2e` tests are included.
- Time limit 45 minutes.

## A. Run the suite
1. `uv run pytest -q -rA` (default selection = everything except `perf`; expected 73 nodes). Paste the summary line and the list of failed/errored node ids.
2. Run it **two more times** (`uv run pytest -q -p no:randomly` is fine if the plugin is absent; otherwise just repeat) and report any node whose result differs between runs (flaky).
3. Report the total wall time of one run, and the 5 slowest nodes (`--durations=5`).

## B. Classify every failure
For each failed/errored node, decide which side is wrong, reading the SPEC carefully:
- `IMPL BUG` — the implementation violates the SPEC. State: R/AC id, expected behaviour per SPEC (quote the SPEC sentence), actual behaviour observed.
- `TEST BUG` — the test asserts something the SPEC does not require, asserts it wrongly, or is flaky/environment-dependent. State: R/AC id, what the SPEC actually requires (quote), what the test expects instead (in words, no code).
- `SPEC AMBIGUOUS` — the SPEC allows both readings. State both readings and quote the SPEC text.
One node may have more than one finding. Be specific enough that the other side can fix it without seeing your evidence code.

## C. Mutation spot-check (does the suite catch real bugs?)
Make **at least 8** small, deliberate, behaviour-changing mutations in `app/`, one at a time, each targeting a different requirement. Choose from the areas below (pick the ones that exist in this implementation):
- R10 `apply_event`: accept one of the transitions it must reject.
- R9: stop stripping whitespace around an event id.
- R18: send `reset` instead of `204` for a finished run with `n ≥ L` (or vice versa).
- R20: drop or duplicate one event at the replay → live boundary.
- R16: count a `204`/`404` response in `/stats`.
- R15: off-by-one in the `after`/`until` log window.
- R14: allow two concurrent `POST /install` to both succeed.
- R22: never send the heartbeat ping.
- R23: never disconnect a slow subscriber.
- R25: broadcast before writing to SQLite / skip startup recovery.
For each mutation: the requirement id, the intended behaviour change in words (no code), the command you ran (a targeted subset is fine), whether at least one test failed (**killed**) or not (**survived**), and which node ids killed it. Restore after each one.

## D. Test audit
- Using the node ids and their names, compare against SPEC R1–R29 and AC1–AC12: list requirements you believe are **not meaningfully tested** (beyond what the author already declared as browser-only: R27 page behaviour, C1–C4) — especially any surviving mutation.
- Flag tests that can never fail, tests that only check status codes where the SPEC requires content, and tests depending on timing that could be flaky on a slower machine. Node id + reason in words.

## Final message (your report)
Reply in Traditional Chinese, identifiers in English:
1. Summary line: `T3: PASS` (all 73 pass, no flaky, mutation kill rate ≥ 7/8) or `T3: FAIL (<n> impl bugs, <m> test bugs, <k> ambiguous, <f> flaky, <s> survived mutations)`.
2. Section A outputs (summary lines and node id lists; no source code).
3. Section B findings, one block per finding, grouped `IMPL BUG` / `TEST BUG` / `SPEC AMBIGUOUS`.
4. Section C table: `# | R id | mutation (words) | killed? | killing node ids`.
5. Section D findings.
6. Confirm `./.t3-tmp/` deleted, no `install.db` anywhere in this directory, and `git status --short` is empty (paste it).
