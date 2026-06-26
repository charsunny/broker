import { Injectable } from "@nestjs/common";
import { SandboxRunner } from "./sandbox.runner";

export interface DryRunCase {
  name: string;
  ok: boolean;
  error?: string;
  value?: unknown;
}
export interface DryRunReport {
  passed: boolean;
  cases: DryRunCase[];
}

/** 边界测试用例 (需求书 5.3 Step3): 保费=0/极大、年龄=100、非法枚举 */
const EDGE_INPUTS: Array<{ name: string; input: Record<string, unknown> }> = [
  { name: "保费=0", input: { premiumAmount: 0, premiumTerm: "5", investorStatus: "Non-PI", policyYear: 1, age: 40 } },
  { name: "保费=9999999", input: { premiumAmount: 9999999, premiumTerm: "5", investorStatus: "PI", policyYear: 1, age: 40 } },
  { name: "年龄=100", input: { premiumAmount: 100000, premiumTerm: "5", investorStatus: "Non-PI", policyYear: 1, age: 100 } },
  { name: "非法身份枚举", input: { premiumAmount: 100000, premiumTerm: "5", investorStatus: "ALIEN", policyYear: 1, age: 40 } },
  { name: "常规", input: { premiumAmount: 100000, premiumTerm: "5", investorStatus: "PI", policyYear: 1, age: 40 } },
];

/**
 * 自动化边界测试 (需求书 5.3 Step3)。在沙箱里用数十组边界用例喂给 AI 生成代码;
 * 崩溃或算出负数 → 标红, 供自我反思重构。
 */
@Injectable()
export class DryRunService {
  constructor(private readonly sandbox: SandboxRunner) {}

  async dryRun(code: string, inputs = EDGE_INPUTS): Promise<DryRunReport> {
    const cases: DryRunCase[] = [];
    for (const c of inputs) {
      const r = await this.sandbox.run(code, c.input);
      let ok = r.ok;
      let error = r.error;
      if (ok) {
        if (this.hasNegative(r.value)) {
          ok = false;
          error = "算出负数佣金";
        } else if (!this.allFinite(r.value)) {
          ok = false;
          error = "结果含非有限数 (NaN/Infinity)";
        }
      }
      cases.push({ name: c.name, ok, error, value: r.value });
    }
    return { passed: cases.every((c) => c.ok), cases };
  }

  /**
   * Coder Agent 自我反思重构循环 (需求书 5.3 Step3): 生成 → dry-run →
   * 失败把用例反馈喂回重新生成, 最多 maxRetries 次。
   */
  async generateUntilGreen(
    generate: (feedback: string | null) => Promise<string>,
    maxRetries = 3,
  ): Promise<{ code: string; report: DryRunReport; attempts: number }> {
    let feedback: string | null = null;
    let last: { code: string; report: DryRunReport } = {
      code: "",
      report: { passed: false, cases: [] },
    };
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const code = await generate(feedback);
      const report = await this.dryRun(code);
      last = { code, report };
      if (report.passed) return { code, report, attempts: attempt };
      feedback = report.cases
        .filter((c) => !c.ok)
        .map((c) => `用例「${c.name}」失败: ${c.error}`)
        .join("; ");
    }
    return { ...last, attempts: maxRetries };
  }

  /**
   * 把"纯数字 token"字符串解析为数字 (含 NaN/Infinity), 普通标签(如 "Yr 1")返回 null。
   * 沙箱 JSON 边界会把 AI 代码里用 String()/toFixed() 拼出的数字保留为字符串,
   * 必须按数字校验, 否则 "-0.5" / "NaN" 会绕过负数/非有限检查。
   */
  private numericToken(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
    if (/^[+-]?Infinity$/i.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
    if (/^NaN$/i.test(t)) return Number.NaN;
    return null;
  }

  private hasNegative(v: unknown): boolean {
    if (typeof v === "number") return v < 0;
    if (typeof v === "string") {
      const n = this.numericToken(v);
      return n !== null && n < 0;
    }
    if (Array.isArray(v)) return v.some((x) => this.hasNegative(x));
    if (v && typeof v === "object")
      return Object.values(v).some((x) => this.hasNegative(x));
    return false;
  }

  private allFinite(v: unknown): boolean {
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "string") {
      const n = this.numericToken(v);
      return n === null ? true : Number.isFinite(n);
    }
    if (Array.isArray(v)) return v.every((x) => this.allFinite(x));
    if (v && typeof v === "object")
      return Object.values(v).every((x) => this.allFinite(x));
    return true;
  }
}
