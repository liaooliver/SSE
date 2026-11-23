import { expect, test } from "vitest";
import { applyEvent, initialSnapshot } from "../../src/domain";
import { count, snapshot, startRun } from "../helpers/data";
import { useWorker } from "../helpers/server";
import { until } from "../helpers/wait";
import { history } from "../helpers/stream";

const server = useWorker({ SSE_LOG_INTERVAL: "1" });
test("R16 R17 R25 AC9 SIGKILL 後同目錄重啟並一次補齊中斷事件", { timeout: 240_000 }, async () => {
  const run = await startRun(server);
  await until("快照出現執行中的 task", 10_000, async (signal) => {
    const state = await snapshot(server, { signal });
    const tasks = state.stages.flatMap((stage) => stage.tasks);
    return tasks.some((task) => task.status === "running")
      ? undefined
      : `last_seq=${String(state.last_seq)}，${tasks.map((task) => task.id + "=" + task.status).join("、")}`;
  });
  await server.stop("SIGKILL");
  await server.start();
  expect(await count(server)).toBe(0);
  const final = await snapshot(server);
  const error = {
    error_code: "E_INTERRUPTED",
    message: "伺服器在安裝途中停止",
    hint: "請重新安裝",
  };
  expect(final).toMatchObject({ run_id: run, status: "failed" });
  const stage = final.stages.find((s) => s.status === "failed");
  const task = stage?.tasks.find((t) => t.status === "failed");
  expect(task?.error).toEqual(error);
  const events = await history(server, run);
  expect(events.slice(-3).map(({ type, data }) => ({ type, data }))).toEqual([
    { type: "task_failed", data: { stage_id: stage?.id, task_id: task?.id, ...error } },
    { type: "stage_failed", data: { stage_id: stage?.id } },
    { type: "run_finished", data: { result: "failed" } },
  ]);
  expect(events.reduce(applyEvent, initialSnapshot(run, "success"))).toEqual(final);
  expect(await startRun(server)).toBeGreaterThan(run);
});
