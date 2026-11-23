import { get, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { StringDecoder } from "node:string_decoder";
import { expect } from "vitest";
import type { Event as InstallEvent, EventType } from "../../src/domain";
import { jsonObject, utc } from "./data";
import { HTTP, type WorkerServer } from "./server";
import { within } from "./wait";

const types: readonly EventType[] = [
  "run_started",
  "stage_started",
  "stage_succeeded",
  "stage_failed",
  "task_started",
  "task_succeeded",
  "task_failed",
  "log",
  "run_finished",
];
function eventType(value: string | undefined): value is EventType {
  return types.some((type) => type === value);
}

interface Block {
  readonly raw: string;
  readonly at: number;
}

/** R19 保留空行邊界，接受跨 TCP chunk 的 UTF-8 字元或同一 chunk 的多筆事件。 */
async function* blocks(response: IncomingMessage): AsyncGenerator<Block> {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  for await (const part of response) {
    if (!Buffer.isBuffer(part)) throw new Error("SSE 串流需要位元組");
    const at = Math.round(performance.now());
    pending += decoder.write(part);
    let boundary: number;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      const raw = pending.slice(0, boundary + 2);
      pending = pending.slice(boundary + 2);
      yield { raw, at };
    }
  }
  expect(pending + decoder.end(), "EOF 前有未結束的 SSE 區塊").toBe("");
}

/** R19 每個欄位限一行；接受任意欄位順序。 */
export function fields(raw: string): ReadonlyMap<string, string> {
  if (!raw.endsWith("\n\n")) throw new Error("SSE 區塊缺少結束空行");
  const result = new Map<string, string>();
  for (const line of raw.slice(0, -2).split("\n")) {
    const colon = line.indexOf(":");
    if (colon <= 0) throw new Error("SSE 欄位缺少名稱或冒號");
    const field = line.slice(0, colon);
    if (result.has(field)) throw new Error("SSE 欄位重複：" + field);
    result.set(field, line.slice(colon + 1).replace(/^ /, ""));
  }
  return result;
}

/** R7–R9、R19 從線路資料解析事件；非 log 的持久化時間不在線路上。 */
export function decodeEvent(raw: string, run: number): InstallEvent {
  const values = fields(raw);
  if (values.size !== 3 || !values.has("data"))
    throw new Error("事件須含 id、event、data 三個欄位");
  const type = values.get("event");
  const id = values.get("id") ?? "";
  const parts = /^(\d+)\.(\d+)$/.exec(id);
  const seq = Number(parts?.[2]);
  if (!Number.isSafeInteger(seq) || seq < 1 || id !== String(run) + "." + String(seq))
    throw new Error("事件 id 錯誤：" + id);
  const data: unknown = JSON.parse(values.get("data") ?? "");
  if (!eventType(type) || !jsonObject(data)) throw new Error("事件類別或資料不合法");
  if (type === "log") utc(data.ts);
  return {
    run_id: run,
    seq,
    type,
    data,
    ts: typeof data.ts === "string" ? data.ts : "2000-01-01T00:00:00Z",
  };
}

/** R18–R24 讀取同一個 TCP 回應；逾時時由該請求的 signal 銷毀連線。 */
export class Feed {
  private readonly iterator: AsyncGenerator<Block>;
  private readonly socket: Socket;
  last: string;
  constructor(readonly response: IncomingMessage) {
    this.last = `HTTP ${String(response.statusCode)}，尚未收到 SSE 區塊`;
    this.socket = response.socket;
    this.iterator = blocks(response);
  }
  async next(): Promise<Block | undefined> {
    const item = await this.iterator.next();
    if (item.done) {
      this.last = "EOF";
      return undefined;
    }
    this.last = item.value.raw.trimEnd().slice(0, 160);
    return item.value;
  }
  async ready(): Promise<Block> {
    expect(this.response.statusCode).toBe(HTTP.ok);
    const headers = this.response.headers;
    expect(headers["content-type"]).toMatch(/^text\/event-stream/i);
    const cache = headers["cache-control"]
      ?.toLowerCase()
      .split(",")
      .map((part) => part.trim());
    expect(cache).toEqual(expect.arrayContaining(["no-cache", "no-transform"]));
    expect(headers["x-accel-buffering"]).toBe("no");
    expect(headers["content-encoding"] ?? "identity").toBe("identity");

    const block = await this.next();
    if (block?.raw !== "retry: 3000\n\n") throw new Error("第一個區塊必須為獨立的 retry: 3000");
    return block;
  }
  async *events(run: number): AsyncGenerator<InstallEvent> {
    for (let block = await this.next(); block; block = await this.next()) {
      if (block.raw !== ": ping\n\n") yield decodeEvent(block.raw, run);
    }
  }
  cut(): void {
    this.socket.destroy();
  }
}

export interface Cursor {
  readonly query?: string;
  readonly header?: string;
}
/** R18–R24 用獨立 socket 訂閱，所有結束路徑都會銷毀 socket。 */
export async function withFeed<T>(
  server: WorkerServer,
  cursor: Cursor,
  read: (feed: Feed) => Promise<T>,
  timeout = 60_000,
  start = performance.now(),
): Promise<T> {
  const url = new URL("/install/events", server.url);
  if (cursor.query !== undefined) url.searchParams.set("last_event_id", cursor.query);
  const headers: Record<string, string> = { "Accept-Encoding": "gzip, br, deflate" };
  if (cursor.header !== undefined) headers["Last-Event-ID"] = cursor.header;
  let feed: Feed | undefined;
  return within(
    `讀取 SSE ${url.pathname}${url.search}（Last-Event-ID ${cursor.header ?? "未指定"}）`,
    timeout,
    () => feed?.last ?? "尚未收到回應標頭",
    async (signal) => {
      const response = await new Promise<IncomingMessage>((resolve, reject) => {
        get(url, { agent: false, headers, signal }, resolve).on("error", reject);
      });
      feed = new Feed(response);
      try {
        return await read(feed);
      } finally {
        feed.cut();
      }
    },
    start,
  );
}

/** R18、R20、R21 讀至真正的 EOF，保留每一筆事件。 */
export async function history(
  server: WorkerServer,
  run: number,
  cursor: Cursor = {},
): Promise<InstallEvent[]> {
  return withFeed(server, cursor, async (feed) => {
    await feed.ready();
    const events: InstallEvent[] = [];
    for await (const event of feed.events(run)) events.push(event);
    return events;
  });
}
