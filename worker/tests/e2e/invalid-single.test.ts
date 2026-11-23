import { expect, test } from "vitest";
import { HTTP, useWorker } from "../helpers/server";

const server = useWorker({ SSE_HEARTBEAT_SECONDS: "1e999" }, "SSE_HEARTBEAT_SECONDS");
test("R3 R17 單一非有限設定即回報錯誤", { timeout: 10_000 }, async () => {
  const response = await server.request("/health");
  expect(response.status).toBe(HTTP.config);
  expect(await response.text()).toContain("SSE_HEARTBEAT_SECONDS");
});
