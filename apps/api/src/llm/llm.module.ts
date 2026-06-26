import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { ConfigStore } from "../engines/config.store";
import { LLM_PROVIDER, type LlmProvider } from "./llm.provider";
import { MockLlmProvider } from "./mock-llm.provider";
import { OpenAiCompatProvider } from "./openai-compat.provider";
import { QueuedLlmProvider } from "./queued-llm.provider";

/**
 * LLM 模块: 按环境变量选择 provider。
 * 未配置真实 API key 时默认走零成本 MockLlmProvider, 保证开箱即跑。
 */
@Module({
  imports: [ConfigModule],
  providers: [
    MockLlmProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigStore],
      useFactory: (config: ConfigStore) => {
        const provider = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
        const apiKey = process.env.LLM_API_KEY ?? "";
        const noRealKey = !apiKey || apiKey.startsWith("sk-xxx");
        const base: LlmProvider =
          provider === "mock" || noRealKey
            ? new MockLlmProvider(config)
            : new OpenAiCompatProvider({
                baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
                apiKey,
                model: process.env.LLM_MODEL ?? "deepseek-chat",
                temperature: Number(process.env.LLM_TEMPERATURE ?? "0"),
              });
        // 套并发限流闸: 削峰填谷 (需求书 7.4(2))
        return new QueuedLlmProvider(
          base,
          Number(process.env.LLM_MAX_CONCURRENCY ?? 8),
        );
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
