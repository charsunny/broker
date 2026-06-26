import { Annotation } from "@langchain/langgraph";
import type { SlotKey, UIRenderCommand } from "@insurance/contracts";
import type { ChatTurn } from "../llm/llm.provider";
import type { CalcInput, CommissionResult } from "../engines/engine.types";

/**
 * 编排层使用的槽位形态。
 * premiumAmount 默认不设值: 比例测算(剧本一)在 compute 时兜底 100000;
 * 大额敏感产品(剧本二 Bright)把它列入必填, null 状态会触发反问。
 */
export interface OrchestratorSlots {
  company?: string | null;
  productName?: string | null;
  premiumTerm?: string | null;
  investorStatus?: "PI" | "Non-PI" | null;
  premiumAmount?: number | null;
  policyYear?: number | null;
}

/** 比例测算的兜底保费 (compute 时对未显式提供 premiumAmount 的场景生效) */
export const DEFAULT_PREMIUM = 100000;

export const DEFAULT_SLOTS: OrchestratorSlots = {};

/** 本轮进入图的消息 (来自 BrokerRequest) */
export interface IncomingMessage {
  messageType: "text" | "slot_update" | "feedback" | "reset";
  content?: string | null;
  targetSlot?: string | null;
  slotValue?: string | null;
  traceId?: string | null;
}

/**
 * 贯穿 LangGraph 生命周期的状态 (需求书 3.3)。
 * 用 MemorySaver(Phase1) / PostgresSaver(Phase2) 按 thread_id 持久化, 断线可恢复。
 */
export const OrchestratorState = Annotation.Root({
  threadId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** 核心槽位, 增量合并 */
  slots: Annotation<OrchestratorSlots>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ ...DEFAULT_SLOTS }),
  }),

  /** LLM 上下文历史 */
  history: Annotation<ChatTurn[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  /** 本轮输入消息 (每次 invoke 覆盖) */
  incoming: Annotation<IncomingMessage | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Router 计算出的缺失必填槽位 */
  missingSlots: Annotation<SlotKey[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** compute 节点的入参快照 (供 synthesis 复用) */
  calcInput: Annotation<CalcInput | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** compute 节点的测算结果 */
  result: Annotation<CommissionResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** 本轮下发给前端的 UI 渲染指令 (每轮由 extractor 重置) */
  commands: Annotation<UIRenderCommand[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;
