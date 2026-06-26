import { Module } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { ResultCacheService } from "./result-cache.service";

@Module({
  providers: [RedisService, ResultCacheService],
  exports: [RedisService, ResultCacheService],
})
export class CacheModule {}
