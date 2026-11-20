# Brief: SPEC v0.3 + contract files (Spec Editor worker)

You are the SPEC EDITOR worker. Your working directory contains `SPEC.md` (v0.2). Work only inside this directory. Do not run shell commands.

## Goal
Make this spec "contract-first": two independent agents (an implementer and a test author) will work in total isolation from each other and must still produce code and tests that fit together. Their ONLY shared source of truth is what you produce here.

## Deliverables
1. **`contracts/openapi.yaml`** (OpenAPI 3.1)
   - Every HTTP endpoint in SPEC: `/health`, `/stats`, `POST /messages`, `GET /events/clock`, `GET /events/messages`, `GET /`.
   - Exact query params (types, min/max, defaults), request body schema, every status code the SPEC mentions (200/201/204/422), response schemas (`Message`, `Stats`, `Health`), and response headers required by R4.
   - For `/events/*`: media type `text/event-stream`; put event names and `data` JSON schemas under a vendor extension (e.g. `x-sse-events`) and reference the SPEC R-ids for framing rules. OpenAPI cannot fully describe SSE framing; SPEC.md stays authoritative for that.
2. **`contracts/domain.pyi`**: a type stub for a new module **`app/domain.py`** that holds the pure business logic, with no I/O and no FastAPI dependency. It must contain at least the following, each with a docstring that cites its R-id:
   - `parse_last_event_id(header: str | None) -> int | None` (R11 grammar)
   - `validate_message(user: object, text: object) -> tuple[str, str]` (R12; define the exact exception type it raises)
   - `select_replay(...)` (R15 rules; you design the exact signature, e.g. it takes an ordered history of messages and N and returns what to replay)
   - `format_sse(...)` (R5/R6/R7: event block, retry block, ping comment; you decide whether that is one function or several)
   - Any data types these need (e.g. a `Message` TypedDict or frozen dataclass), plus custom exception classes.
   - Keep the stub minimal: only what tests genuinely need to unit-test the core rules. Do not expose helpers.
3. **`SPEC.md` → v0.3**
   - Add a section "合約檔" stating: the contract files are authoritative for **shape** (names, signatures, paths, schemas); SPEC.md is authoritative for **behavior**; any contradiction between them is a spec defect to be reported, not guessed.
   - Add a section "領域介面" with one requirement per function in `domain.pyi`, giving R-ids (continue numbering from R23). Specify behavior precisely enough to unit-test it: inputs → outputs, error types, edge cases. Cross-reference the existing R11/R12/R15/R5–R7 instead of duplicating them where possible.
   - Update R2: tests may import only `create_app`, `app`, and the names listed in `contracts/domain.pyi`.
   - Add to §7 (測試指引) the **CONTRACT GAP rule**: if a test needs anything not in the contract, the test author must not assume. They report `CONTRACT GAP: <what> — <why>` instead. The implementer likewise must not add public surface that tests would rely on.
   - Do NOT change the meaning of any existing requirement R1–R22. If you find a real defect while doing this, list it in your report instead of fixing it silently.
   - Append a "v0.2 → v0.3" changelog table to the appendix.
   - Keep SPEC prose in Traditional Chinese (identifiers and code in English), consistent with the existing style.

## Final message (your report)
Reply in Traditional Chinese with:
- Files created or changed
- The list of public names in `domain.pyi` with one-line purpose each
- Any defects or ambiguities you found but did not fix (with R-ids)
- Anything you were unsure about
