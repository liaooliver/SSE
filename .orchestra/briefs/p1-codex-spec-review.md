You are the future TEST AUTHOR for this project. Read ./SPEC.md (the only file you need). Review it strictly from the perspective of writing deterministic, non-flaky automated tests (pytest + httpx, plus E2E against a real uvicorn server). Do NOT write any files.

For each problem found, output one line in this exact format:
[SEVERITY: blocker|major|minor] R<id> — <problem> — <proposed rewrite or addition>

Focus on: requirements that are ambiguous or untestable as written, timing assumptions that will make tests flaky, missing edge cases, contradictions between requirements, and anything the interface contract (R2) is missing for you to test without reading the implementation.
End with a line "VERDICT: <ready|needs-changes>". Reply in Traditional Chinese for the problem descriptions; keep R-ids and code in English.
