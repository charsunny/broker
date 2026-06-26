import { Injectable } from "@nestjs/common";
import type { RatesByYear } from "@insurance/contracts";
import type { ProductMeta, RatesKey } from "./engine.types";
import { SEED_CONFIGS, SEED_PRODUCTS } from "../config/seed-data";

/**
 * 费率配置内存缓存 (需求书 4.2(2) / 5.1 + 7.4 规则字典内存预热)。
 *
 * 纯内存存储 + 同步查表, 与数据来源解耦:
 *  - 生产: ConfigWarmupService 启动时从 PostgreSQL 拉 Active 配置 → load()
 *  - 单测: 直接 seedDemo() 注入种子, 无需数据库
 * 引擎查表为 O(1)。津贴超出 eligibleYears 的年份在数据里已被置 0, 引擎统一做加法 (4.1 附注)。
 */
@Injectable()
export class ConfigStore {
  private readonly rates = new Map<string, RatesByYear>();
  private readonly products = new Map<string, ProductMeta>();

  private ratesKey(k: RatesKey): string {
    return [k.productName, k.premiumTerm, k.investorStatus]
      .map((s) => s.trim().toLowerCase())
      .join("::");
  }

  // ---- 写入 (由预热服务或种子调用) ----

  /** 全量替换缓存内容 (热重载安全: 先建后换) */
  load(
    products: ProductMeta[],
    configs: Array<{
      productName: string;
      premiumTerm: string;
      investorStatus: string;
      ratesByYear: RatesByYear;
    }>,
  ): void {
    this.rates.clear();
    this.products.clear();
    for (const p of products) this.products.set(p.productName.toLowerCase(), p);
    for (const c of configs) {
      this.rates.set(
        this.ratesKey({
          productName: c.productName,
          premiumTerm: c.premiumTerm,
          investorStatus: c.investorStatus,
        }),
        c.ratesByYear,
      );
    }
  }

  /** 注入演示种子 (离线单测 / 无库兜底) */
  seedDemo(): void {
    this.load(SEED_PRODUCTS, SEED_CONFIGS);
  }

  get size(): number {
    return this.rates.size;
  }

  // ---- 读取 (引擎 / 编排同步调用) ----

  getRates(k: RatesKey): RatesByYear | null {
    return this.rates.get(this.ratesKey(k)) ?? null;
  }

  listCompanies(): string[] {
    return [...new Set([...this.products.values()].map((p) => p.company))];
  }

  listProducts(company: string): ProductMeta[] {
    return [...this.products.values()].filter(
      (p) => p.company.toLowerCase() === company.trim().toLowerCase(),
    );
  }

  getProductMeta(productName: string): ProductMeta | null {
    return this.products.get(productName.trim().toLowerCase()) ?? null;
  }
}
