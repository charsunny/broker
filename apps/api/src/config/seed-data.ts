import type { RatesByYear } from "@insurance/contracts";
import type { ProductMeta } from "../engines/engine.types";

/**
 * 演示种子数据 (取自需求书 4.2(2) JSONB 示例)。
 * 单一事实源: 既被 ConfigStore.seedDemo() 用于离线单测, 也被 db/seed.ts 灌入 PostgreSQL。
 */
export const SEED_EFFECTIVE_DATE = "2026-01-01";

export const SEED_PRODUCTS: ProductMeta[] = [
  {
    company: "Sun Life",
    productName: "SunJoy Global 2",
    terms: ["2", "5", "10", "Single"],
    requiredSlots: ["productName", "premiumTerm", "investorStatus"],
  },
  {
    company: "Sun Life",
    productName: "Generations II",
    terms: ["5", "10", "Single"],
    requiredSlots: ["productName", "premiumTerm", "investorStatus"],
  },
  {
    company: "Sun Life",
    productName: "Bright Universal Life (RMB)",
    terms: ["Single"],
    requiredSlots: ["productName", "premiumAmount", "investorStatus"],
    singlePay: true,
  },
];

export interface SeedConfig {
  company: string;
  productName: string;
  premiumTerm: string;
  investorStatus: string;
  ratesByYear: RatesByYear;
}

export const SEED_CONFIGS: SeedConfig[] = [
  {
    company: "Sun Life",
    productName: "SunJoy Global 2",
    premiumTerm: "5",
    investorStatus: "Non-PI",
    ratesByYear: {
      "1": { basicRate: 0.25, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "2": { basicRate: 0.027, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "3": { basicRate: 0.027, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "4": { basicRate: 0.027, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "5": { basicRate: 0.027, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "6": { basicRate: 0.0, allowances: { extra: 0, smpa: 0, ma: 0 } },
    },
  },
  {
    company: "Sun Life",
    productName: "SunJoy Global 2",
    premiumTerm: "5",
    investorStatus: "PI",
    ratesByYear: {
      "1": { basicRate: 0.25, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "2": { basicRate: 0.027, allowances: { extra: 0, smpa: 0, ma: 0 } },
      "3": { basicRate: 0.027, allowances: { extra: 0, smpa: 0, ma: 0 } },
      "4": { basicRate: 0.027, allowances: { extra: 0, smpa: 0, ma: 0 } },
      "5": { basicRate: 0.027, allowances: { extra: 0, smpa: 0, ma: 0 } },
    },
  },
  {
    company: "Sun Life",
    productName: "Generations II",
    premiumTerm: "5",
    investorStatus: "Non-PI",
    ratesByYear: {
      "1": { basicRate: 0.22, allowances: { extra: 0.5, smpa: 0.3, ma: 0.1 } },
      "2": { basicRate: 0.02, allowances: { extra: 0.5, smpa: 0.3, ma: 0.1 } },
      "3": { basicRate: 0.0, allowances: { extra: 0, smpa: 0, ma: 0 } },
    },
  },
  {
    company: "Sun Life",
    productName: "Bright Universal Life (RMB)",
    premiumTerm: "Single",
    investorStatus: "PI",
    ratesByYear: {
      "1": { basicRate: 0.05, allowances: { extra: 0.0, smpa: 0.4, ma: 0.0 } },
    },
  },
  {
    company: "Sun Life",
    productName: "Bright Universal Life (RMB)",
    premiumTerm: "Single",
    investorStatus: "Non-PI",
    ratesByYear: {
      "1": { basicRate: 0.05, allowances: { extra: 0.0, smpa: 0.4, ma: 0.0 } },
      "2": { basicRate: 0.01, allowances: { extra: 0.0, smpa: 0.4, ma: 0.0 } },
    },
  },
];
