import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Redis 客户端封装。Redis 不可用时所有操作静默降级 (缓存未命中), 绝不阻断业务。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  private warned = false;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      // 连接建立前的命令排队 (避免启动竞态); Redis 真正不可用时命令会 reject → 被 catch 降级
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    this.client.on("error", (e) => {
      if (!this.warned) {
        this.logger.warn(`Redis 不可用, 缓存降级: ${e.message}`);
        this.warned = true;
      }
    });
    this.client.on("ready", () => {
      this.warned = false;
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, value);
    } catch {
      /* 降级: 不缓存 */
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
