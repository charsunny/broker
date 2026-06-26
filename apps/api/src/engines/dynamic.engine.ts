import { BaseCommissionEngine } from "./base.engine";
import { SandboxRunner } from "../sandbox/sandbox.runner";
import type { CalcInput, CommissionResult, YearBreakdown } from "./engine.types";

/**
 * 动态引擎 (需求书 5.3 / 5.5): 承载 AI Coder Agent 生成并经 HITL 审批的计算代码,
 * 每次测算都在零信任沙箱里执行 (而非主进程 eval)。由 EngineRegistry 热挂载/回滚。
 */
export class DynamicEngine extends BaseCommissionEngine {
  constructor(
    public readonly company: string,
    private readonly code: string,
    private readonly sandbox: SandboxRunner,
  ) {
    super();
  }

  async calculate(input: CalcInput): Promise<CommissionResult> {
    const r = await this.sandbox.run(this.code, input);
    if (!r.ok) {
      throw new Error(`动态引擎沙箱执行失败: ${r.error}`);
    }
    const v = (r.value ?? {}) as Record<string, unknown>;

    // 沙箱只保证物理隔离, 不保证语义正确。生产路径必须强校验输出 (fail-closed),
    // 否则 AI 代码返回 "-0.5"/NaN/越界 会被当作合法佣金渲染给用户。
    const rate = this.numeric(v.firstYearTotalRate, "firstYearTotalRate");
    const amount = this.numeric(v.firstYearTotalAmount, "firstYearTotalAmount");
    const breakdown = Array.isArray(v.breakdown)
      ? (v.breakdown as YearBreakdown[]).map((b, i) => this.checkRow(b, i))
      : [];

    return {
      company: input.company,
      productName: input.productName,
      premiumTerm: input.premiumTerm,
      investorStatus: input.investorStatus,
      premiumAmount: input.premiumAmount,
      firstYearTotalRate: rate,
      firstYearTotalAmount: amount,
      breakdown,
      warnings: [],
    };
  }

  /** 强制有限非负数, 否则抛错 (fail-closed) */
  private numeric(raw: unknown, field: string): number {
    const n = Number(raw ?? 0);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`动态引擎输出非法 ${field}=${String(raw)} (须为有限非负数)`);
    }
    return n;
  }

  private checkRow(b: YearBreakdown, i: number): YearBreakdown {
    for (const k of ["basicComm", "extra", "smpa", "ma", "allowanceTotal", "totalComm"] as const) {
      const val = (b as unknown as Record<string, unknown>)[k];
      if (val != null) this.numeric(val, `breakdown[${i}].${k}`);
    }
    return b;
  }
}
