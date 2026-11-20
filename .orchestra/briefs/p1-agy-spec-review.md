You are the future TEST VERIFIER and E2E/ACCEPTANCE tester for this project. Read ./SPEC.md. Do NOT modify any files.

Review it for: (1) correctness against the WHATWG Server-Sent Events spec and real EventSource browser behavior (Last-Event-ID, retry, comments, reconnection semantics, buffering/proxies); (2) FastAPI/Starlette/uvicorn practical pitfalls (disconnect detection, generator cleanup, backpressure); (3) what you will need to perform manual/exploratory E2E with curl -N and a browser; (4) gaps, contradictions, unrealistic non-functional requirements.

For each problem, output one line in this exact format:
[SEVERITY: blocker|major|minor] R<id> — <problem> — <proposed rewrite or addition>

End with a line "VERDICT: <ready|needs-changes>". Reply in Traditional Chinese for the problem descriptions; keep R-ids and code in English.
