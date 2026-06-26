import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { EnginesModule } from "../engines/engines.module";
import { LlmModule } from "../llm/llm.module";
import { CacheModule } from "../cache/cache.module";
import { OrchestratorService } from "./orchestrator.service";

@Module({
  imports: [ConfigModule, EnginesModule, LlmModule, CacheModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
