import { describe, it, expect, beforeAll, afterAll } from "vitest";
import ExcelJS from "exceljs";
import { Pool } from "pg";
import { ConfigRepository } from "../config.repository";
import { ConfigStore } from "../../engines/config.store";
import { ConfigWarmupService } from "../config-warmup.service";
import { SunLifeEngine } from "../../engines/sunlife.engine";
import { EngineRegistry } from "../../engines/engine.registry";
import { SandboxRunner } from "../../sandbox/sandbox.runner";
import { DryRunService } from "../../sandbox/dry-run.service";
import { ExcelImportService } from "../import/excel-import.service";
import { AdminConfigService } from "./admin-config.service";
import { databaseUrl } from "../db/client";

const PROD = "__ADMIN_TEST_PROD__";

async function xlsx(tag: string): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const b = wb.addWorksheet("Basic_Commission");
  b.addRow(["Product", "Term", "Yr 1", "Yr 2"]);
  b.addRow([PROD, "5", 0.2, 0.02]);
  const a = wb.addWorksheet("Allowances_Schedule");
  a.addRow(["Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA"]);
  a.addRow([PROD, "5", "Non-PI", "1-2", 0.5, 0.3, 0.1]);
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `SunLife_Rates_${tag}生效.xlsx`,
  };
}

/** 集成测试: Admin HITL 闭环。需真实 PG。 */
describe("AdminConfigService HITL 闭环", () => {
  const repo = new ConfigRepository();
  const store = new ConfigStore();
  const warmup = new ConfigWarmupService(repo, store);
  const sandbox = new SandboxRunner();
  const dryRun = new DryRunService(sandbox);
  const registry = new EngineRegistry(new SunLifeEngine(store));
  const admin = new AdminConfigService(
    new ExcelImportService(),
    repo,
    warmup,
    dryRun,
    sandbox,
    registry,
  );
  const pool = new Pool({ connectionString: databaseUrl() });

  const clean = async () => {
    await pool.query("delete from commission_config where product_name=$1", [PROD]);
    await pool.query("delete from product where product_name=$1", [PROD]);
  };

  beforeAll(clean);
  afterAll(async () => {
    await clean();
    await pool.end();
    await repo.onModuleDestroy();
  });

  it("导入→草稿→审批(Active+热重载)→二次审批(旧版日落)→一键回滚", async () => {
    // v1 导入 + 审批
    const v1 = await xlsx("20260101");
    const imp1 = await admin.importExcel(v1.buffer, v1.filename);
    expect(imp1.report.passed).toBe(true);
    expect(imp1.drafts).toBe(1);
    expect((await admin.listPending()).some((d) => d.productName === PROD)).toBe(true);

    await admin.approve("2026-01-01");
    // 热重载后内存里能查到
    expect(
      store.getRates({ productName: PROD, premiumTerm: "5", investorStatus: "Non-PI" }),
    ).not.toBeNull();

    // v2 导入 + 审批 → v1 日落
    const v2 = await xlsx("20260601");
    await admin.importExcel(v2.buffer, v2.filename);
    await admin.approve("2026-06-01");
    const versions = await admin.matrix(PROD);
    expect(versions.find((r) => r.effectiveDate === "2026-01-01")?.status).toBe("Sunset");
    expect(versions.find((r) => r.effectiveDate === "2026-06-01")?.status).toBe("Active");

    // 一键回滚 → v1 复活, v2 日落
    const rb = await admin.rollback(PROD, "5", "Non-PI");
    expect(rb.ok).toBe(true);
    const after = await admin.matrix(PROD);
    expect(after.find((r) => r.effectiveDate === "2026-01-01")?.status).toBe("Active");
    expect(after.find((r) => r.effectiveDate === "2026-06-01")?.status).toBe("Sunset");
  });

  it("deployDynamic: 负数代码被拒, 健康代码热挂载成功", async () => {
    await expect(
      admin.deployDynamic("TestCo", "function calculate(){ return { totalComm: -5 }; }"),
    ).rejects.toThrow();

    const ok = await admin.deployDynamic(
      "TestCo",
      "function calculate(i){ return { firstYearTotalRate: 0.1, firstYearTotalAmount: i.premiumAmount * 0.1, breakdown: [] }; }",
    );
    expect(ok.deployed).toBe(true);
    expect(registry.resolve("TestCo")).not.toBeNull();
  });

  it("同生效日再导入: 覆盖草稿, 已发布版本不被覆盖 (审查修复)", async () => {
    const v = await xlsx("20270101");
    const imp1 = await admin.importExcel(v.buffer, v.filename);
    expect(imp1.drafts).toBe(1);
    // 仍是草稿时再导入同日期 → 覆盖, 仍 1 条
    const imp2 = await admin.importExcel(v.buffer, v.filename);
    expect(imp2.drafts).toBe(1);
    // 发布后再导入同日期 → blocked, 不覆盖已发布版本
    await admin.approve("2027-01-01");
    const imp3 = await admin.importExcel(v.buffer, v.filename);
    expect(imp3.drafts).toBe(0);
    expect(imp3.blocked).toBe(1);
  });
});
