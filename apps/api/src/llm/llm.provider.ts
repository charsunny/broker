import type { InvestorStatus } from "@insurance/contracts";

/** 当前已知槽位 (仅作为 LLM 上下文, 形态宽松) */
export type CurrentSlots = Readonly<Record<string, unknown>>;

/** 一轮对话 (用于给 LLM 提供上下文) */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** LLM 从自然语言中抽取到的槽位 (只含本次能确定的字段) */
export interface ExtractionResult {
  company?: string | null;
  productName?: string | null;
  premiumTerm?: string | null;
  investorStatus?: InvestorStatus | null;
  premiumAmount?: number | null;
  policyYear?: number | null;
}

/**
 * LLM 适配接口 (需求书: 多供应商可插拔)。
 * 实现可以是规则 Mock, 也可以是通义/DeepSeek/Moonshot 的 OpenAI 兼容端点。
 */
export interface LlmProvider {
  /** 结合历史与当前槽位, 从用户输入中抽取核心因子 */
  extract(
    content: string,
    history: ChatTurn[],
    currentSlots: CurrentSlots,
  ): Promise<ExtractionResult>;
}

/** DI 注入令牌 */
export const LLM_PROVIDER = Symbol("LLM_PROVIDER");
