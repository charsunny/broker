import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { AdminModule } from "./config/admin/admin.module";

@Module({
  imports: [AuthModule, ChatModule, AdminModule],
})
export class AppModule {}
