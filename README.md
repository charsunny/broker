# AI 佣金查询工具 (Insurance Commission Tool)

为保险经纪人（Broker）提供「对话流 + 结构化卡片」的自然语言佣金测算服务。
本期（Phase 1）为**沙盒模拟测算台**：仅基于内置产品规则库给参考性测算，不连真实保单系统。

> 完整技术方案见 [`docs/技术方案设计.md`](docs/技术方案设计.md)。

## 技术栈

| 维度 | 选型 |
|---|---|
| 前端 | **Flutter**（一套 Dart 代码 → Web/H5 本期、iOS/Android App 后续；小程序 Phase 2 用薄渲染器复用同一契约） |
| 后端 | **NestJS**（TypeScript） |
| AI 编排 | **LangGraph.js** + PostgreSQL Checkpointer |
| 校验/契约 | **Zod**（前后端共享 `@insurance/contracts`） |
| 数据库 | PostgreSQL + JSONB（Drizzle ORM） |
| 沙箱 | `isolated-vm`（执行 AI 生成的计算代码，3s/128MB/断网/只读） |
| 缓存 | Redis（语义缓存 / 规则字典预热 / 限流排队） |
| LLM | 国内模型（通义千问 / DeepSeek / Moonshot，OpenAI 兼容端点 + 适配层） |

## 目录结构

```
insurance/                # JS 侧 pnpm + Turborepo monorepo
├─ packages/
│  └─ contracts/          # ★ 后端 + 协议源头: Zod 契约 (SDUI 协议 / 槽位 / 引擎配置)  ✅
├─ apps/
│  ├─ api/                # NestJS 后端 (鉴权 / 编排 / 引擎 / 配置 / 沙箱 / 缓存)
│  ├─ app/                # ★ Flutter 用户端 (Dart, Server-Driven UI 纯渲染器)
│  └─ admin/              # Admin 后台 (JSONB 可视化 / HITL 审批)
├─ docs/技术方案设计.md   # 完整技术方案
└─ docker-compose.yml     # PostgreSQL + Redis 本地一键起
```

> `apps/app` 是独立 Flutter(Dart) 工程, 不归 pnpm 管; 协议契约以 `packages/contracts`(Zod)
> 为单一事实源, Flutter 侧用 `lib/models/` 下的 Dart 类镜像同一套 JSON。

## 本地启动

前置：Node ≥ 20、Docker。pnpm 通过 corepack 启用（无需单独安装）：

```bash
corepack enable pnpm        # Node 自带 corepack, 启用 pnpm
pnpm install                # 安装全部 workspace 依赖
cp .env.example .env        # 配置 DATABASE_URL / REDIS_URL / LLM_API_KEY 等

pnpm infra:up               # 起 PostgreSQL + Redis (docker compose)
pnpm --filter @insurance/api dev   # 起 NestJS 后端 (Flutter 端见下方"快速体验")
```

仅构建/测试共享契约：

```bash
pnpm --filter @insurance/contracts build
pnpm --filter @insurance/contracts test
```

## 核心架构不变量（务必保留）

- **Server-Driven UI**：前端零业务逻辑，只按指令 `type` 多态渲染；未知 `type` 降级不白屏。
- **单一反问原则**：`Ask_User` 节点每次只反问 `missingSlots[0]` 一个缺失槽位。
- **状态持久化**：每个对话绑定 `thread_id`，断线可精准恢复到中断的反问节点。
- **零信任沙箱**：AI 生成的计算代码严禁主进程 `eval`，必须在 `isolated-vm` 隔离执行。
- **版本日落**：配置只追加不物理 `DELETE`，旧版本 `effective_end_date` 日落，可追溯历史费率。

## 实施进度

**纵向最小链路已打通并验证**（对话 → Choice Chips → 佣金账单卡片，端到端可跑）：

- [x] **脚手架 + 共享契约层**（`@insurance/contracts`，10 项契约测试通过）
- [x] **后端骨架**：NestJS + Auth(手机号白名单+JWT) + Chat 响应外壳 + 全局异常拦截
- [x] **AI 编排**：LangGraph.js 5 节点状态机 + MemorySaver + LLM 适配(默认 Mock，可切国内模型) —— 剧本一/二测试通过
- [x] **计算引擎**：BaseCommissionEngine + SunLifeEngine(四步公式) + RiskInterceptor + EngineRegistry（内存版 ConfigStore seed）
- [x] **前端 MVP**：Flutter + CommandRenderer 多态分发 + 4 类组件 + UI Lock —— `flutter analyze` 零问题、`flutter build web` 通过、浏览器实跑验证
- [x] **配置表落库**：Drizzle + PostgreSQL JSONB + 版本日落 + 启动预热 —— 集成测试验证日落事务
- [x] **配置导入 + 沙箱 + HITL**：exceljs 矩阵展平 + Zod 熔断 + `isolated-vm` 零信任沙箱(7 项对抗测试) + 自我反思重构 + 审批/回滚 + Admin(React+AntD) —— 浏览器实跑
- [x] **缓存调优**：Redis 结果缓存 + 并发限流削峰 + 日志脱敏 —— 25 项测试(21 单测 + 4 集成)全绿

> 后端测试：`pnpm --filter @insurance/api test`(单测) + `test:int`(集成，需 PG/Redis)。
> 数据库：`pnpm --filter @insurance/api db:generate|db:migrate|db:seed`。

### 快速体验（本地）

```bash
corepack enable pnpm && pnpm install
# 终端1: 启动后端 (默认 Mock LLM, 无需 API key)
pnpm --filter @insurance/api build && PORT=3000 node apps/api/dist/main.js
# 验证后端剧本一: node apps/api/scripts/e2e-smoke.mjs

# 终端2: 启动 Flutter 用户端 (Web)
cd apps/app && flutter pub get
flutter run -d chrome           # 或 flutter build web 后静态托管 build/web
# API 基址可覆盖: flutter run -d chrome --dart-define=API_BASE=http://localhost:3000/api/v1
```

> 后端单测：`pnpm --filter @insurance/api test`（回放剧本一/二）。
> 前端检查：`cd apps/app && flutter analyze`。
