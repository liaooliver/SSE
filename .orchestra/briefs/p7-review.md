# Brief T7.3 / T7.4: Cross-review a documentation HTML file (reviewer)

You are the **REVIEWER**. Another AI agent from a different vendor wrote one HTML document in this working directory. Your job is to check it hard against the source files and report problems. **Do not edit the document.** The original author will apply your findings.

- **Document under review:** `{DOC}`
- **Sources of truth:** {SOURCES}
- **What the document was asked to cover:** the original writer's brief is below, under "Writer's brief". The shared format rules are below that.

## Check
1. **Accuracy.** Check every factual claim, number, file name, function name, event name, status value, HTTP path, header, model name, time and cost against the sources. Open the cited `file:line` and confirm it. For each wrong, unsupported or invented claim, quote the sentence and give the correct fact with its source.
2. **Diagrams.** For each SVG, check:
   - (a) that it matches the real structure or flow in the sources: boxes, arrows, direction and labels;
   - (b) that nothing important is missing;
   - (c) that it renders cleanly: no overlapping text, no text cut off at the viewBox edge, arrows that point at the right box, readable in both themes.
3. **Coverage.** Every required section and diagram in the writer's brief exists and actually answers its question. List the missing or thin ones.
4. **Format rules:**
   - no external resources: run `grep -nE 'https?://|<link|src=|@import|url\(' {DOC}`;
   - `prefers-color-scheme` dark tokens;
   - the cross-link in the header;
   - no horizontal page scroll at 390 px;
   - Traditional Chinese prose;
   - no absolute home paths (`grep -n '/Users/' {DOC}` must be empty), no personal names or emails.
5. **Readability.** Confusing explanations, wrong terminology, or a section order that does not flow.

## Render evidence (required)
- Screenshot the document with headless Chrome at 1280 px and 390 px (light), and in dark mode if you can. Several shots or a tall window are fine. Example: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,9000 --screenshot=./.t7-evidence/{TID}/review-1280.png "file://$PWD/{DOC}"`. For dark mode, try adding `--force-dark-mode --blink-settings=preferredColorScheme=0` and check that it really turned dark.
- **Look at the screenshots** and base the render findings on them.
- Save them in `./.t7-evidence/{TID}/` with an `INDEX.md` (name, what it shows).
- If Chrome cannot run in your sandbox, say so and review the SVG source instead.

## Rules
- Write only inside `./.t7-evidence/{TID}/`. Do not modify any other file.
- Do not start servers. Reading files and running grep/Chrome screenshots is enough.

## Final message (your report)
Reply in Traditional Chinese:
1. A summary line: `{TID}: <n> must-fix, <m> should-fix, <k> nit`.
2. A numbered findings list. Each item has:
   - the severity: `MUST` (wrong facts, broken or missing required diagrams, rule violations), `SHOULD` (thin coverage, unclear diagrams, render problems) or `NIT`;
   - the location: section heading, and figure number or line;
   - what is wrong, quoting it;
   - the correct fact with its source `file:line`;
   - a concrete suggested fix.
3. A list of the claims you verified as correct. Keep it short, grouped by section.
4. The screenshot names.
