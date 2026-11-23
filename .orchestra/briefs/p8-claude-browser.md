# Brief T8.6: Real-browser E2E of the Cloudflare Worker + Durable Object version (Browser worker)

You are the BROWSER TESTER worker. Your working directory is a project copy containing:
- `worker/`: the new **TypeScript Cloudflare Worker + Durable Object** implementation (`wrangler dev` locally). It serves the page at `GET /` through Workers Static Assets, and the API through one Durable Object;
- `docs/SPEC.md` (v1.1.4, behaviour) and `docs/SPEC-cloudflare.md` (cf1.1, the differences for this version; it wins on conflict), `contracts/`, `AGENTS.md` §9.

The page (`worker/public/index.html`) is byte-identical to the Python version's page, so the UI itself is NOT under test; **the behaviour of the Cloudflare version behind it is**. You check, in a real Chrome browser with the Claude in Chrome tools, that the page opens, shows its content and works end to end against `wrangler dev` (R26, R27 and the Cloudflare-specific rules in SPEC-cloudflare).

## Rules
- **Browser:** call `tabs_context_mcp` first, then open new tabs with `tabs_create_mcp`. Never use, read or navigate the user's existing tabs. Only visit `http://127.0.0.1:<port>/...` on servers you started. Close every tab you opened at the end. Do not trigger `alert`/`confirm`/`prompt` dialogs.
- **Server:** start it yourself in the background, from `worker/`:
  - one time: `npm ci` (network to the npm registry is allowed for this only);
  - then `npx wrangler dev --port <p> --inspector-port <q> --persist-to <dir> --var SSE_LOG_INTERVAL:0.3 --var SSE_HEARTBEAT_SECONDS:2` with `<p>` in 18500–18599, `<q>` in 18900–18999, `<dir>` a fresh directory under `./.t86-tmp/` (relative to your working directory, not inside `worker/`). Read SPEC-cloudflare R1/R3 for the exact variable names and rules; restart with other settings when a check needs them.
  - run it in its own process group so you can stop all of it (`wrangler` + `workerd`): after each use, kill the whole group and confirm `pgrep -fl "wrangler|workerd"` is empty and the port is free (`lsof -iTCP:<p> -sTCP:LISTEN`).
- `curl` is allowed only against your own server (for example to act as another client).
- **Never** run `wrangler login`, `wrangler deploy`, anything with `--remote`, or anything that needs a Cloudflare account or token. If a login prompt appears, stop and report.
- Do not modify any project file. Temporary files go in `./.t86-tmp/`; delete it at the end (also delete `worker/node_modules/` and `worker/.wrangler/`).
- If a browser tool fails 2–3 times in a row, stop and report instead of looping.
- Time limit: 45 minutes.

## Evidence (required; checks without evidence count as not done)
- **Folder:** absolute path `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T8.6/`. Write nothing else outside your working directory.
- **Screenshots:** for every check take at least 2: one before the action and one after the result appears, plus one for each key state change. Use the `computer` `screenshot` action with `save_to_disk: true`, then copy the returned file with Bash to `<folder>/<checkID>-<nn>-<desc>.png` (for example `R2-03-running.png`).
- **GIF:** record the whole session, or at least R2 + R4 + C1, with `gif_creator` (`download: true`), then move the GIF into the folder.
- **`INDEX.md`:** one line per file: check ID, time taken, and what the screen should show.
- **Report:** list the screenshot file names for each check.

## Part R: Behaviour (R26, R27, with the Cloudflare server)
For each, give the steps, what you observed (DOM state via `read_page`/`find`, visible text) and a verdict: `OK` / `DEVIATION` / `NOT CHECKED` with the reason.

1. **R1. Load.** Open `http://127.0.0.1:<p>/` in a new tab. The page opens and shows content (title, header with `#scenario`, `#install-btn`, `#run-status`, the Stage list on the left and the Task area on the right). The fixed ids exist: `#scenario` is a `<select>` with the 7 options of R12, `#install-btn`, `#run-status`, `#stage-list`, `#task-list`, `#follow-btn`. All nodes are `pending` (`data-status`). The network requests list shows **no request leaving `127.0.0.1:<p>`**. Also `curl -i http://127.0.0.1:<p>/` returns `200 text/html; charset=utf-8`.
2. **R2. Install `success`.** The button is disabled while running; auto-follow tracks the running stage; the running task expands, appends log lines and auto-scrolls; it collapses when it succeeds; on `run_finished` the result appears in `#run-status` and the button is enabled again.
3. **R3. Collapsed finished task.** Clicking it shows its log with no new HTTP request (check the network requests).
4. **R4. Failure.** Run a failing scenario (for example `checksum_mismatch`): the failed task stays expanded and red, error lines are red, `message`/`hint` are shown, and after the run auto-follow picks the failed stage.
5. **R5. Follow rules.** Clicking the shown stage keeps auto-follow; clicking another stage stops it; `#install-btn` does not restore it; only `#follow-btn` does.
6. **R6. Mid-run join.** Start a run with `curl -X POST` (JSON body, see openapi), then open the page mid-run: earlier logs are present, no duplicate lines, live updates continue. Also reload the page mid-run: the screen is fully restored with no duplicate log lines.
7. **R7. Server killed mid-run (SPEC-cloudflare R25, R24).** With the page open and a run in progress, kill the whole `wrangler dev` process group with SIGKILL: `#run-status` shows a connection error and the page keeps retrying. Restart `wrangler dev` with the **same `--persist-to` directory** (a new port is fine, then open the page on it; or the same port if free): `GET /install` shows `failed` with `E_INTERRUPTED`, and the page shows that failed state.
8. **R8. Browser offline 5 seconds** (DevTools network offline, or the closest equivalent you can do with the tools; if you cannot, say `NOT CHECKED` with the reason): after reconnect the screen is completed with no duplicates.

## Part C: Cloudflare-specific checks
1. **C1. Two tabs at once.** Open the page in two tabs, start a run in tab A: both tabs show the same log lines in step (tab B was opened before the run started). `curl http://127.0.0.1:<p>/stats` shows `subscribers` of 2 while both are open.
2. **C2. Disconnect detection.** Close one of the two tabs. Within `2 × SSE_HEARTBEAT_SECONDS + 1` seconds (5 s with the settings above, plus a small allowance for polling) `/stats.subscribers` goes down by 1; the other tab keeps receiving. Record the observed times (poll `/stats` with curl every second). Then close the second tab and confirm it returns to 0.
3. **C3. New run replaces the old.** After a finished run, click install again (another scenario): the logs of the previous run are cleared and only the new run is shown (R5/R14).
4. **C4. Persistence across restart.** Finish a run, stop the server cleanly (SIGTERM to the process group), start it again with the same `--persist-to`: open the page, and the finished run is displayed (the page reads `GET /install`).

## Final message (your report)
Reply in Traditional Chinese, with identifiers in English:
1. A summary line: `T8.6: PASS` when there are no `DEVIATION`s and no missing evidence; otherwise `T8.6: FAIL (<n> deviations, <k> not checked)`.
2. A table `ID | check | verdict | screenshots`, then a short block per check (steps, observations).
3. Write each `DEVIATION` as R id + SPEC quote + expected + actual.
4. The observed numbers for C2 and R7 (time to reconnect/recover).
5. Cleanup confirmation: tabs closed; servers stopped (paste `pgrep -fl "wrangler|workerd"` and port checks); `./.t86-tmp/`, `worker/node_modules/`, `worker/.wrangler/` deleted; the evidence folder file count matches `INDEX.md`.
