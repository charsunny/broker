# 部署指南 (dokploy + wxenv.com)

用 dokploy(自托管 PaaS, 内置 Traefik + Let's Encrypt) 部署本项目的三个对外服务 +
PostgreSQL + Redis。一套 `docker-compose.prod.yml` 全部带起。

## 子域名规划 (wxenv.com)

| 服务 | 子域名 | 容器端口 |
|---|---|---|
| Broker Flutter Web | `commission.wxenv.com` | 80 |
| Admin 后台 | `commission-admin.wxenv.com` | 80 |
| NestJS API | `commission-api.wxenv.com` | 3000 |

> 改子域名: 编辑 `docker-compose.prod.yml` 里的 Traefik `Host(...)` 标签 + 两处构建参数
> `API_BASE` / `VITE_API_BASE`(前端在编译期把 API 地址打进包里)。

## 需要你提供 / 操作的(我无法代办的部分)

1. **DNS**: 在 wxenv.com 的 DNS 控制台给上面 3 个子域名各加一条 **A 记录 → wxenv 服务器公网 IP**。
2. **dokploy 访问**: dokploy 面板地址 + 登录(或服务器 SSH), 用来创建 Compose 应用。
3. **Git 远程**: dokploy 从 Git 仓库拉代码构建。把本仓库 push 到一个 dokploy 能访问的远程(GitHub/GitLab/自建)。

## 部署步骤

1. **推代码**: 本仓库已 `git init` + 初始提交。加远程并推送:
   ```bash
   git remote add origin <your-git-remote>
   git push -u origin main
   ```
2. **dokploy 建应用**: dokploy → Create → **Compose** → 选该 Git 仓库 →
   Compose 文件填 `docker-compose.prod.yml`。
3. **环境变量** (dokploy 应用的 Environment):
   ```env
   POSTGRES_PASSWORD=<强密码>
   JWT_SECRET=<强随机串>
   BROKER_PHONE_WHITELIST=13800000000,13900000000   # 允许登录的经纪人手机号
   # 接真实国内大模型时填(默认 mock 离线可跑):
   LLM_PROVIDER=deepseek
   LLM_API_KEY=sk-xxxx
   LLM_BASE_URL=https://api.deepseek.com/v1
   LLM_MODEL=deepseek-chat
   ```
4. **网络**: compose 用了外部网络 `dokploy-network`(dokploy 安装时自带)。若名字不同,
   改 compose 里的网络名。
5. **域名/SSL**: 两种方式二选一:
   - **靠 labels(已写好)**: 确认 dokploy 的 Traefik certresolver 名为 `letsencrypt`
     (不一致就改 labels 里的 `tls.certresolver`)。
   - **靠 dokploy UI**: 删掉 labels, 在 dokploy 每个服务的 Domains 里手动加子域名,
     dokploy 自动配 Traefik + SSL(更省心, 推荐)。
6. **Deploy**: 点部署。dokploy 构建 3 个镜像(api 含 isolated-vm 原生编译, web 用 Flutter SDK
   镜像, 首次构建较慢), Traefik 自动签发证书。

## 验证

- `https://commission.wxenv.com` → Broker 对话测算页(欢迎语来自 API → 链路通)
- `https://commission-admin.wxenv.com` → Admin 登录(用白名单手机号)→ 导入/审批/矩阵/回滚
- `https://commission-api.wxenv.com/api/v1/broker/chat/message` → POST `{"messageType":"reset"}` 返回欢迎卡

## 说明

- **数据库迁移**: api 容器启动时自动 `migrate`(`CMD` 里 migrate && main)。首次启动会建表。
  种子数据可在容器内手动 `node dist/config/db/seed.js`(或经 Admin 导入真实费率)。
- **CORS**: `main.ts` 当前 `cors: true`(放开)。如需收紧, 限制为上面三个子域名 origin。
- **成本**: PG/Redis 小规格即可; api 走 Serverless/容器按量(需求书 7.4)。Flutter Web 是纯静态(nginx),
  几乎零成本。
- **镜像体积**: api 镜像为可靠起见整体拷贝了 workspace(含 isolated-vm 原生件); 后续可用
  `pnpm deploy` 进一步瘦身。
