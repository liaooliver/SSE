# Brief T7.1: Write the technical document `docs/technical.html` (Codex, writer)

Your working directory is a copy of a finished project: 「安裝進度即時串流」, a FastAPI + SSE demo. It contains:
- `app/`: Python backend;
- `app/static/index.html`: the generated page;
- `frontend/`: page build source;
- `docs/SPEC.md` v1.1.4: the behaviour spec, the source of truth;
- `contracts/`: `openapi.yaml`, `domain.pyi`;
- `tests/`;
- `AGENTS.md`, `README.md`, `pyproject.toml`.

Read them and write **one new file: `docs/technical.html`**. Do not modify any other file.

Follow the shared rules in the section "Shared rules for both HTML documents" below this brief.

## What the document must answer
Write it as a technical article that a developer new to the project can read in about 20 minutes, in an experience-sharing tone. It must contain at least these sections, in a sensible order:

1. **專案在做什麼:** the problem (show install progress live), what the user sees, and the scenarios (R12).
2. **系統架構:** **architecture diagram (required).** Show:
   - the browser page with its `EventSource`;
   - FastAPI and its routers;
   - the install runner or runtime;
   - the event broker;
   - the SQLite store;
   - the SSE endpoint.

   Show how data flows between them. Base it on the real modules in `app/`.
3. **模組說明:** a table with one row per module in `app/` (each `.py`, plus `routers/*`, `static/index.html`) and `frontend/`: its responsibility, its main public functions or classes, and who calls it. Follow with a short paragraph per module where it is non-trivial.
4. **資料模型與狀態機:** run, stage, task and log; the statuses (`pending`, `running`, `succeeded`, `failed`); a **state-machine diagram**; what is persisted, and how `seq` / event ids work.
5. **SSE 在這個專案的應用.** This is a core section and must be thorough:
   - why SSE here rather than polling or WebSocket (one-way server push, auto-reconnect, plain HTTP);
   - the endpoint and the response headers;
   - the event types and their payloads, with one real example frame (`id:`, `event:`, `data:`);
   - how `id` and `Last-Event-ID` give resume without duplicates;
   - heartbeat or keep-alive;
   - how a client that joins mid-run gets earlier logs (snapshot or replay);
   - how the page consumes events;
   - a **sequence diagram** of one normal install, from `POST` to `run_finished`.
6. **正常流程:** a flowchart or sequence of a successful run, end to end.
7. **失敗流程:** what happens when a task fails, in the backend (events, status propagation to stage and run, the error `code`/`message`/`hint`) and on the page (red task, error box, auto-follow picks the failed stage, C2). Include a **flowchart**.
8. **重試與恢復流程.** Include **flowcharts** for each:
   - (a) network drop: the browser reconnects with `Last-Event-ID` and the page shows and clears the error;
   - (b) server stopped mid-run and restarted: the run becomes `failed` with `E_INTERRUPTED` (R25);
   - (c) the user retries by starting a new install after a failure, and what happens if an install is already running;
   - (d) the page's own retry or backoff when the stream or the initial fetches fail.

   State exactly what the SPEC and code do. Do not add behaviour.
9. **前端:** the page's state handling, auto-follow rules (C3), collapsed and expanded tasks, and how it is built (Tailwind + Preline compiled and inlined, so there are no external resources, R26).
10. **測試與驗證:** what kinds of tests exist (unit, HTTP, stream, e2e, perf). Summarise by category and requirement IDs, not code. Then how to run the five gate commands in `AGENTS.md` §1.
11. **經驗分享 / 設計取捨:** 5–8 concrete lessons or trade-offs you can support from the SPEC and code (for example: why SQLite + WAL, why event ids are sequence numbers, proxy buffering headers, how duplicates are avoided). Each lesson cites the file that shows it.

At least **5 diagrams** in total: architecture, state machine, SSE sequence, failure flow, and the retry and recovery flows (one combined or several).

## Evidence and checks before you finish
- Open the file in headless Chrome and screenshot it at 1280 px and at 390 px width, light theme. If you can, also do a dark-theme shot.
  - Example command: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,8000 --screenshot=./.t7-evidence/T7.1/tech-1280.png "file://$PWD/docs/technical.html"`. Adjust the height so the whole page fits, or take several shots.
  - Look at the screenshots yourself and fix overlapping text or broken diagrams.
  - Save them in `./.t7-evidence/T7.1/`, with an `INDEX.md` there (one line per file: name, what it shows).
  - If Chrome cannot run in your sandbox, say so and continue.
- Run `grep -nE 'https?://|<link|src=|@import|url\(' docs/technical.html` and explain every hit. Only SVG `xmlns` is expected.
- Do not leave other new files behind except `./.t7-evidence/`.

## Final message (your report)
Reply in Traditional Chinese:
1. The section list with the diagrams in each.
2. For every diagram, the source files it is based on.
3. The grep result.
4. The screenshot file names, or why there are none.
5. Anything in the code or SPEC you found unclear or inconsistent. Report it, do not fix it.
