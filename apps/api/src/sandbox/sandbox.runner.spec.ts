import { describe, it, expect, beforeAll } from "vitest";
import { SandboxRunner } from "./sandbox.runner";

/** 对抗式测试: 证明零信任沙箱的物理边界真的拦得住 (需求书 5.2)。 */
describe("SandboxRunner 零信任边界", () => {
  let runner: SandboxRunner;

  beforeAll(() => {
    process.env.SANDBOX_TIMEOUT_MS = "400";
    process.env.SANDBOX_MEMORY_LIMIT_MB = "16";
    runner = new SandboxRunner();
  });

  it("正常计算: 返回结果", async () => {
    const r = await runner.run("function calculate(i){ return i.a * i.b; }", {
      a: 6,
      b: 7,
    });
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it("死循环 → 超时熔断 (timedOut)", async () => {
    const r = await runner.run("function calculate(){ while(true){} }", {});
    expect(r.ok).toBe(false);
    expect(r.timedOut).toBe(true);
    expect(r.durationMs).toBeLessThan(3000);
  });

  it("断网: fetch 不存在 → 报错", async () => {
    const r = await runner.run(
      "function calculate(){ return fetch('http://evil'); }",
      {},
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fetch is not defined|fetch/i);
  });

  it("禁高危库: require 不存在 → 报错", async () => {
    const r = await runner.run(
      "function calculate(){ return require('fs'); }",
      {},
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/require is not defined|require/i);
  });

  it("禁系统访问: process 不存在 → 报错", async () => {
    const r = await runner.run("function calculate(){ return process.pid; }", {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/process is not defined|process/i);
  });

  it("内存炸弹 → 边界拦截 (ok=false)", async () => {
    const r = await runner.run(
      `function calculate(){
        const big = [];
        for (let i = 0; i < 1e9; i++) big.push(new Array(100000).fill(i));
        return big.length;
      }`,
      {},
    );
    expect(r.ok).toBe(false);
    expect(r.timedOut || r.oom).toBe(true);
  });

  it("缺少 calculate 函数 → 明确报错", async () => {
    const r = await runner.run("const x = 1;", {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/calculate/);
  });

  it("calculate 无返回值 → 明确报错 (不再误导为 JSON 错误, 审查修复)", async () => {
    const r = await runner.run("function calculate(){ /* 无 return */ }", {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/未返回|undefined/);
  });
});
