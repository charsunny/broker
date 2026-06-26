import { Injectable } from "@nestjs/common";
import type { RiskBanner } from "@insurance/contracts";
import type { CalcInput, CommissionResult } from "./engine.types";

/**
 * 风险拦截器 (需求书 4.2(4) 退佣与合规拦截规则)。
 * 在 Synthesis 节点对计算结果比对预警规则库, 命中则强制写入 warnings。
 */
@Injectable()
export class RiskInterceptor {
  apply(input: CalcInput, result: CommissionResult): RiskBanner[] {
    const banners: RiskBanner[] = [];
    const isFirstYear = !input.policyYear || input.policyYear === 1;

    // 全局通用预警: 首年测算必追加退佣提示
    if (isFirstYear) {
      banners.push({
        level: "info",
        text: "若发生保费退回、欺诈、误导销售或保单取消等情形，保司有权要求退回全部的 Extra Commission、SMPA 及 MA。",
      });
    }

    // 特定产品预警: Bright Universal Life RMB + 首年 + 保费 > 300,000
    const isBright = input.productName
      .toLowerCase()
      .includes("bright universal life");
    if (isBright && isFirstYear && input.premiumAmount > 300000) {
      banners.push({
        level: "danger",
        text: "⚠️ 全额退佣预警：由于总缴保费 ＞ HK$300,000，若保单生效后首 12 个月内单次或累计提取金额 ≥ 总保费的 50%，将全额退回 (Claw Back) 已发放的 SMPA 津贴。",
      });
    }

    return banners;
  }
}
