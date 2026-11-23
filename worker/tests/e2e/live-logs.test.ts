import { expect, test } from "vitest";
import { json, logItem, snapshot, startRun } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { withFeed } from "../helpers/stream";

const server = useWorker({ SSE_LOG_INTERVAL: "0.5" });
test("R13–R15 R25 即時 log 可補讀，同一步的非 log 事件一併提交", { timeout: 25_000 }, async () => {
  const run = await startRun(server);
  await withFeed(
    server,
    {},
    async (feed) => {
      await feed.ready();
      const logs = [];
      let samples = 0;
      let crossedTask = false;
      for await (const event of feed.events(run)) {
        if (event.type !== "log") continue;
        logs.push(logItem(event));
        const before = await snapshot(server);
        expect(before.last_seq).toBeGreaterThanOrEqual(event.seq);
        const boundary = event.data.task_id === "check_os" && event.data.line_no === 8;
        if (boundary) {
          // 第八步同時完成 check_os、開始 check_disk。
          expect(before.last_seq).toBeGreaterThanOrEqual(event.seq + 2);
          const prepare = before.stages.find((s) => s.id === "prepare");
          expect(prepare?.tasks.find((t) => t.id === "check_os")?.status).toBe("succeeded");
          crossedTask = true;
        }
        const page = await json(server, "/install/logs?run_id=" + String(run));
        const after = await snapshot(server);
        if (
          before.last_seq === after.last_seq &&
          before.last_seq === event.seq + (boundary ? 2 : 0)
        ) {
          expect(page).toEqual({ run_id: run, items: logs, next_after: null });
          samples++;
        }
        if (samples >= 2 && crossedTask) return;
      }
      throw new Error("缺少執行中的補讀樣本或步驟邊界");
    },
    20_000,
  );
});
