import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { SlotKey } from "@insurance/contracts";
import { ConfigStore } from "../engines/config.store";
import { ConfigRepository } from "./config.repository";

/**
 * 规则字典内存预热 (需求书 7.4)。FastAPI/Nest 启动或 Admin "发布" 时, 把所有 Active
 * 配置拉进 ConfigStore 内存, 引擎查表走 1ms 缓存而非每次读 PG JSONB。
 */
@Injectable()
export class ConfigWarmupService implements OnModuleInit {
  private readonly logger = new Logger(ConfigWarmupService.name);

  constructor(
    private readonly repo: ConfigRepository,
    private readonly store: ConfigStore,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.warm();
  }

  /** 全量重载 (可由发布动作触发热重载) */
  async warm(): Promise<void> {
    try {
      const [configs, products] = await Promise.all([
        this.repo.listActiveConfigs(),
        this.repo.listProducts(),
      ]);

      if (configs.length === 0 && products.length === 0) {
        this.logger.warn(
          "PostgreSQL 暂无 Active 配置, 回退内存种子 (请运行 pnpm --filter @insurance/api db:seed)",
        );
        this.store.seedDemo();
        return;
      }

      this.store.load(
        products.map((p) => ({
          company: p.company,
          productName: p.productName,
          terms: p.terms,
          requiredSlots: p.requiredSlots as SlotKey[],
          singlePay: p.singlePay,
        })),
        configs.map((c) => ({
          productName: c.productName,
          premiumTerm: c.premiumTerm,
          investorStatus: c.investorStatus,
          ratesByYear: c.ratesData,
        })),
      );
      this.logger.log(
        `规则字典预热完成: ${configs.length} 条费率 / ${products.length} 个产品`,
      );
    } catch (err) {
      this.logger.error(`预热失败, 回退内存种子: ${String(err)}`);
      this.store.seedDemo();
    }
  }
}
