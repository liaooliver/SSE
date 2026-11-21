# Brief T7.5 / T7.6: Integrate the cross-review into your document (author, integration)

You wrote `{DOC}` earlier in this working directory. A reviewer from another AI vendor checked it against the sources. Their report is in `./REVIEW.md`. The companion document written by the other agent is at `{OTHER}`, so the two documents can link to each other.

## Do
1. **Go through every finding in `REVIEW.md`:**
   - `MUST`: fix it, after you verify it against the source;
   - `SHOULD`: fix it unless you can show from the sources that the reviewer is wrong;
   - `NIT`: fix it if cheap.

   If you reject a finding, it must be because the source says otherwise. Quote the `file:line`.
2. **Make the two documents a consistent set.** Read `{OTHER}`, but do **not** edit it. Align your document to the shared rules below:
   - the same token names;
   - the header with title, subtitle, date and nav cross-link (`technical.html` ⇄ `ai-agents.html`);
   - the footer "資料來源";
   - the figure caption style 「圖 N：…」.

   Where the two documents describe the same thing, make sure they do not contradict each other. For example, the technical document may mention that the app was built by AI agents, and the agent document describes the app. If they do contradict, check the sources and report which one is wrong.
3. **Re-render with headless Chrome** at 1280 px and 390 px (light, and dark if you can), look at the images, and fix any overlap or overflow.
   - Save them in `./.t7-evidence/{TID}/` with an `INDEX.md`.
4. **Final checks:**
   - `grep -nE 'https?://|<link|src=|@import|url\(' {DOC}`: explain each hit;
   - `grep -n '/Users/' {DOC}` must be empty;
   - every `href="#…"` anchor exists;
   - the HTML is well formed: matching tags, one `<h1>`.
5. Change only `{DOC}` and `./.t7-evidence/{TID}/`. Do not delete `REVIEW.md`; the coordinator removes it.

## Final message (your report)
Reply in Traditional Chinese:
1. A summary line: `{TID}: <a> fixed, <r> rejected, <s> skipped`.
2. A table: finding number, what you did, and for a rejection the source `file:line`.
3. The consistency changes you made, and any contradiction with `{OTHER}` that you found and could not resolve.
4. The grep and anchor check results.
5. The screenshot names.
