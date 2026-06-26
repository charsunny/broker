import { Module } from "@nestjs/common";
import { SandboxRunner } from "./sandbox.runner";
import { DryRunService } from "./dry-run.service";

@Module({
  providers: [SandboxRunner, DryRunService],
  exports: [SandboxRunner, DryRunService],
})
export class SandboxModule {}
