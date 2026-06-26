import { Module } from "@nestjs/common";
import { ConfigModule } from "../config.module";
import { EnginesModule } from "../../engines/engines.module";
import { SandboxModule } from "../../sandbox/sandbox.module";
import { CacheModule } from "../../cache/cache.module";
import { AuthModule } from "../../auth/auth.module";
import { ExcelImportService } from "../import/excel-import.service";
import { AdminConfigService } from "./admin-config.service";
import { AdminController } from "./admin.controller";

@Module({
  imports: [ConfigModule, EnginesModule, SandboxModule, CacheModule, AuthModule],
  controllers: [AdminController],
  providers: [ExcelImportService, AdminConfigService],
})
export class AdminModule {}
