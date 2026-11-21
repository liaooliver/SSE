# Brief T6.2: Document `frontend/` in AGENTS.md (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `docs/SPEC.md` (v1.1.4), `contracts/` and `AGENTS.md`. Work only inside this directory. You cannot run shell commands.

## Background
The user decided to redesign the page with Preline UI, a Tailwind CSS component library, with these constraints:
- **E8:** Tailwind + Preline are compiled locally with the Tailwind CLI. The compiled CSS is **inlined** into `app/static/index.html`, so SPEC R26 (「不依賴外部資源…的單一 HTML 頁面」) still holds and the SPEC does not change.
- **E9:** the build source is committed under a new `frontend/` folder, and the generated `app/static/index.html` is committed too. Running the app and the tests never needs Node; Node is needed only to change the page.
- **E10:** the change is visual only, with no behaviour change.

The implementer is building this structure, and it is fixed:
```
frontend/
  package.json        # exact pinned versions of tailwindcss, @tailwindcss/cli, preline; "build" script
  package-lock.json
  src/index.html      # page template (markup + inline script); the single source of the page
  src/input.css       # Tailwind + Preline imports, custom CSS
  build.mjs           # runs the Tailwind CLI, inlines CSS into the template, writes ../app/static/index.html
  README.md
```

## Edits (only `AGENTS.md`)
1. **§2 工具 table:** add one row for Node/npm:
   - purpose: building the frontend only;
   - rules: only inside `frontend/`, using `npm ci` and `npm run build`; versions pinned exactly, `package-lock.json` delivered with the change; not needed to run the app or the tests.
2. **§5 專案結構:**
   - add the `frontend/` tree with short comments in the existing style;
   - change the `static/index.html` comment to say it is a **build output** generated from `frontend/` (still a single HTML page with no external resources, R26) and must not be edited by hand;
   - add one bullet below the tree: to change the page, edit `frontend/src/`, run `npm run build`, and commit both the source and the generated `app/static/index.html`.

Keep Traditional Chinese prose, English identifiers and the existing style. Keep it minimal: do not touch other sections. **Do not change `docs/SPEC.md` or `contracts/`.** If you think the SPEC must change for E8–E10, say so in your report instead of editing.

## Final message (your report)
Reply in Traditional Chinese with:
- the exact new or changed lines in `AGENTS.md`;
- any defect you noticed but did not fix;
- anything you were unsure about.
