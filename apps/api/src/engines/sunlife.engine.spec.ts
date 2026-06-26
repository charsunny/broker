import { describe, it, expect } from "vitest";
import { ConfigStore } from "./config.store";
import { SunLifeEngine } from "./sunlife.engine";

describe("SunLifeEngine 首年指标 (审查修复)", () => {
  const config = new ConfigStore();
  config.seedDemo();
  const engine = new SunLifeEngine(config);
  const base = {
    company: "Sun Life",
    productName: "SunJoy Global 2",
    premiumTerm: "5",
    investorStatus: "Non-PI" as const,
    premiumAmount: 100000,
  };

  it("查第 3 年时, 首年率仍基于第 1 年, 不被误标", () => {
    const full = engine.calculate({ ...base, policyYear: null });
    const yr3 = engine.calculate({ ...base, policyYear: 3 });

    // 首年率两者一致 (≈0.5325 = 25% basic + 28.25% 津贴), 而非第 3 年的 ≈5.75%
    expect(yr3.firstYearTotalRate).toBeCloseTo(full.firstYearTotalRate, 6);
    expect(yr3.firstYearTotalRate).toBeGreaterThan(0.5);
    // breakdown 仍只含查询的第 3 年
    expect(yr3.breakdown.map((b) => b.year)).toEqual([3]);
  });

  it("首年(year=1)数值与全量计算一致", () => {
    const full = engine.calculate({ ...base, policyYear: null });
    expect(full.firstYearTotalRate).toBeCloseTo(0.5325, 4);
    expect(full.firstYearTotalAmount).toBeCloseTo(53250, 0);
  });
});
