import { expect, test } from "vitest";
import { HTTP, useWorker } from "../helpers/server";

const vars = {
  SSE_LOG_INTERVAL: "0x1",
  SSE_HEARTBEAT_SECONDS: "1second",
  SSE_SUBSCRIBER_QUEUE_SIZE: "1e1",
};
const server = useWorker(vars, "SSE_LOG_INTERVAL");
test("R3 部分可解析的字串仍須逐一報錯", { timeout: 10_000 }, async () => {
  const response = await server.request("/health");
  expect(response.status).toBe(HTTP.config);
  const body = await response.text();
  for (const name of Object.keys(vars)) expect(body).toContain(name);
});
