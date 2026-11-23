/**
 * Worker entry (SPEC-cloudflare R2, R3): validate settings, then forward the request unchanged
 * to the single `InstallDO` and return its response unchanged (including streams).
 */
import { parseSettings } from "./config";
import { HTTP_STATUS, textResponse } from "./http";
import type { Env } from "./install-do";

export { InstallDO } from "./install-do";

export default {
  /** R3: 500 with every invalid variable name; otherwise forward to the DO (R2). */
  async fetch(request: Request, env: Env): Promise<Response> {
    const result = parseSettings(env);
    if (!result.ok) {
      const names = result.invalid.join(", ");
      return textResponse(`Invalid configuration: ${names}\n`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
    const stub = env.INSTALL.get(env.INSTALL.idFromName("install"));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
