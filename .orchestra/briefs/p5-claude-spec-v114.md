# Brief T5.4: SPEC v1.1.3 → v1.1.4 (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `docs/SPEC.md` (v1.1.3), `contracts/domain.pyi`, `contracts/openapi.yaml` and `AGENTS.md`. Work only inside this directory. You cannot run shell commands.

## Background
In the v1.1.3 edit, you reported two ambiguities in R27 「錯誤與重試」 but did not fix them. The user has **already decided** both. Write the decisions precisely. Do not re-decide them and do not change anything else. If you notice another real defect, list it in your report instead of fixing it.

Both decisions describe behaviour the implementation already has, which final acceptance confirmed. This is a documentation-only change.

Current text (R27, `docs/SPEC.md` around line 177):
> **錯誤與重試**：同步流程中的請求（`GET /install`、`GET /install/logs`）發生網路錯誤、同步流程中遇到 `409` 以外的錯誤，或這一輪還在執行時 `EventSource` 變成 `CLOSED`：在 `#run-status` 顯示錯誤，3 秒後重新執行同步流程。這一輪還在執行時 `EventSource` 發生錯誤，但 `readyState` 是 `CONNECTING`（瀏覽器正在自動重連）：只在 `#run-status` 顯示錯誤，**不**重新執行同步流程，讓 `EventSource` 自己帶 `Last-Event-ID` 重連；R18、R20 保證事件不漏、不重複。

## Edits
- **E5: after a successful auto-reconnect.** When the `EventSource` reconnects successfully after a `CONNECTING` error (its `open` event fires), `#run-status` goes back to showing the current run's status instead of the error.
- **E6: `404` is not an error.** The phrase 「`409` 以外的錯誤」 does not include `GET /install` returning `404`. That case is handled as R27 「載入時」 already defines it: show only the plan with every node `pending`, with no error shown and no retry.
  - Check how 「載入時」 and the sync-flow steps describe `404`, and phrase E6 so the two items no longer conflict.
  - Do not change what `GET /install/logs` returning `409` does: it re-runs the sync flow immediately, as already written.

Keep the existing triggers, the 3-second retry and the v1.1.3 `CONNECTING` sentence. Add at most one or two short sentences or clauses in the same style. No other R/AC changes.

## Housekeeping
- Change the title to `v1.1.4`.
- In the appendix version table, add a `v1.1.4` row: 使用者決定; follow-up to the v1.1.3 editor's notes; documents existing behaviour; 「合約不變，維持 1.1.2」.
- Add a `v1.1.3 → v1.1.4 變更明細` table with two rows, E5 and E6, each with the affected R and files.
- **Do not change `contracts/` or `AGENTS.md`.**
- Keep Traditional Chinese prose, English identifiers and the existing style.

## Final message (your report)
Reply in Traditional Chinese with:
- the exact new R27 「錯誤與重試」 text, plus any other sentence you changed (with its line);
- the appendix rows you added;
- any defects you noticed but did not fix;
- anything you were unsure about.
