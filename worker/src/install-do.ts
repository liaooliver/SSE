/**
 * `InstallDO`: the single Durable Object holding Store (SQLite), Runtime (alarm-driven
 * simulator) and Broker (SSE subscribers) (SPEC-cloudflare R2, R11–R25).
 */
import { DurableObject } from "cloudflare:workers";
import { Broker, resetStream } from "./broker";
import { parseSettings, type Settings, type SettingsEnv } from "./config";
import { formatEventId, parseEventId, PLAN, SCENARIOS, type Event } from "./domain";
import { errorResponse, HTTP_STATUS, jsonResponse, SSE_HEADERS } from "./http";
import * as logger from "./logger";
import { Store } from "./store";

/** Worker and Durable Object bindings (R1, R3). */
export interface Env extends SettingsEnv {
  readonly INSTALL: DurableObjectNamespace<InstallDO>;
}

interface PlanResponse {
  readonly stages: readonly {
    readonly id: string;
    readonly name: string;
    readonly tasks: readonly { readonly id: string; readonly name: string }[];
  }[];
}

interface ScenarioInfo {
  readonly id: string;
  readonly label: string;
  readonly fail_task_id: string | null;
}

interface InstallStarted {
  readonly run_id: number;
  readonly scenario: string;
}

interface LogItem {
  readonly seq: number;
  readonly stage_id: string;
  readonly task_id: string;
  readonly line_no: number;
  readonly level: string;
  readonly text: string;
  readonly ts: string;
}

interface LogPageResponse {
  readonly run_id: number;
  readonly items: readonly LogItem[];
  readonly next_after: number | null;
}

type Handler = (request: Request, url: URL) => Response | Promise<Response>;

const QUERY_INT_RE = /^[0-9]+$/;
const DEFAULT_LOG_LIMIT = 500;
const MAX_LOG_LIMIT = 1000;
const NO_RUN = "No run has been started";

/** R15: strict query integer: `^[0-9]+$` and <= 2^53 - 1; undefined when absent. */
function queryInt(params: URLSearchParams, name: string): number | null | undefined {
  const raw = params.get(name);
  if (raw === null) {
    return undefined;
  }
  if (!QUERY_INT_RE.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

interface LogQuery {
  readonly runId: number;
  readonly after: number;
  readonly until: number | null;
  readonly limit: number;
}

/** R15: parse and range-check the `/install/logs` query; null when invalid (422). */
function parseLogQuery(params: URLSearchParams): LogQuery | null {
  const runId = queryInt(params, "run_id");
  const after = queryInt(params, "after");
  const until = queryInt(params, "until");
  const limit = queryInt(params, "limit");
  if (runId === undefined || runId === null || runId < 1) {
    return null;
  }
  if (after === null || until === null || limit === null) {
    return null;
  }
  const pageSize = limit ?? DEFAULT_LOG_LIMIT;
  if (pageSize < 1 || pageSize > MAX_LOG_LIMIT) {
    return null;
  }
  return { runId, after: after ?? 0, until: until ?? null, limit: pageSize };
}

/**
 * R14: alarm time for the next step, set from inside `alarm()`. It is at least 1 ms after `nowMs`:
 * the clock is frozen during the handler, and an alarm re-set to the exact time of the alarm being
 * handled is treated as unchanged and deleted when the handler returns (seen with interval 0).
 */
function nextAlarmMs(nowMs: number, targetMs: number): number {
  return Math.max(Math.ceil(targetMs), nowMs + 1);
}

function stringField(data: Event["data"], key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function numberField(data: Event["data"], key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : 0;
}

function logItem(event: Event): LogItem {
  return {
    seq: event.seq,
    stage_id: stringField(event.data, "stage_id"),
    task_id: stringField(event.data, "task_id"),
    line_no: numberField(event.data, "line_no"),
    level: stringField(event.data, "level"),
    text: stringField(event.data, "text"),
    ts: stringField(event.data, "ts"),
  };
}

/** R14: decode the body as UTF-8 JSON and return the scenario id, or null (422). */
async function readScenario(request: Request): Promise<string | null> {
  const bytes = await request.arrayBuffer();
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const scenario: unknown = Reflect.get(body, "scenario");
  return typeof scenario === "string" && SCENARIOS.has(scenario) ? scenario : null;
}

function planResponse(): PlanResponse {
  return {
    stages: PLAN.map((stage) => ({
      id: stage.id,
      name: stage.name,
      tasks: stage.tasks.map((task) => ({ id: task.id, name: task.name })),
    })),
  };
}

function scenarioList(): readonly ScenarioInfo[] {
  return [...SCENARIOS.values()].map((s) => ({
    id: s.id,
    label: s.label,
    fail_task_id: s.fail_task_id,
  }));
}

/** SPEC-cloudflare R2: Store, Runtime and Broker of the whole system. */
export class InstallDO extends DurableObject<Env> {
  private readonly store: Store;
  private readonly broker = new Broker();
  private readonly routes: ReadonlyMap<string, Readonly<Partial<Record<string, Handler>>>>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new Store(ctx.storage);
    this.routes = new Map<string, Readonly<Partial<Record<string, Handler>>>>([
      ["/install/plan", { GET: () => jsonResponse(planResponse() satisfies PlanResponse) }],
      ["/install/scenarios", { GET: () => jsonResponse(scenarioList()) }],
      ["/install", { GET: () => this.getSnapshot(), POST: (r) => this.startInstall(r) }],
      ["/install/logs", { GET: (_r, url) => this.getLogs(url) }],
      ["/install/events", { GET: (r, url) => this.streamEvents(r, url) }],
      ["/stats", { GET: () => jsonResponse({ subscribers: this.broker.count }) }],
      ["/health", { GET: () => jsonResponse({ status: "ok" }) }],
    ]);
    void ctx.blockConcurrencyWhile(async () => {
      this.recover();
      await ctx.storage.deleteAlarm();
    });
  }

  /** R2: route a request forwarded unchanged by the Worker. */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const methods = this.routes.get(url.pathname);
    if (methods === undefined) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, "Not Found");
    }
    const handler = methods[request.method];
    if (handler === undefined) {
      return errorResponse(HTTP_STATUS.METHOD_NOT_ALLOWED, "Method Not Allowed");
    }
    return handler(request, url);
  }

  /** R14: run exactly one simulator step; log and rethrow on failure so the platform retries. */
  override async alarm(): Promise<void> {
    try {
      await this.step();
    } catch (error) {
      logger.error("alarm failed", { error: String(error) });
      throw error;
    }
  }

  /** R25: close a run interrupted by a previous process (inside `blockConcurrencyWhile`). */
  private recover(): void {
    this.store.init();
    const added = this.store.recover(new Date().toISOString());
    const first = added[0];
    if (first !== undefined) {
      logger.warn("recovered interrupted run", { run_id: first.run_id, events: added.length });
    }
  }

  private settings(): Settings {
    const result = parseSettings(this.env);
    if (!result.ok) {
      throw new Error(`invalid configuration: ${result.invalid.join(", ")}`);
    }
    return result.settings;
  }

  private async step(): Promise<void> {
    const { logIntervalMs } = this.settings();
    const nowMs = Date.now();
    const outcome = this.store.advance(nowMs, logIntervalMs);
    if (outcome.kind === "idle") {
      return;
    }
    if (outcome.kind === "wait") {
      await this.ctx.storage.setAlarm(nextAlarmMs(nowMs, outcome.untilMs));
      return;
    }
    for (const event of outcome.events) {
      this.broker.publish(event);
    }
    if (!outcome.finished) {
      await this.ctx.storage.setAlarm(nextAlarmMs(nowMs, nowMs + logIntervalMs));
    }
  }

  /** R13: atomic snapshot of the current run; 404 if none ever ran. */
  private getSnapshot(): Response {
    const snapshot = this.store.snapshot();
    if (snapshot === null) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, NO_RUN);
    }
    return jsonResponse(snapshot);
  }

  /** R14: validate (422) before the atomic running check (409); schedule step 0; 202. */
  private async startInstall(request: Request): Promise<Response> {
    const scenario = await readScenario(request);
    if (scenario === null) {
      return errorResponse(HTTP_STATUS.UNPROCESSABLE_CONTENT, "Invalid body or unknown scenario");
    }
    const event = this.store.startRun(scenario, new Date().toISOString());
    if (event === null) {
      return errorResponse(HTTP_STATUS.CONFLICT, "A run is already in progress");
    }
    this.broker.publish(event);
    await this.ctx.storage.setAlarm(Date.now());
    const body = { run_id: event.run_id, scenario } satisfies InstallStarted;
    return jsonResponse(body, HTTP_STATUS.ACCEPTED);
  }

  /** R15: cursor-paged log events with `after < seq <= until`. */
  private getLogs(url: URL): Response {
    const query = parseLogQuery(url.searchParams);
    if (query === null) {
      return errorResponse(HTTP_STATUS.UNPROCESSABLE_CONTENT, "Invalid query parameter");
    }
    const page = this.store.readLogs(query.after, query.until, query.limit);
    if (page === null) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, NO_RUN);
    }
    if (page.run.runId !== query.runId) {
      return errorResponse(HTTP_STATUS.CONFLICT, "run_id is not the current run");
    }
    const items = page.items.map(logItem);
    const last = items.at(-1);
    const body = {
      run_id: page.run.runId,
      items,
      next_after: page.hasMore && last !== undefined ? last.seq : null,
    } satisfies LogPageResponse;
    return jsonResponse(body);
  }

  /** R18–R20: decide the start point, then register, replay and stream synchronously. */
  private streamEvents(request: Request, url: URL): Response {
    const rawQuery = url.searchParams.get("last_event_id");
    const queryStart = parseEventId(rawQuery);
    if (rawQuery !== null && queryStart === null) {
      return errorResponse(HTTP_STATUS.UNPROCESSABLE_CONTENT, "Malformed last_event_id");
    }
    const start = parseEventId(request.headers.get("Last-Event-ID")) ?? queryStart;
    const run = this.store.currentRun();
    if (run === null) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, NO_RUN);
    }
    if (start !== null) {
      const [startRun, startSeq] = start;
      if (startRun !== run.runId || (startSeq > run.lastSeq && run.running)) {
        return new Response(resetStream(run.runId), { headers: SSE_HEADERS });
      }
      if (!run.running && startSeq >= run.lastSeq) {
        return new Response(null, { status: HTTP_STATUS.NO_CONTENT });
      }
    }
    const startSeq = start === null ? 0 : start[1];
    const { heartbeatMs, subscriberQueueSize } = this.settings();
    const stream = this.broker.open(
      run.runId,
      startSeq,
      { heartbeatMs, queueSize: subscriberQueueSize },
      () => this.store.eventsAfter(run.runId, startSeq),
    );
    logger.debug("subscriber opened", { from: formatEventId(run.runId, startSeq) });
    return new Response(stream, { headers: SSE_HEADERS });
  }
}
