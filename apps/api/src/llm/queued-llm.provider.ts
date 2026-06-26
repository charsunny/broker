import { ConcurrencyLimiter } from "../cache/concurrency-limiter";
import type {
  ChatTurn,
  CurrentSlots,
  ExtractionResult,
  LlmProvider,
} from "./llm.provider";

/**
 * 给任意 LlmProvider 套一层并发限流 (需求书 7.4(2))。
 * LLM 调用是最贵且最容易触发配额限制的环节, 超并发时排队而非报错。
 */
export class QueuedLlmProvider implements LlmProvider {
  private readonly limiter: ConcurrencyLimiter;

  constructor(
    private readonly inner: LlmProvider,
    max: number,
  ) {
    this.limiter = new ConcurrencyLimiter(max);
  }

  extract(
    content: string,
    history: ChatTurn[],
    currentSlots: CurrentSlots,
  ): Promise<ExtractionResult> {
    return this.limiter.run(() =>
      this.inner.extract(content, history, currentSlots),
    );
  }
}
