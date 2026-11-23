import { expect, test } from "vitest";
import { count, json, logItem, snapshot, startRun, utc, waitForCount } from "../helpers/data";
import { upper, useWorker } from "../helpers/server";
import { decodeEvent, withFeed } from "../helpers/stream";

const heartbeat = 500;
const interval = 3000;
const server = useWorker({
  SSE_HEARTBEAT_SECONDS: String(heartbeat / 1000),
  SSE_LOG_INTERVAL: String(interval / 1000),
});
test("AC9 R14 R16 R18–R20 R22 R24 R25 心跳、即時補讀與斷線退訂", { timeout: 35_000 }, async () => {
  const run = await startRun(server);
  const baseline = await count(server);
  expect(baseline).toBe(0);
  let cutAt = 0;
  await withFeed(
    server,
    {},
    async (feed) => {
      const ready = await feed.ready();
      let previous = ready.at;
      let lastLog: number | undefined;
      let logs = 0;
      let pings = 0;
      let betweenLogs = false;
      while (logs < 2 || !betweenLogs) {
        const block = await feed.next();
        if (!block) throw new Error("在心跳取樣完成前已結束");
        if (block.raw === ": ping\n\n") {
          expect(block.at - previous).toBeGreaterThanOrEqual(heartbeat);
          expect(block.at - previous).toBeLessThanOrEqual(upper(heartbeat));
          pings++;
        } else {
          const event = decodeEvent(block.raw, run);
          if (event.type === "log") {
            const stamp = utc(event.data.ts);
            if (lastLog !== undefined) {
              expect(stamp - lastLog).toBeGreaterThanOrEqual(interval);
              betweenLogs ||= pings >= 2;
            }
            lastLog = stamp;
            logs++;
            expect(
              await json(
                server,
                "/install/logs?run_id=" +
                  String(run) +
                  "&after=" +
                  String(event.seq - 1) +
                  "&until=" +
                  String(event.seq),
              ),
            ).toEqual({ run_id: run, items: [logItem(event)], next_after: null });
          }
          pings = 0;
        }
        previous = block.at;
      }
      expect(await count(server)).toBe(baseline + 1);
      const state = await snapshot(server);
      const connecting = performance.now();
      await withFeed(
        server,
        { query: String(run) + "." + String(state.last_seq) },
        async (second) => {
          await second.ready();
          expect(performance.now() - connecting).toBeLessThanOrEqual(upper(0));
          expect((await snapshot(server)).last_seq).toBe(state.last_seq);
          expect(await count(server)).toBe(baseline + 2);
          for await (const event of second.events(run)) {
            expect(event.seq).toBe(state.last_seq + 1);
            break;
          }
        },
      );
      cutAt = performance.now();
      feed.cut();
    },
    25_000,
  );
  const budget = upper(2 * heartbeat + 1000);
  await waitForCount(server, baseline, budget, cutAt);
});
