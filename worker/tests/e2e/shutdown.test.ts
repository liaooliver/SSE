import { test } from "vitest";
import { startRun } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { withFeed } from "../helpers/stream";

const server = useWorker({ SSE_LOG_INTERVAL: "1" });
test(
  "R24 AC9 觀察 SIGTERM 與 SIGINT 的串流及群組結束時間",
  { timeout: 260_000 },
  async ({ annotate }) => {
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      if (signal === "SIGINT") await server.start();
      await startRun(server);
      await withFeed(
        server,
        {},
        async (feed) => {
          await feed.ready();
          const start = performance.now();
          const closed = (async () => {
            try {
              while (await feed.next()) {
                /* 持續讀取，直到收到 EOF 或連線錯誤。 */
              }
              return "EOF，" + String(Math.round(performance.now() - start)) + " ms";
            } catch (error) {
              if (!(error instanceof Error)) throw error;
              return error.name + "，" + String(Math.round(performance.now() - start)) + " ms";
            }
          })();
          const forced = await server.stop(signal);
          const groupMs = Math.round(performance.now() - start);
          await annotate(
            signal +
              "：SSE " +
              (await closed) +
              "；群組退出 " +
              String(groupMs) +
              " ms；" +
              (forced ? "寬限期後群組仍有程序，已送 SIGKILL" : "群組無殘留程序"),
          );
        },
        20_000,
      );
    }
  },
);
