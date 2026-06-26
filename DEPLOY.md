# 部署指南 (dokploy + broker.wxenv.com)

用 dokploy 部署三个构建服务 (api / web / admin)。
- **PostgreSQL / Redis 用阿里云托管服务** (不在 compose 里拉容器, 通过环境变量接入)。
- **单域名 `broker.wxenv.com` + 路径代理**, 在 dokploy UI 里配 (compose 不写 Traefik labels)。

## 路由规划 (单域名)

| 路径 | 服务 | 容器端口 | 说明 |
|---|---|---|---|
| `/` | `web` | 80 | Broker Flutter Web (根路径) |
| `/api` | `api` | 3000 | NestJS, **不 strip 前缀** (API 自身就在 `/api/v1` 下) |
| `/admin` | `admin` | 80 | Admin, **不 strip 前缀** (已按 `/admin/` base 打包) |

> 前端 API 基址已编译为 `https://broker.wxenv.com/api/v1`; Admin 以 `/admin/` 为 base 打包。
> 改域名: 改 `docker-compose.prod.yml` 的 `API_BASE`/`VITE_API_BASE` + `apps/admin/vite.config.ts` 的 `base`。

## 需要你提供 / 操作的

1. **DNS**: `broker.wxenv.com` 一条 **A 记录 → wxenv 服务器公网 IP** (单域名, 只需一条)。
2. **阿里云 PG/Redis**: 准备 RDS PostgreSQL + Redis, 拿到连接串; 服务器 IP 加白名单 (或同 VPC); RDS 里先建空库 `insurance`。
3. **dokploy 访问** + **Git 远程**。

## 部署步骤

1. **推代码**:
   ```bash
   git remote add origin <your-git-remote>
   git push -u origin main
   ```
2. **dokploy 建应用**: Create → **Compose** → 选该仓库 → Compose 文件 `docker-compose.prod.yml`。
3. **环境变量** (Environment):
   ```env
   DATABASE_URL=postgresql://<user>:<pass>@<rds-host>:5432/insurance   # 需SSL加 ?sslmode=require
   REDIS_URL=redis://:<redis-pass>@<redis-host>:6379                   # 走TLS用 rediss://
   JWT_SECRET=<强随机串>
   BROKER_PHONE_WHITELIST=13800000000,13900000000
   # 接真实国内大模型时填(默认 mock 离线可跑):
   LLM_PROVIDER=deepseek
   LLM_API_KEY=sk-xxxx
   LLM_BASE_URL=https://api.deepseek.com/v1
   LLM_MODEL=deepseek-chat
   ```
4. **域名/SSL (已在 compose 里写好, 不用在 dokploy UI 配)**:
   `docker-compose.prod.yml` 已带 Traefik label + `dokploy-network` —— 单 host `broker.wxenv.com`
   的 `/` `/api` `/admin` 路径路由, https(websecure) 用 `letsencrypt` 签证书, http(web) 自动跳 https。
   - **关键: dokploy 的 Compose 部署不会自动注入域名(那是 Application 类型才有),所以域名必须靠
     compose 里的 label —— 不要再在 dokploy UI 给这几个服务配域名(会冲突)。** 直接 Deploy 即可。
   - 前提: dokploy 自带 Traefik 在用, certresolver 名为 `letsencrypt`(本机已确认)。若你的不叫这个,
     改 compose 里的 `tls.certresolver`。
   - `/api`、`/admin` 已设 `priority=100` 高于 `/` 的 `priority=1`; 都不 strip 前缀。
5. **Deploy**: 点部署。`web` 是**预构建静态产物** (`apps/app/web_dist`) 直接进 nginx, 构建很快
   (部署端不装 Flutter SDK); `api` 含 isolated-vm 原生编译稍慢; `admin` 是 Vite 构建。
   api 启动时自动迁移建表到阿里云 PG。
   > 改了 Broker 前端代码后, 本地跑 `bash scripts/build-web.sh` 重建 `web_dist` 并提交, 再部署。

## 验证

- `https://broker.wxenv.com/` → Broker 对话测算页(欢迎语来自 API → 链路通)
- `https://broker.wxenv.com/admin/` → Admin 登录(白名单手机号)→ 导入/审批/矩阵/回滚
- `https://broker.wxenv.com/api/v1/broker/chat/message` → POST `{"messageType":"reset"}` 返回欢迎卡

## 说明

- **建表/迁移**: api 容器启动自动 `migrate` 到阿里云 PG (前提: 容器能连到 RDS, 白名单含服务器 IP)。
- **初始数据**: 不灌演示种子。真实费率经 **Admin 导入管道** 上传, 或一次性 `node dist/config/db/seed.js`。
- **CORS**: 单域名同源, 前端与 API 同在 broker.wxenv.com, 无跨域问题。`main.ts` 当前 `cors:true`。
- **镜像体积**: api 镜像整体拷贝了 workspace(含 isolated-vm 原生件); 后续可用 `pnpm deploy` 瘦身。
