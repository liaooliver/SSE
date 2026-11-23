/**
 * In-memory fan-out of committed events to SSE subscribers (SPEC-cloudflare R16, R20–R24).
 *
 * R23 design A (chosen by the spike): each subscriber has a `SubscriberQueue` of live events not
 * yet handed to its `highWaterMark: 1` response stream. Every way a subscriber ends goes through
 * `remove`, which is idempotent and clears the heartbeat timer.
 */
import { formatEvent, PING_COMMENT, RETRY_BLOCK, SubscriberQueue, type Event } from "./domain";

type Controller = ReadableStreamDefaultController<Uint8Array>;
type RemoveReason = "finished" | "overflow" | "cancel" | "enqueue-error";

/** R22/R23: per-subscriber settings. */
export interface SubscriberOptions {
  readonly heartbeatMs: number;
  readonly queueSize: number;
}

interface Subscriber {
  readonly runId: number;
  readonly queue: SubscriberQueue<Event>;
  readonly heartbeatMs: number;
  controller: Controller | null;
  lastSeq: number;
  lastOutputMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  removed: boolean;
}

const encoder = new TextEncoder();

/** R18: control event telling the client to resync; carries no `id`. */
function resetBlock(runId: number): string {
  return `event: reset\ndata: ${JSON.stringify({ run_id: runId })}\n\n`;
}

/** R18: a stream that sends `retry`, then `reset`, then ends; never registered (R16). */
export function resetStream(runId: number): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(RETRY_BLOCK));
      controller.enqueue(encoder.encode(resetBlock(runId)));
      controller.close();
    },
  });
}

/** R16/R20–R24: the set of live subscribers of the Durable Object. */
export class Broker {
  private readonly subscribers = new Set<Subscriber>();

  /** R16: number of registered subscribers. */
  get count(): number {
    return this.subscribers.size;
  }

  /**
   * R20 steps 2 and 4: create the response stream and register the subscriber (so live events
   * start entering its queue), then call `replay` synchronously to read the events to resend,
   * send `retry` and the replayed events, and return the stream.
   */
  open(
    runId: number,
    startSeq: number,
    options: SubscriberOptions,
    replay: () => readonly Event[],
  ): ReadableStream<Uint8Array> {
    const sub: Subscriber = {
      runId,
      queue: new SubscriberQueue<Event>(options.queueSize),
      heartbeatMs: options.heartbeatMs,
      controller: null,
      lastSeq: startSeq,
      lastOutputMs: Date.now(),
      timer: null,
      removed: false,
    };
    const stream = new ReadableStream<Uint8Array>(
      {
        start: (controller) => {
          sub.controller = controller;
        },
        pull: () => {
          this.drain(sub);
        },
        cancel: () => {
          this.remove(sub, "cancel");
        },
      },
      new CountQueuingStrategy({ highWaterMark: 1 }),
    );
    this.subscribers.add(sub);
    const events = replay();
    this.write(sub, RETRY_BLOCK);
    for (const event of events) {
      this.deliver(sub, event);
    }
    return stream;
  }

  /** R23: hand a committed live event to every subscriber without blocking. */
  publish(event: Event): void {
    for (const sub of [...this.subscribers]) {
      this.offer(sub, event);
    }
  }

  private offer(sub: Subscriber, event: Event): void {
    if (sub.removed || event.run_id !== sub.runId || event.seq <= sub.lastSeq) {
      return;
    }
    sub.lastSeq = event.seq;
    const desired = sub.controller?.desiredSize ?? 0;
    if (sub.queue.size === 0 && desired > 0) {
      this.deliver(sub, event);
      return;
    }
    if (!sub.queue.push(event)) {
      this.remove(sub, "overflow");
      return;
    }
    this.drain(sub);
  }

  /** R23: the stream wants more data: move queued events while it has room. */
  private drain(sub: Subscriber): void {
    while (!sub.removed && sub.queue.size > 0 && (sub.controller?.desiredSize ?? 0) > 0) {
      const event = sub.queue.shift();
      if (event === undefined) {
        return;
      }
      this.deliver(sub, event);
    }
  }

  /** Write one data event; after `run_finished` the stream ends (R21). */
  private deliver(sub: Subscriber, event: Event): void {
    sub.lastSeq = Math.max(sub.lastSeq, event.seq);
    this.write(sub, formatEvent(event));
    if (event.type === "run_finished") {
      this.remove(sub, "finished");
    }
  }

  /** R22/R24: every output restarts the heartbeat; a throwing `enqueue` means disconnect. */
  private write(sub: Subscriber, text: string): void {
    if (sub.removed || sub.controller === null) {
      return;
    }
    try {
      sub.controller.enqueue(encoder.encode(text));
    } catch {
      this.remove(sub, "enqueue-error");
      return;
    }
    sub.lastOutputMs = Date.now();
    this.schedulePing(sub, sub.heartbeatMs);
  }

  private schedulePing(sub: Subscriber, delayMs: number): void {
    if (sub.timer !== null) {
      clearTimeout(sub.timer);
    }
    sub.timer = setTimeout(() => {
      this.ping(sub);
    }, delayMs);
  }

  /** R22: send a ping only once `heartbeatMs` passed since the last output. */
  private ping(sub: Subscriber): void {
    sub.timer = null;
    if (sub.removed) {
      return;
    }
    const remainingMs = sub.lastOutputMs + sub.heartbeatMs - Date.now();
    if (remainingMs > 0) {
      this.schedulePing(sub, remainingMs);
      return;
    }
    this.write(sub, PING_COMMENT);
  }

  /**
   * R16: the single removal path (finished, overflow, cancel, enqueue error). Idempotent:
   * clears the timer, drops the subscriber (its queued events are discarded, R23) and, when the
   * server ends the stream, closes it.
   */
  private remove(sub: Subscriber, reason: RemoveReason): void {
    if (sub.removed) {
      return;
    }
    sub.removed = true;
    if (sub.timer !== null) {
      clearTimeout(sub.timer);
      sub.timer = null;
    }
    this.subscribers.delete(sub);
    const controller = sub.controller;
    sub.controller = null;
    if (controller !== null && (reason === "finished" || reason === "overflow")) {
      controller.close();
    }
  }
}
