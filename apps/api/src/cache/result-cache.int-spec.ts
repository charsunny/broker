import { describe, it, expect, afterAll } from "vitest";
import { RedisService } from "./redis.service";
import { ResultCacheService } from "./result-cache.service";
import type { CalcInput, CommissionResult } from "../engines/engine.types";

/** 集成测试: 结果缓存命中。需真实 Redis (docker compose up -d)。 */
describe("ResultCacheService 结果缓存", () => {
  const redis = new RedisService();
  const cache = new ResultCacheService(redis);
  afterAll(() => redis.onModuleDestroy());

  const input: CalcInput = {
    company: "Sun Life",
    productName: "__CACHE_TEST__",
    premiumTerm: "5",
    investorStatus: "PI",
    premiumAmount: 100000,
    policyYear: 1,
  };
  const result: CommissionResult = {
    company: "Sun Life",
    productName: "__CACHE_TEST__",
    premiumTerm: "5",
    investorStatus: "PI",
    premiumAmount: 100000,
    firstYearTotalRate: 0.5,
    firstYearTotalAmount: 50000,
    breakdown: [],
    warnings: [],
  };

  it("set → get 命中相同结果; invalidate 后未命中", async () => {
    await cache.set(input, result);
    const got = await cache.get(input);
    expect(got?.firstYearTotalAmount).toBe(50000);

    await cache.invalidateAll();
    expect(await cache.get(input)).toBeNull();
  });
});
