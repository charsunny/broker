import { createPool, createDb } from "./client";
import { commissionConfig, product } from "./schema";
import { SEED_CONFIGS, SEED_PRODUCTS, SEED_EFFECTIVE_DATE } from "../seed-data";

/**
 * 演示种子: 把内存种子数据灌入 PostgreSQL, 全部标记 Active。
 * 幂等 (先清后插)。生产环境走 Admin 导入管道 (#6), 不用这个脚本。
 */
async function main(): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);

  await db.delete(commissionConfig);
  await db.delete(product);

  await db.insert(product).values(
    SEED_PRODUCTS.map((p) => ({
      productName: p.productName,
      company: p.company,
      terms: p.terms,
      requiredSlots: p.requiredSlots,
      singlePay: p.singlePay ?? false,
    })),
  );

  await db.insert(commissionConfig).values(
    SEED_CONFIGS.map((c) => ({
      company: c.company,
      productName: c.productName,
      premiumTerm: c.premiumTerm,
      investorStatus: c.investorStatus,
      effectiveDate: SEED_EFFECTIVE_DATE,
      status: "Active" as const,
      ratesData: c.ratesByYear,
    })),
  );

  console.log(
    `[seed] ${SEED_PRODUCTS.length} products, ${SEED_CONFIGS.length} configs (Active @ ${SEED_EFFECTIVE_DATE})`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
