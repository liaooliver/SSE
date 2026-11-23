/**
 * Pure install-progress logic (SPEC R4–R10, R19, R20, R22; SPEC-cloudflare R9, R23).
 *
 * Public names and signatures follow `contracts/domain.d.ts`. No I/O, no clock, no randomness,
 * no logger, and no imports other than the contract's types.
 */
import type {
  Event,
  EventType,
  JsonValue,
  LogLevel,
  RunStatus,
  Scenario,
  ScriptStep,
  Snapshot,
  StageDef,
  StageState,
  Status,
  TaskDef,
  TaskState,
} from "../../contracts/domain";

export type {
  Event,
  EventType,
  JsonValue,
  LogLevel,
  RunStatus,
  Scenario,
  ScriptStep,
  Snapshot,
  StageDef,
  StageState,
  Status,
  TaskDef,
  TaskError,
  TaskState,
} from "../../contracts/domain";

type EventData = Readonly<Record<string, JsonValue>>;

/** Python `ValueError` counterpart: invalid argument or invalid state transition (R10). */
export class ValueError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ValueError";
  }
}

/** Python `KeyError` counterpart: unknown scenario id (R6, R10). */
export class KeyError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "KeyError";
  }
}

function stage(id: string, name: string, tasks: readonly (readonly [string, string, number])[]) {
  const defs = tasks.map(([taskId, taskName, logLines]) => ({
    id: taskId,
    name: taskName,
    log_lines: logLines,
  }));
  return { id, name, tasks: defs } satisfies StageDef;
}

/** R4: the fixed install plan, in order. */
export const PLAN: readonly StageDef[] = [
  stage("prepare", "準備環境", [
    ["check_os", "檢查作業系統", 8],
    ["check_disk", "檢查磁碟空間", 6],
    ["check_deps", "檢查相依套件", 12],
  ]),
  stage("download", "下載套件", [
    ["fetch_manifest", "取得套件清單", 6],
    ["download_packages", "下載套件", 30],
    ["verify_checksum", "驗證雜湊", 10],
  ]),
  stage("install", "安裝", [
    ["extract", "解壓縮", 20],
    ["copy_files", "複製檔案", 40],
    ["register", "註冊元件", 8],
  ]),
  stage("configure", "設定", [
    ["write_config", "寫入設定", 10],
    ["set_permissions", "設定權限", 6],
    ["start_service", "啟動服務", 12],
  ]),
];

const SCENARIO_LIST: readonly Scenario[] = [
  {
    id: "success",
    label: "全部成功",
    fail_task_id: null,
    fail_after_lines: null,
    error_code: null,
    message: null,
    hint: null,
  },
  {
    id: "network_unreachable",
    label: "無法連線到套件伺服器",
    fail_task_id: "fetch_manifest",
    fail_after_lines: 0,
    error_code: "E_NETWORK",
    message: "無法連線到套件伺服器 packages.example.com:443",
    hint: "請檢查網路、Proxy 與防火牆設定後重新安裝",
  },
  {
    id: "dependency_missing",
    label: "缺少相依套件",
    fail_task_id: "check_deps",
    fail_after_lines: 7,
    error_code: "E_DEPENDENCY",
    message: "缺少相依套件 libssl（需要 >= 3.0）",
    hint: "請先安裝 libssl 3.0 以上版本後重新安裝",
  },
  {
    id: "checksum_mismatch",
    label: "套件雜湊值不符",
    fail_task_id: "verify_checksum",
    fail_after_lines: 9,
    error_code: "E_CHECKSUM",
    message: "套件 core-2.4.1.pkg 的 SHA-256 雜湊值不符",
    hint: "請清除下載快取後重新下載，或改用其他鏡像站",
  },
  {
    id: "disk_full",
    label: "磁碟空間不足",
    fail_task_id: "copy_files",
    fail_after_lines: 23,
    error_code: "E_DISK_FULL",
    message: "磁碟空間不足，/opt 剩餘 0 MB",
    hint: "請釋放至少 2 GB 空間後重新安裝",
  },
  {
    id: "permission_denied",
    label: "權限不足",
    fail_task_id: "set_permissions",
    fail_after_lines: 3,
    error_code: "E_PERMISSION",
    message: "無法寫入 /etc/app：權限不足",
    hint: "請以系統管理員權限執行安裝",
  },
  {
    id: "service_timeout",
    label: "服務啟動逾時",
    fail_task_id: "start_service",
    fail_after_lines: 12,
    error_code: "E_SERVICE_TIMEOUT",
    message: "服務 app-daemon 在 30 秒內沒有回應",
    hint: "請查看服務 log，並確認連接埠 8443 沒有被佔用",
  },
];

/** R5: scenarios keyed by id; iteration order equals the R5 table order. */
export const SCENARIOS: ReadonlyMap<string, Scenario> = new Map(
  SCENARIO_LIST.map((scenario) => [scenario.id, scenario]),
);

/** R20: exactly `"retry: 3000\n\n"`. */
export const RETRY_BLOCK = "retry: 3000\n\n";

/** R22: exactly `": ping\n\n"`. */
export const PING_COMMENT = ": ping\n\n";

const EVENT_ID_RE = /^[0-9]+\.[0-9]+$/;

/** R9: `(3, 57) -> "3.57"`. */
export function formatEventId(runId: number, seq: number): string {
  return `${String(runId)}.${String(seq)}`;
}

/**
 * R9 (SPEC-cloudflare): trim, require `^[0-9]+\.[0-9]+$` and both parts <= 2^53 - 1;
 * `"3.57" -> [3, 57]`. Returns null for null or any invalid input; never throws.
 */
export function parseEventId(raw: string | null): readonly [runId: number, seq: number] | null {
  if (typeof raw !== "string") {
    return null;
  }
  const text = raw.trim();
  if (!EVENT_ID_RE.test(text)) {
    return null;
  }
  const [runId, seq] = text.split(".").map(Number);
  if (runId === undefined || seq === undefined) {
    return null;
  }
  if (!Number.isSafeInteger(runId) || !Number.isSafeInteger(seq)) {
    return null;
  }
  return [runId, seq];
}

function findScenario(scenarioId: string): Scenario {
  const scenario = SCENARIOS.get(scenarioId);
  if (scenario === undefined) {
    throw new KeyError(`unknown scenario ${JSON.stringify(scenarioId)}`);
  }
  return scenario;
}

function logText(task: TaskDef, lineNo: number): string {
  return `[${task.id}] (${String(lineNo)}/${String(task.log_lines)}) ${task.name} - 處理第 ${String(lineNo)} 項`;
}

function logStep(ids: EventData, lineNo: number, level: LogLevel, text: string): ScriptStep {
  return { type: "log", data: { ...ids, line_no: lineNo, level, text } };
}

function lineNumbers(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function failureSteps(scenario: Scenario, task: TaskDef, ids: EventData): readonly ScriptStep[] {
  const okLines = scenario.fail_after_lines ?? 0;
  const message = scenario.message ?? "";
  const steps = lineNumbers(okLines).map((n) => logStep(ids, n, "info", logText(task, n)));
  steps.push(logStep(ids, okLines + 1, "error", message));
  steps.push({
    type: "task_failed",
    data: { ...ids, error_code: scenario.error_code ?? "", message, hint: scenario.hint ?? "" },
  });
  return steps;
}

/**
 * R6: the full deterministic event script of a scenario. The first step is `run_started` with
 * `data` `{ scenario }`; the persisted event additionally carries `run_id`.
 *
 * @throws KeyError for an unknown scenario id.
 */
export function scriptFor(scenarioId: string): readonly ScriptStep[] {
  const scenario = findScenario(scenarioId);
  const steps: ScriptStep[] = [{ type: "run_started", data: { scenario: scenario.id } }];
  for (const stageDef of PLAN) {
    steps.push({ type: "stage_started", data: { stage_id: stageDef.id } });
    for (const task of stageDef.tasks) {
      const ids: EventData = { stage_id: stageDef.id, task_id: task.id };
      steps.push({ type: "task_started", data: { ...ids } });
      if (task.id === scenario.fail_task_id) {
        steps.push(...failureSteps(scenario, task, ids));
        steps.push({ type: "stage_failed", data: { stage_id: stageDef.id } });
        steps.push({ type: "run_finished", data: { result: "failed" } });
        return steps;
      }
      for (const n of lineNumbers(task.log_lines)) {
        steps.push(logStep(ids, n, "info", logText(task, n)));
      }
      steps.push({ type: "task_succeeded", data: { ...ids } });
    }
    steps.push({ type: "stage_succeeded", data: { stage_id: stageDef.id } });
  }
  steps.push({ type: "run_finished", data: { result: "succeeded" } });
  return steps;
}

/**
 * R10: state before any event: run `running`, `last_seq` 0, everything `pending`.
 *
 * @throws KeyError for an unknown scenario id.
 */
export function initialSnapshot(runId: number, scenarioId: string): Snapshot {
  const scenario = findScenario(scenarioId);
  const stages = PLAN.map((stageDef): StageState => ({
    id: stageDef.id,
    name: stageDef.name,
    status: "pending",
    tasks: stageDef.tasks.map((task): TaskState => ({
      id: task.id,
      name: task.name,
      status: "pending",
      error: null,
    })),
  }));
  return { run_id: runId, scenario: scenario.id, status: "running", last_seq: 0, stages };
}

type FieldKind = "str" | "int" | "level" | "result";

const STAGE_FIELDS: Readonly<Record<string, FieldKind>> = { stage_id: "str" };
const TASK_FIELDS: Readonly<Record<string, FieldKind>> = { stage_id: "str", task_id: "str" };

/** R8: required `data` fields and their kinds for every event type. */
const DATA_SCHEMA: Readonly<Record<EventType, Readonly<Record<string, FieldKind>>>> = {
  run_started: { run_id: "int", scenario: "str" },
  stage_started: STAGE_FIELDS,
  stage_succeeded: STAGE_FIELDS,
  stage_failed: STAGE_FIELDS,
  task_started: TASK_FIELDS,
  task_succeeded: TASK_FIELDS,
  log: { ...TASK_FIELDS, line_no: "int", level: "level", text: "str", ts: "str" },
  task_failed: { ...TASK_FIELDS, error_code: "str", message: "str", hint: "str" },
  run_finished: { result: "result" },
};

function isEventType(value: string): value is EventType {
  return Object.hasOwn(DATA_SCHEMA, value);
}

function fieldOk(value: JsonValue | undefined, kind: FieldKind): boolean {
  switch (kind) {
    case "str":
      return typeof value === "string";
    case "int":
      return typeof value === "number" && Number.isSafeInteger(value);
    case "level":
      return value === "info" || value === "error";
    case "result":
      return value === "succeeded" || value === "failed";
  }
}

/** R10 item 9: every R8 field must be present with the right type; extra fields are ignored. */
function validateData(event: Event): void {
  const type: string = event.type;
  if (!isEventType(type)) {
    throw new ValueError(`unknown event type ${JSON.stringify(type)}`);
  }
  for (const [key, kind] of Object.entries(DATA_SCHEMA[type])) {
    if (!Object.hasOwn(event.data, key)) {
      throw new ValueError(`${type} data is missing field ${key}`);
    }
    if (!fieldOk(event.data[key], kind)) {
      throw new ValueError(`${type} data field ${key} must be ${kind}`);
    }
  }
}

function strField(data: EventData, key: string): string {
  const value = data[key];
  if (typeof value !== "string") {
    throw new ValueError(`event data field ${key} must be a string`);
  }
  return value;
}

function findStage(state: Snapshot, stageId: string): number {
  const index = state.stages.findIndex((s) => s.id === stageId);
  if (index < 0) {
    throw new ValueError(`unknown stage ${JSON.stringify(stageId)}`);
  }
  return index;
}

function findTask(stageState: StageState, taskId: string): number {
  const index = stageState.tasks.findIndex((t) => t.id === taskId);
  if (index < 0) {
    throw new ValueError(`unknown task ${JSON.stringify(taskId)} in stage ${stageState.id}`);
  }
  return index;
}

function requireStatus(current: Status, expected: Status, what: string): void {
  if (current !== expected) {
    throw new ValueError(`${what} is ${current}, expected ${expected}`);
  }
}

function replaceAt<T>(items: readonly T[], index: number, item: T): readonly T[] {
  return items.map((existing, i) => (i === index ? item : existing));
}

function stageAt(state: Snapshot, index: number): StageState {
  const found = state.stages[index];
  if (found === undefined) {
    throw new ValueError(`stage index ${String(index)} out of range`);
  }
  return found;
}

function applyStageEvent(state: Snapshot, event: Event): readonly StageState[] {
  const index = findStage(state, strField(event.data, "stage_id"));
  const current = stageAt(state, index);
  if (event.type === "stage_started") {
    requireStatus(current.status, "pending", `stage ${current.id}`);
    return replaceAt(state.stages, index, { ...current, status: "running" });
  }
  requireStatus(current.status, "running", `stage ${current.id}`);
  const status: Status = event.type === "stage_succeeded" ? "succeeded" : "failed";
  return replaceAt(state.stages, index, { ...current, status });
}

function validateLog(data: EventData): void {
  const lineNo = data.line_no;
  if (typeof lineNo !== "number" || !Number.isSafeInteger(lineNo) || lineNo < 1) {
    throw new ValueError("log line_no must be a positive integer");
  }
}

function nextTaskState(task: TaskState, event: Event): TaskState {
  if (event.type === "task_started") {
    requireStatus(task.status, "pending", `task ${task.id}`);
    return { ...task, status: "running" };
  }
  requireStatus(task.status, "running", `task ${task.id}`);
  if (event.type === "task_succeeded") {
    return { ...task, status: "succeeded" };
  }
  const error = {
    error_code: strField(event.data, "error_code"),
    message: strField(event.data, "message"),
    hint: strField(event.data, "hint"),
  };
  return { ...task, status: "failed", error };
}

function applyTaskEvent(state: Snapshot, event: Event): readonly StageState[] {
  const stageIndex = findStage(state, strField(event.data, "stage_id"));
  const current = stageAt(state, stageIndex);
  requireStatus(current.status, "running", `stage ${current.id}`);
  const taskIndex = findTask(current, strField(event.data, "task_id"));
  const task = current.tasks[taskIndex];
  if (task === undefined) {
    throw new ValueError(`task index ${String(taskIndex)} out of range`);
  }
  if (event.type === "log") {
    requireStatus(task.status, "running", `task ${task.id}`);
    validateLog(event.data);
    return state.stages;
  }
  const tasks = replaceAt(current.tasks, taskIndex, nextTaskState(task, event));
  return replaceAt(state.stages, stageIndex, { ...current, tasks });
}

function isStageEvent(type: EventType): boolean {
  return type === "stage_started" || type === "stage_succeeded" || type === "stage_failed";
}

/**
 * R10: return the new snapshot after applying one event; `state` is not modified.
 *
 * @throws ValueError for a wrong `run_id` or `seq`, invalid `data`, or any transition not
 * allowed by the R10 state machine.
 */
export function applyEvent(state: Snapshot, event: Event): Snapshot {
  if (event.run_id !== state.run_id) {
    throw new ValueError(
      `event run_id ${String(event.run_id)} != snapshot run_id ${String(state.run_id)}`,
    );
  }
  if (event.seq !== state.last_seq + 1) {
    throw new ValueError(`event seq ${String(event.seq)} != ${String(state.last_seq + 1)}`);
  }
  validateData(event);
  if (event.type === "run_started") {
    if (state.last_seq !== 0) {
      throw new ValueError("run_started must be the first event");
    }
    return { ...state, last_seq: event.seq };
  }
  if (state.last_seq === 0) {
    throw new ValueError("the first event must be run_started");
  }
  if (state.status !== "running") {
    throw new ValueError(`run is already ${state.status}`);
  }
  if (event.type === "run_finished") {
    const status: RunStatus = event.data.result === "succeeded" ? "succeeded" : "failed";
    return { ...state, status, last_seq: event.seq };
  }
  const stages = isStageEvent(event.type)
    ? applyStageEvent(state, event)
    : applyTaskEvent(state, event);
  return { ...state, stages, last_seq: event.seq };
}

/**
 * R19: one SSE block ending with a blank line: `id: <run_id>.<seq>`, `event: <type>`,
 * `data: <one-line JSON>`.
 */
export function formatEvent(event: Event): string {
  const id = formatEventId(event.run_id, event.seq);
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/**
 * SPEC-cloudflare R23 / AC10: bounded FIFO queue of one subscriber's live events that have not
 * been handed to its response stream yet.
 */
export class SubscriberQueue<T> {
  /** The capacity given to the constructor (`subscriber_queue_size`). */
  readonly capacity: number;
  #items: T[] = [];
  #head = 0;

  /** @throws ValueError if `capacity` is not a safe integer >= 1. */
  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new ValueError(`capacity must be a safe integer >= 1, got ${String(capacity)}`);
    }
    this.capacity = capacity;
  }

  /** Number of queued items; always `0 <= size <= capacity`. */
  get size(): number {
    return this.#items.length - this.#head;
  }

  /** Append `item` and return true, or return false (queue unchanged) when full. */
  push(item: T): boolean {
    if (this.size >= this.capacity) {
      return false;
    }
    this.#items.push(item);
    return true;
  }

  /** Remove and return the head item (FIFO); undefined when empty. */
  shift(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    const item = this.#items[this.#head];
    this.#head += 1;
    if (this.#head === this.#items.length) {
      this.#items = [];
      this.#head = 0;
    } else if (this.#head >= 1024 && this.#head * 2 >= this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return item;
  }
}
