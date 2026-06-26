import { z } from "zod";

/**
 * UI 渲染指令协议 (需求书 3.4 / 6.1) —— Server-Driven UI 的核心契约。
 *
 * 后端 LangGraph 状态机下发的所有指令必须是以下判别联合之一; 前端按 `type`
 * 多态分发 (<CommandRenderer/>)。前端零业务逻辑, 只负责把指令渲染为组件。
 */

// ==========================================
// 基础组件模型 (Base Components)
// ==========================================

/** Choice Chips 的单个选项 */
export const OptionItem = z.object({
  /** 前端展示文案, 如 '5年交' */
  label: z.string(),
  /** 回传给后端的真实值, 如 '5' */
  value: z.string(),
});
export type OptionItem = z.infer<typeof OptionItem>;

/** 卡片顶部可点击的上下文微调标签 (需求书 2.3 上下文微调区) */
export const ContextTag = z.object({
  /** 前端展示文案, 如 '5年交' */
  label: z.string(),
  /** 对应的状态机槽位变量名, 如 'premiumTerm' */
  slotKey: z.string(),
  /** 当前内部取值, 如 '5' */
  value: z.string(),
  /** 是否允许经纪人点击弹窗修改 */
  editable: z.boolean().default(true),
});
export type ContextTag = z.infer<typeof ContextTag>;

/** 风险/合规提示横幅 (需求书 2.3 风险与规则提示区) */
export const RiskBanner = z.object({
  /** 控制前端 UI 底色: info 蓝 / warning 橙 / danger 红 */
  level: z.enum(["info", "warning", "danger"]),
  text: z.string(),
});
export type RiskBanner = z.infer<typeof RiskBanner>;

// ==========================================
// 指令模型 (Command Schemas)
// ==========================================

/** 1. 普通文本 / 兜底指令 */
export const TextCommand = z.object({
  type: z.literal("text"),
  content: z.string(),
});
export type TextCommand = z.infer<typeof TextCommand>;

/** 2. 动态反问: 选项卡片 (枚举型槽位, 需求书 2.2 模式 A) */
export const ChoiceChipsCommand = z.object({
  type: z.literal("choice_chips"),
  content: z.string(),
  options: z.array(OptionItem),
  /** 该反问对应的状态机槽位变量名, 如 'investorStatus' */
  targetSlot: z.string(),
});
export type ChoiceChipsCommand = z.infer<typeof ChoiceChipsCommand>;

/** 3. 动态反问: 原生输入框 (连续/数值型槽位, 需求书 2.2 模式 B) */
export const NativeInputCommand = z.object({
  type: z.literal("native_input"),
  content: z.string(),
  /** 控制前端唤起的原生键盘: number → 纯数字键盘 */
  inputType: z.enum(["text", "number"]),
  placeholder: z.string().nullish(),
  targetSlot: z.string(),
});
export type NativeInputCommand = z.infer<typeof NativeInputCommand>;

/** 佣金账单卡片的折叠明细行 (需求书 2.3 折叠明细表) */
export const AccordionRow = z.object({
  /** 保单年度, 如 'Yr 1' */
  year: z.string(),
  /** 基础佣金率展示值 */
  basic: z.string(),
  /** 津贴汇总展示值 */
  allowance: z.string(),
  /** 本年度总佣金率 */
  total: z.string(),
  /** 悬浮提示: 津贴构成拆解, 如 '含 Extra 60%, SMPA 35%' */
  tooltip: z.string().nullish(),
});
export type AccordionRow = z.infer<typeof AccordionRow>;

/** 4. 结构化佣金账单卡片 (需求书 2.3 / 3.4 场景 3) */
export const CommissionCardCommand = z.object({
  type: z.literal("commission_card"),
  /** 本次测算唯一流水 ID, 用于 '点踩/报错' 时溯源 (需求书 2.4) */
  traceId: z.string(),
  /** 卡片头部, 如 '永明人寿 | SunJoy Global 2 | 5年期 | Non-PI' */
  header: z.string(),
  /** 核心数字区, 如 '首年预估毛佣金率: 120%' */
  heroNumber: z.string(),
  /** 上下文微调区: 可点击修改的标签 */
  contextTags: z.array(ContextTag),
  /** 折叠明细表 */
  accordionData: z.array(AccordionRow),
  /** 预警横幅 */
  riskBanner: RiskBanner.nullish(),
});
export type CommissionCardCommand = z.infer<typeof CommissionCardCommand>;

/** 双产品横向对比的一行 (需求书 6.1 ComparisonRow) */
export const ComparisonRow = z.object({
  metricName: z.string(),
  productAValue: z.string(),
  productBValue: z.string(),
  /** 指示前端高亮优势方 */
  highlight: z.enum(["A", "B", "None"]),
});
export type ComparisonRow = z.infer<typeof ComparisonRow>;

/** 5. 双产品横向对比卡片 (需求书 6.1) */
export const ComparisonCardCommand = z.object({
  type: z.literal("comparison_card"),
  traceId: z.string(),
  header: z.string(),
  contextTags: z.array(ContextTag),
  comparisonData: z.array(ComparisonRow),
  riskBanner: RiskBanner.nullish(),
});
export type ComparisonCardCommand = z.infer<typeof ComparisonCardCommand>;

// ==========================================
// 根类型导出 (Root Export)
// ==========================================

/** 所有合法的 UI 渲染指令 (判别联合, 对应需求书 6.1 UIRenderCommand) */
export const UIRenderCommand = z.discriminatedUnion("type", [
  TextCommand,
  ChoiceChipsCommand,
  NativeInputCommand,
  CommissionCardCommand,
  ComparisonCardCommand,
]);
export type UIRenderCommand = z.infer<typeof UIRenderCommand>;

export type UIRenderCommandType = UIRenderCommand["type"];
