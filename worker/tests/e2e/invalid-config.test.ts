import { expect, test } from "vitest";
import { HTTP, useWorker } from "../helpers/server";

const vars = {
  SSE_LOG_INTERVAL: "10.01",
  SSE_HEARTBEAT_SECONDS: "0",
  SSE_SUBSCRIBER_QUEUE_SIZE: "9007199254740992",
};
const server = useWorker(vars, "SSE_LOG_INTERVAL");
test("R2 R3 R17 無效設定列出所有錯誤並保留靜態首頁", { timeout: 20_000 }, async () => {
  for (const [path, method] of [
    ["/health", "GET"],
    ["/stats", "GET"],
    ["/install", "GET"],
    ["/install/plan", "GET"],
    ["/install/scenarios", "GET"],
    ["/install/logs", "GET"],
    ["/install/events?last_event_id=bad", "GET"],
    ["/install", "POST"],
  ] as const) {
    const response = await server.request(
      path,
      method === "POST" ? { method: "POST", body: "{" } : {},
    );
    expect(response.status).toBe(HTTP.config);
    expect(response.headers.get("content-type")?.toLowerCase()).toMatch(
      /^text\/plain\s*;\s*charset="?utf-8"?$/,
    );
    const body = await response.text();
    for (const name of Object.keys(vars)) expect(body).toContain(name);
  }
  expect((await server.request("/")).status).toBe(HTTP.ok);
});
