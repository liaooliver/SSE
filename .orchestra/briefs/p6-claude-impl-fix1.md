# Brief T6.1-fix1: Fix one visual issue found by the browser E2E (Implementer worker)

You are the IMPLEMENTER worker. Your working directory is the project copy where you already built the Preline redesign: `app/`, `frontend/` (with `node_modules/` installed), `docs/SPEC.md` v1.1.4, `contracts/`, `AGENTS.md`. There is no `tests/` directory. Do not create one, and do not look for tests anywhere else. Work only inside this directory, except for the evidence folder named below.

All earlier rules from the redesign still apply:
- E8: inline CSS, no external resources;
- E9: edit `frontend/src/` and regenerate `app/static/index.html` with `npm run build`, never edit the generated file by hand;
- E10: visual only. Do not change ids, attributes, text or script logic.

## The issue (reported by the independent browser tester, confirmed by the coordinator)
**VISUAL ISSUE: the log box inside an expanded task card has uneven padding.**
- When the task has **no** error box shown, there is about 16 px between the card's divider and the top of the dark log box, but about 28 px between the bottom of the log box and the bottom of the card.
- When the error box **is** shown (a failed task), the spacing looks correct.
- It happens in both light and dark mode and in the empty-log 「（尚無 log）」 state.

**Likely cause, for you to confirm:** the task body uses a `space-y-*` utility. In Tailwind v4 that adds a bottom margin to every child except the last one. The hidden error box is still the last child, so the log keeps an extra bottom margin even when the error box is hidden.

**Expected:** the spacing above and below the log box is equal when no error box is shown. The spacing between the log box and the error box stays as it is now when the error box is shown.

## Do
1. Fix it in `frontend/src/` with the smallest change. Prefer a class-only change, for example a gap that ignores hidden children, or a margin on the error box instead of `space-y`. If you must touch the script, it may only change a class string.
2. `cd frontend && npm run build` twice and report both `shasum -a 256` values; they must be identical.
3. Re-run the five `AGENTS.md` §1 commands. `pytest` will find no tests; say so.
4. **Check in Chrome:**
   - Open a **new tab** on your own server only (`127.0.0.1`, port 18600–18699, `SSE_DB_PATH` in a `mktemp -d` folder; never create `./install.db`).
   - Check three states:
     - an expanded succeeded task with log lines;
     - an expanded pending task with the empty log;
     - an expanded failed task with the error box.
   - Measure the gaps with `javascript_tool` (`getBoundingClientRect`) and report the numbers in px for each state.
   - Close your tabs and stop your server.
5. **Evidence:**
   - Save screenshots to `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.1/`:
     - `fix1-01-succeeded-task-log.png`
     - `fix1-02-empty-log.png`
     - `fix1-03-failed-task-errorbox.png`
     - (optional) one dark-mode shot
   - Append one line per file to the existing `INDEX.md` there: name, time, what it shows, and the measured gaps.
6. Delete caches you created (`.mypy_cache`, `.ruff_cache`, `__pycache__`). Keep `frontend/node_modules/`.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. the root cause;
2. the exact diff of what you changed in `frontend/src/` (class strings only);
3. the two `shasum` values and the new file size;
4. the gate output;
5. the measured gaps before and after;
6. the screenshot names;
7. anything you were unsure about.
