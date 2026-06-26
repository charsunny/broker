/**
 * @insurance/contracts —— 前后端共享的单一事实源 (替代需求书原 Pydantic Schema)。
 *
 * NestJS 后端直接 import 这份 Zod 契约 (协议单一事实源); Flutter 前端用 Dart 类
 * (apps/app/lib/models) 镜像同一套 JSON。保证 Server-Driven UI 协议、槽位定义、
 * 引擎配置在编译期与运行期对齐。
 */
export * from "./error-codes.js";
export * from "./dialog-state.js";
export * from "./render-command.js";
export * from "./request.js";
export * from "./engine-config.js";
