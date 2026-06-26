import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { ExcelImportService, ImportValidationError } from "./excel-import.service";

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function validWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const b = wb.addWorksheet("Basic_Commission");
  b.addRow(["Product", "Term", "Yr 1", "Yr 2", "Yr 3-5", "Yr 6"]);
  b.addRow(["SunJoy Global 2", "5", 0.25, 0.027, 0.027, 0.0]);
  const a = wb.addWorksheet("Allowances_Schedule");
  a.addRow(["Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA"]);
  a.addRow(["SunJoy Global 2", "5", "Non-PI", "1-5", 0.6, 0.35, 0.18]);
  a.addRow(["SunJoy Global 2", "5", "PI", "1", 0.6, 0.35, 0.18]);
  return wb;
}

const svc = new ExcelImportService();

describe("ExcelImportService 导入管道 (需求书 5.4)", () => {
  it("逆向展平 + 两表 Join + 文件名提取生效日", async () => {
    const buf = await toBuffer(validWorkbook());
    const res = await svc.parse(buf, "SunLife_Rates_20260101生效.xlsx");

    expect(res.effectiveDate).toBe("2026-01-01");
    expect(res.company).toBe("Sun Life");
    expect(res.configs.length).toBe(2);

    const nonPi = res.configs.find((c) => c.investorStatus === "Non-PI")!;
    // "Yr 3-5" 展平为 3/4/5
    expect(Object.keys(nonPi.ratesByYear).sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(nonPi.ratesByYear["1"]!.basicRate).toBe(0.25);
    expect(nonPi.ratesByYear["3"]!.allowances.extra).toBe(0.6); // 3 ∈ 1-5
    expect(nonPi.ratesByYear["6"]!.allowances.extra).toBe(0); // 6 ∉ 1-5 → 置 0

    const pi = res.configs.find((c) => c.investorStatus === "PI")!;
    expect(pi.ratesByYear["1"]!.allowances.smpa).toBe(0.35); // PI 仅首年
    expect(pi.ratesByYear["2"]!.allowances.smpa).toBe(0); // 2 ∉ [1]

    expect(res.products[0]!.productName).toBe("SunJoy Global 2");
    expect(res.products[0]!.terms).toEqual(["5"]);
  });

  it("熔断: 费率填成 '20%' 文本 → 报错带 Sheet+行+列", async () => {
    const wb = validWorkbook();
    wb.getWorksheet("Basic_Commission")!.addRow(["BadProd", "5", "20%", 0.02, 0.02, 0]);
    const buf = await toBuffer(wb);

    await expect(svc.parse(buf, "SunLife_Rates_20260101.xlsx")).rejects.toThrow(
      ImportValidationError,
    );
    try {
      await svc.parse(buf, "SunLife_Rates_20260101.xlsx");
    } catch (e) {
      const err = e as ImportValidationError;
      expect(err.detail.sheet).toBe("Basic_Commission");
      expect(err.detail.column).toBe("Yr 1");
      expect(err.detail.row).toBe(3);
      expect(err.detail.reason).toMatch(/小数|百分号|文本/);
    }
  });

  it("熔断: 年度范围超出 1-100 (Yr 1-200) → 报错", async () => {
    const wb = new ExcelJS.Workbook();
    const b = wb.addWorksheet("Basic_Commission");
    b.addRow(["Product", "Term", "Yr 1-200"]);
    b.addRow(["X", "5", 0.1]);
    wb.addWorksheet("Allowances_Schedule").addRow([
      "Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA",
    ]);
    const buf = await toBuffer(wb);

    await expect(svc.parse(buf, "SunLife_Rates_20260101.xlsx")).rejects.toThrow(
      /1-100/,
    );
  });

  it("熔断: EligibleYears 无法解析 (如 '1;3') → 报错 (审查修复)", async () => {
    const wb = new ExcelJS.Workbook();
    const b = wb.addWorksheet("Basic_Commission");
    b.addRow(["Product", "Term", "Yr 1"]);
    b.addRow(["X", "5", 0.1]);
    const a = wb.addWorksheet("Allowances_Schedule");
    a.addRow(["Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA"]);
    a.addRow(["X", "5", "Non-PI", "1;3", 0.5, 0.3, 0.1]);
    await expect(
      svc.parse(await toBuffer(wb), "SunLife_Rates_20260101.xlsx"),
    ).rejects.toThrow(/EligibleYears/);
  });

  it("支持逗号列表 EligibleYears '1,3' → 仅 1/3 有津贴 (审查修复)", async () => {
    const wb = new ExcelJS.Workbook();
    const b = wb.addWorksheet("Basic_Commission");
    b.addRow(["Product", "Term", "Yr 1", "Yr 2", "Yr 3"]);
    b.addRow(["X", "5", 0.1, 0.1, 0.1]);
    const a = wb.addWorksheet("Allowances_Schedule");
    a.addRow(["Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA"]);
    a.addRow(["X", "5", "Non-PI", "1,3", 0.5, 0.3, 0.1]);
    const res = await svc.parse(await toBuffer(wb), "SunLife_Rates_20260101.xlsx");
    const c = res.configs[0]!;
    expect(c.ratesByYear["1"]!.allowances.extra).toBe(0.5);
    expect(c.ratesByYear["2"]!.allowances.extra).toBe(0);
    expect(c.ratesByYear["3"]!.allowances.extra).toBe(0.5);
  });

  it("熔断: 重叠年度列 (Yr 1-5 与 Yr 5) → 报错 (审查修复)", async () => {
    const wb = new ExcelJS.Workbook();
    const b = wb.addWorksheet("Basic_Commission");
    b.addRow(["Product", "Term", "Yr 1-5", "Yr 5"]);
    b.addRow(["X", "5", 0.1, 0.2]);
    wb.addWorksheet("Allowances_Schedule").addRow([
      "Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA",
    ]);
    await expect(
      svc.parse(await toBuffer(wb), "SunLife_Rates_20260101.xlsx"),
    ).rejects.toThrow(/重复覆盖/);
  });
});
