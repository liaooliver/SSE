import { expect, test } from "vitest";
import { applyEvent, initialSnapshot, scriptFor } from "../../src/domain";
import { cases } from "../helpers/catalog";
import { count, snapshot, startRun } from "../helpers/data";
import { HTTP, useWorker } from "../helpers/server";
import { history } from "../helpers/stream";

const server = useWorker({ SSE_LOG_INTERVAL: "0" });
test("AC4 AC5 AC7 七個情境的完整劇本、失敗位置及 EOF", { timeout: 180_000 }, async () => {
  for (const scenario of cases) {
    const run = await startRun(server, scenario.id);
    const events = await history(server, run);
    const actual = events.map((event, i) => {
      expect(event.seq).toBe(i + 1);
      const data = { ...event.data };
      if (event.type === "log") delete data.ts;
      if (event.type === "run_started") {
        expect(data.run_id).toBe(run);
        delete data.run_id;
      }
      return { type: event.type, data };
    });
    expect(actual).toEqual(scriptFor(scenario.id));
    expect(actual.at(-1)).toEqual({
      type: "run_finished",
      data: { result: scenario.fail_task_id ? "failed" : "succeeded" },
    });
    const final = await snapshot(server);
    expect(final).toEqual(events.reduce(applyEvent, initialSnapshot(run, scenario.id)));
    if (scenario.fail_task_id) {
      const tasks = final.stages.flatMap((stage) => stage.tasks);
      const index = tasks.findIndex((t) => t.id === scenario.fail_task_id);
      const stageIndex = final.stages.findIndex((s) =>
        s.tasks.some((t) => t.id === scenario.fail_task_id),
      );
      expect(tasks[index]).toMatchObject({
        status: "failed",
        error: { error_code: scenario.error_code, message: scenario.message, hint: scenario.hint },
      });
      expect(final.stages[stageIndex]?.status).toBe("failed");
      expect(tasks.slice(index + 1).every((t) => t.status === "pending")).toBe(true);
      expect(final.stages.slice(stageIndex + 1).every((s) => s.status === "pending")).toBe(true);
      const tail = actual.filter((e) => e.data.task_id === scenario.fail_task_id).slice(-2);
      expect(tail[0]).toMatchObject({
        type: "log",
        data: { level: "error", text: scenario.message },
      });
      expect(tail[1]).toMatchObject({
        type: "task_failed",
        data: {
          task_id: scenario.fail_task_id,
          error_code: scenario.error_code,
          message: scenario.message,
          hint: scenario.hint,
        },
      });
    }
    const again = await server.request("/install/events", {
      headers: { "Last-Event-ID": String(run) + "." + String(final.last_seq) },
    });
    expect(again.status).toBe(HTTP.empty);
    expect(await again.text()).toBe("");
    expect(await count(server)).toBe(0);
  }
});
