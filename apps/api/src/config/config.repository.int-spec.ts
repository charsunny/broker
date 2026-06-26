import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import type { RatesByYear } from "@insurance/contracts";
import { ConfigRepository } from "./config.repository";
import { databaseUrl } from "./db/client";

const P = "__TEST_SUNSET__";
const RATE: RatesByYear = {
  "1": { basicRate: 0.1, allowances: { extra: 0, smpa: 0, ma: 0 } },
};

/** 集成测试: 验证版本日落事务 (需求书 5.4 Step4)。需真实 PG。 */
describe("ConfigRepository 版本日落", () => {
  const repo = new ConfigRepository();
  const pool = new Pool({ connectionString: databaseUrl() });

  const cleanup = () =>
    pool.query("delete from commission_config where product_name=$1", [P]);

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await pool.end();
    await repo.onModuleDestroy();
  });

  it("发布新版本时旧 Active 自动 Sunset, effectiveEndDate = 新版生效日前一天", async () => {
    const key = { productName: P, premiumTerm: "5", investorStatus: "PI" };

    // 2026-01-01 草稿 → 发布 → Active
    await repo.insertDrafts([
      { company: "T", ...key, effectiveDate: "2026-01-01", ratesData: RATE },
    ]);
    await repo.publish({ ...key, effectiveDate: "2026-01-01" });

    // 2026-06-01 草稿 → 发布 → 旧版日落
    await repo.insertDrafts([
      { company: "T", ...key, effectiveDate: "2026-06-01", ratesData: RATE },
    ]);
    await repo.publish({ ...key, effectiveDate: "2026-06-01" });

    const rows = await repo.listVersions(P);
    const d1 = rows.find((r) => r.effectiveDate === "2026-01-01");
    const d2 = rows.find((r) => r.effectiveDate === "2026-06-01");

    expect(d1?.status).toBe("Sunset");
    expect(d1?.effectiveEndDate).toBe("2026-05-31"); // 新版前一天
    expect(d2?.status).toBe("Active");
    expect(d2?.effectiveEndDate).toBeNull();
    // 严禁物理删除: 两个版本都还在
    expect(rows.length).toBe(2);
  });
});
