import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { RatesByYear, SlotKey } from "@insurance/contracts";
import type { ProductMeta } from "../../engines/engine.types";

const REQ_SINGLE: SlotKey[] = ["productName", "premiumAmount", "investorStatus"];
const REQ_REGULAR: SlotKey[] = ["productName", "premiumTerm", "investorStatus"];

export interface ImportedConfig {
  company: string;
  productName: string;
  premiumTerm: string;
  investorStatus: string;
  ratesByYear: RatesByYear;
}

export interface ImportResult {
  effectiveDate: string;
  company: string;
  products: ProductMeta[];
  configs: ImportedConfig[];
}

/** 熔断校验错误: 携带具体 Sheet + 行号/列名, 打回让运营修改 (需求书 5.4 Step2) */
export class ImportValidationError extends Error {
  constructor(
    public readonly detail: {
      sheet: string;
      row?: number;
      column?: string;
      reason: string;
    },
  ) {
    super(`[${detail.sheet}] ${detail.reason}`);
    this.name = "ImportValidationError";
  }
}

const SHEET_BASIC = "Basic_Commission";
const SHEET_ALLOW = "Allowances_Schedule";

// 费率必须是小数 (拒绝 "20%"/"百分之二十" 等字符串; basic ≤1, 津贴乘数允许 >1)
const RateCell = z.number().min(0).max(10);
const MAX_POLICY_YEAR = 100;

const COMPANY_ALIAS: Record<string, string> = {
  sunlife: "Sun Life",
  manulife: "Manulife",
  yflife: "YF Life",
  chubb: "Chubb",
};

@Injectable()
export class ExcelImportService {
  /**
   * 解析"矩阵式 Excel" → 逆向展平 + Zod 熔断校验 + 两表 Join → JSONB 聚合。
   * 不写库; 由 HITL 服务在沙箱 dry-run 通过后插入 Draft。
   */
  async parse(buffer: Buffer, filename: string): Promise<ImportResult> {
    const effectiveDate = this.extractDate(filename);
    const company = this.extractCompany(filename);

    const wb = new ExcelJS.Workbook();
    // @types/node 22 的泛型 Buffer 与 exceljs 类型有摩擦, 运行时无碍, 仅做类型转换
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const basic = this.parseBasic(wb); // Map<"product::term", {year: basicRate}>
    const allowRows = this.parseAllowances(wb);

    // 两表 Join: 基础佣金对所有身份相同; 津贴按身份, 超出 eligibleYears 的年份置 0
    const configs: ImportedConfig[] = [];
    const productTerms = new Map<string, Set<string>>();

    for (const a of allowRows) {
      const key = this.key(a.product, a.term);
      const basics = basic.get(key);
      if (!basics) {
        throw new ImportValidationError({
          sheet: SHEET_ALLOW,
          row: a.row,
          reason: `津贴表里的 (${a.product} / ${a.term}) 在基础佣金表中找不到对应行`,
        });
      }
      const elig = new Set(a.eligibleYears);
      const ratesByYear: RatesByYear = {};
      for (const [yearStr, basicRate] of Object.entries(basics)) {
        const inElig = elig.has(Number(yearStr));
        ratesByYear[yearStr] = {
          basicRate,
          allowances: inElig
            ? { extra: a.extra, smpa: a.smpa, ma: a.ma }
            : { extra: 0, smpa: 0, ma: 0 },
        };
      }
      configs.push({
        company,
        productName: a.product,
        premiumTerm: a.term,
        investorStatus: a.investor,
        ratesByYear,
      });

      if (!productTerms.has(a.product)) productTerms.set(a.product, new Set());
      productTerms.get(a.product)!.add(a.term);
    }

    const products: ProductMeta[] = [...productTerms.entries()].map(
      ([productName, termSet]) => {
        const terms = [...termSet];
        const singlePay = terms.length === 1 && terms[0] === "Single";
        return {
          company,
          productName,
          terms,
          requiredSlots: singlePay ? REQ_SINGLE : REQ_REGULAR,
          singlePay,
        };
      },
    );

    return { effectiveDate, company, products, configs };
  }

  // ---- 文件名元数据 ----
  private extractDate(filename: string): string {
    const m = filename.match(/(\d{4})(\d{2})(\d{2})/);
    if (!m) {
      throw new ImportValidationError({
        sheet: "filename",
        reason: `文件名缺少 8 位生效日期 (如 SunLife_Rates_20260101生效.xlsx): ${filename}`,
      });
    }
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  private extractCompany(filename: string): string {
    const m = filename.match(/^([A-Za-z]+)[_-]/);
    const raw = (m?.[1] ?? "").toLowerCase();
    return COMPANY_ALIAS[raw] ?? (m?.[1] ?? "Unknown");
  }

  // ---- 矩阵逆向展平 ----
  /** "Yr 3-5" | "3-5" | "Yr 1" | "1" → [3,4,5] / [1]; 非年份列返回 null */
  private meltRange(header: string, sheet: string, column: string): number[] | null {
    const cleaned = header.replace(/yr\.?\s*/i, "").trim();
    const range = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a > b || b > MAX_POLICY_YEAR) {
        throw new ImportValidationError({
          sheet,
          column,
          reason: `保单年度范围非法或超出 1-${MAX_POLICY_YEAR}: "${header}"`,
        });
      }
      return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    }
    const single = cleaned.match(/^(\d+)$/);
    if (single) {
      const y = Number(single[1]);
      if (y > MAX_POLICY_YEAR) {
        throw new ImportValidationError({
          sheet,
          column,
          reason: `保单年度超出 1-${MAX_POLICY_YEAR}: "${header}"`,
        });
      }
      return [y];
    }
    return null;
  }

  /** 解析 EligibleYears: 支持 "1" / "1-5" / "1,3,5"; 空或无法解析则熔断 (绝不静默置 0) */
  private parseEligibleYears(raw: string, row: number): number[] {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new ImportValidationError({
        sheet: SHEET_ALLOW,
        row,
        column: "EligibleYears",
        reason: "EligibleYears 不能为空",
      });
    }
    const years = new Set<number>();
    const tokens = trimmed
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tok of tokens) {
      const parsed = this.meltRange(tok, SHEET_ALLOW, "EligibleYears");
      if (parsed === null) {
        throw new ImportValidationError({
          sheet: SHEET_ALLOW,
          row,
          column: "EligibleYears",
          reason: `无法解析 EligibleYears: "${raw}"`,
        });
      }
      for (const y of parsed) years.add(y);
    }
    return [...years];
  }

  private cellNumber(value: unknown, sheet: string, row: number, column: string): number {
    const parsed = RateCell.safeParse(typeof value === "object" && value !== null && "result" in value ? (value as { result: unknown }).result : value);
    if (!parsed.success) {
      throw new ImportValidationError({
        sheet,
        row,
        column,
        reason: `费率必须是 0-10 的小数 (疑似填了百分号/文本): 实际值 "${String(value)}"`,
      });
    }
    return parsed.data;
  }

  private headerMap(ws: ExcelJS.Worksheet): Map<number, string> {
    const map = new Map<number, string>();
    ws.getRow(1).eachCell((cell, col) => {
      map.set(col, String(cell.value ?? "").trim());
    });
    return map;
  }

  private parseBasic(wb: ExcelJS.Workbook): Map<string, Record<string, number>> {
    const ws = wb.getWorksheet(SHEET_BASIC);
    if (!ws) {
      throw new ImportValidationError({
        sheet: SHEET_BASIC,
        reason: `缺少工作表 ${SHEET_BASIC}`,
      });
    }
    const headers = this.headerMap(ws);
    const yearCols = new Map<number, number[]>();
    let productCol = 0;
    let termCol = 0;
    for (const [col, h] of headers) {
      if (/^product$/i.test(h)) productCol = col;
      else if (/^(term|payment\s*type)$/i.test(h)) termCol = col;
      else {
        const years = this.meltRange(h, SHEET_BASIC, h);
        if (years) yearCols.set(col, years);
      }
    }
    if (!productCol || !termCol || yearCols.size === 0) {
      throw new ImportValidationError({
        sheet: SHEET_BASIC,
        reason: "表头需包含 Product / Term 及至少一个年度列 (如 Yr 1, Yr 3-5)",
      });
    }

    const out = new Map<string, Record<string, number>>();
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const product = String(row.getCell(productCol).value ?? "").trim();
      const term = String(row.getCell(termCol).value ?? "").trim();
      if (!product) continue;
      const rates: Record<string, number> = {};
      for (const [col, years] of yearCols) {
        const v = this.cellNumber(
          row.getCell(col).value,
          SHEET_BASIC,
          r,
          headers.get(col) ?? `col${col}`,
        );
        for (const y of years) {
          const key = String(y);
          if (key in rates) {
            // 年度列重叠 (如 'Yr 1-5' 与 'Yr 5-10' 都含第 5 年) → 静默覆盖会算错佣金
            throw new ImportValidationError({
              sheet: SHEET_BASIC,
              row: r,
              column: headers.get(col) ?? `col${col}`,
              reason: `保单年度 ${y} 被多个年度列重复覆盖`,
            });
          }
          rates[key] = v;
        }
      }
      out.set(this.key(product, term), rates);
    }
    return out;
  }

  private parseAllowances(wb: ExcelJS.Workbook): Array<{
    product: string;
    term: string;
    investor: string;
    eligibleYears: number[];
    extra: number;
    smpa: number;
    ma: number;
    row: number;
  }> {
    const ws = wb.getWorksheet(SHEET_ALLOW);
    if (!ws) {
      throw new ImportValidationError({
        sheet: SHEET_ALLOW,
        reason: `缺少工作表 ${SHEET_ALLOW}`,
      });
    }
    const headers = this.headerMap(ws);
    const colOf = (re: RegExp): number => {
      for (const [col, h] of headers) if (re.test(h)) return col;
      return 0;
    };
    const cProduct = colOf(/^product$/i);
    const cTerm = colOf(/^(term|payment\s*type)$/i);
    const cInvestor = colOf(/^investor(\s*status)?$/i);
    const cElig = colOf(/^eligible(\s*years)?$/i);
    const cExtra = colOf(/^extra$/i);
    const cSmpa = colOf(/^smpa$/i);
    const cMa = colOf(/^ma$/i);
    if (!cProduct || !cTerm || !cInvestor || !cElig || !cExtra || !cSmpa || !cMa) {
      throw new ImportValidationError({
        sheet: SHEET_ALLOW,
        reason:
          "表头需包含 Product / Term / Investor / EligibleYears / Extra / SMPA / MA",
      });
    }

    const rows = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const product = String(row.getCell(cProduct).value ?? "").trim();
      if (!product) continue;
      const term = String(row.getCell(cTerm).value ?? "").trim();
      const investor = String(row.getCell(cInvestor).value ?? "").trim();
      const eligRaw = String(row.getCell(cElig).value ?? "").trim();
      const eligibleYears = this.parseEligibleYears(eligRaw, r);
      rows.push({
        product,
        term,
        investor,
        eligibleYears,
        extra: this.cellNumber(row.getCell(cExtra).value, SHEET_ALLOW, r, "Extra"),
        smpa: this.cellNumber(row.getCell(cSmpa).value, SHEET_ALLOW, r, "SMPA"),
        ma: this.cellNumber(row.getCell(cMa).value, SHEET_ALLOW, r, "MA"),
        row: r,
      });
    }
    return rows;
  }

  private key(product: string, term: string): string {
    return `${product.toLowerCase()}::${term.toLowerCase()}`;
  }
}
