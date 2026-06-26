import { Injectable } from "@nestjs/common";
import { BaseCommissionEngine } from "./base.engine";
import { SunLifeEngine } from "./sunlife.engine";

/**
 * 引擎注册表 (需求书 5.5 热重载 / 一键回滚的挂载点)。
 * 按 company 解析对应引擎; Phase 2 接入沙箱动态生成的引擎时, 在此 register/swap。
 */
@Injectable()
export class EngineRegistry {
  private readonly engines = new Map<string, BaseCommissionEngine>();

  constructor(sunLife: SunLifeEngine) {
    this.register(sunLife);
  }

  register(engine: BaseCommissionEngine): void {
    this.engines.set(engine.company.toLowerCase(), engine);
  }

  resolve(company: string | null | undefined): BaseCommissionEngine | null {
    if (!company) return null;
    return this.engines.get(company.trim().toLowerCase()) ?? null;
  }

  companies(): string[] {
    return [...this.engines.keys()];
  }
}
