import { Injectable, Logger } from "@nestjs/common";
import ivm from "isolated-vm";

export interface SandboxResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  timedOut?: boolean;
  oom?: boolean;
  durationMs: number;
}

/**
 * 零信任沙箱执行器 (需求书 5.2)。
 *
 * 在隔离 V8 Isolate 中运行 AI 生成的计算代码, 强制物理边界:
 *  - 执行超时熔断: 默认 3000ms (防 while(true) 死循环拖垮 CPU)
 *  - 内存上限隔离: 默认 128MB (防内存泄漏/数组越界 OOM)
 *  - 断网 + 只读 + 禁高危库: Isolate 天然无 Node 全局(无 require/fetch/fs/process),
 *    我们不注入任何宿主能力 → 代码物理上够不到网络/磁盘/系统库
 *  - 主进程严禁 eval/exec: 一切经 isolated-vm, 错误不外泄
 *
 * 约定: 被执行代码必须定义全局函数 `calculate(input)`, 返回可 JSON 序列化的值。
 */
@Injectable()
export class SandboxRunner {
  private readonly logger = new Logger(SandboxRunner.name);
  private readonly timeoutMs = Number(process.env.SANDBOX_TIMEOUT_MS ?? 3000);
  private readonly memoryMb = Number(process.env.SANDBOX_MEMORY_LIMIT_MB ?? 128);

  async run(code: string, input: unknown): Promise<SandboxResult> {
    const isolate = new ivm.Isolate({ memoryLimit: this.memoryMb });
    const start = Date.now();
    try {
      const context = await isolate.createContext();
      // 把入参作为纯 JSON 字符串注入, 沙箱内 parse — 不传任何宿主引用
      const inputLiteral = JSON.stringify(JSON.stringify(input));
      const wrapped = `
        (function () {
          'use strict';
          const __input = JSON.parse(${inputLiteral});
          ${code}
          if (typeof calculate !== 'function') {
            throw new Error('AI 生成代码必须定义全局函数 calculate(input)');
          }
          return JSON.stringify(calculate(__input));
        })()
      `;
      const script = await isolate.compileScript(wrapped);
      const resultJson = await script.run(context, {
        timeout: this.timeoutMs,
        copy: true,
      });
      // calculate 返回 undefined/函数/symbol 时 JSON.stringify 产出 JS undefined,
      // 此处明确兜底, 避免 JSON.parse(undefined) 抛出误导性错误
      if (typeof resultJson !== "string") {
        return {
          ok: false,
          error: "calculate(input) 未返回可 JSON 序列化的结果 (是否返回了 undefined?)",
          durationMs: Date.now() - start,
        };
      }
      return {
        ok: true,
        value: JSON.parse(resultJson),
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const timedOut = /time(d)?\s?out|script execution timed out/i.test(msg);
      const oom =
        /memory limit|out of memory|array buffer allocation failed/i.test(msg) ||
        (isolate.isDisposed && !timedOut);
      return { ok: false, error: msg, timedOut, oom, durationMs: Date.now() - start };
    } finally {
      if (!isolate.isDisposed) isolate.dispose();
    }
  }
}
