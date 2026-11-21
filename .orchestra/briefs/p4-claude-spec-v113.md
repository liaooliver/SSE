# Brief T4.5: SPEC v1.1.2 → v1.1.3 (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `docs/SPEC.md` (v1.1.2), `contracts/domain.pyi`, `contracts/openapi.yaml` and `AGENTS.md`. Work only inside this directory. You cannot run shell commands.

## Background
Real-browser testing found one ambiguity in R27 「錯誤與重試」, and the user has **already decided** how to resolve it. Write the decision precisely. Do not re-decide it and do not change anything else. If you notice another real defect, list it in your report instead of fixing it.

Current text (R27):
> **錯誤與重試**：發生網路錯誤、同步流程中遇到 `409` 以外的錯誤，或這一輪還在執行時 `EventSource` 變成 `CLOSED`：在 `#run-status` 顯示錯誤，3 秒後重新執行同步流程。

What happened in testing: the server stopped mid-run and came back on the same DB. The page showed an error in `#run-status`, then recovered through the browser's built-in `EventSource` auto-reconnect: `readyState` was `CONNECTING`, not `CLOSED`, and the reconnect resent the last event id. The server replayed exactly the missing events (R18, R20) and the end state was correct. The page did **not** re-run the sync flow. It was unclear whether 「發生網路錯誤」 covers this case.

## Edit (decision E4)
**E4: R27 「錯誤與重試」.** Clarify the following:
- 「網路錯誤」 means a network failure of a request made **during the sync flow**, that is, `GET /install` or `GET /install/logs`.
- While a run is still in progress, an `EventSource` error during which the browser is still auto-reconnecting (`readyState` is `CONNECTING`) does **not** require re-running the sync flow. The page shows an error in `#run-status` and lets `EventSource` reconnect by itself with `Last-Event-ID`. R18 and R20 guarantee that nothing is missed or duplicated.
- The sync flow is re-run (after 3 s) only when the `EventSource` becomes `CLOSED` while the run is still in progress, or when the sync flow itself fails, as already written.

Keep the existing three triggers and the 3-second retry. Write it as one or two sentences in the same style. No other R/AC changes.

## Housekeeping
- Change the title to `v1.1.3`.
- In the appendix version table, add a `v1.1.3` row (使用者決定; real-browser test T4.4 follow-up). Also add a `v1.1.2 → v1.1.3 變更明細` table with one row: E4, R27, files.
- **Do not change `contracts/` or `AGENTS.md`.** The contracts are not affected, so their version stays `1.1.2`. State that in the v1.1.3 row, for example 「合約不變，維持 1.1.2」.
- Keep Traditional Chinese prose, English identifiers and the existing style.

## Final message (your report)
Reply in Traditional Chinese with:
- the exact new R27 text;
- the appendix rows you added;
- any defects you noticed but did not fix;
- anything you were unsure about.
