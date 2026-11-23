import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll } from "vitest";
import { until, WaitTimeout, within } from "./wait";

const workerDir = fileURLToPath(new URL("../../", import.meta.url));
export const HTTP = {
  ok: 200,
  accepted: 202,
  empty: 204,
  missing: 404,
  conflict: 409,
  invalid: 422,
  config: 500,
} as const;

/** R24 依 §10 放寬預期上限，單位為毫秒。 */
export function upper(ms: number): number {
  return 3 * ms + 200;
}

async function freePort(): Promise<number> {
  const listener = createServer();
  let last = "尚未分配 TCP 埠";
  return within(
    "分配本機 TCP 埠",
    3000,
    () => last,
    (signal) =>
      new Promise<number>((resolve, reject) => {
        listener.once("error", reject);
        listener.listen({ port: 0, host: "127.0.0.1", signal }, () => {
          const address = listener.address();
          if (address && typeof address !== "string") last = `正在釋放埠 ${String(address.port)}`;
          listener.close((error) => {
            if (error || !address || typeof address === "string")
              reject(error ?? new Error("沒有取得 TCP 埠"));
            else resolve(address.port);
          });
        });
      }),
  );
}

function groupSignal(pid: number, signal: NodeJS.Signals | 0): string | undefined {
  try {
    process.kill(-pid, signal);
    return "群組仍存在";
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "ESRCH") return undefined;
      if (error.code === "EPERM") return "EPERM，尚無法確認群組已退出";
    }
    throw error;
  }
}

type Vars = Readonly<Record<string, string>>;

/** R1、R2、R17、R24、R25 每個檔案只控制自己的程序群組和暫存目錄。 */
export class WorkerServer {
  private directory: string | undefined;
  private pid: number | undefined;
  url = "";

  constructor(
    private readonly vars: Vars,
    private readonly invalidVar?: string,
  ) {}

  async start(): Promise<void> {
    this.directory ??= await mkdtemp(join(tmpdir(), "wrangler-test-state-"));
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const port = await freePort();
      const vars = Object.entries(this.vars).flatMap(([key, value]) => [
        "--var",
        key + ":" + value,
      ]);
      const child = spawn(
        "npx",
        ["wrangler", "dev", "--port", String(port), "--persist-to", this.directory, ...vars],
        {
          cwd: workerDir,
          detached: true,
          stdio: "ignore",
          env: { ...process.env, npm_config_offline: "true", WRANGLER_SEND_METRICS: "false" },
        },
      );
      let spawnError: Error | undefined;
      child.once("error", (error) => {
        spawnError = error;
      });
      this.pid = child.pid;
      this.url = "http://127.0.0.1:" + String(port);
      try {
        await until(`/health 就緒（埠 ${String(port)}）`, 60_000, async (signal) => {
          if (spawnError) throw spawnError;
          if (child.exitCode !== null || child.signalCode !== null)
            throw new Error("wrangler 在就緒前退出");
          try {
            const response = await this.request("/health", { signal }, 1000);
            const body = await response.text();
            const ready =
              this.invalidVar === undefined
                ? response.status === HTTP.ok
                : response.status === HTTP.config && body.includes(this.invalidVar);
            return ready ? undefined : `HTTP ${String(response.status)}，${body}`;
          } catch (error) {
            if (error instanceof TypeError) return error.message;
            throw error;
          }
        });
        return;
      } catch (error) {
        lastError = error;
        try {
          await this.stop();
        } catch (stopError) {
          throw new AggregateError([error, stopError], "wrangler 啟動失敗，程序群組清理也失敗", {
            cause: error,
          });
        }
      }
    }
    throw new Error("三次啟動 wrangler 均失敗", { cause: lastError });
  }

  request(path: string, init: RequestInit = {}, timeout = 5000): Promise<Response> {
    let last = "尚未收到回應標頭";
    return within(
      `${init.method ?? "GET"} ${path}`,
      timeout,
      () => last,
      async (deadline) => {
        const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
        const response = await fetch(this.url + path, { ...init, signal });
        last = `HTTP ${String(response.status)}，正在讀取本文`;
        // 有限回應的本文也受單次請求時限約束；SSE 另由 withFeed 逐塊讀取。
        const body = response.body === null ? null : await response.arrayBuffer();
        return new Response(body, response);
      },
    );
  }

  async stop(signal: NodeJS.Signals = "SIGTERM"): Promise<boolean> {
    const pid = this.pid;
    if (pid === undefined) return false;
    const start = performance.now();
    const grace = 5000;
    const reason = `程序群組 PGID ${String(pid)} 在 ${signal} 後退出`;
    const probe = () => groupSignal(pid, 0);
    let forced = false;
    if (groupSignal(pid, signal) !== undefined) {
      try {
        await until(reason, grace, probe, start);
      } catch (error) {
        if (!(error instanceof WaitTimeout)) throw error;
        forced = true;
        if (groupSignal(pid, "SIGKILL") !== undefined)
          await until(reason + "（已要求 SIGKILL）", 2 * grace, probe, start);
      }
    }
    this.pid = undefined;
    return forced;
  }

  async dispose(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await this.stop();
    } catch (error) {
      errors.push(error);
    } finally {
      if (this.directory !== undefined) {
        try {
          await rm(this.directory, { recursive: true, force: true, maxRetries: 3 });
          this.directory = undefined;
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, "程序群組與暫存目錄均未清理完成", { cause: errors[0] });
  }
}

/** R2、R17 每個 e2e／perf 檔案取得獨立的 Worker，在測試結束時清理。 */
export function useWorker(vars: Vars = {}, invalidVar?: string): WorkerServer {
  const server = new WorkerServer(vars, invalidVar);
  beforeAll(() => server.start(), 230_000);
  afterAll(() => server.dispose(), 15_000);
  return server;
}
