import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";

const LoginSchema = z.object({ phone: z.string().min(6) });
type LoginDto = z.infer<typeof LoginSchema>;

@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
    return this.auth.login(body.phone);
  }
}
