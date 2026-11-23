import { expect, test } from "vitest";
import { scriptFor, type Event as InstallEvent } from "../../src/domain";
import { snapshot, startRun } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { history, withFeed } from "../helpers/stream";
import { capture, random, verifySync } from "../helpers/sync";

const server = useWorker({ SSE_LOG_INTERVAL: "0.02" });
test("AC1 AC3 三十次切斷 TCP 後接回完整後綴", { timeout: 240_000 }, async () => {
  const scenario = "network_unreachable";
  const maxCut = scriptFor(scenario).reduce(
    (last, step, index) => (step.type === "log" && step.data.level === "info" ? index : last),
    0,
  );
  const draw = random(13057);
  for (let trial = 0; trial < 30; trial++) {
    const run = await startRun(server, scenario);
    const prefix = await capture(server, 3);
    const first = prefix.state.last_seq + 1;
    expect(first).toBeLessThanOrEqual(maxCut);
    const cut = first + Math.floor(draw() * (maxCut - first + 1));
    const query = String(run) + "." + String(first - 1);
    const suffix: InstallEvent[] = [];
    await withFeed(server, { query }, async (feed) => {
      await feed.ready();
      for await (const event of feed.events(run)) {
        suffix.push(event);
        if (event.seq === cut) {
          feed.cut();
          break;
        }
      }
    });
    const last = suffix.at(-1);
    if (last?.seq !== cut) throw new Error("在選定斷點之前串流已結束");
    suffix.push(
      ...(await history(server, run, { query, header: String(run) + "." + String(last.seq) })),
    );
    verifySync(prefix, suffix, await history(server, run), await snapshot(server));
  }
});
