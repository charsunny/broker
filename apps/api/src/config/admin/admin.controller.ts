import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminConfigService } from "./admin-config.service";

interface UploadedExcel {
  buffer: Buffer;
  originalname: string;
}

const ApproveSchema = z.object({ effectiveDate: z.string() });
const RollbackSchema = z.object({
  productName: z.string(),
  premiumTerm: z.string(),
  investorStatus: z.string(),
});
const DeploySchema = z.object({ company: z.string(), code: z.string() });

/** Admin 后台 (需求书第 5 章 HITL 闭环)。Phase 1 复用手机号 JWT, Phase 2 加 role 校验。 */
@UseGuards(JwtAuthGuard)
@Controller("api/v1/admin")
export class AdminController {
  constructor(private readonly admin: AdminConfigService) {}

  /** 上传矩阵式 Excel → 解析 + dry-run + 写草稿 */
  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  importExcel(@UploadedFile() file?: UploadedExcel) {
    if (!file) throw new BadRequestException("缺少上传文件字段 file");
    return this.admin.importExcel(file.buffer, file.originalname);
  }

  /** 草稿待办 (红点) */
  @Get("pending")
  pending() {
    return this.admin.listPending();
  }

  /** JSONB 反向解析为保单年度矩阵 + 版本历史 */
  @Get("matrix/:productName")
  matrix(@Param("productName") productName: string) {
    return this.admin.matrix(productName);
  }

  /** 人工放行: 发布 + 日落 + 热重载 */
  @Post("approve")
  approve(
    @Body(new ZodValidationPipe(ApproveSchema)) body: { effectiveDate: string },
  ) {
    return this.admin.approve(body.effectiveDate);
  }

  /** 一键回滚 */
  @Post("rollback")
  rollback(
    @Body(new ZodValidationPipe(RollbackSchema))
    body: { productName: string; premiumTerm: string; investorStatus: string },
  ) {
    return this.admin.rollback(
      body.productName,
      body.premiumTerm,
      body.investorStatus,
    );
  }

  /** 动态代码部署 (沙箱 dry-run 通过才热挂载) */
  @Post("deploy-dynamic")
  deployDynamic(
    @Body(new ZodValidationPipe(DeploySchema))
    body: { company: string; code: string },
  ) {
    return this.admin.deployDynamic(body.company, body.code);
  }
}
