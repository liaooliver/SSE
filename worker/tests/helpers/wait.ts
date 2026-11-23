import { setTimeout as delay } from "node:timers/promises";

/** R17、R24 區分等待逾時與受測系統或測試斷言的錯誤。 */
export class WaitTimeout extends Error {}

/** R17、R24 以單一截止時間限制整段操作，同時取消仍在等待的 I/O。 */
export async function within<T>(
  reason: string,
  ms: number,
  last: () => string,
  work: (signal: AbortSignal) => Promise<T>,
  start = performance.now(),
): Promise<T> {
  const elapsed = () => performance.now() - start;
  const timeout = () =>
    new WaitTimeout(
      `等候${reason}逾時，已等 ${String(Math.round(elapsed()))} ms（上限 ${String(ms)} ms），最後觀察：${last()}`,
    );
  if (elapsed() >= ms) throw timeout();
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => {
        const error = timeout();
        reject(error);
        controller.abort(error);
      },
      Math.ceil(ms - elapsed()),
    );
  });
  try {
    const result = await Promise.race([expired, work(controller.signal)]);
    if (elapsed() >= ms) throw timeout();
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/** R17、R24 輪詢至條件成立。未成立時保留觀察值，單次請求逾時可再試。 */
export async function until(
  reason: string,
  ms: number,
  check: (signal: AbortSignal) => string | undefined | Promise<string | undefined>,
  start = performance.now(),
): Promise<void> {
  let last = "尚未取得樣本";
  let requestError = "";
  await within(
    reason,
    ms,
    () => last + requestError,
    async (signal) => {
      for (;;) {
        signal.throwIfAborted();
        try {
          const observed = await check(signal);
          if (observed === undefined) return;
          last = observed;
          requestError = "";
        } catch (error) {
          if (!(error instanceof WaitTimeout)) throw error;
          requestError = "；最近一次請求：" + error.message;
        }
        await delay(25, undefined, { signal });
      }
    },
    start,
  );
}
