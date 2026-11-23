import { expect } from "vitest";
import type {
  Event as InstallEvent,
  JsonValue,
  Snapshot,
  StageState,
  TaskState,
} from "../../src/domain";
import { HTTP, type WorkerServer } from "./server";
import { until } from "./wait";

/** R8、R13 辨識 JSON 物件。 */
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** R13、R15 保留陣列元素的未知型別以供驗證。 */
export function list(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
/** R8 驗證事件 payload 的 JSON 型別。 */
export function jsonObject(value: unknown): value is Record<string, JsonValue> {
  return record(value) && Object.values(value).every(jsonValue);
}
function jsonValue(value: unknown): value is JsonValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    (list(value) && value.every(jsonValue)) ||
    jsonObject(value)
  );
}
/** R9、R15 僅接受安全整數。 */
export function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function status(value: unknown): boolean {
  return ["pending", "running", "succeeded", "failed"].some((item) => item === value);
}
function task(value: unknown): value is TaskState {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !status(value.status)
  )
    return false;
  const error = value.error;
  return (
    error === null ||
    (record(error) &&
      [error.error_code, error.message, error.hint].every((item) => typeof item === "string"))
  );
}
function stage(value: unknown): value is StageState {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    status(value.status) &&
    list(value.tasks) &&
    value.tasks.every(task)
  );
}
function isSnapshot(value: unknown): value is Snapshot {
  return (
    record(value) &&
    integer(value.run_id) &&
    value.run_id >= 1 &&
    integer(value.last_seq) &&
    value.last_seq >= 1 &&
    typeof value.scenario === "string" &&
    status(value.status) &&
    value.status !== "pending" &&
    list(value.stages) &&
    value.stages.every(stage)
  );
}

/** R11–R17 先檢查成功狀態，再解析尚未驗證的 JSON。 */
export async function json(
  server: WorkerServer,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await server.request(path, init);
  expect(response.status).toBe(HTTP.ok);
  return response.json();
}
/** R13 驗證 HTTP 快照的每一層。 */
export async function snapshot(server: WorkerServer, init: RequestInit = {}): Promise<Snapshot> {
  const value = await json(server, "/install", init);
  if (!isSnapshot(value)) throw new Error("快照的形狀不符 R13");
  return value;
}
/** R14 回傳伺服器配發的輪次。 */
export async function startRun(server: WorkerServer, scenario = "success"): Promise<number> {
  const response = await server.request("/install", {
    method: "POST",
    body: JSON.stringify({ scenario }),
  });
  expect(response.status).toBe(HTTP.accepted);
  const value: unknown = await response.json();
  if (!record(value) || !integer(value.run_id) || value.run_id < 1) throw new Error("缺少合法輪次");
  expect(value).toEqual({ run_id: value.run_id, scenario });
  return value.run_id;
}
/** R16 讀取目前訂閱數。 */
export async function count(server: WorkerServer, init: RequestInit = {}): Promise<number> {
  const response = await server.request("/stats", init);
  expect(response.status).toBe(HTTP.ok);
  const value: unknown = await response.json();
  if (!record(value) || !integer(value.subscribers) || value.subscribers < 0)
    throw new Error("訂閱數不合法");
  expect(value).toEqual({ subscribers: value.subscribers });
  return value.subscribers;
}
/** R16、R24 從斷線時刻起，等候訂閱數回到預期值。 */
export async function waitForCount(
  server: WorkerServer,
  expected: number,
  ms: number,
  start = performance.now(),
): Promise<void> {
  await until(
    `/stats.subscribers 回到 ${String(expected)}`,
    ms,
    async (signal) => {
      const value = await count(server, { signal });
      return value === expected ? undefined : `subscribers=${String(value)}`;
    },
    start,
  );
}
/** R7 檢查公開 log 時間的 UTC 格式並換算毫秒。 */
export function utc(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("log 缺少有效的 UTC 時間");
  return Date.parse(value);
}
/** R15 將 SSE 的 log 投影成分頁回應項目。 */
export function logItem(event: InstallEvent): Record<string, JsonValue> {
  return { seq: event.seq, ...event.data };
}
