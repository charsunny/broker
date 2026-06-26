import { describe, it, expect, beforeAll } from "vitest";
import { SandboxRunner } from "./sandbox.runner";
import { DryRunService } from "./dry-run.service";

describe("DryRunService 自动化边界测试 + 自我反思 (需求书 5.3 Step3)", () => {
  let dry: DryRunService;
  beforeAll(() => {
    process.env.SANDBOX_TIMEOUT_MS = "300";
    dry = new DryRunService(new SandboxRunner());
  });

  it("dry-run 拦截负数佣金", async () => {
    const r = await dry.dryRun(
      "function calculate(i){ return { totalComm: -1 }; }",
    );
    expect(r.passed).toBe(false);
    expect(r.cases.some((c) => c.error === "算出负数佣金")).toBe(true);
  });

  it("dry-run 放行健康代码", async () => {
    const r = await dry.dryRun(
      "function calculate(i){ return { totalComm: i.premiumAmount * 0.25 }; }",
    );
    expect(r.passed).toBe(true);
  });

  it("自我反思: 首版 bug → 反馈后修复, attempts=2", async () => {
    let calls = 0;
    const generate = async (_feedback: string | null): Promise<string> => {
      calls += 1;
      return calls === 1
        ? "function calculate(i){ return { totalComm: i.premiumAmount * -0.1 }; }"
        : "function calculate(i){ return { totalComm: i.premiumAmount * 0.1 }; }";
    };
    const r = await dry.generateUntilGreen(generate, 3);
    expect(r.report.passed).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it("自我反思: 始终失败 → 用尽 maxRetries 仍 not passed", async () => {
    const generate = async (): Promise<string> =>
      "function calculate(){ while(true){} }";
    const r = await dry.generateUntilGreen(generate, 2);
    expect(r.report.passed).toBe(false);
    expect(r.attempts).toBe(2);
  });

  it("拦截字符串伪装的负数/NaN, 但不误伤标签字符串 (审查修复)", async () => {
    const neg = await dry.dryRun(
      'function calculate(i){ return { firstYearTotalRate: "-0.5", firstYearTotalAmount: "100" }; }',
    );
    expect(neg.passed).toBe(false);

    const nan = await dry.dryRun(
      'function calculate(i){ return { firstYearTotalRate: "NaN" }; }',
    );
    expect(nan.passed).toBe(false);

    const label = await dry.dryRun(
      'function calculate(i){ return { totalComm: 100, year: "Yr 1" }; }',
    );
    expect(label.passed).toBe(true);
  });
});
