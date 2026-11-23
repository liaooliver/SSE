import { expect } from "vitest";
import {
  applyEvent,
  initialSnapshot,
  type Event as InstallEvent,
  type Snapshot,
} from "../../src/domain";
import { integer, json, list, logItem, record, snapshot } from "./data";
import { type WorkerServer, HTTP } from "./server";
import { withFeed } from "./stream";

export interface Prefix {
  readonly state: Snapshot;
  readonly logs: readonly unknown[];
}

/** R13、R15、R27 以單一快照的 S 為界，依伺服器的 next_after 分頁。 */
export async function capture(server: WorkerServer, limit: number): Promise<Prefix> {
  const state = await snapshot(server);
  const logs: unknown[] = [];
  let after = 0;
  for (;;) {
    const query = new URLSearchParams({
      run_id: String(state.run_id),
      until: String(state.last_seq),
      after: String(after),
      limit: String(limit),
    });
    const page = await json(server, "/install/logs?" + query.toString());
    if (!record(page) || !list(page.items)) throw new Error("補讀回應缺少 items");
    expect(Object.keys(page).sort()).toEqual(["items", "next_after", "run_id"]);
    expect(page.run_id).toBe(state.run_id);
    expect(page.items.length).toBeLessThanOrEqual(limit);
    if (after > 0) expect(page.items.length).toBeGreaterThan(0);
    for (const item of page.items) {
      if (!record(item) || !integer(item.seq) || item.seq <= after || item.seq > state.last_seq)
        throw new Error("補讀序號超出範圍或重複");
      after = item.seq;
      logs.push(item);
    }
    if (page.next_after === null) return { state, logs };
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.next_after).toBe(after);
  }
}

/** AC1、AC2 只有完成快照已達結尾時，才接受 204。 */
export async function synchronize(
  server: WorkerServer,
  limit: number,
): Promise<{ prefix: Prefix; suffix: InstallEvent[] }> {
  const prefix = await capture(server, limit);
  const { run_id, last_seq, status } = prefix.state;
  const suffix = await withFeed(
    server,
    { query: String(run_id) + "." + String(last_seq) },
    async (feed) => {
      if (feed.response.statusCode === HTTP.empty) {
        expect(status).not.toBe("running");
        return [];
      }
      await feed.ready();
      const events: InstallEvent[] = [];
      for await (const event of feed.events(run_id)) events.push(event);
      return events;
    },
  );
  return { prefix, suffix };
}
/** AC1、AC3 用獨立的完整重播核對前綴、補讀與後綴；保持原順序且不去重。 */
export function verifySync(
  prefix: Prefix,
  suffix: readonly InstallEvent[],
  full: readonly InstallEvent[],
  final: Snapshot,
): void {
  const state = prefix.state;
  const first = full.slice(0, state.last_seq);
  expect(full.map((e) => e.seq)).toEqual(Array.from({ length: final.last_seq }, (_, i) => i + 1));
  expect(full.at(-1)?.type).toBe("run_finished");
  expect(first.reduce(applyEvent, initialSnapshot(final.run_id, final.scenario))).toEqual(state);
  expect(prefix.logs).toEqual(first.filter((e) => e.type === "log").map(logItem));
  expect(suffix).toEqual(full.slice(state.last_seq));
  expect(suffix.reduce(applyEvent, state)).toEqual(final);
}
/** AC2、AC3 固定種子選取進度點，失敗時可重現。 */
export function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
