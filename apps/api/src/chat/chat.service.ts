import { Injectable } from "@nestjs/common";
import type { ApiEnvelope, BrokerRequest } from "@insurance/contracts";
import { OrchestratorService } from "../orchestrator/orchestrator.service";

/** 把编排结果包装为标准响应外壳 (需求书 6.3) */
@Injectable()
export class ChatService {
  constructor(private readonly orchestrator: OrchestratorService) {}

  async message(req: BrokerRequest): Promise<ApiEnvelope> {
    const r = await this.orchestrator.handle(req);
    return { code: r.code, msg: r.msg, threadId: r.threadId, data: r.commands };
  }
}
