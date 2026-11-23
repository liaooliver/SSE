/**
 * R3 (SPEC-cloudflare): settings come only from Worker vars; one parser shared by the Worker
 * entry and the Durable Object.
 */

/** R3: resolved settings, already converted to milliseconds where relevant. */
export interface Settings {
  readonly logIntervalMs: number;
  readonly heartbeatMs: number;
  readonly subscriberQueueSize: number;
}

/** R3: the env bindings the parser reads; values are untrusted. */
export interface SettingsEnv {
  readonly SSE_LOG_INTERVAL?: unknown;
  readonly SSE_HEARTBEAT_SECONDS?: unknown;
  readonly SSE_SUBSCRIBER_QUEUE_SIZE?: unknown;
}

/** R3: either valid settings or the names of every invalid variable. */
export type SettingsResult =
  | { readonly ok: true; readonly settings: Settings }
  | { readonly ok: false; readonly invalid: readonly string[] };

const FLOAT_RE = /^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$/;
const INT_RE = /^[+-]?[0-9]+$/;
const MS_PER_SECOND = 1000;

const DEFAULT_LOG_INTERVAL = 0.15;
const DEFAULT_HEARTBEAT_SECONDS = 15;
const DEFAULT_QUEUE_SIZE = 1000;
const MAX_LOG_INTERVAL = 10;

function parseNumber(raw: unknown, pattern: RegExp, fallback: number): number | null {
  if (raw === undefined) {
    return fallback;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const text = raw.trim();
  return pattern.test(text) ? Number(text) : null;
}

function logInterval(raw: unknown): number | null {
  const value = parseNumber(raw, FLOAT_RE, DEFAULT_LOG_INTERVAL);
  if (value === null || !Number.isFinite(value) || value < 0 || value > MAX_LOG_INTERVAL) {
    return null;
  }
  return value;
}

function heartbeat(raw: unknown): number | null {
  const value = parseNumber(raw, FLOAT_RE, DEFAULT_HEARTBEAT_SECONDS);
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function queueSize(raw: unknown): number | null {
  const value = parseNumber(raw, INT_RE, DEFAULT_QUEUE_SIZE);
  if (value === null || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }
  return value;
}

/** R3: parse and validate the three settings; never falls back to a default for a bad value. */
export function parseSettings(env: SettingsEnv): SettingsResult {
  const interval = logInterval(env.SSE_LOG_INTERVAL);
  const beat = heartbeat(env.SSE_HEARTBEAT_SECONDS);
  const size = queueSize(env.SSE_SUBSCRIBER_QUEUE_SIZE);
  if (interval === null || beat === null || size === null) {
    const invalid: string[] = [];
    if (interval === null) invalid.push("SSE_LOG_INTERVAL");
    if (beat === null) invalid.push("SSE_HEARTBEAT_SECONDS");
    if (size === null) invalid.push("SSE_SUBSCRIBER_QUEUE_SIZE");
    return { ok: false, invalid };
  }
  return {
    ok: true,
    settings: {
      logIntervalMs: interval * MS_PER_SECOND,
      heartbeatMs: beat * MS_PER_SECOND,
      subscriberQueueSize: size,
    },
  };
}
