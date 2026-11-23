import { expect, test } from "vitest";
import { scriptFor, type Event as InstallEvent } from "../../src/domain";
import { startRun, utc } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { withFeed } from "../helpers/stream";

const server = useWorker({ SSE_LOG_INTERVAL: "0.005" });
test(
  "AC11 本機二十個訂閱者的完整序列與 log 延遲 p95",
  // 預留啟動安裝與整理樣本的時間，讓各 SSE 讀取器先回報自己的逾時。
  { timeout: 70_000 },
  async ({ annotate }) => {
    const script = scriptFor("success");
    const run = await startRun(server);
    const readers = await Promise.all(
      Array.from({ length: 20 }, () =>
        withFeed(server, {}, async (feed) => {
          await feed.ready();
          const readyAt = Date.now();
          const arrivals: number[] = [];
          const events: InstallEvent[] = [];
          for await (const event of feed.events(run)) {
            arrivals.push(Date.now());
            events.push(event);
          }
          return { readyAt, arrivals, events };
        }),
      ),
    );
    const allReady = Math.max(...readers.map((r) => r.readyAt));
    const first = readers[0];
    if (!first) throw new Error("沒有訂閱者樣本");
    expect(first.events).toHaveLength(202);
    expect(
      first.events.map((e, i) => {
        expect(e.seq).toBe(i + 1);
        const data = { ...e.data };
        if (e.type === "run_started") {
          expect(data.run_id).toBe(run);
          delete data.run_id;
        }
        if (e.type === "log") delete data.ts;
        return { type: e.type, data };
      }),
    ).toEqual(script);
    for (const reader of readers) expect(reader.events).toEqual(first.events);
    const delays: number[] = [];
    for (const [i, event] of first.events.entries()) {
      if (event.type !== "log") continue;
      const generated = utc(event.data.ts);
      if (generated <= allReady) continue;
      const latest = Math.max(
        ...readers.map((r) => {
          const at = r.arrivals[i];
          if (at === undefined) throw new Error("訂閱者遺漏延遲樣本");
          return at;
        }),
      );
      expect(latest).toBeGreaterThanOrEqual(generated);
      delays.push(latest - generated);
    }
    delays.sort((a, b) => a - b);
    const p95 = delays[Math.ceil(delays.length * 0.95) - 1];
    if (p95 === undefined) throw new Error("所有訂閱者就緒後沒有 log 樣本");
    await annotate(
      "本機 wrangler dev，" + String(delays.length) + " 個 log，p95 " + String(p95) + " ms",
    );
    expect(p95).toBeLessThan(200);
  },
);
