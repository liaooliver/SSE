/**
 * Contract for `worker/src/domain.ts` (SPEC v1.1.4 + SPEC-cloudflare cf1.1).
 *
 * TypeScript counterpart of `contracts/domain.pyi`. Pure logic only: no `cloudflare:workers`
 * imports, no I/O, no clock (`Date`), no randomness, no `console`. `worker/src/domain.ts` must
 * export every name exported here with a compatible signature; tests may import exactly these
 * names from `worker/src/domain.ts` and nothing else from `worker/src/`.
 *
 * Mapping rules (domain.pyi -> this file):
 *  1. Names: functions, methods and their parameters snake_case -> camelCase
 *     (`script_for` -> `scriptFor`, `run_id` parameter -> `runId`). Types/classes keep
 *     PascalCase. Constants keep UPPER_SNAKE_CASE.
 *  2. Data field names keep the pyi snake_case (`run_id`, `last_seq`, `task_id`, `error_code`,
 *     `fail_task_id`, `log_lines`, ...). They are the HTTP/SSE wire names defined by
 *     `contracts/openapi.yaml`, so values serialize with `JSON.stringify` without renaming.
 *  3. `@dataclass(frozen=True, slots=True)` -> interface whose fields are all `readonly`. Values
 *     are plain object literals (no constructor); equality is deep structural equality.
 *  4. `tuple[X, ...]` -> `readonly X[]` (same type as `ReadonlyArray<X>`);
 *     `tuple[int, int]` -> `readonly [number, number]`;
 *     `Mapping[str, V]` -> `Readonly<Record<string, V>>` for event data, and
 *     `ReadonlyMap<string, Scenario>` for `SCENARIOS` (keeps insertion order = R5 order).
 *  5. `Literal[...]` / `TypeAlias` -> string literal union / `type`.
 *  6. `int` -> `number` that satisfies `Number.isSafeInteger` (a boolean is never an int; an
 *     integer parsed from text that exceeds 2^53 - 1 is invalid, SPEC-cloudflare §7 CF-GAP-1);
 *     `float` -> finite `number`; `str` -> `string`; `bool` -> `boolean`; `None` -> `null`;
 *     `X | None` -> `X | null`.
 *  7. `Final` constants -> `export declare const`, typed as the exact literal when SPEC fixes it.
 *  8. Python `ValueError` / `KeyError` -> the `ValueError` / `KeyError` classes declared here
 *     (subclasses of `Error`); test with `instanceof`.
 *  9. Time: the pyi has no numeric time; `ts` is an ISO-8601 UTC string, unchanged here.
 *
 * Note: `Event` shadows the global `Event` type of the Workers runtime inside modules that
 * import it; importing it under an alias (`import type { Event as DomainEvent }`) is allowed.
 *
 * Cloudflare-only additions (not in domain.pyi): `ValueError`, `KeyError` (rule 8) and
 * `SubscriberQueue` (SPEC-cloudflare R23 / AC10).
 *
 * Decided (cf1.1, CF-GAP-1 option (a)): integers above 2^53 - 1 are invalid. `parseEventId`
 * returns null for them; numbers stay `number` (no `bigint`).
 */

/** Any JSON value (pyi `JsonValue`). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** R8: event types (pyi `EventType`). */
export type EventType =
  | "run_started"
  | "stage_started"
  | "stage_succeeded"
  | "stage_failed"
  | "task_started"
  | "task_succeeded"
  | "task_failed"
  | "log"
  | "run_finished";

/** R10: stage/task status (pyi `Status`). */
export type Status = "pending" | "running" | "succeeded" | "failed";

/** R10: run status (pyi `RunStatus`). */
export type RunStatus = "running" | "succeeded" | "failed";

/** R8: log level (pyi `LogLevel`). */
export type LogLevel = "info" | "error";

/** R4: one task of the fixed plan. */
export interface TaskDef {
  readonly id: string;
  readonly name: string;
  readonly log_lines: number;
}

/** R4: one stage of the fixed plan. */
export interface StageDef {
  readonly id: string;
  readonly name: string;
  readonly tasks: readonly TaskDef[];
}

/** R5: a simulation scenario. All failure fields are null for `success`. */
export interface Scenario {
  readonly id: string;
  readonly label: string;
  readonly fail_task_id: string | null;
  readonly fail_after_lines: number | null;
  readonly error_code: string | null;
  readonly message: string | null;
  readonly hint: string | null;
}

/**
 * R6: one scripted event, without `seq`, without the log `ts` and without `run_id`.
 *
 * The `run_started` step's `data` is `{ scenario: <id> }` only.
 */
export interface ScriptStep {
  readonly type: EventType;
  readonly data: Readonly<Record<string, JsonValue>>;
}

/** R7/R8: a persisted event. For `log` events `data` includes `ts`. */
export interface Event {
  readonly run_id: number;
  readonly seq: number;
  readonly type: EventType;
  readonly data: Readonly<Record<string, JsonValue>>;
  readonly ts: string;
}

/** R13: failure details of a task. */
export interface TaskError {
  readonly error_code: string;
  readonly message: string;
  readonly hint: string;
}

/** R13: task part of the snapshot. */
export interface TaskState {
  readonly id: string;
  readonly name: string;
  readonly status: Status;
  readonly error: TaskError | null;
}

/** R13: stage part of the snapshot. */
export interface StageState {
  readonly id: string;
  readonly name: string;
  readonly status: Status;
  readonly tasks: readonly TaskState[];
}

/**
 * R13: full state of one run after applying events `1..last_seq`.
 *
 * `JSON.stringify` of a Snapshot is exactly the `Snapshot` schema of openapi.yaml.
 */
export interface Snapshot {
  readonly run_id: number;
  readonly scenario: string;
  readonly status: RunStatus;
  readonly last_seq: number;
  readonly stages: readonly StageState[];
}

/** Python `ValueError` counterpart: invalid argument or invalid state transition (R10). */
export declare class ValueError extends Error {
  constructor(message?: string);
}

/** Python `KeyError` counterpart: unknown scenario id (R6, R10). */
export declare class KeyError extends Error {
  constructor(message?: string);
}

/** R4: the fixed install plan, in order. */
export declare const PLAN: readonly StageDef[];

/** R5: scenarios keyed by id; iteration order equals the R5 table order. */
export declare const SCENARIOS: ReadonlyMap<string, Scenario>;

/** R20: exactly `"retry: 3000\n\n"`. */
export declare const RETRY_BLOCK: "retry: 3000\n\n";

/** R22: exactly `": ping\n\n"`. */
export declare const PING_COMMENT: ": ping\n\n";

/** R9: `(3, 57) -> "3.57"`. */
export declare function formatEventId(runId: number, seq: number): string;

/**
 * R9: trim, then require `^[0-9]+\.[0-9]+$`; `"3.57" -> [3, 57]`.
 *
 * Additionally both parts must be <= 2^53 - 1 (`Number.MAX_SAFE_INTEGER`); otherwise the input
 * is invalid (SPEC-cloudflare R9). Returns null for null or any invalid input; never throws.
 */
export declare function parseEventId(
  raw: string | null,
): readonly [runId: number, seq: number] | null;

/**
 * R6: the full deterministic event script of a scenario.
 *
 * The script has no run id: the first step is `run_started` with `data` equal to
 * `{ scenario: scenarioId }`. The persisted/streamed `run_started` event additionally carries
 * `run_id` (R8), added when the run is written.
 *
 * @throws KeyError for an unknown scenario id.
 */
export declare function scriptFor(scenarioId: string): readonly ScriptStep[];

/**
 * R10: state before any event: run `running`, `last_seq` 0, everything `pending`.
 *
 * @throws KeyError for an unknown scenario id.
 */
export declare function initialSnapshot(runId: number, scenarioId: string): Snapshot;

/**
 * R10: return the new snapshot after applying one event; `state` is not modified.
 *
 * @throws ValueError if `event.run_id !== state.run_id`, `event.seq !== state.last_seq + 1`,
 * the transition is not allowed by the state machine, or any other case listed in SPEC R10:
 * the first event is not `run_started` or `run_started` appears later; any event after
 * `run_finished`; an unknown stage id; a `task_*`/`log` event whose `(stage_id, task_id)` pair
 * is not in the plan (R4), including a task id that exists but belongs to a different stage; a
 * `task_*`/`log` event whose stage is not `running`; a `log` event whose task is not `running`;
 * `data` missing a field or having a field of the wrong type (int = safe integer number, see
 * mapping rule 6).
 *
 * Not required (tests must not assert either way): checking that all tasks of a stage are
 * finished when the stage finishes; checking that `run_started`'s `data.run_id` or
 * `data.scenario` matches the snapshot or `event.run_id`; enforcing that stages/tasks start in
 * plan order, or that only one stage/task is `running` at a time.
 */
export declare function applyEvent(state: Snapshot, event: Event): Snapshot;

/**
 * R19: one SSE block ending with a blank line.
 *
 * Fields: `id: <run_id>.<seq>`, `event: <type>`, `data: <one-line JSON>`. Only the parsed
 * result is contractual: the JSON text may differ byte-wise from the Python version (e.g.
 * non-ASCII characters are emitted as UTF-8, not `\uXXXX`).
 */
export declare function formatEvent(event: Event): string;

/**
 * SPEC-cloudflare R23 / AC10 (Cloudflare-only): bounded FIFO queue of one subscriber.
 *
 * Holds live events broadcast to the subscriber but not yet handed to its response stream.
 * Pure in-memory data structure: no I/O, no timers. This contract and its AC10 unit tests stay
 * the same whichever R23 design (A or B, chosen by the R23 spike) the DO uses.
 */
export declare class SubscriberQueue<T> {
  /** @throws ValueError if `capacity` is not a safe integer >= 1 (e.g. 0, -1, 1.5, NaN). */
  constructor(capacity: number);

  /** The capacity given to the constructor (`subscriber_queue_size`). */
  readonly capacity: number;

  /** Number of queued items; always `0 <= size <= capacity`. */
  get size(): number;

  /**
   * If `size < capacity`: append `item` at the tail and return true.
   * If `size === capacity`: overflow — leave the queue unchanged and return false.
   */
  push(item: T): boolean;

  /** Remove and return the head item (FIFO); return undefined when empty. */
  shift(): T | undefined;
}
