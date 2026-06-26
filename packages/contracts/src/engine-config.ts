import { z } from "zod";

/**
 * 底层费率配置契约 (需求书 4.2(2) / 5.1)。
 *
 * 运营维护"矩阵式 Excel", 导入脚本逆向展平 + Join 两表后, 聚合成高内聚的
 * rates_by_year JSONB 结构入库。引擎查表为 O(1), 且津贴超出 eligibleYears 的
 * 年份已被脚本置 0 → 引擎统一做加法, 无需运行时 if-else 判空 (4.1 附注)。
 */

/** 单一年度的津贴乘数 (均以"当年基础佣金"为乘数基数, 非保费) */
export const Allowances = z.object({
  /** 额外佣金乘数 (占基础佣金的百分比) */
  extra: z.number().min(0),
  /** 特别月度生产津贴 SMPA 乘数 */
  smpa: z.number().min(0),
  /** 市场营销津贴 MA 乘数 */
  ma: z.number().min(0),
});
export type Allowances = z.infer<typeof Allowances>;

/** 单一保单年度的费率 */
export const YearRates = z.object({
  /** 基础佣金率 (占保费的百分比) */
  basicRate: z.number().min(0),
  allowances: Allowances,
});
export type YearRates = z.infer<typeof YearRates>;

/**
 * 按保单年度散落的费率聚合体。key 为年度字符串 ("1".."30")。
 * 例: { "1": { basicRate: 0.25, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } } }
 */
export const RatesByYear = z.record(
  z.string().regex(/^\d+$/, "年度 key 必须是数字字符串"),
  YearRates,
);
export type RatesByYear = z.infer<typeof RatesByYear>;

/** 配置表的业务联合主键 (需求书 4.2(2) 联合唯一索引) */
export const ConfigKey = z.object({
  productName: z.string(),
  premiumTerm: z.string(),
  investorStatus: z.string(),
});
export type ConfigKey = z.infer<typeof ConfigKey>;

/** 配置版本状态 (需求书 5.4: 草稿态隔离 → 生效 → 日落) */
export const ConfigStatus = z.enum(["Draft", "Active", "Sunset"]);
export type ConfigStatus = z.infer<typeof ConfigStatus>;

/** 一条完整的费率配置记录 (落库前的内存形态) */
export const CommissionConfigRecord = ConfigKey.extend({
  /** 由 Excel 文件名正则提取, 如 '2026-01-01' (需求书 5.4 Step1) */
  effectiveDate: z.string(),
  effectiveEndDate: z.string().nullish(),
  status: ConfigStatus,
  ratesByYear: RatesByYear,
});
export type CommissionConfigRecord = z.infer<typeof CommissionConfigRecord>;
