import { Injectable } from "@nestjs/common";
import { ConfigStore } from "../engines/config.store";
import type {
  ChatTurn,
  CurrentSlots,
  ExtractionResult,
  LlmProvider,
} from "./llm.provider";

/**
 * 规则版 Mock LLM (零成本、离线可跑)。
 *
 * 用确定性正则/关键词抽取覆盖需求书 2.6 的两套基准剧本, 让纵向链路无需真实
 * API key 即可演示。生产环境用 OpenAiCompatProvider 替换 (走通义/DeepSeek)。
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  constructor(private readonly config: ConfigStore) {}

  async extract(
    content: string,
    _history: ChatTurn[],
    _currentSlots: CurrentSlots,
  ): Promise<ExtractionResult> {
    const text = content.toLowerCase();
    const result: ExtractionResult = {};

    // ---- 保险公司 ----
    if (/永明|sun\s?life/.test(text)) result.company = "Sun Life";

    // ---- 产品 (用配置库已知产品名做匹配, 含别名) ----
    const aliases: Record<string, string> = {
      "sunjoy global 2": "SunJoy Global 2",
      sunjoy: "SunJoy Global 2",
      "generations ii": "Generations II",
      generations: "Generations II",
      "bright universal life": "Bright Universal Life (RMB)",
      bright: "Bright Universal Life (RMB)",
    };
    for (const [alias, name] of Object.entries(aliases)) {
      if (text.includes(alias)) {
        result.productName = name;
        const meta = this.config.getProductMeta(name);
        if (meta) {
          result.company = meta.company;
          if (meta.singlePay) result.premiumTerm = "Single";
        }
        break;
      }
    }

    // ---- 缴费年期 / 方式 ----
    if (/趸交|single|一次性/.test(text)) {
      result.premiumTerm = "Single";
    } else {
      const term = text.match(/(\d+)\s*(年|-?pay|年期)/);
      if (term?.[1]) result.premiumTerm = term[1];
    }

    // ---- 投资者身份 (先判 Non-PI 再判 PI, 避免子串误命中) ----
    if (/non[-\s]?pi|普通客户|非专业/.test(text)) {
      result.investorStatus = "Non-PI";
    } else if (/\bpi\b|专业投资者/.test(text)) {
      result.investorStatus = "PI";
    }

    // ---- 保费金额 (支持 350000 / 350,000 / 35万 / 100k) ----
    const wan = text.match(/([\d.]+)\s*万/);
    const kilo = text.match(/([\d.]+)\s*k\b/);
    const plain = text.replace(/,/g, "").match(/(?<!\d)(\d{4,})(?!\d)/);
    if (wan?.[1]) result.premiumAmount = Math.round(parseFloat(wan[1]) * 10000);
    else if (kilo?.[1]) result.premiumAmount = Math.round(parseFloat(kilo[1]) * 1000);
    else if (plain?.[1]) result.premiumAmount = parseInt(plain[1], 10);

    // ---- 目标保单年度 (如 "第5年") ----
    const yr = text.match(/第\s*(\d+)\s*年/);
    if (yr?.[1]) result.policyYear = parseInt(yr[1], 10);

    return result;
  }
}
