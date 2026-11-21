T6.4b: PASS (0 issues)

The fix works. In an expanded task card, the log box now has the same space above and below it, in light and dark mode, with and without the error box.

Gaps are from `getBoundingClientRect`. "Above" is the log `ol` top minus the task-head bottom. "Below" is the card bottom minus the `ol` bottom. Each includes a 1 px border, so the content padding is 16 / 16.

| ID | verdict | measured gaps | screenshots |
|---|---|---|---|
| F1 | PASS | light, `success` run, `write_config` expanded with 10 log lines: above 17, below 17. The error box is `display:none`, height 0. | `F1-01-light-success-expanded-log.png` |
| F2 | PASS | light, pending task with 「（尚無 log）」: above 17, below 17 (log box height 44.5). | `F2-01-light-pending-empty-log.png` |
| F3 | PASS | light, `checksum_mismatch`, failed `verify_checksum` task: above 17, log → error box 12, error box → card bottom 17. The error box shows `E_CHECKSUM`, the message and the hint. | `F3-01-light-checksum-error-box.png` |
| F4 | PASS | dark F1: 17 / 17. Dark F3: 17 / 12 / 17, with code, message and hint visible. | `F4-01-dark-success-expanded-log.png`, `F4-02-dark-checksum-error-box.png` |
| F5 | PASS | no gap measurement. The running task `download_packages` expanded and its lines grew from 6 to 15 in the samples. The log auto-scrolled to the bottom (`scrollTop` = `scrollHeight` − `clientHeight`). Each running task collapsed on success as the next one expanded. `#install-btn` stayed disabled during the run and was enabled again at the end. | `F5-01-running-autoscroll-dark.png` |

- **Light-mode override:** the OS is dark, so F1–F3 used a temporary in-page override. I set every `prefers-color-scheme: dark` media rule to `not all`. A first attempt only changed the top-level rule and left washed-out badge text. I redid it recursively, because Tailwind nests the dark rules inside `@layer`. All F1–F3 numbers come from the corrected run.
- **Error-box spacing:** the 12 px between the log and the error box is the error box's own `mt-3`, an intentional smaller gap. It sits inside 16 px of padding above the log and below the error box, and I did not treat it as a defect.
- **Tool timeout:** one `javascript_tool` call (a 90 s polling loop) hit the 45 s CDP timeout. The page itself behaved normally and later calls worked, so I don't think it is a page issue.
- **Auto-follow:** clicking a stage button in the left list turned off 自動跟隨, as expected. F2 and the dark F1 were measured that way.

**Cleanup**
- My tab is closed.
- The server is stopped, and the port check printed `port 18577 free`.
- `./.t64-tmp/` is deleted.
- No `install.db` exists.
- The evidence folder `/Users/oliver/Desktop/projects/SSE/.orchestra/evidence/T6.4b/` has 6 PNGs plus `INDEX.md`, and `INDEX.md` has 6 entries.

I changed no project files.