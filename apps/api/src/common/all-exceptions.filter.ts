import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiCode } from "@insurance/contracts";

/**
 * 全局异常拦截器 (需求书 6.4): 严禁把底层报错直接抛给业务员。
 * 统一包装为响应外壳 {code,msg,threadId,data[]}。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let httpStatus = 500;
    let code: number = ApiCode.INTERNAL_ERROR;
    let msg = "服务器开小差了，请稍后再试";

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      code = httpStatus;
      const r = exception.getResponse();
      msg = typeof r === "string" ? r : ((r as { message?: string }).message ?? msg);
    }

    this.logger.error(`未捕获异常: ${String(exception)}`);
    res.status(httpStatus).json({ code, msg, threadId: "", data: [] });
  }
}
