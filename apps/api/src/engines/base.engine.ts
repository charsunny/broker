import type { CalcInput, CommissionResult } from "./engine.types";

/**
 * 保司佣金引擎抽象基类 (需求书 4.1)。
 *
 * 统一入参 (CalcInput), 独立引擎: 每家保司一个子类, 保司特有逻辑
 * (如万通高龄递减、宏利 Band 级别) 仅在自身子类实现, 不污染全局。
 * calculate 必须是无状态纯函数。
 */
export abstract class BaseCommissionEngine {
  abstract readonly company: string;
  // 同步(查表引擎如 SunLife) 或异步(沙箱动态引擎) 均可
  abstract calculate(input: CalcInput): CommissionResult | Promise<CommissionResult>;
}
