import { Module } from "@nestjs/common";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [OrchestratorModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
