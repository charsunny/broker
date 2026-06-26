import { REQUIRED_SLOTS, type SlotKey } from "@insurance/contracts";
import type { ConfigStore } from "../engines/config.store";
import type { RiskBanner } from "@insurance/contracts";
import type { OrchestratorSlots } from "./state";

/** 保司中文展示名 */
const COMPANY_DISPLAY: Record<string, string> = {
  "sun life": "永明人寿 (Sun Life)",
};

export function displayCompany(company?: string | null): string {
  if (!company) return "";
  return COMPANY_DISPLAY[company.toLowerCase()] ?? company;
}

export function displayTerm(term?: string | null): string {
  if (!term) return "";
  if (term.toLowerCase() === "single") return "趸交 (Single)";
  return `${term}年期`;
}

/** 比率格式化为百分比展示 */
export function pct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

/** 金额格式化 (千分位) */
export function money(x: number): string {
  return `HK$ ${Math.round(x).toLocaleString("en-US")}`;
}

/**
 * 产品感知的必填槽位 (需求书 4.2)。产品已知则用其 meta.requiredSlots,
 * 否则用全局默认 (productName / premiumTerm / investorStatus)。
 */
export function requiredSlotsFor(
  productName: string | null | undefined,
  config: ConfigStore,
): SlotKey[] {
  if (productName) {
    const meta = config.getProductMeta(productName);
    if (meta) return meta.requiredSlots;
  }
  return REQUIRED_SLOTS;
}

/** 计算缺失槽位, 保持 required 顺序 (供单一反问取 [0]) */
export function missingFor(
  slots: OrchestratorSlots,
  required: SlotKey[],
): SlotKey[] {
  return required.filter((k) => {
    const v = slots[k];
    return v === null || v === undefined || v === "";
  });
}

/** 把前端回传的字符串值按槽位类型强制转换 */
export function coerceSlotValue(
  slotKey: string,
  raw: string,
): string | number {
  if (slotKey === "premiumAmount" || slotKey === "policyYear") {
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

/** 多个预警中取最严重的一个 (卡片只展示单条 riskBanner) */
export function severestBanner(banners: RiskBanner[]): RiskBanner | null {
  const order = { danger: 3, warning: 2, info: 1 } as const;
  return (
    banners
      .slice()
      .sort((a, b) => order[b.level] - order[a.level])[0] ?? null
  );
}
