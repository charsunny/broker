import { Injectable } from "@nestjs/common";
import { BaseCommissionEngine } from "./base.engine";
import { ConfigStore } from "./config.store";
import { ProductNotConfiguredError } from "./errors";
import type { CalcInput, CommissionResult, YearBreakdown } from "./engine.types";

/**
 * 永明人寿计算引擎 (需求书 4.2)。严格实现核心数学公式契约 4.2(3):
 *  步骤一 基础佣金: basicComm_N = premium * basicRate_N            (基数永远是保费)
 *  步骤二 津贴资格: 超出 eligibleYears 的年份费率已在数据里置 0     (4.1 附注, 无需 if-else)
 *  步骤三 额外津贴: extra/smpa/ma = basicComm_N * 各自 rate         (基数是当年基础佣金, 非保费)
 *  步骤四 聚合:    totalComm_N = basicComm_N + extra + smpa + ma
 */
@Injectable()
export class SunLifeEngine extends BaseCommissionEngine {
  readonly company = "Sun Life";

  constructor(private readonly config: ConfigStore) {
    super();
  }

  calculate(input: CalcInput): CommissionResult {
    const rates = this.config.getRates({
      productName: input.productName,
      premiumTerm: input.premiumTerm,
      investorStatus: input.investorStatus,
    });
    if (!rates) {
      throw new ProductNotConfiguredError({
        productName: input.productName,
        premiumTerm: input.premiumTerm,
        investorStatus: input.investorStatus,
      });
    }

    const targetYears = input.policyYear
      ? [input.policyYear]
      : Object.keys(rates)
          .map(Number)
          .sort((a, b) => a - b);

    const breakdown: YearBreakdown[] = [];
    for (const year of targetYears) {
      const yr = rates[String(year)];
      if (!yr) continue;
      const basicComm = input.premiumAmount * yr.basicRate; // 步骤一
      const extra = basicComm * yr.allowances.extra; // 步骤三
      const smpa = basicComm * yr.allowances.smpa;
      const ma = basicComm * yr.allowances.ma;
      const allowanceTotal = extra + smpa + ma;
      breakdown.push({
        year,
        basicRate: yr.basicRate,
        basicComm,
        extra,
        smpa,
        ma,
        allowanceTotal,
        totalComm: basicComm + allowanceTotal, // 步骤四
      });
    }

    // 首年指标始终基于第 1 年, 与查询的 policyYear 无关。
    // (否则查第 N 年时 breakdown 只含第 N 年, 会被误标为"首年", 造成数量级错误)
    const yr1 = rates["1"];
    const firstYearBasic = yr1 ? input.premiumAmount * yr1.basicRate : 0;
    const firstYearTotalAmount = yr1
      ? firstYearBasic *
        (1 + yr1.allowances.extra + yr1.allowances.smpa + yr1.allowances.ma)
      : 0;
    const firstYearTotalRate =
      input.premiumAmount > 0 ? firstYearTotalAmount / input.premiumAmount : 0;

    return {
      company: input.company,
      productName: input.productName,
      premiumTerm: input.premiumTerm,
      investorStatus: input.investorStatus,
      premiumAmount: input.premiumAmount,
      firstYearTotalRate,
      firstYearTotalAmount,
      breakdown,
      warnings: [], // 由 RiskInterceptor 在 Synthesis 节点追加
    };
  }
}
