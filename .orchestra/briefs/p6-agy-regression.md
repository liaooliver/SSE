# Brief T6.3: Regression check after the Preline redesign (Verifier)

You are the VERIFIER for this project. Your working directory is a fresh copy of the project:
- the implementation `app/`;
- the new `frontend/` build source;
- `docs/SPEC.md` **v1.1.4** (the only source of truth);
- `contracts/` (1.1.2), `AGENTS.md`, `pyproject.toml`, `uv.lock`;
- the independently written test suite `tests/`.

The git history has one baseline commit: the delivered project **before** the redesign. The redesign is the uncommitted working-tree change, so `git diff` and `git status` show exactly what changed.

## What changed (decided by the user)
The page at `GET /` was restyled with Preline UI (Tailwind CSS):
- **E8:** Tailwind + Preline are compiled locally and the CSS is inlined into `app/static/index.html`. R26 「不依賴外部資源（不載入 CDN、字型或外部腳本）的單一 HTML 頁面」 must still hold.
- **E9:** the build source lives in `frontend/`, and the generated `app/static/index.html` is committed.
- **E10:** visual only. Every element id, every attribute the script uses, every visible text and all R27 behaviour must be unchanged.

## Rules
- **Do not commit or keep any change** to tracked files. Do not fix anything; report it.
- Temporary files go only in `./.t63-tmp/`; delete it before you finish. Never write outside this directory. The default `./install.db` must never be created.
- **Servers:** bind any server to `127.0.0.1` on a port in 18000–18399. Stop every server you start, and never touch processes you did not start. Do not open a browser (another agent checks visuals).
- Use `uv run ...` for Python tools.
- **No test or implementation source code in your report.** For HTML/JS, describe each change in words, with `file:line` references; short identifiers are fine.
- **Evidence (E7):** save the raw output of every command below to `./.t63-evidence/<step>-<n>-<desc>.txt`. Each file starts with the command and its start time. Also write `./.t63-evidence/INDEX.md`, one line per file. Do **not** delete `./.t63-evidence/`; the coordinator collects it.
- Time limit: 45 minutes.

## A. Gate and tests
1. `uv sync --locked`, which must not change `uv.lock`.
2. Run the five `AGENTS.md` §1 commands in order. For each, give the command, the last lines of output and the exit status.
3. Run the default suite **3 times** with `uv run pytest -q -rA --durations=5`. Expect 75 passed. Report any failure and any flakiness.
4. Run `uv run pytest -q -rA -m perf` **3 times**.
5. Classify any failure as `IMPL BUG` / `TEST BUG` / `SPEC AMBIGUOUS`, with R/AC id, SPEC quote, expected and actual behaviour.

## B. R26 static checks on `app/static/index.html`
1. Search the file for `http://`, `https://`, `<link`, `src=`, `@import`, `@font-face`, `url(` and `//` used as a protocol-relative URL. Explain every hit; an SVG `xmlns` namespace is fine.
2. Confirm the file is one self-contained HTML document: CSS inline in `<style>`, script inline, and no other files referenced.
3. Confirm all fixed ids from R26 exist exactly once, and that `#scenario` is a `<select>`.
4. Start the app with `SSE_DB_PATH=./.t63-tmp/x.db`. Fetch `GET /` and confirm `200` plus `Content-Type: text/html; charset=utf-8`, and that the body equals the file on disk.

## C. E10: the script behaviour is unchanged
Compare the inline `<script>` of the baseline `app/static/index.html` (from `git show HEAD:app/static/index.html`) with the new one.
1. List every hunk of the script diff. For each, give a verdict:
   - `PRESENTATIONAL`: only class names, decorative DOM or icons change;
   - `LOGIC`: anything that could change behaviour, such as control flow, event handling, fetch/EventSource use, state, timers, text or attributes the SPEC relies on;
   - `UNSAFE`: any `innerHTML`, `outerHTML` or `insertAdjacentHTML` fed with server data, or any other way data could become markup.
2. Compare all user-visible text strings between the old and new page, in both the markup and the script. List any added, removed or changed string.
3. Confirm the markup keeps the attributes the script and the SPEC rely on: `role` and `aria-live` on `#run-status`, `aria-pressed` on `#follow-btn`, and the `data-*` attributes.

## D. Build reproducibility (E9)
1. Check that `frontend/package.json` pins exact versions (no `^` or `~`) and that `frontend/package-lock.json` exists. Check that `frontend/node_modules/` is not tracked and is listed in `.gitignore`.
2. If Node and network access are available, run `cd frontend && npm ci && npm run build`. Then confirm with `git diff --exit-code app/static/index.html` that the regenerated file is byte-identical to the delivered one. Run the build a second time and compare `shasum`. Remove `frontend/node_modules/` afterwards. If you cannot run it, mark `NOT CHECKED` with the reason.

## E. Hygiene
After everything:
- `git status --short` shows only the redesign's files: `app/static/index.html`, `frontend/**`, `.gitignore`, `AGENTS.md`, plus `./.t63-evidence/`;
- no `install.db*` exists anywhere;
- `./.t63-tmp/` is deleted;
- no server you started is still running.

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line:
   - `T6.3: PASS` when A is clean (75 ×3 and perf ×3, no flakiness), B is clean, C has no `LOGIC` or `UNSAFE` hunk and no text change, and D is OK or NOT CHECKED with a reason;
   - otherwise `T6.3: FAIL (<n> impl bugs, <m> test bugs, <k> ambiguous, <f> flaky, <g> gate failures, <l> logic/unsafe hunks, <t> text changes, <r> R26 hits)`.
2. Sections A–E in order, each with its evidence file names.
3. Anything you were unsure about.
