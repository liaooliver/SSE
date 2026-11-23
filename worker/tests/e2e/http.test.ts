import { expect, test } from "vitest";
import { cases, stages } from "../helpers/catalog";
import { count, json, snapshot } from "../helpers/data";
import { HTTP, useWorker } from "../helpers/server";

const server = useWorker({
  SSE_LOG_INTERVAL: " +1.e0 ",
  SSE_SUBSCRIBER_QUEUE_SIZE: " +001000 ",
  SSE_HEARTBEAT_SECONDS: " .5e1 ",
});
test("R1 R2 R3 R11–R18 AC8 初始狀態、驗證順序與並行安裝", { timeout: 45_000 }, async () => {
  expect(await json(server, "/health")).toEqual({ status: "ok" });
  expect(await count(server)).toBe(0);
  const plan = {
    stages: stages.map(({ id, name, tasks }) => ({
      id,
      name,
      tasks: tasks.map(({ id, name }) => ({ id, name })),
    })),
  };
  expect(await json(server, "/install/plan")).toEqual(plan);
  expect(await json(server, "/install/scenarios")).toEqual(
    cases.map(({ id, label, fail_task_id }) => ({ id, label, fail_task_id })),
  );
  for (const path of [
    "/install",
    "/install/logs?run_id=01",
    "/install/events",
    "/install/events?last_event_id=1.2",
  ])
    expect((await server.request(path)).status).toBe(HTTP.missing);
  expect(await count(server)).toBe(0);
  expect((await server.request("/install/logs")).status).toBe(HTTP.invalid);
  for (const field of ["run_id", "after", "until", "limit"]) {
    for (const bad of ["", " 1", "+1", "-1", "1.0", "1e0", "１", "9007199254740992"]) {
      const query = new URLSearchParams({ run_id: "1", [field]: bad });
      expect((await server.request("/install/logs?" + query.toString())).status).toBe(HTTP.invalid);
    }
  }
  for (const query of ["run_id=0", "run_id=1&limit=0", "run_id=1&limit=1001"])
    expect((await server.request("/install/logs?" + query)).status).toBe(HTTP.invalid);
  expect((await server.request("/install/events?last_event_id=bad")).status).toBe(HTTP.invalid);
  const post = (body: string) =>
    server.request("/install", { method: "POST", headers: { "Content-Type": "text/plain" }, body });
  const responses = await Promise.all(
    Array.from({ length: 10 }, () => post('{"scenario":"success","extra":true}')),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([
    HTTP.accepted,
    ...Array<number>(9).fill(HTTP.conflict),
  ]);
  const accepted = responses.find((r) => r.status === HTTP.accepted);
  const state = await snapshot(server);
  expect(await accepted?.json()).toEqual({ run_id: state.run_id, scenario: "success" });
  expect(state.status).toBe("running");
  expect(state.last_seq).toBeGreaterThanOrEqual(1);
  expect(await json(server, "/install/plan")).toEqual(plan);
  expect((await post('{"scenario":"success"}')).status).toBe(HTTP.conflict);
  for (const body of [
    "{",
    "[]",
    "null",
    '"success"',
    "{}",
    '{"scenario":1}',
    '{"scenario":"未知"}',
  ])
    expect((await post(body)).status).toBe(HTTP.invalid);
  expect(
    (await server.request("/install/logs?run_id=" + String(state.run_id + 1) + "&after=-1")).status,
  ).toBe(HTTP.invalid);
});
