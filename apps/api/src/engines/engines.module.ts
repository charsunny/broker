import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { SunLifeEngine } from "./sunlife.engine";
import { RiskInterceptor } from "./risk.interceptor";
import { EngineRegistry } from "./engine.registry";

@Module({
  imports: [ConfigModule],
  providers: [SunLifeEngine, RiskInterceptor, EngineRegistry],
  exports: [RiskInterceptor, EngineRegistry],
})
export class EnginesModule {}
