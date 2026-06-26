/**
 * 产品未入库错误。被编排层捕获后走统一兜底话术 + 写入未命中池 (需求书 1.2 / 5.3 Step1)。
 */
export class ProductNotConfiguredError extends Error {
  constructor(public readonly detail: Record<string, unknown>) {
    super(`Product not configured: ${JSON.stringify(detail)}`);
    this.name = "ProductNotConfiguredError";
  }
}
