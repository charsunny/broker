import { describe, it, expect } from "vitest";
import {
  UIRenderCommand,
  CommissionCardCommand,
  BrokerRequestSchema,
  RatesByYear,
  computeMissingSlots,
  REQUIRED_SLOTS,
} from "../index.js";

describe("UIRenderCommand 判别联合 (需求书 6.1)", () => {
  it("接受合法的 choice_chips 指令", () => {
    const r = UIRenderCommand.safeParse({
      type: "choice_chips",
      content: "请问该客户的投资者身份是？",
      targetSlot: "investorStatus",
      options: [
        { label: "PI", value: "PI" },
        { label: "Non-PI", value: "Non-PI" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("接受完整的佣金卡片指令", () => {
    const r = CommissionCardCommand.safeParse({
      type: "commission_card",
      traceId: "trace_1",
      header: "永明人寿 | SunJoy Global 2 | 5年期 | Non-PI",
      heroNumber: "首年预估毛佣金率: 120%",
      contextTags: [
        { label: "5年交", slotKey: "premiumTerm", value: "5", editable: true },
      ],
      accordionData: [
        { year: "Yr 1", basic: "25%", allowance: "95%", total: "120%" },
      ],
      riskBanner: { level: "danger", text: "⚠️ 退佣预警" },
    });
    expect(r.success).toBe(true);
  });

  it("拒绝未知 type (前端据此降级, 不白屏)", () => {
    const r = UIRenderCommand.safeParse({ type: "hologram", content: "x" });
    expect(r.success).toBe(false);
  });
});

describe("BrokerRequestSchema 上行协议 (需求书 6.2)", () => {
  it("slot_update 携带 targetSlot/slotValue", () => {
    const r = BrokerRequestSchema.safeParse({
      threadId: "session_abc",
      messageType: "slot_update",
      targetSlot: "premiumTerm",
      slotValue: "5",
    });
    expect(r.success).toBe(true);
  });

  it("拒绝非法 messageType", () => {
    const r = BrokerRequestSchema.safeParse({ messageType: "explode" });
    expect(r.success).toBe(false);
  });
});

describe("RatesByYear JSONB 契约 (需求书 4.2)", () => {
  it("接受合法的逐年费率树", () => {
    const r = RatesByYear.safeParse({
      "1": { basicRate: 0.25, allowances: { extra: 0.6, smpa: 0.35, ma: 0.18 } },
      "6": { basicRate: 0.0, allowances: { extra: 0, smpa: 0, ma: 0 } },
    });
    expect(r.success).toBe(true);
  });

  it("拒绝负费率", () => {
    const r = RatesByYear.safeParse({
      "1": { basicRate: -0.1, allowances: { extra: 0, smpa: 0, ma: 0 } },
    });
    expect(r.success).toBe(false);
  });
});

describe("computeMissingSlots 单一反问 (需求书 3.2)", () => {
  it("空槽位时按 REQUIRED_SLOTS 顺序返回全部缺失", () => {
    expect(computeMissingSlots({})).toEqual(REQUIRED_SLOTS);
  });

  it("仅缺投资者身份时只返回 investorStatus", () => {
    expect(
      computeMissingSlots({ productName: "SunJoy Global 2", premiumTerm: "5" }),
    ).toEqual(["investorStatus"]);
  });

  it("槽位齐备时返回空数组 → 路由至 Compute", () => {
    expect(
      computeMissingSlots({
        productName: "SunJoy Global 2",
        premiumTerm: "5",
        investorStatus: "PI",
      }),
    ).toEqual([]);
  });
});
