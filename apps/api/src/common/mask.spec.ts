import { describe, it, expect } from "vitest";
import { maskSensitive } from "./mask";

describe("maskSensitive 日志脱敏 (需求书 7.3)", () => {
  it("掩码 8 位以上数字串 (电话/HKID)", () => {
    expect(maskSensitive("我的电话13800000000请记下")).toBe("我的电话***请记下");
  });
  it("保留短数字 (保费 350000 = 6 位不掩)", () => {
    expect(maskSensitive("首年保费350000")).toBe("首年保费350000");
  });
  it("空值安全", () => {
    expect(maskSensitive(null)).toBe("");
    expect(maskSensitive(undefined)).toBe("");
  });
});
