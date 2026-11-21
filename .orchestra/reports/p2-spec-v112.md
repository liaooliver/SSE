T2.7 is done: SPEC is now v1.1.2 and all three edits (E1–E3) are in. I couldn't run any shell commands, so none of the AGENTS.md §1 checks have been run (`ruff format --check`, `ruff check`, `mypy`, a YAML parse). The orchestrator needs to run them.

## E1 — `contracts/openapi.yaml`
- **`x-sse-events.control.reset.when`**: changed from a one-line string to a folded block (`>`). The new text:
  `Start point (r, n) with r != R (current run running or finished), or r = R and n > L (last seq) while the run is still running (R18). If the run has finished and r = R, n >= L, the response is 204, not reset.`
- **`GET /install/events` → `"204"` description**: I changed this one. The old text, "the client already has the last event", only really covers `n = L`. When `n > L` the client doesn't actually have the last event, so it didn't match R18. The new text is a quoted string:
  `"Run finished and the start point (r, n) has r = R and n >= L, the last seq (R18)."`
- R18 in SPEC is unchanged.

## E2 — `AGENTS.md` §4 "回應"
The `/health` exception is removed and the rest of the sentence keeps its meaning:
```
- **回應**：所有 JSON 端點（包含 `/health`）都用 Pydantic model 或明確的回傳型別，
  讓 FastAPI 自動產生符合 `contracts/openapi.yaml` 的 schema；不回傳裸的 `dict` 當作公開 API 形狀。
```

## E3 — `contracts/domain.pyi` type aliases
- `JsonValue` is now on one line with no parentheses, and ends with the pragma:
  `JsonValue: TypeAlias = str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None  # noqa: UP040  stubtest 不支援 PEP 695（B1）`
- The pragma `  # noqa: UP040  stubtest 不支援 PEP 695（B1）` is also on the first line of `EventType` (the line `EventType: TypeAlias = Literal[`), `Status`, `RunStatus` and `LogLevel`.
- Names, values and order are unchanged.

## Version bumps
- **`docs/SPEC.md`**: title is now `v1.1.2`. The appendix version table has a new `v1.1.2` row (T2.5 follow-up), and there is a new `v1.1.1 → v1.1.2 變更明細` table with one row each for E1 (R18, `openapi.yaml`), E2 (R17, `AGENTS.md`) and E3 (R2, `domain.pyi`; R2 follows the earlier B1 row).
- **`domain.pyi`**: header docstring is now `SPEC v1.1.2`.
- **`openapi.yaml`**: `info.version` is `1.1.2` and the description says `SPEC v1.1.2`.

## Defects noticed but not fixed
- **R18 table row is hard to parse.** The row reads "`r ≠ R`，或 `n > L`，且這一輪還在執行". It could mean "r ≠ R, or (n > L and running)" or "(r ≠ R or n > L) and running". The next row ("`r ≠ R`，且這一輪已經結束 → reset") makes the behaviour the same either way, so this is not a real conflict. Rewording it as "`r ≠ R`；或 `r = R`、`n > L`" would read more clearly. I didn't change it because the brief says R18 stays the same.

## Unsure about
- **Line length.** All five pragma lines are over 100 characters, and the `JsonValue` code alone is about 98. Ruff's formatter and `E501` should ignore pragma comments when measuring line width. I'm not sure ruff still treats the comment as a pragma with the reason text after `UP040`, and I don't know whether `E501` is enabled in `pyproject.toml`. If `ruff format --check` or `ruff check` reports problems on these lines, the pragma format the brief specified needs another decision.
- **YAML validity.** I believe both changes parse, but I haven't run a parser on them. The `204` description is in quotes so `>=` and the comma inside the flow mapping are safe, and `when: >` is a standard folded block.


---

## 追加修正（協調者 resume，同一 session）

已把全形括號 `（B1）` 改成半形 `(B1)`，前面留一個空格，共改了 6 行，其他內容都沒動。我還是不能執行 shell，所以 `ruff check`／`ruff format --check` 都**沒跑過**，請協調者實際跑一次確認。

**`contracts/domain.pyi`（5 行）**
```
37: JsonValue: TypeAlias = str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None  # noqa: UP040  stubtest 不支援 PEP 695 (B1)
38: EventType: TypeAlias = Literal[  # noqa: UP040  stubtest 不支援 PEP 695 (B1)
49: Status: TypeAlias = Literal["pending", "running", "succeeded", "failed"]  # noqa: UP040  stubtest 不支援 PEP 695 (B1)
50: RunStatus: TypeAlias = Literal["running", "succeeded", "failed"]  # noqa: UP040  stubtest 不支援 PEP 695 (B1)
51: LogLevel: TypeAlias = Literal["info", "error"]  # noqa: UP040  stubtest 不支援 PEP 695 (B1)
```

**`docs/SPEC.md`（1 行）**：v1.1.1 → v1.1.2 表的 E3 列（第 276 行），引用的 pragma 改為 `` `# noqa: UP040  stubtest 不支援 PEP 695 (B1)` ``。

SPEC 第 251 行 B1 列的說明文字「（`stubtest` 不支援 PEP 695）」也用了全形括號，但那是中文說明，不是 pragma，也不是 Python 檔，RUF003 不會檢查，所以我沒改。
