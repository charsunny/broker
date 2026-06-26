import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "./redis.service";
import type { CalcInput, CommissionResult } from "../engines/engine.types";

/**
 * 语义/查询结果缓存 (需求书 7.4(3))。同槽位组合命中直接返回已算结果,
 * 绕过引擎计算 (爆款产品高度重复查询时极大降本提速)。
 */
@Injectable()
export class ResultCacheService {
  private readonly logger = new Logger(ResultCacheService.name);
  private readonly ttl = Number(process.env.RESULT_CACHE_TTL ?? 600);

  constructor(private readonly redis: RedisService) {}

  private key(i: CalcInput): string {
    return `calc:${[
      i.company,
      i.productName,
      i.premiumTerm,
      i.investorStatus,
      i.premiumAmount,
      i.policyYear ?? "all",
    ]
      .join("|")
      .toLowerCase()}`;
  }

  async get(input: CalcInput): Promise<CommissionResult | null> {
    const raw = await this.redis.get(this.key(input));
    if (!raw) return null;
    try {
      this.logger.debug(`缓存命中 ${this.key(input)}`);
      return JSON.parse(raw) as CommissionResult;
    } catch {
      return null;
    }
  }

  async set(input: CalcInput, result: CommissionResult): Promise<void> {
    await this.redis.setex(this.key(input), this.ttl, JSON.stringify(result));
    this.logger.debug(`缓存写入 ${this.key(input)}`);
  }

  /** 配置发布后失效相关缓存 (避免旧费率残留) */
  async invalidateAll(): Promise<void> {
    try {
      const keys = await this.redis.client.keys("calc:*");
      if (keys.length) await this.redis.client.del(...keys);
      this.logger.log(`清理结果缓存 ${keys.length} 条`);
    } catch {
      /* 降级 */
    }
  }
}
