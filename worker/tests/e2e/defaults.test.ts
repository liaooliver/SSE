import { expect, test } from "vitest";
import { startRun, utc } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { withFeed } from "../helpers/stream";

const server = useWorker();
test("R3 R14 未指定設定時相鄰 log 至少相隔 150 毫秒", { timeout: 20_000 }, async () => {
  const run = await startRun(server);
  await withFeed(
    server,
    {},
    async (feed) => {
      await feed.ready();
      let before: number | undefined;
      let measured = 0;
      for await (const event of feed.events(run)) {
        if (event.type !== "log") continue;
        const now = utc(event.data.ts);
        if (before !== undefined) {
          expect(now - before).toBeGreaterThanOrEqual(150);
          if (++measured === 3) return;
        }
        before = now;
      }
      throw new Error("預設設定下未取得足夠的 log");
    },
    15_000,
  );
});
