import { randomUUID } from "node:crypto";
import {
  SLOT_PROMPT_META,
  FALLBACK_MESSAGE,
  type ContextTag,
  type UIRenderCommand,
  type AccordionRow,
} from "@insurance/contracts";
import type { LlmProvider, ChatTurn } from "../llm/llm.provider";
import type { ConfigStore } from "../engines/config.store";
import type { EngineRegistry } from "../engines/engine.registry";
import type { RiskInterceptor } from "../engines/risk.interceptor";
import type { ResultCacheService } from "../cache/result-cache.service";
import { ProductNotConfiguredError } from "../engines/errors";
import type { CalcInput } from "../engines/engine.types";
import {
  DEFAULT_PREMIUM,
  type OrchestratorSlots,
  type OrchestratorStateType,
} from "./state";
import {
  coerceSlotValue,
  displayCompany,
  displayTerm,
  missingFor,
  money,
  pct,
  requiredSlotsFor,
  severestBanner,
} from "./util";

export interface NodeDeps {
  llm: LlmProvider;
  config: ConfigStore;
  registry: EngineRegistry;
  risk: RiskInterceptor;
  cache?: ResultCacheService;
}

type NodeReturn = Partial<OrchestratorStateType>;

export function createNodes(deps: NodeDeps) {
  const { llm, config, registry, risk, cache } = deps;

  /** 1. Extractor: 意图/实体提取 → 覆盖写入槽位; 顺带算出 missingSlots */
  async function extractor(state: OrchestratorStateType): Promise<NodeReturn> {
    const inc = state.incoming;
    const updates: Partial<OrchestratorSlots> = {};
    const historyAdd: ChatTurn[] = [];

    if (inc?.messageType === "slot_update" && inc.targetSlot) {
      // 点击 Chips / Native Input: 跳过 LLM, 直接赋值 (省 Token, 需求书 6.2)
      const val = coerceSlotValue(inc.targetSlot, inc.slotValue ?? "");
      (updates as Record<string, unknown>)[inc.targetSlot] = val;
    } else if (inc?.messageType === "text" && inc.content) {
      const ex = await llm.extract(
        inc.content,
        state.history,
        state.slots as Record<string, unknown>,
      );
      for (const [k, v] of Object.entries(ex)) {
        if (v !== null && v !== undefined) {
          (updates as Record<string, unknown>)[k] = v;
        }
      }
      historyAdd.push({ role: "user", content: inc.content });
    }

    const merged: OrchestratorSlots = { ...state.slots, ...updates };

    // 产品已知 → 派生 company / 趸交默认年期 (Zero Hallucination: 仅基于配置库)
    if (merged.productName) {
      const meta = config.getProductMeta(merged.productName);
      if (meta) {
        if (!merged.company) {
          updates.company = meta.company;
          merged.company = meta.company;
        }
        if (meta.singlePay && !merged.premiumTerm) {
          updates.premiumTerm = "Single";
          merged.premiumTerm = "Single";
        }
      }
    }

    const required = requiredSlotsFor(merged.productName, config);
    return {
      slots: updates,
      missingSlots: missingFor(merged, required),
      history: historyAdd,
      commands: [],
      incoming: null,
    };
  }

  /** 2. Router: 槽位校验条件路由 (决策枢纽) */
  function router(state: OrchestratorStateType): "ask_user" | "compute" {
    return state.missingSlots.length > 0 ? "ask_user" : "compute";
  }

  /** 3. Ask_User: 单一反问 — 仅针对 missingSlots[0] (需求书 3.2 交互红线) */
  function askUser(state: OrchestratorStateType): NodeReturn {
    const slot = state.missingSlots[0];
    if (!slot) return { commands: [] };
    const meta = SLOT_PROMPT_META[slot];
    const commands: UIRenderCommand[] = [];

    // 产品锁定后反问产品名: 先来一句过场文本 (演示 data 数组的 "一句话+卡片" 组合)
    if (slot === "productName" && state.slots.company) {
      commands.push({
        type: "text",
        content: `好的，正在为您测算${displayCompany(state.slots.company)}产品。`,
      });
    }

    if (meta.render === "choice_chips") {
      let options = meta.options ?? [];
      if (slot === "productName") {
        const company = state.slots.company;
        const products = company ? config.listProducts(company) : [];
        options = products.map((p) => ({
          label: p.productName,
          value: p.productName,
        }));
        if (options.length === 0) {
          options = [{ label: "其他产品...", value: "__other__" }];
        }
      }
      commands.push({
        type: "choice_chips",
        content: meta.question,
        options,
        targetSlot: slot,
      });
    } else if (meta.render === "native_input") {
      commands.push({
        type: "native_input",
        content: meta.question,
        inputType: meta.inputType ?? "text",
        placeholder: meta.placeholder ?? null,
        targetSlot: slot,
      });
    } else {
      commands.push({ type: "text", content: meta.question });
    }

    return { commands };
  }

  /** 4. Compute: 槽位齐备后调用引擎执行无状态测算 (引擎可同步或异步) */
  async function compute(state: OrchestratorStateType): Promise<NodeReturn> {
    const slots = state.slots;
    const engine = registry.resolve(slots.company);
    if (!engine || !slots.productName) {
      throw new ProductNotConfiguredError({
        company: slots.company,
        productName: slots.productName,
      });
    }
    const calcInput: CalcInput = {
      company: slots.company ?? "",
      productName: slots.productName,
      premiumTerm: slots.premiumTerm ?? "Single",
      investorStatus: slots.investorStatus ?? "Non-PI",
      premiumAmount: slots.premiumAmount ?? DEFAULT_PREMIUM,
      policyYear: slots.policyYear ?? null,
    };
    // 语义/结果缓存: 同槽位组合命中直接返回, 绕过引擎计算 (需求书 7.4(3))
    const cached = cache ? await cache.get(calcInput) : null;
    const result = cached ?? (await engine.calculate(calcInput));
    if (cache && !cached) await cache.set(calcInput, result);
    return { calcInput, result };
  }

  /** 5. Synthesis: 结果拼装 + 风险拦截 → CommissionCardCommand */
  function synthesis(state: OrchestratorStateType): NodeReturn {
    const { result, calcInput, slots } = state;
    if (!result || !calcInput) {
      return { commands: [{ type: "text", content: FALLBACK_MESSAGE }] };
    }

    const banner = severestBanner(risk.apply(calcInput, result));

    const header = [
      displayCompany(result.company),
      result.productName,
      displayTerm(result.premiumTerm),
      result.investorStatus,
    ]
      .filter(Boolean)
      .join(" | ");

    const contextTags: ContextTag[] = [];
    if (slots.premiumTerm) {
      contextTags.push({
        label: displayTerm(slots.premiumTerm),
        slotKey: "premiumTerm",
        value: slots.premiumTerm,
        editable: true,
      });
    }
    if (slots.investorStatus) {
      contextTags.push({
        label: slots.investorStatus,
        slotKey: "investorStatus",
        value: slots.investorStatus,
        editable: true,
      });
    }
    contextTags.push({
      label: `保费 ${money(result.premiumAmount)}`,
      slotKey: "premiumAmount",
      value: String(result.premiumAmount),
      editable: true,
    });

    const accordionData: AccordionRow[] = result.breakdown.map((b) => ({
      year: `Yr ${b.year}`,
      basic: pct(b.basicRate),
      allowance: pct(
        result.premiumAmount > 0 ? b.allowanceTotal / result.premiumAmount : 0,
      ),
      total: pct(
        result.premiumAmount > 0 ? b.totalComm / result.premiumAmount : 0,
      ),
      tooltip: `含 Extra ${money(b.extra)}, SMPA ${money(b.smpa)}, MA ${money(b.ma)}`,
    }));

    const card: UIRenderCommand = {
      type: "commission_card",
      traceId: randomUUID(),
      header,
      heroNumber: `首年预估总佣金率: ${pct(result.firstYearTotalRate)} (${money(result.firstYearTotalAmount)})`,
      contextTags,
      accordionData,
      riskBanner: banner ?? null,
    };
    return { commands: [card] };
  }

  return { extractor, router, askUser, compute, synthesis };
}
