import { describe, it, expect } from "vitest";
import { ConcurrencyLimiter } from "./concurrency-limiter";

describe("ConcurrencyLimiter 削峰排队 (需求书 7.4(2))", () => {
  it("并发数不超过上限, 任务全部完成", async () => {
    const limiter = new ConcurrencyLimiter(3);
    let active = 0;
    let maxActive = 0;
    const task = () =>
      limiter.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 15));
        active -= 1;
        return true;
      });
    const results = await Promise.all(Array.from({ length: 20 }, task));
    expect(results.length).toBe(20);
    expect(results.every(Boolean)).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("任务抛异常不会卡死队列", async () => {
    const limiter = new ConcurrencyLimiter(1);
    await expect(
      limiter.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const ok = await limiter.run(async () => 42);
    expect(ok).toBe(42);
  });

  it("交错到达时并发恒不超上限 (slot 转交修复)", async () => {
    const limiter = new ConcurrencyLimiter(2);
    let active = 0;
    let maxActive = 0;
    const run = (delay: number) => async () => {
      await new Promise((r) => setTimeout(r, delay));
      return limiter.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active -= 1;
      });
    };
    // 让新任务恰好在前序任务释放/转交 slot 的微任务窗口到达
    await Promise.all([0, 5, 10, 18, 19, 20, 38, 39].map((d) => run(d)()));
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
