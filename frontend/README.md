# frontend — build source for `app/static/index.html`

- Prerequisite: Node.js 20 or later (built with Node 24.21.0, npm 11.19.0). Running the app or tests never needs Node.
- Build: `cd frontend && npm ci && npm run build` — compiles Tailwind CSS v4 + Preline UI theme from `src/input.css`, inlines it into `src/index.html`, and writes `../app/static/index.html`.
- Edit `src/index.html` (markup + script) and `src/input.css`, then rebuild and commit both the source and the generated page.
- Never edit `app/static/index.html` by hand; it is overwritten by every build.
