# syntax=docker/dockerfile:1
# 构建上下文 = 仓库根目录 (pnpm monorepo)。dokploy compose 里 context: .
FROM node:22-bookworm AS builder
RUN corepack enable && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# 先拷 manifest 充分利用层缓存
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
# 只装 api + 其依赖(contracts); isolated-vm 在此原生编译
RUN pnpm install --frozen-lockfile --filter @insurance/api...
# 源码 + 构建
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @insurance/contracts build \
  && pnpm --filter @insurance/api build \
  && cp -r apps/api/src/config/db/migrations apps/api/dist/config/db/migrations
# 去掉 devDependencies, 收敛体积
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# 整体拷贝以保留 pnpm 的 workspace 软链结构 (@insurance/contracts)
COPY --from=builder /app /app
WORKDIR /app/apps/api
EXPOSE 3000
# 启动前先跑迁移, 再起服务
CMD ["sh", "-c", "node dist/config/db/migrate.js && node dist/main.js"]
