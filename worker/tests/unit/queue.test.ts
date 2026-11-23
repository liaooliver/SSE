import { expect, test } from "vitest";
import { SubscriberQueue, ValueError } from "../../src/domain";

test("R23 AC10 有界 FIFO 在溢位時保留內容，訂閱者彼此獨立", () => {
  for (const capacity of [1, 4]) {
    const a = new SubscriberQueue<number>(capacity);
    const b = new SubscriberQueue<number>(1);
    expect(a.capacity).toBe(capacity);
    expect(a.size).toBe(0);
    expect(a.shift()).toBeUndefined();
    for (let i = 0; i < capacity; i++) {
      expect(a.push(i)).toBe(true);
      expect(a.size).toBe(i + 1);
    }
    expect(a.push(999)).toBe(false);
    expect(a.size).toBe(capacity);
    expect(b.push(41)).toBe(true);
    expect(a.shift()).toBe(0);
    expect(a.size).toBe(capacity - 1);
    expect(a.push(capacity)).toBe(true);
    for (let i = 1; i <= capacity; i++) expect(a.shift()).toBe(i);
    expect(a.shift()).toBeUndefined();
    expect(a.size).toBe(0);
    expect(b.shift()).toBe(41);
  }
  for (const capacity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => new SubscriberQueue(capacity)).toThrow(ValueError);
});
