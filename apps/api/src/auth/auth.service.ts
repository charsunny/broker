import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

/**
 * 轻量级鉴权 (需求书 3.1 Phase 1): 手机号白名单验证 → 下发 JWT。
 * Token 预留 broker_id/role 扩展插槽, 便于 Phase 2 平滑过渡至完整权限校验。
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  private whitelist(): string[] {
    return (process.env.BROKER_PHONE_WHITELIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async login(phone: string): Promise<{ token: string }> {
    if (!this.whitelist().includes(phone)) {
      throw new UnauthorizedException("手机号不在公司白名单内");
    }
    const token = await this.jwt.signAsync({
      sub: phone,
      phone,
      broker_id: null, // Phase 2 扩展插槽
      role: "broker",
    });
    return { token };
  }
}
