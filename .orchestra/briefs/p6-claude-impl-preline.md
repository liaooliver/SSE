# Brief T6.1: Visual redesign of the page with Preline UI (Implementer worker)

You are the IMPLEMENTER worker. Your working directory is a copy of the project: `app/`, `docs/SPEC.md` (v1.1.4, the only source of truth for behaviour), `contracts/`, `AGENTS.md`, `pyproject.toml`, `uv.lock`. There is no `tests/` directory. Do not create one, and do not look for tests anywhere else. Work only inside this directory; never read or write outside it, except for the evidence folder named below.

## Goal
Redesign the look of the single page served at `GET /` (`app/static/index.html`, SPEC R26/R27) with **Preline UI** (https://preline.co/, a Tailwind CSS component library). The result should look like a polished, modern Preline dashboard. This is a **visual-only** change, decided by the user.

## Decisions already made by the user (do not re-decide)
- **E8: build locally and inline.** SPEC R26 requires 「不依賴外部資源（不載入 CDN、字型或外部腳本）的單一 HTML 頁面」. So compile Tailwind + Preline locally with the Tailwind CLI and **inline** the compiled CSS into `app/static/index.html`. The delivered page must not reference any external URL. Do not load Preline from a CDN.
- **E9: keep the build source in the repo** under a new `frontend/` folder. The generated `app/static/index.html` is committed too, so running the app and the tests never needs Node.
- **E10: visual only.** Keep every existing element, element id, attribute the script uses (`data-status`, `data-kind`, `aria-*`, `role`), every user-visible text string, and all page behaviour in R27 exactly as they are.

## Required structure
```
frontend/
  package.json        # exact pinned versions (no ^ or ~) of tailwindcss, @tailwindcss/cli, preline; "build" script
  package-lock.json   # committed
  src/index.html      # the page template: markup + the existing inline <script>, with a placeholder where the CSS goes
  src/input.css       # @import "tailwindcss"; Preline theme/variants; @source pointing at src/index.html; any small custom CSS
  build.mjs           # Node script (no extra deps): runs the Tailwind CLI (minified), inlines the CSS into the template, writes ../app/static/index.html
  README.md           # 3–6 lines: prerequisites (Node version), `npm ci && npm run build`, "never edit app/static/index.html by hand"
```
- Add `frontend/node_modules/` to `.gitignore`.
- The generated `app/static/index.html` starts with `<!doctype html>`, then a one-line HTML comment saying it is generated from `frontend/` and must not be edited by hand.
- The build must be deterministic: running `npm run build` twice gives byte-identical output. Verify this and report the `shasum` of both runs.
- Use the current stable versions of Tailwind CSS v4 and Preline that you install from npm, pinned exactly. Read Preline's docs on preline.co for the Tailwind v4 setup (theme CSS and variants). You may use WebFetch for preline.co, tailwindcss.com and the npm registry only.

## Hard rules for the delivered page
1. **No external resources (R26).** `app/static/index.html` contains no `<link>`, no `<script src=...>`, no `http://` or `https://` in any `src`, `href`, CSS `url(...)` or `@import`, and no `@font-face` that loads anything. Use a system font stack. Inline SVG icons written by you are fine. Report the result of a grep for `http`, `<link`, `src=`, `@import`, `@font-face` and `url(` on the generated file, and explain every remaining hit (for example the SVG `xmlns`).
2. **Preline JS:** do not include it unless a component truly needs it. E10 means no new interactive components, so you should not need it. If you do include it, it must be inlined, and you must say why.
3. **Keep the script's logic unchanged.** Change it only where it sets class names or builds DOM structure that needs Tailwind/Preline classes. Every change must be purely presentational. Keep `textContent` only (no `innerHTML` or `insertAdjacentHTML` with data). Static SVG icons may be built with `createElementNS`, or cloned from a static `<template>` in the markup. In your report, list every changed line of script logic, with the reason for each.
4. **Fixed ids stay** (R26): `#scenario` (`<select>`), `#install-btn`, `#run-status`, `#stage-list`, `#task-list`, `#follow-btn`, plus every other id the script uses (for example `#task-title`).
5. **Layout (R27):** `#stage-list` is on the left and `#task-list` on the right at widths ≥ 768 px. Below 768 px the two may stack (stages first). Nothing may scroll horizontally at 375 px.
6. **States must stay visually distinct:**
   - `pending`, `running`, `succeeded`, `failed` for stages and tasks (Preline soft badges; a decorative spinner or pulsing dot for `running` is fine);
   - failed in red with the error box showing the message and hint;
   - the selected stage;
   - `#follow-btn` on/off (`aria-pressed`);
   - `#install-btn` disabled;
   - `#run-status` for each `data-kind` (info, error, failed, succeeded);
   - the dark log panel with error lines highlighted and the 「（尚無 log）」 empty state;
   - expanded and collapsed tasks.
7. **Dark mode:** follow `prefers-color-scheme` through Tailwind's `dark:` variant. Do not add a toggle (that would be a new element).
8. **Allowed additions:** decorative only, such as icons, a spinner, spacing, card headers, a subtle header brand mark. Do not add elements that carry new information (no progress bar, counts or timestamps) and do not add new text.
9. **Accessibility:** visible focus rings on every interactive element, colour contrast at least WCAG AA in both themes, and keep the existing `aria-live` on `#run-status`.
10. Do not change any Python file unless serving the page truly requires it (it should not), and never change `docs/`, `contracts/`, `AGENTS.md`, `pyproject.toml` or `uv.lock`.

## Verify before you finish
- Run the five commands in `AGENTS.md` §1 (`uv run pytest` will find no tests; say so) and paste the last lines of each.
- Start the app yourself:
  - `SSE_DB_PATH=$(mktemp -d)/t.db uv run uvicorn app.main:app --host 127.0.0.1 --port <18600–18699>`;
  - check `GET /` returns `200` and `text/html; charset=utf-8` with the generated page;
  - stop the server when done; never touch processes you did not start; never create `./install.db`.
- **Look at it in the real browser** with Claude in Chrome:
  - open a **new tab** and only `http://127.0.0.1:<your port>/`;
  - run at least the `success` scenario and one failing scenario, in light mode and at a 375 px-wide window;
  - iterate on the design until it looks clean and consistent;
  - for dark mode, if you cannot switch the OS theme, emulate it (for example DevTools or a temporary media override). Say in your report which method you used;
  - close the tabs you opened when you are done.
- Save **before** screenshots (the current page, before any change) and **after** screenshots to the absolute folder `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.1/`:
  - use the `computer` screenshot with `save_to_disk: true`, then copy the file there with Bash;
  - name them `before-01-<desc>.png`, `after-01-<desc>.png` and so on;
  - write `INDEX.md` there with one line per file: name, time, what it shows;
  - write nothing else outside your working directory.
- Delete caches you created (`.mypy_cache`, `.ruff_cache`, `__pycache__`). Keep `frontend/node_modules/` (it is gitignored).

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. **Files.** Every file created or changed.
2. **Versions and build.** The pinned versions, the build command, the two `shasum` values and the size of the generated `index.html`.
3. **External-resource grep.** The results, with an explanation for each hit.
4. **Script changes.** Every script logic line you changed, with the reason.
5. **Design summary.** Which Preline components and patterns you used for each part of the page.
6. **Gate output.** The output of the five `AGENTS.md` §1 commands.
7. **Browser check.** What you checked, plus the list of screenshots in `evidence/T6.1/`.
8. **Uncertainties.** Anything you were unsure about, or any place where you think the SPEC and the design conflict.
