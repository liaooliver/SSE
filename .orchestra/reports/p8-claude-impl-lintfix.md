# T8.3-fix1 回報

`npm run lint` now checks `worker/tests/` with the same type-aware rules as `src/`.

**Changed file:** only `worker/eslint.config.mjs`. `src/**/*.ts` and `tests/**/*.ts` now use `parserOptions.project: ["./tsconfig.json", "./tsconfig.test.json"]`, so files under `tests/` resolve to `tsconfig.test.json`. Only `eslint.config.mjs` and `vitest.config.ts`, which are in neither tsconfig, still use `projectService` with the default project. The rules haven't changed: `strictTypeChecked` + `stylisticTypeChecked`, `no-console` (off only for `src/logger.ts`), and `prefer-readonly`. Nothing was relaxed, nothing new is ignored, and `tsconfig.test.json` is unchanged.

**Probe check** (`tests/_probe.test.ts` imported `node:child_process` and `vitest`, with one `describe`/`it`):
- **Before the fix:** I first reproduced the reported error, `was not found by the project service`.
- **(a) Clean probe:** `npm run lint` parsed and checked it, exit 0. `npm run typecheck` also passed with the probe present.
- **(b) Probe with violations:** I added an `any`, a `console.log` and an unawaited Promise. Lint failed with exit 1 and 3 errors: `no-explicit-any`, `no-console`, and the type-aware `no-floating-promises`.

**The three commands** (rerun after deleting the probe, so `tests/` doesn't exist — this also covers item 4):

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 (`All matched files use Prettier code style!`) |

**Cleanup:** the probe and the whole `tests/` folder are deleted, there is no `.tmp/`, and `pgrep` finds no `wrangler` or `workerd` processes. Nothing outside `worker/` was modified.
