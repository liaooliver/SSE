# Shared rules for both HTML documents (Phase 7)

There are two documents that link to each other and must look like one set:
- `docs/technical.html`: the technical document / experience write-up about the app;
- `docs/ai-agents.html`: how the multi-AI-agent team that built the app works.

## Format
- **One self-contained HTML file per document.** No external resources: no CDN, no web fonts, no `<link>`, no `<script src>`, no `@import`, no `url(http…)`. They must open offline by double-clicking. Small inline `<script>` is allowed only for a table-of-contents highlight; prefer none.
- **Language:** Traditional Chinese (台灣用語) for the prose. Keep code identifiers, file names, HTTP paths, event names and status values in English, in `<code>`.
- **Diagrams:** hand-written **inline SVG**, inside `<figure>` with a `<figcaption>` (圖 N：…).
  - Every SVG has a `viewBox`, `width="100%"`, no fixed pixel width, and `role="img"` with an `aria-label`.
  - Text must not overlap boxes or lines, and must stay inside the viewBox.
  - Keep the font size at least 12 px at a 1280 px page width.
  - Use CSS variables (below) for strokes, fills and text, so the diagrams work in dark mode.
  - Use arrow markers for direction.
  - Mermaid or other diagram libraries are not allowed, since they need external JS.
- **Theme:** light and dark through `@media (prefers-color-scheme: dark)`. Define these tokens on `:root` and redefine them for dark mode:
  `--bg --surface --text --muted --border --accent --ok --warn --err --info --code-bg`.
  - Use a system font stack, and a monospace stack for code.
- **Layout:**
  - Max content width of about 960 px, centred.
  - A sticky or top table of contents with anchor links.
  - Readable at 390 px wide, with no horizontal page scroll; wide tables and SVGs scroll inside their own container.
- **Header:** document title, a one-line subtitle, the date `2026-11-21`, and a small nav with the cross-link: `technical.html` ⇄ `ai-agents.html`, as relative links.
- **Footer:** a "資料來源" line listing the repo files the content is based on.

## Content rules
- **Every factual claim must come from the files you were given.** Cite them inline as `<code>path:line</code>` or `<code>path</code>` where it helps. Do not invent features, numbers, timings, model names or file names. If something is unknown, leave it out.
- **Privacy:**
  - Do not write absolute paths that contain a home directory (write `~/.local/share/sse-orchestra/…` or repo-relative paths instead).
  - Do not write any person's name, email or account.
  - Call the human 「使用者」.
- Do not paste test source code or long implementation code. Short snippets of at most about 15 lines, such as an SSE frame or a config line, are fine when they explain something.
- The tone may be an experience-sharing article (經驗分享), but the structure must stay scannable: headings, short paragraphs, tables, diagrams.
