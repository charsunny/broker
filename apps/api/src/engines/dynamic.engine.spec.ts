import { describe, it, expect, beforeAll } from "vitest";
import { SandboxRunner } from "../sandbox/sandbox.runner";
import { DynamicEngine } from "./dynamic.engine";

describe("DynamicEngine 输出强校验 fail-closed (审查修复)", () => {
  let sandbox: SandboxRunner;
  beforeAll(() => {
    process.env.SANDBOX_TIMEOUT_MS = "500";
    sandbox = new SandboxRunner();
  });
  const input = {
    company: "X",
    productName: "P",
    premiumTerm: "5",
    investorStatus: "PI" as const,
    premiumAmount: 100000,
    policyYear: 1,
  };

  it("健康输出通过", async () => {
    const eng = new DynamicEngine(
      "X",
      "function calculate(i){ return { firstYearTotalRate:0.1, firstYearTotalAmount:i.premiumAmount*0.1, breakdown:[] }; }",
      sandbox,
    );
    const r = await eng.calculate(input);
    expect(r.firstYearTotalAmount).toBe(10000);
  });

  it("字符串负数输出被拒", async () => {
    const eng = new DynamicEngine(
      "X",
      'function calculate(i){ return { firstYearTotalRate:"-0.5", firstYearTotalAmount:1 }; }',
      sandbox,
    );
    await expect(eng.calculate(input)).rejects.toThrow(/非法/);
  });

  it("NaN 金额输出被拒", async () => {
    const eng = new DynamicEngine(
      "X",
      'function calculate(i){ return { firstYearTotalRate:0.1, firstYearTotalAmount:"NaN" }; }',
      sandbox,
    );
    await expect(eng.calculate(input)).rejects.toThrow(/非法/);
  });
});
