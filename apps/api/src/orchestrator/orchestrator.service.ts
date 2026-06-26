import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ApiCode,
  FALLBACK_MESSAGE,
  type BrokerRequest,
  type UIRenderCommand,
} from "@insurance/contracts";
import { LLM_PROVIDER, type LlmProvider } from "../llm/llm.provider";
import { ConfigStore } from "../engines/config.store";
import { ConfigRepository } from "../config/config.repository";
import { EngineRegistry } from "../engines/engine.registry";
import { RiskInterceptor } from "../engines/risk.interceptor";
import { ProductNotConfiguredError } from "../engines/errors";
import { ResultCacheService } from "../cache/result-cache.service";
import { maskSensitive } from "../common/mask";
import { buildGraph, type CommissionGraph } from "./graph";
import type { IncomingMessage } from "./state";

const WELCOME = "请问您要查询什么产品？";

export interface HandleResult {
  threadId: string;
  commands: UIRenderCommand[];
  code: number;
  msg: string;
}

/**
 * 编排服务: 把一次 BrokerRequest 喂入 LangGraph, 返回本轮 UI 渲染指令。
 * 处理全局重置、反馈纠错、产品未命中兜底 (需求书 2.1 / 2.4 / 3.2)。
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  private readonly graph: CommissionGraph;

  constructor(
    @Inject(LLM_PROVIDER) llm: LlmProvider,
    config: ConfigStore,
    registry: EngineRegistry,
    risk: RiskInterceptor,
    private readonly repo: ConfigRepository,
    cache: ResultCacheService,
  ) {
    this.graph = buildGraph({ llm, config, registry, risk, cache });
  }

  /** 持久化到未命中池 (需求书 5.3 Step1); 入库前脱敏, PG 不可用时不阻断用户流程 */
  private async record(
    kind: "unhandled" | "feedback",
    payload: Record<string, unknown>,
  ): Promise<void> {
    const safe = { ...payload };
    if (typeof safe.content === "string") {
      safe.content = maskSensitive(safe.content);
    }
    try {
      await this.repo.recordUnhandled(kind, safe);
    } catch (err) {
      this.logger.warn(`写未命中池失败 (忽略): ${String(err)}`);
    }
  }

  async handle(req: BrokerRequest): Promise<HandleResult> {
    // 全局重置: 开新会话, 旧 state 自然弃用 (需求书 2.1 一键新测算)
    if (req.messageType === "reset") {
      return {
        threadId: randomUUID(),
        commands: [{ type: "text", content: WELCOME }],
        code: ApiCode.SUCCESS,
        msg: "reset",
      };
    }

    const threadId = req.threadId ?? randomUUID();

    // 反馈纠错: 打包推入未命中池 (需求书 2.4 HITL Loop)
    if (req.messageType === "feedback") {
      await this.record("feedback", {
        traceId: req.traceId,
        content: req.content,
        at: new Date().toISOString(),
      });
      return {
        threadId,
        commands: [{ type: "text", content: "已收到您的反馈，我们会尽快核查。" }],
        code: ApiCode.SUCCESS,
        msg: "feedback received",
      };
    }

    const incoming: IncomingMessage = {
      messageType: req.messageType,
      content: req.content,
      targetSlot: req.targetSlot,
      slotValue: req.slotValue,
      traceId: req.traceId,
    };

    try {
      const out = await this.graph.invoke(
        { threadId, incoming },
        { configurable: { thread_id: threadId } },
      );
      return {
        threadId,
        commands: out.commands ?? [],
        code: ApiCode.SUCCESS,
        msg: "success",
      };
    } catch (err) {
      if (err instanceof ProductNotConfiguredError) {
        // 未命中: 写池 + 统一友好兜底话术 (需求书 1.2 / 5.3 Step1)
        await this.record("unhandled", err.detail);
        this.logger.warn(`未命中拦截: ${err.message}`);
        return {
          threadId,
          commands: [{ type: "text", content: FALLBACK_MESSAGE }],
          code: ApiCode.FALLBACK_UNHANDLED,
          msg: "fallback",
        };
      }
      throw err;
    }
  }
}
