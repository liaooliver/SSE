import { expect, test } from "vitest";
import { startRun, waitForCount } from "../helpers/data";
import { upper, useWorker } from "../helpers/server";
import { withFeed } from "../helpers/stream";

const server = useWorker({
  SSE_SUBSCRIBER_QUEUE_SIZE: "1",
  SSE_LOG_INTERVAL: "0.01",
  SSE_HEARTBEAT_SECONDS: "0.5",
});
test("R16 R18 R20 R23 R24 AC10 容量一的連線可補齊整輪", { timeout: 60_000 }, async () => {
  const run = await startRun(server);
  let seq = 0;
  let done = false;
  const start = performance.now();
  while (!done) {
    done = await withFeed(
      server,
      seq ? { header: String(run) + "." + String(seq) } : {},
      async (feed) => {
        await feed.ready();
        let finished = false;
        for await (const event of feed.events(run)) {
          expect(finished).toBe(false);
          expect(event.seq).toBe(++seq);
          finished = event.type === "run_finished";
          if (finished) expect(event.data).toEqual({ result: "succeeded" });
        }
        return finished;
      },
      45_000,
      start,
    );
  }
  expect(seq).toBe(202);
  await waitForCount(server, 0, upper(2000));
});
