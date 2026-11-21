# Brief T5.1: Final acceptance from a clean copy (Verifier)

You are the ACCEPTANCE VERIFIER for this project. Your working directory is a **fresh, clean copy** of the project as it will be delivered:
- the implementation `app/`;
- the approved spec `docs/SPEC.md` **v1.1.3**;
- `contracts/` (version 1.1.2: the v1.1.3 change touched only R27 wording, and the SPEC appendix states the contracts are unchanged);
- `AGENTS.md`, `pyproject.toml`, `uv.lock`;
- the independently written test suite `tests/`.

The SPEC is the only source of truth. Earlier phases are already done:
- Phase 3: all 75 default tests passed, with no flakiness, and targeted mutations were killed.
- Phase 4: E2E against a real `uvicorn`, plus browser checks of R26/R27 and C1–C4.

Your job is to confirm, **from scratch**, that this exact copy is deliverable.

## Rules
- **Do not commit or keep any change** to `app/`, `tests/`, `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml` or `uv.lock`. Do not fix anything; report it.
- Temporary files go only in `./.t5-tmp/`; delete it before you finish. Never write outside this directory. The default `./install.db` must never be created.
- **Servers:** if you start a server, bind it to `127.0.0.1` on a port in the range 18000–18999. Stop every server you start, and never touch processes you did not start.
- Use `uv run ...` for every Python tool, and stay inside this directory. Do not open a browser.
- **Your report must not contain test source code or implementation source code.** Describe findings as **requirement id + SPEC quote + expected behaviour + actual behaviour**, and refer to tests only by pytest node id.
- Time limit: 45 minutes.

## A. Clean environment
1. Before anything else, confirm that `.venv/` does not exist, then run `uv sync --locked`. It must succeed without changing `uv.lock`.
2. Report the Python version (`uv run python --version`) and that `git diff --stat uv.lock` is empty.

## B. AC12: the quality gate (`AGENTS.md` §1)
Run the five commands exactly as written in `AGENTS.md` §1, in order. For each, paste the command and the last lines of its output, including the exit status:
```
uv sync
uv run ruff format --check .
uv run ruff check .
uv run mypy
uv run pytest
```
Also scan `app/` for `# noqa` and `# type: ignore`. Per `AGENTS.md` §1, each must carry an error code and a reason on the same line. List every occurrence as `file:line` plus whether it complies; do not paste the code around it.

## C. Full test suite
1. Run the default suite (everything except `perf`) **3 times** with `uv run pytest -q -rA --durations=5`. Report the summary lines, the node count (75 expected), any failing node and any flakiness.
2. Run `uv run pytest -q -rA -m perf` **3 times** (AC11). Report the summary lines.
3. Classify any failure as `IMPL BUG` / `TEST BUG` / `SPEC AMBIGUOUS`, with R/AC id, SPEC quote, expected and actual behaviour.

## D. AC coverage map
For each of AC1–AC12 in SPEC §驗收條件, give:
- the pytest node ids that cover it, which you find by reading the tests;
- whether those nodes passed in C;
- any part of the AC that no test exercises.

Requirements already declared not automatically testable (recorded, not failures): R25 recovery with no `running` task; WAL mode / event loop not blocked; the R22 data-vs-heartbeat tie; browser-only behaviour R27 and C1–C4, which were checked in a real browser in Phase 4.

## E. v1.1.3 consistency (R27 「錯誤與重試」)
The only v1.1.3 change is the wording of R27 「錯誤與重試」. Read that item and the page script served at `GET /` (`app/static/index.html`). In words only, confirm that the page:
- **(a)** re-runs the sync flow after 3 s when a sync-flow request (`GET /install` or `GET /install/logs`) fails with a network error or with an error other than `409`;
- **(b)** re-runs the sync flow after 3 s when the `EventSource` becomes `CLOSED` while the run is still in progress;
- **(c)** while the `EventSource` is `CONNECTING` (browser auto-reconnect), only shows an error in `#run-status` and does **not** re-run the sync flow.

Give a verdict `OK` / `DEVIATION` for each of (a), (b) and (c).

Also confirm that the version labels are consistent:
- the SPEC title says v1.1.3;
- `contracts/openapi.yaml` `info.version` and the app's OpenAPI `info.version` (from `GET /openapi.json` or by constructing the app) are both `1.1.2`, as the SPEC appendix says.

## F. Clean-copy hygiene
After everything:
- `git status --short --ignored` lists only ignored tool outputs (for example `.venv/`, caches);
- no `install.db` exists anywhere in this directory;
- `./.t5-tmp/` is deleted;
- no `uvicorn` process you started is still running.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line:
   - `T5.1: ACCEPT` when A and B are clean, C has all 75 + perf passing ×3 with no flakiness, and E has no DEVIATION;
   - otherwise `T5.1: REJECT (<n> impl bugs, <m> test bugs, <k> ambiguous, <f> flaky, <g> gate failures, <e> R27 deviations)`.
2. Sections A–F outputs, in order. Section D is a table `AC | node ids | passed? | uncovered part`.
3. Anything you were unsure about.
