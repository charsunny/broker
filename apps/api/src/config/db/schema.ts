import {
  pgTable,
  serial,
  text,
  date,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { RatesByYear } from "@insurance/contracts";

/**
 * 费率配置物理表 (需求书 4.2(2) / 5.4)。
 * 高内聚单一表 + JSONB 载体 + 版本日落: 只追加不物理删除, 旧版本靠 status + 日期轴追溯。
 */
export const commissionConfig = pgTable(
  "commission_config",
  {
    id: serial("id").primaryKey(),
    company: text("company").notNull(),
    productName: text("product_name").notNull(),
    premiumTerm: text("premium_term").notNull(),
    investorStatus: text("investor_status").notNull(),
    /** 生效日 (由 Excel 文件名提取, 需求书 5.4 Step1) */
    effectiveDate: date("effective_date").notNull(),
    /** 日落日: 旧版本被新版本顶替时, 自动设为新版生效日前一天 */
    effectiveEndDate: date("effective_end_date"),
    status: text("status", { enum: ["Draft", "Active", "Sunset"] })
      .notNull()
      .default("Draft"),
    /** O(1) 取全年费率 */
    ratesData: jsonb("rates_data").$type<RatesByYear>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqVersion: uniqueIndex("uq_config_version").on(
      t.productName,
      t.premiumTerm,
      t.investorStatus,
      t.effectiveDate,
    ),
    ixActive: index("ix_config_active").on(t.status, t.productName),
  }),
);

/** 产品元数据: 驱动反问选项与必填槽位 (需求书 4.2) */
export const product = pgTable("product", {
  productName: text("product_name").primaryKey(),
  company: text("company").notNull(),
  terms: jsonb("terms").$type<string[]>().notNull().default([]),
  requiredSlots: jsonb("required_slots")
    .$type<string[]>()
    .notNull()
    .default(["productName", "premiumTerm", "investorStatus"]),
  singlePay: boolean("single_pay").notNull().default(false),
});

/** 未命中需求池 (需求书 5.3 Step1) */
export const unhandledQuery = pgTable("unhandled_query", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // 'unhandled' | 'feedback'
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CommissionConfigRow = typeof commissionConfig.$inferSelect;
export type CommissionConfigInsert = typeof commissionConfig.$inferInsert;
export type ProductRow = typeof product.$inferSelect;
export type ProductInsert = typeof product.$inferInsert;
