import { Body, Controller, Post } from "@nestjs/common";
import { BrokerRequestSchema, type BrokerRequest } from "@insurance/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ChatService } from "./chat.service";

/** 核心交互接口 (需求书 6.3): POST /api/v1/broker/chat/message */
@Controller("api/v1/broker/chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("message")
  message(
    @Body(new ZodValidationPipe(BrokerRequestSchema)) body: BrokerRequest,
  ) {
    return this.chat.message(body);
  }
}
