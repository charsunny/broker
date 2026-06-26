# 部署指南 (dokploy + wxenv.com)

用 dokploy 部署三个对外服务 (api / web / admin)。**PostgreSQL 与 Redis 用阿里云托管服务**
(不在 compose 里拉容器, 通过环境变量接入)。**域名/SSL 在 dokploy UI 里逐个服务配置**
(compose 不写 Traefik labels)。

## 子域名规划 (wxenv.com)

| 服务 | 子域名 | 容器端口 |
|---|---|---|
| Broker Flutter Web (`web`) | `broker.wxenv.com` | 80 |
| Admin 后台 (`admin`) | `admin.wxenv.com` | 80 |
| NestJS API (`api`) | `api.wxenv.com` | 3000 |

> 改子域名: 改这里 + `docker-compose.prod.yml` 两处构建参数 `API_BASE`/`VITE_API_BASE`
> (前端在编译期把 API 地址打进包里)。

## 需要你提供 / 操作的

1. **DNS**: 给上面 3 个子域名各加一条 **A 记录 → wxenv 服务器公网 IP**。
2. **阿里云 PG/Redis**: 准备好 RDS PostgreSQL 与 Redis 实例, 拿到连接串; 把 dokploy 所在服务器 IP
   加进它们的访问白名单 (或用同 VPC 内网地址)。
3. **dokploy 访问** + **Git 远程** (dokploy 从仓库拉代码构建)。

## 部署步骤

1. **推代码**: 本仓库已 `git init` + 提交。加远程并推送:
   ```bash
   git remote add origin <your-git-remote>
   git push -u origin main
   ```
2. **dokploy 建应用**: Create → **Compose** → 选该仓库 → Compose 文件 `docker-compose.prod.yml`。
3. **环境变量** (dokploy 应用的 Environment):
   ```env
   # 阿里云 RDS PostgreSQL (需 SSL 时末尾加 ?sslmode=require)
   DATABASE_URL=postgresql://<user>:<pass>@<rds-host>:5432/insurance
   # 阿里云 Redis (带密码; 走 TLS 用 rediss://)
   REDIS_URL=redis://:<redis-pass>@<redis-host>:6379
   JWT_SECRET=<强随机串>
   BROKER_PHONE_WHITELIST=13800000000,13900000000   # 允许登录的经纪人手机号
   # 接真实国内大模型时填(默认 mock 离线可跑):
   LLM_PROVIDER=deepseek
   LLM_API_KEY=sk-xxxx
   LLM_BASE_URL=https://api.deepseek.com/v1
   LLM_MODEL=deepseek-chat
   ```
   > `insurance` 数据库需在 RDS 里先建好 (空库即可, 建表由 api 启动时自动迁移完成)。
4. **域名/SSL (在 dokploy UI 里配)**: 给 `api` / `web` / `admin` 三个服务分别在 Domains 里加
   `api.wxenv.com` / `broker.wxenv.com` / `admin.wxenv.com`, 端口分别 `3000` / `80` / `80`,
   勾选自动 SSL (Let's Encrypt)。dokploy 会自动接管 Traefik 路由 + 证书。
5. **Deploy**: 点部署。首次构建较慢 (api 含 isolated-vm 原生编译, web 用 Flutter SDK 镜像)。
   api 启动时自动跑数据库迁移 (`CMD` 里 migrate && main), 会在你的阿里云 PG 上建表。

## 验证

- `https://broker.wxenv.com` → Broker 对话测算页(欢迎语来自 API → 链路通)
- `https://admin.wxenv.com` → Admin 登录(白名单手机号)→ 导入/审批/矩阵/回滚
- `https://api.wxenv.com/api/v1/broker/chat/message` → POST `{"messageType":"reset"}` 返回欢迎卡

## 说明

- **建表/迁移**: api 容器启动自动 `migrate` 到阿里云 PG。前提是容器能连到 RDS
  (白名单含服务器 IP / 同 VPC)。首次成功后表即建好。
- **初始数据**: 不灌演示种子。真实费率经 **Admin 导入管道** 上传 (推荐), 或一次性
  `node dist/config/db/seed.js` 灌演示数据。
- **CORS**: `main.ts` 当前 `cors: true`(放开)。如需收紧, 限制为上面三个子域名 origin。
- **镜像体积**: api 镜像为可靠起见整体拷贝了 workspace(含 isolated-vm 原生件); 后续可用
  `pnpm deploy` 进一步瘦身。
