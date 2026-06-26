import type { InvestorStatus, RiskBanner, SlotKey } from "@insurance/contracts";

/** 引擎计算入参 (需求书 4.2(1) 5 个确定性维度) */
export interface CalcInput {
  company: string;
  productName: string;
  premiumTerm: string;
  investorStatus: InvestorStatus;
  premiumAmount: number;
  /** 目标查询保单年度; 不传则计算配置覆盖的全部年度 */
  policyYear?: number | null;
}

/** 单一保单年度的测算明细 */
export interface YearBreakdown {
  year: number;
  basicRate: number;
  basicComm: number;
  extra: number;
  smpa: number;
  ma: number;
  allowanceTotal: number;
  totalComm: number;
}

/** 一次完整测算的结果 (无状态纯函数输出) */
export interface CommissionResult {
  company: string;
  productName: string;
  premiumTerm: string;
  investorStatus: string;
  premiumAmount: number;
  /** 首年总佣金率 (totalComm_1 / premium), 用于卡片 Hero Number */
  firstYearTotalRate: number;
  firstYearTotalAmount: number;
  breakdown: YearBreakdown[];
  /** 由 RiskInterceptor 追加的预警 */
  warnings: RiskBanner[];
}

/** 产品元数据: 驱动反问选项与必填槽位 (需求书 4.2) */
export interface ProductMeta {
  company: string;
  productName: string;
  /** 可选缴费年期, 用于 premiumTerm 的 Choice Chips */
  terms: string[];
  /** 该产品触发测算所需的必填槽位 (覆盖全局默认) */
  requiredSlots: SlotKey[];
  /** 趸交单一产品 (如 Bright Universal Life RMB), 默认 premiumTerm=Single */
  singlePay?: boolean;
}

/** 费率配置的业务联合主键 */
export interface RatesKey {
  productName: string;
  premiumTerm: string;
  investorStatus: string;
}
