import { expect, test } from "vitest";
import { scriptFor, type Event as InstallEvent } from "../../src/domain";
import { cases } from "../helpers/catalog";
import { snapshot, startRun } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { withFeed } from "../helpers/stream";
import { random, synchronize, verifySync } from "../helpers/sync";

const server = useWorker({ SSE_LOG_INTERVAL: "0.001" });
test("AC1 AC2 七個情境各在十個進度點重建", { timeout: 240_000 }, async () => {
  const draw = random(8971);
  for (const scenario of cases) {
    const possible = scriptFor(scenario.id)
      .flatMap((step, index) => (step.type === "log" ? [index + 1] : []))
      .slice(0, -1);
    const triggers = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const [seq] = possible.splice(Math.floor(draw() * possible.length), 1);
      if (seq === undefined) throw new Error("不足十個 log 進度點");
      triggers.add(seq);
    }
    const run = await startRun(server, scenario.id);
    const full: InstallEvent[] = [];
    const captured: Awaited<ReturnType<typeof synchronize>>[] = [];
    const pending: Promise<void>[] = [];
    await withFeed(server, {}, async (feed) => {
      await feed.ready();
      // 每個進度點立即啟動同步。先接住失敗，完整讀完參考串流再一起核對。
      const errors: unknown[] = [];
      try {
        for await (const event of feed.events(run)) {
          full.push(event);
          if (triggers.has(event.seq)) {
            pending.push(
              synchronize(server, 2 + Math.floor(draw() * 8)).then(
                (result) => {
                  captured.push(result);
                },
                (error: unknown) => {
                  errors.push(error);
                },
              ),
            );
          }
        }
      } finally {
        await Promise.all(pending);
      }
      if (errors.length) throw new AggregateError(errors, "中途同步失敗：" + scenario.id);
    });
    expect(captured).toHaveLength(10);
    expect(captured.some(({ prefix }) => prefix.state.status === "running")).toBe(true);
    const final = await snapshot(server);
    for (const { prefix, suffix } of captured) verifySync(prefix, suffix, full, final);
  }
});
