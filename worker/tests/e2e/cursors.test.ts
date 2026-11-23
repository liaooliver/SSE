import { expect, test } from "vitest";
import { count, json, logItem, snapshot, startRun } from "../helpers/data";
import { HTTP, upper, useWorker } from "../helpers/server";
import { fields, history, withFeed, type Cursor } from "../helpers/stream";

const server = useWorker({ SSE_LOG_INTERVAL: "0.03" });
async function reset(run: number, query: string): Promise<void> {
  await withFeed(
    server,
    { query },
    async (feed) => {
      await feed.ready();
      expect(await count(server)).toBe(0);
      const values = fields((await feed.next())?.raw ?? "");
      expect([...values.keys()].sort()).toEqual(["data", "event"]);
      expect(values.get("event")).toBe("reset");
      expect(JSON.parse(values.get("data") ?? "")).toEqual({ run_id: run });
      expect(await feed.next()).toBeUndefined();
    },
    upper(1000),
  );
  expect(await count(server)).toBe(0);
}
test("R9 R14–R21 AC6 換輪、重播、重設與游標優先序", { timeout: 75_000 }, async () => {
  const old = await startRun(server, "network_unreachable");
  await history(server, old);
  const run = await startRun(server);
  expect(run).toBeGreaterThan(old);
  expect(await snapshot(server)).toMatchObject({
    run_id: run,
    status: "running",
    scenario: "success",
  });
  const id = (seq: number) => String(run) + "." + String(seq);
  await reset(run, String(old) + ".1");
  await reset(run, id(9999));
  expect((await server.request("/install/logs?run_id=" + String(old))).status).toBe(HTTP.conflict);
  const all = await history(server, run);
  const end = all.length;
  expect(end).toBe(202);
  await reset(run, String(old) + ".1");
  await withFeed(server, {}, async (feed) => {
    await feed.ready();
    expect(await count(server)).toBe(0);
    const replay = [];
    for await (const event of feed.events(run)) replay.push(event);
    expect(replay).toEqual(all);
  });
  for (const n of [end, end + 1]) {
    const response = await server.request("/install/events?last_event_id=" + id(n));
    expect(response.status).toBe(HTTP.empty);
    expect(await response.text()).toBe("");
    expect(await count(server)).toBe(0);
  }
  const probes: readonly (readonly [Cursor, number])[] = [
    [{ query: id(2), header: id(5) }, 5],
    [{ query: id(2), header: "bad" }, 2],
    [{ header: "bad" }, 0],
    [{ query: " \t" + id(2) + "\n" }, 2],
    [{ query: id(0) }, 0],
    [{ header: "9007199254740992.0" }, 0],
    [{ query: id(1), header: "1.9007199254740992" }, 1],
  ];
  for (const [cursor, n] of probes)
    expect(await history(server, run, cursor)).toEqual(all.slice(n));
  for (const value of ["", "1", "１.２", "1.2.3", "9007199254740992.1", "1.9007199254740992"]) {
    const response = await server.request(
      "/install/events?" + new URLSearchParams({ last_event_id: value }).toString(),
      { headers: { "Last-Event-ID": id(2) } },
    );
    expect(response.status).toBe(HTTP.invalid);
  }
  const logs = all.filter((e) => e.type === "log");
  const base = "/install/logs?run_id=0" + String(run);
  expect(await json(server, base)).toEqual({
    run_id: run,
    items: logs.map(logItem),
    next_after: null,
  });
  for (const [after, until, limit] of [
    [0, 0, 1],
    [5, 4, 1],
    [3, 9, 2],
    [4, 5, 1],
    [4, 5, 1000],
    [0, Number.MAX_SAFE_INTEGER, 1000],
  ] as const) {
    const selected = logs.filter((e) => after < e.seq && e.seq <= until);
    const items = selected.slice(0, limit).map(logItem);
    expect(
      await json(
        server,
        base +
          "&" +
          new URLSearchParams({
            after: String(after),
            until: String(until),
            limit: String(limit),
          }).toString(),
      ),
    ).toEqual({
      run_id: run,
      items,
      next_after: selected.length > limit ? items.at(-1)?.seq : null,
    });
  }
});
