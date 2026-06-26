/**
 * 并发限流闸 (需求书 7.4(2) 动态排队/削峰填谷)。
 * 限制同时进行的重操作 (如 LLM 调用) 数量; 超出的请求排队等待, 而非报错崩溃。
 * 用牺牲少量等待时间换取扛住数倍瞬时并发。
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  get activeCount(): number {
    return this.active;
  }
  get queuedCount(): number {
    return this.waiters.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      // 排队; 被唤醒即继承释放出的 slot, 不再自增 active
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) {
        next(); // slot 直接转交给等待者, active 保持不变 → 并发恒 ≤ max
      } else {
        this.active -= 1; // 无人等待才真正释放 slot
      }
    }
  }
}
