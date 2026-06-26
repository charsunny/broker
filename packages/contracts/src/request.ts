import { z } from "zod";
import { UIRenderCommand } from "./render-command.js";
import { ApiCode } from "./error-codes.js";

/**
 * 前端上行请求协议 (需求书 6.2 BrokerRequestSchema)。
 *
 * 通过 messageType 区分行为, 后端可精准决定 LangGraph 是清空记忆、跑 NLP 识别,
 * 还是直接槽位赋值 (跳过大模型, 省 Token 和时间)。
 */
export const BrokerRequestSchema = z.object({
  /** 会话 ID。首次会话传 null, 由后端生成返回; 后续对话必须携带 */
  threadId: z.string().nullish(),

  /** 上报行为分类 */
  messageType: z.enum(["text", "slot_update", "feedback", "reset"]),

  /** 适用 text(用户输入内容) 或 feedback(用户填写的纠错原因) */
  content: z.string().nullish(),

  /** 仅 slot_update 时使用: 明确要修改的后端变量名, 如 'premiumTerm' */
  targetSlot: z.string().nullish(),
  /** 仅 slot_update 时使用: 要更新的具体值, 如 '5' */
  slotValue: z.string().nullish(),

  /** 仅 feedback 时必须携带, 用于溯源异常账单 */
  traceId: z.string().nullish(),
});
export type BrokerRequest = z.infer<typeof BrokerRequestSchema>;

export type BrokerMessageType = BrokerRequest["messageType"];

/**
 * 后端下发的标准响应外壳 (需求书 6.3)。
 * data 必须是指令数组, 以支持 "一句回复 + 一个选项卡片" 的组合展示。
 */
export const ApiEnvelope = z.object({
  code: z.number(),
  msg: z.string(),
  /** 贯穿始终的会话 ID */
  threadId: z.string(),
  data: z.array(UIRenderCommand),
});
export type ApiEnvelope = z.infer<typeof ApiEnvelope>;

/** 构造成功响应外壳的便捷函数 */
export function ok(
  threadId: string,
  data: UIRenderCommand[],
  msg = "success",
): ApiEnvelope {
  return { code: ApiCode.SUCCESS, msg, threadId, data };
}

/** 构造失败/降级响应外壳的便捷函数 */
export function fail(
  code: number,
  msg: string,
  threadId: string,
  data: UIRenderCommand[] = [],
): ApiEnvelope {
  return { code, msg, threadId, data };
}
