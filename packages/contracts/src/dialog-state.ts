import { z } from "zod";

/**
 * 对话状态槽位定义 (需求书 3.3 BrokerDialogState 的核心计算槽位)。
 *
 * 槽位 key 在前后端、状态机、UI 渲染指令的 target_slot 之间共享同一套字面量,
 * 因此统一在此声明, 避免拼写漂移。
 */
export const SLOT_KEYS = [
  "company",
  "productName",
  "premiumTerm",
  "investorStatus",
  "premiumAmount",
  "policyYear",
] as const;

export const SlotKey = z.enum(SLOT_KEYS);
export type SlotKey = z.infer<typeof SlotKey>;

export const InvestorStatus = z.enum(["PI", "Non-PI"]);
export type InvestorStatus = z.infer<typeof InvestorStatus>;

/**
 * 贯穿 LangGraph 生命周期的核心槽位 (需求书 3.3)。
 * 全部可空: 由 Extractor 节点渐进式填充; Router 节点据此算 missingSlots。
 */
export const BrokerSlots = z.object({
  /** 保险公司名称 (如 Sun Life)。通常随产品锁定自动绑定 */
  company: z.string().nullish(),
  /** 产品全称 (精确匹配配置表, 如 "SunJoy Global 2") */
  productName: z.string().nullish(),
  /** 缴费年期及方式, 枚举值 (如 '5' / '10' / 'Single' 趸交) */
  premiumTerm: z.string().nullish(),
  /** 投资者身份: 'PI' | 'Non-PI', 直接决定津贴派发年限 */
  investorStatus: InvestorStatus.nullish(),
  /** 总缴保费金额, 默认 100000 用于比例测算 (需求书 3.3) */
  premiumAmount: z.number().positive().default(100000),
  /** 目标查询保单年度 (1-30); 不传则引擎默认计算首年起的明细 */
  policyYear: z.number().int().min(1).max(30).nullish(),
});
export type BrokerSlots = z.infer<typeof BrokerSlots>;

/**
 * 触发测算所需的必填槽位 (需求书 2.6 剧本一: 产品 → 年期 → 身份 → 出卡片)。
 * premiumAmount 有默认值故非必填; company 随产品锁定派生; policyYear 引擎兜底。
 */
export const REQUIRED_SLOTS: SlotKey[] = [
  "productName",
  "premiumTerm",
  "investorStatus",
];

/**
 * 计算当前缺失的必填槽位, 保持 REQUIRED_SLOTS 的声明顺序。
 * Ask_User 节点据此取 missingSlots[0] 做单一反问 (需求书 3.2 交互红线)。
 */
export function computeMissingSlots(slots: Partial<BrokerSlots>): SlotKey[] {
  return REQUIRED_SLOTS.filter((key) => {
    const value = slots[key];
    return value === null || value === undefined || value === "";
  });
}

/**
 * 槽位反问元数据: 把"该用 Choice Chips 还是 Native Input""反问话术""枚举选项"
 * 集中在一处 (需求书 2.2)。productName 的选项依赖 company, 由编排层运行时注入。
 */
export interface SlotPromptMeta {
  /** 反问渲染形态: 枚举 → choice_chips; 连续数值 → native_input */
  render: "choice_chips" | "native_input" | "text";
  /** 极简反问话术 (需求书 2.5: 不寒暄/不长篇) */
  question: string;
  /** choice_chips 的静态选项 (productName 等动态选项留空, 运行时填充) */
  options?: { label: string; value: string }[];
  /** native_input 的键盘类型 */
  inputType?: "text" | "number";
  placeholder?: string;
}

export const SLOT_PROMPT_META: Record<SlotKey, SlotPromptMeta> = {
  company: {
    render: "text",
    question: "请问您要查询哪家保险公司的产品？",
  },
  productName: {
    render: "choice_chips",
    question: "请问您要查询的具体产品名称是？",
    options: [], // 运行时按 company 从配置表填充
  },
  premiumTerm: {
    render: "choice_chips",
    question: "请问该保单的缴费年期是？",
    options: [
      { label: "2年", value: "2" },
      { label: "5年", value: "5" },
      { label: "10年", value: "10" },
      { label: "Single (趸交)", value: "Single" },
    ],
  },
  investorStatus: {
    render: "choice_chips",
    question: "请问该客户的投资者身份是？",
    options: [
      { label: "PI (专业投资者)", value: "PI" },
      { label: "Non-PI (普通客户)", value: "Non-PI" },
    ],
  },
  premiumAmount: {
    render: "native_input",
    question: "请问该客户预计缴纳的首年总保费金额是多少？",
    inputType: "number",
    placeholder: "请输入金额，如 350000",
  },
  policyYear: {
    render: "native_input",
    question: "请问要查询第几个保单年度？",
    inputType: "number",
    placeholder: "1-30",
  },
};
