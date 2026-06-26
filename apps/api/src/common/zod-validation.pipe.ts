import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import type { ZodSchema } from "zod";

/** 用 Zod 契约做入参强校验 (替代 class-validator), 失败抛 400 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "请求参数校验失败",
        issues: result.error.flatten(),
      });
    }
    return result.data;
  }
}
