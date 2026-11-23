/**
 * The single event sequence in the Durable Object's SQLite (SPEC-cloudflare R13–R15, R25).
 *
 * Every method is synchronous. Each method that writes events runs inside exactly one
 * `transactionSync` callback, computing `seq` from the current `last_seq` inside it.
 */
import {
  applyEvent,
  initialSnapshot,
  scriptFor,
  type Event,
  type EventType,
  type JsonValue,
  type ScriptStep,
  type Snapshot,
} from "./domain";

type EventData = Readonly<Record<string, JsonValue>>;
type Row = Record<string, SqlStorageValue>;

/** The current (latest) run. */
export interface RunInfo {
  readonly runId: number;
  readonly scenario: string;
  readonly running: boolean;
  readonly lastSeq: number;
}

/** R15: one page of log events of the current run. */
export interface LogPage {
  readonly run: RunInfo;
  readonly items: readonly Event[];
  readonly hasMore: boolean;
}

/** R14: result of one simulator step. */
export type StepOutcome =
  | { readonly kind: "idle" }
  | { readonly kind: "wait"; readonly untilMs: number }
  | { readonly kind: "written"; readonly events: readonly Event[]; readonly finished: boolean };

const SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS runs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     scenario TEXT NOT NULL,
     status TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS events (
     run_id INTEGER NOT NULL,
     seq INTEGER NOT NULL,
     type TEXT NOT NULL,
     data TEXT NOT NULL,
     ts TEXT NOT NULL,
     PRIMARY KEY (run_id, seq)
   )`,
];

const INTERRUPTED: EventData = {
  error_code: "E_INTERRUPTED",
  message: "伺服器在安裝途中停止",
  hint: "請重新安裝",
};

const EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  "run_started",
  "stage_started",
  "stage_succeeded",
  "stage_failed",
  "task_started",
  "task_succeeded",
  "task_failed",
  "log",
  "run_finished",
]);

function isEventType(value: string): value is EventType {
  return EVENT_TYPES.has(value);
}

function isJsonObject(value: unknown): value is EventData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function intColumn(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`column ${key} is not an integer`);
  }
  return value;
}

function textColumn(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new TypeError(`column ${key} is not text`);
  }
  return value;
}

function rowToEvent(row: Row): Event {
  const type = textColumn(row, "type");
  if (!isEventType(type)) {
    throw new TypeError(`stored event type ${type} is unknown`);
  }
  const data: unknown = JSON.parse(textColumn(row, "data"));
  if (!isJsonObject(data)) {
    throw new TypeError("stored event data is not a JSON object");
  }
  return {
    run_id: intColumn(row, "run_id"),
    seq: intColumn(row, "seq"),
    type,
    data,
    ts: textColumn(row, "ts"),
  };
}

/**
 * R14: the next simulator step of a run whose first `lastSeq` script events are written.
 * A step is the event at index `lastSeq` plus every following non-`log` event.
 */
function nextStep(script: readonly ScriptStep[], lastSeq: number): readonly ScriptStep[] {
  const steps: ScriptStep[] = [];
  for (let index = lastSeq; index < script.length; index += 1) {
    const step = script[index];
    if (step === undefined || (steps.length > 0 && step.type === "log")) {
      break;
    }
    steps.push(step);
  }
  return steps;
}

/** Owns the SQL schema and every read/write of runs and events. */
export class Store {
  private readonly sql: SqlStorage;

  constructor(private readonly storage: DurableObjectStorage) {
    this.sql = storage.sql;
  }

  /** R25: create the tables (called inside `blockConcurrencyWhile`). */
  init(): void {
    for (const statement of SCHEMA) {
      this.sql.exec(statement);
    }
  }

  /** The latest run, or null if this persist directory never ran one. */
  currentRun(): RunInfo | null {
    const rows = this.sql
      .exec(
        `SELECT r.id AS id, r.scenario AS scenario, r.status AS status,
                (SELECT COALESCE(MAX(seq), 0) FROM events e WHERE e.run_id = r.id) AS last_seq
           FROM runs r ORDER BY r.id DESC LIMIT 1`,
      )
      .toArray();
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      runId: intColumn(row, "id"),
      scenario: textColumn(row, "scenario"),
      running: textColumn(row, "status") === "running",
      lastSeq: intColumn(row, "last_seq"),
    };
  }

  /** R18/R20: events of `runId` with `seq > after`, in order. */
  eventsAfter(runId: number, after: number): readonly Event[] {
    return this.sql
      .exec("SELECT * FROM events WHERE run_id = ? AND seq > ? ORDER BY seq", runId, after)
      .toArray()
      .map(rowToEvent);
  }

  /** R13: fold every event of the current run, read inside one `transactionSync` callback. */
  snapshot(): Snapshot | null {
    return this.storage.transactionSync(() => {
      const run = this.currentRun();
      return run === null ? null : this.fold(run);
    });
  }

  /** R15: log events of the current run with `after < seq <= until`, read atomically. */
  readLogs(after: number, until: number | null, limit: number): LogPage | null {
    return this.storage.transactionSync(() => {
      const run = this.currentRun();
      if (run === null) {
        return null;
      }
      const upper = until ?? run.lastSeq;
      const rows = this.sql
        .exec(
          `SELECT * FROM events WHERE run_id = ? AND type = 'log' AND seq > ? AND seq <= ?
             ORDER BY seq LIMIT ?`,
          run.runId,
          after,
          upper,
          limit + 1,
        )
        .toArray();
      return { run, items: rows.slice(0, limit).map(rowToEvent), hasMore: rows.length > limit };
    });
  }

  /** R14: replace the previous run and write `run_started`; null while a run is running. */
  startRun(scenario: string, ts: string): Event | null {
    return this.storage.transactionSync(() => {
      const current = this.currentRun();
      if (current?.running === true) {
        return null;
      }
      this.sql.exec("DELETE FROM events");
      this.sql.exec("DELETE FROM runs");
      const row = this.sql
        .exec("INSERT INTO runs (scenario, status) VALUES (?, 'running') RETURNING id", scenario)
        .one();
      const runId = intColumn(row, "id");
      return this.insert(runId, 1, "run_started", { run_id: runId, scenario }, ts);
    });
  }

  /**
   * R14: write the next simulator step of the running run in one transaction. The step to run
   * depends only on the stored scenario and `last_seq`, so a retried alarm never duplicates.
   * Returns `wait` if fewer than `minGapMs` passed since the previous step (alarm fired early).
   */
  advance(nowMs: number, minGapMs: number): StepOutcome {
    return this.storage.transactionSync((): StepOutcome => {
      const run = this.currentRun();
      if (!run?.running) {
        return { kind: "idle" };
      }
      if (run.lastSeq > 1) {
        const dueMs = Date.parse(this.lastTs(run)) + minGapMs;
        if (nowMs < dueMs) {
          return { kind: "wait", untilMs: Math.ceil(dueMs) };
        }
      }
      const steps = nextStep(scriptFor(run.scenario), run.lastSeq);
      const ts = new Date(nowMs).toISOString();
      const events = steps.map((step, offset) =>
        this.insert(run.runId, run.lastSeq + 1 + offset, step.type, step.data, ts),
      );
      const finished = events.length === 0 || events.at(-1)?.type === "run_finished";
      return { kind: "written", events, finished };
    });
  }

  /** R25: close a run left `running` by an interrupted process; returns the added events. */
  recover(ts: string): readonly Event[] {
    return this.storage.transactionSync(() => {
      const run = this.currentRun();
      if (!run?.running) {
        return [];
      }
      let state = this.fold(run);
      const added: Event[] = [];
      const emit = (type: EventType, data: EventData): void => {
        const event = this.insert(run.runId, state.last_seq + 1, type, data, ts);
        state = applyEvent(state, event);
        added.push(event);
      };
      if (state.last_seq === 0) {
        emit("run_started", { run_id: run.runId, scenario: run.scenario });
      }
      for (const stage of state.stages) {
        for (const task of stage.tasks) {
          if (task.status === "running") {
            emit("task_failed", { stage_id: stage.id, task_id: task.id, ...INTERRUPTED });
          }
        }
        if (stage.status === "running") {
          emit("stage_failed", { stage_id: stage.id });
        }
      }
      emit("run_finished", { result: "failed" });
      return added;
    });
  }

  private fold(run: RunInfo): Snapshot {
    let state = initialSnapshot(run.runId, run.scenario);
    for (const event of this.eventsAfter(run.runId, 0)) {
      state = applyEvent(state, event);
    }
    return state;
  }

  private lastTs(run: RunInfo): string {
    const row = this.sql
      .exec("SELECT ts FROM events WHERE run_id = ? AND seq = ?", run.runId, run.lastSeq)
      .one();
    return textColumn(row, "ts");
  }

  private insert(runId: number, seq: number, type: EventType, data: EventData, ts: string): Event {
    const payload: EventData = type === "log" ? { ...data, ts } : data;
    this.sql.exec(
      "INSERT INTO events (run_id, seq, type, data, ts) VALUES (?, ?, ?, ?, ?)",
      runId,
      seq,
      type,
      JSON.stringify(payload),
      ts,
    );
    const result = payload.result;
    if (type === "run_finished" && typeof result === "string") {
      this.sql.exec("UPDATE runs SET status = ? WHERE id = ?", result, runId);
    }
    return { run_id: runId, seq, type, data: payload, ts };
  }
}
