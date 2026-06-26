import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

/**
 * JWT 鉴权守卫。Phase 1 纵向切片默认不挂在 chat 接口上 (便于开箱演示);
 * 需要时在 controller 上加 @UseGuards(JwtAuthGuard) 即可启用。
 * Phase 2: token/thread 失效时映射为 SESSION_EXPIRED 状态码 (需求书 3.1)。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = req.headers["authorization"];
    const token =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7)
        : null;
    if (!token) throw new UnauthorizedException("缺少 Token");
    try {
      req.user = await this.jwt.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException("会话已过期");
    }
  }
}
