import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { createPool, createDb, type Db } from "./db/client";
import {
  commissionConfig,
  product,
  unhandledQuery,
  type CommissionConfigInsert,
  type CommissionConfigRow,
  type ProductInsert,
  type ProductRow,
} from "./db/schema";

export interface VersionKey {
  productName: string;
  premiumTerm: string;
  investorStatus: string;
  effectiveDate: string;
}

/** PostgreSQL 配置仓库: 费率版本读写 + 发布日落事务 + 未命中池。 */
@Injectable()
export class ConfigRepository implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly db: Db;

  constructor() {
    this.pool = createPool();
    this.db = createDb(this.pool);
  }

  onModuleDestroy(): Promise<void> {
    return this.pool.end();
  }

  listActiveConfigs(): Promise<CommissionConfigRow[]> {
    return this.db
      .select()
      .from(commissionConfig)
      .where(eq(commissionConfig.status, "Active"));
  }

  listProducts(): Promise<ProductRow[]> {
    return this.db.select().from(product);
  }

  listVersions(productName: string): Promise<CommissionConfigRow[]> {
    return this.db
      .select()
      .from(commissionConfig)
      .where(eq(commissionConfig.productName, productName));
  }

  async recordUnhandled(
    kind: "unhandled" | "feedback",
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(unhandledQuery).values({ kind, payload });
  }

  async upsertProduct(p: ProductInsert): Promise<void> {
    await this.db
      .insert(product)
      .values(p)
      .onConflictDoUpdate({
        target: product.productName,
        set: {
          company: p.company,
          terms: p.terms,
          requiredSlots: p.requiredSlots,
          singlePay: p.singlePay,
        },
      });
  }

  /**
   * 导入管道写入草稿态配置 (需求书 5.4 草稿态隔离)。
   * 同 key+生效日 再次导入 (运营改错重传) 时覆盖仍是 Draft 的行;
   * 已发布的 Active/Sunset 版本绝不被导入改动 (setWhere 守护), 计入 blocked。
   * 返回真实落库数, 避免 UI "导入成功" 但实际未写入的假象。
   */
  async insertDrafts(
    rows: CommissionConfigInsert[],
  ): Promise<{ staged: number; blocked: number }> {
    if (!rows.length) return { staged: 0, blocked: 0 };
    const res = await this.db
      .insert(commissionConfig)
      .values(rows.map((r) => ({ ...r, status: "Draft" as const })))
      .onConflictDoUpdate({
        target: [
          commissionConfig.productName,
          commissionConfig.premiumTerm,
          commissionConfig.investorStatus,
          commissionConfig.effectiveDate,
        ],
        set: {
          ratesData: sql`excluded.rates_data`,
          company: sql`excluded.company`,
          status: "Draft",
        },
        setWhere: eq(commissionConfig.status, "Draft"),
      })
      .returning({ id: commissionConfig.id });
    return { staged: res.length, blocked: rows.length - res.length };
  }

  /**
   * 发布: 版本日落 + 平滑切换 (需求书 5.4 Step4)。单事务保证:
   *  1) 同 key 历史 Active → Sunset, effectiveEndDate = 新版生效日前一天 (严禁物理删除)
   *  2) 该 effectiveDate 的 Draft → Active
   */
  async publish(key: VersionKey): Promise<void> {
    const end = new Date(`${key.effectiveDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    const sunsetDate = end.toISOString().slice(0, 10);

    await this.db.transaction(async (tx) => {
      await tx
        .update(commissionConfig)
        .set({ status: "Sunset", effectiveEndDate: sunsetDate })
        .where(
          and(
            eq(commissionConfig.productName, key.productName),
            eq(commissionConfig.premiumTerm, key.premiumTerm),
            eq(commissionConfig.investorStatus, key.investorStatus),
            eq(commissionConfig.status, "Active"),
          ),
        );
      await tx
        .update(commissionConfig)
        .set({ status: "Active" })
        .where(
          and(
            eq(commissionConfig.productName, key.productName),
            eq(commissionConfig.premiumTerm, key.premiumTerm),
            eq(commissionConfig.investorStatus, key.investorStatus),
            eq(commissionConfig.effectiveDate, key.effectiveDate),
          ),
        );
    });
  }

  listDrafts(): Promise<CommissionConfigRow[]> {
    return this.db
      .select()
      .from(commissionConfig)
      .where(eq(commissionConfig.status, "Draft"));
  }

  listDraftsByDate(effectiveDate: string): Promise<CommissionConfigRow[]> {
    return this.db
      .select()
      .from(commissionConfig)
      .where(
        and(
          eq(commissionConfig.status, "Draft"),
          eq(commissionConfig.effectiveDate, effectiveDate),
        ),
      );
  }

  /** 一键回滚: 当前 Active → Sunset, 最近一个 Sunset 版本 → Active (需求书 5.5) */
  async rollback(key: {
    productName: string;
    premiumTerm: string;
    investorStatus: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    return this.db.transaction(async (tx) => {
      const versions = await tx
        .select()
        .from(commissionConfig)
        .where(
          and(
            eq(commissionConfig.productName, key.productName),
            eq(commissionConfig.premiumTerm, key.premiumTerm),
            eq(commissionConfig.investorStatus, key.investorStatus),
          ),
        );
      const active = versions.find((v) => v.status === "Active");
      if (!active) return { ok: false, reason: "无生效版本可回滚" };
      // 上一稳定版本 = 生效日严格早于当前 Active 的最近一个 Sunset
      // (否则连续回滚会复活刚退役的更新版本, 在版本间来回震荡)
      const prev = versions
        .filter(
          (v) => v.status === "Sunset" && v.effectiveDate < active.effectiveDate,
        )
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1))[0];
      if (!prev) {
        return { ok: false, reason: "无更早的历史版本可回滚" };
      }
      await tx
        .update(commissionConfig)
        .set({ status: "Sunset" })
        .where(eq(commissionConfig.id, active.id));
      await tx
        .update(commissionConfig)
        .set({ status: "Active", effectiveEndDate: null })
        .where(eq(commissionConfig.id, prev.id));
      return { ok: true };
    });
  }
}
