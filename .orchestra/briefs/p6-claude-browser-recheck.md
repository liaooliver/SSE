# Brief T6.4b: Visual recheck after a CSS fix (Browser worker)

You are the BROWSER TESTER worker. Your working directory contains the project: `app/`, whose page at `GET /` is styled with Preline UI; `frontend/`; `docs/SPEC.md` v1.1.4; `contracts/`; `AGENTS.md`; `pyproject.toml`; `uv.lock`.

An earlier full visual E2E of this page passed every check except one:
> **VISUAL ISSUE:** inside an expanded task card with no error box, the dark log box had about 16 px of space above it but about 28 px below it.

The implementer has changed one CSS class to fix it. Your job is to confirm the fix and to check that it broke nothing nearby.

## Rules
- **Browser:**
  - Call `tabs_context_mcp` first, then open new tabs with `tabs_create_mcp`. Never use, read or navigate the user's existing tabs.
  - Only visit `http://127.0.0.1:<port>/` on a server you started.
  - Close your tabs at the end.
  - Do not trigger `alert`/`confirm`/`prompt` dialogs.
- **Server:**
  - `uv run --env-file ./.t64-tmp/env uvicorn app.main:app --host 127.0.0.1 --port <18500–18599>`, with `./.t64-tmp/env` containing `SSE_DB_PATH=./.t64-tmp/page.db` and `SSE_LOG_INTERVAL=0.3`.
  - Stop it at the end and confirm the port is free.
- Do not modify project files. Temporary files go in `./.t64-tmp/`; delete it at the end. Never create `./install.db`.
- If a browser tool fails 2–3 times in a row, stop and report.
- Time limit: 20 minutes.

## Checks
For each check, measure with `javascript_tool` (`getBoundingClientRect` of the log `ol`, the error box and the task card) and give the gaps in px. Take screenshots with `computer` `screenshot` `save_to_disk: true`, then copy them to `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.4b/<checkID>-<nn>-<desc>.png`.

| ID | State | Pass when |
|---|---|---|
| F1 | Light mode, `success` run finished, one succeeded task expanded with log lines | gap above the log box = gap below it (±2 px) |
| F2 | Expanded pending task with the 「（尚無 log）」 empty state | gap above = gap below (±2 px) |
| F3 | Failing scenario (for example `checksum_mismatch`): the failed task expanded with the error box | log → error box gap and error box → card bottom gap look even and consistent with F1; the error box still shows code, message and hint |
| F4 | Dark mode for F1 and F3 (the OS is dark; for light mode use a temporary in-page `prefers-color-scheme` override through `javascript_tool`, and say so) | same as F1 and F3 |
| F5 | Quick regression: during a run, the running task expands, appends lines and auto-scrolls, and collapses on success; `#install-btn` is disabled while running | behaves as before |

Write `INDEX.md` in the evidence folder, one line per file: check ID, time taken, what it shows, and the measured gaps.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line: `T6.4b: PASS`, or `T6.4b: FAIL (<n> issues)`.
2. A table `ID | verdict | measured gaps | screenshots`.
3. Each issue: screenshot, what is wrong, where.
4. Cleanup confirmation:
   - your tabs are closed;
   - the server is stopped (paste the port check);
   - `./.t64-tmp/` is deleted;
   - there is no `install.db`;
   - the evidence file count matches `INDEX.md`.
