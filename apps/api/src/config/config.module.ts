import { Module } from "@nestjs/common";
import { ConfigStore } from "../engines/config.store";
import { ConfigRepository } from "./config.repository";
import { ConfigWarmupService } from "./config-warmup.service";

/**
 * 配置模块: PG 仓库 + 内存缓存 (ConfigStore) + 启动预热。
 * 引擎/编排/LLM 通过它拿到统一的同步查表能力。
 */
@Module({
  providers: [ConfigRepository, ConfigStore, ConfigWarmupService],
  exports: [ConfigStore, ConfigRepository, ConfigWarmupService],
})
export class ConfigModule {}
