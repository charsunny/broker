import { describe, it, expect, beforeEach } from "vitest";
import type { UIRenderCommand } from "@insurance/contracts";
import { ConfigStore } from "../engines/config.store";
import { SunLifeEngine } from "../engines/sunlife.engine";
import { RiskInterceptor } from "../engines/risk.interceptor";
import { EngineRegistry } from "../engines/engine.registry";
import { MockLlmProvider } from "../llm/mock-llm.provider";
import { buildGraph, type CommissionGraph } from "./graph";
import type { IncomingMessage } from "./state";

/** 直接拼装核心依赖 (绕过 Nest DI), 用 MemorySaver 跑多轮对话 */
function makeGraph(): CommissionGraph {
  const config = new ConfigStore();
  config.seedDemo();
  const engine = new SunLifeEngine(config);
  const registry = new EngineRegistry(engine);
  const risk = new RiskInterceptor();
  const llm = new MockLlmProvider(config);
  return buildGraph({ llm, config, registry, risk });
}

async function turn(
  graph: CommissionGraph,
  threadId: string,
  incoming: IncomingMessage,
): Promise<UIRenderCommand[]> {
  const out = await graph.invoke(
    { threadId, incoming },
    { configurable: { thread_id: threadId } },
  );
  return out.commands ?? [];
}

const first = <T extends UIRenderCommand["type"]>(
  cmds: UIRenderCommand[],
  type: T,
): Extract<UIRenderCommand, { type: T }> => {
  const c = cmds.find((x) => x.type === type);
  if (!c) throw new Error(`期望指令 ${type}, 实际: ${cmds.map((x) => x.type)}`);
  return c as Extract<UIRenderCommand, { type: T }>;
};

describe("剧本一: 常规流程 (需求书 2.6)", () => {
  let graph: CommissionGraph;
  const tid = "script-1";
  beforeEach(() => {
    graph = makeGraph();
  });

  it("快捷胶囊 → 反问产品 → 年期 → 身份 → 卡片 → NLP 静默微调", async () => {
    // 回合1: 快捷指令 "永明产品佣金测算" → 锁定 Sun Life, 反问产品
    let cmds = await turn(graph, tid, {
      messageType: "text",
      content: "永明产品佣金测算",
    });
    const productAsk = first(cmds, "choice_chips");
    expect(productAsk.targetSlot).toBe("productName");
    expect(productAsk.options.map((o) => o.value)).toContain("SunJoy Global 2");

    // 回合2: 点击 SunJoy Global 2 → 反问缴费年期
    cmds = await turn(graph, tid, {
      messageType: "slot_update",
      targetSlot: "productName",
      slotValue: "SunJoy Global 2",
    });
    expect(first(cmds, "choice_chips").targetSlot).toBe("premiumTerm");

    // 回合3: 点击 5年 → 反问投资者身份 (单一反问: 每轮只问一个)
    cmds = await turn(graph, tid, {
      messageType: "slot_update",
      targetSlot: "premiumTerm",
      slotValue: "5",
    });
    expect(first(cmds, "choice_chips").targetSlot).toBe("investorStatus");

    // 回合4: 点击 Non-PI → 信息齐备, 出佣金卡片
    cmds = await turn(graph, tid, {
      messageType: "slot_update",
      targetSlot: "investorStatus",
      slotValue: "Non-PI",
    });
    const card = first(cmds, "commission_card");
    expect(card.header).toContain("SunJoy Global 2");
    expect(card.header).toContain("Non-PI");
    expect(card.accordionData.length).toBeGreaterThan(0);
    expect(card.heroNumber).toContain("首年预估总佣金率");
    expect(card.traceId).toBeTruthy();

    // 回合5: NLP 静默微调 "如果是PI客户呢" → 跳过反问, 直接出新卡片
    cmds = await turn(graph, tid, {
      messageType: "text",
      content: "如果是PI客户呢？",
    });
    const piCard = first(cmds, "commission_card");
    expect(piCard.header).toContain("PI");
    expect(piCard.header).not.toContain("Non-PI");
  });
});

describe("剧本二: 大额退佣预警 (需求书 2.6 / 4.2)", () => {
  let graph: CommissionGraph;
  const tid = "script-2";
  beforeEach(() => {
    graph = makeGraph();
  });

  it("Bright Universal Life + Native Input 350000 + PI → 强制红色 Claw Back 预警", async () => {
    // 回合1: 文本锁定特殊产品 → 因缺连续数值变量, 反问保费 (Native Input 数字键盘)
    let cmds = await turn(graph, tid, {
      messageType: "text",
      content: "帮我查一下 Bright Universal Life RMB 的首年佣金",
    });
    const amountAsk = first(cmds, "native_input");
    expect(amountAsk.targetSlot).toBe("premiumAmount");
    expect(amountAsk.inputType).toBe("number");

    // 回合2: 输入 350000 → 反问投资者身份
    cmds = await turn(graph, tid, {
      messageType: "slot_update",
      targetSlot: "premiumAmount",
      slotValue: "350000",
    });
    expect(first(cmds, "choice_chips").targetSlot).toBe("investorStatus");

    // 回合3: PI → 触发大额退佣拦截, 卡片亮红色 danger banner
    cmds = await turn(graph, tid, {
      messageType: "slot_update",
      targetSlot: "investorStatus",
      slotValue: "PI",
    });
    const card = first(cmds, "commission_card");
    expect(card.riskBanner?.level).toBe("danger");
    expect(card.riskBanner?.text).toMatch(/退佣|Claw Back/);
  });
});
