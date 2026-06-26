import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import type {
  ChatTurn,
  CurrentSlots,
  ExtractionResult,
  LlmProvider,
} from "./llm.provider";

const ExtractionSchema = z.object({
  company: z.string().nullish(),
  productName: z.string().nullish(),
  premiumTerm: z.string().nullish(),
  investorStatus: z.enum(["PI", "Non-PI"]).nullish(),
  premiumAmount: z.number().nullish(),
  policyYear: z.number().nullish(),
});

const SYSTEM_PROMPT = `你是资深财务精算助手。从用户消息中抽取保险佣金测算槽位, 只输出 JSON。
人设(三不要): 不寒暄、不长篇、不脑补——信息缺失的字段必须留空(null), 严禁主观假设。
字段: company, productName, premiumTerm('5'/'10'/'Single'), investorStatus('PI'|'Non-PI'),
premiumAmount(数字), policyYear(数字)。仅返回 {"company":...} 这样的 JSON 对象。`;

/**
 * 国内大模型适配 (需求书: 通义/DeepSeek/Moonshot 均提供 OpenAI 兼容端点)。
 * 用 fetch 直连 /chat/completions, JSON 模式 + Zod 二次校验兜底。
 */
@Injectable()
export class OpenAiCompatProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiCompatProvider.name);

  constructor(
    private readonly opts: {
      baseUrl: string;
      apiKey: string;
      model: string;
      temperature: number;
    },
  ) {}

  async extract(
    content: string,
    history: ChatTurn[],
    currentSlots: CurrentSlots,
  ): Promise<ExtractionResult> {
    try {
      const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          model: this.opts.model,
          temperature: this.opts.temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: `当前已知槽位: ${JSON.stringify(currentSlots)}`,
            },
            ...history,
            { role: "user", content },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`LLM HTTP ${res.status}; 降级为空抽取`);
        return {};
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = ExtractionSchema.safeParse(JSON.parse(raw));
      return parsed.success ? (parsed.data as ExtractionResult) : {};
    } catch (err) {
      this.logger.error(`LLM 抽取失败, 降级为空抽取: ${String(err)}`);
      return {};
    }
  }
}
