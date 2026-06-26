# syntax=docker/dockerfile:1
# Admin (Vite + React) → 静态资源 → nginx。构建上下文 = 仓库根目录。
FROM node:22-bookworm AS builder
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN pnpm install --frozen-lockfile --filter @insurance/admin
COPY apps/admin apps/admin
# API 基址在编译期注入
ARG VITE_API_BASE=https://commission-api.wxenv.com/api/v1
RUN VITE_API_BASE=${VITE_API_BASE} pnpm --filter @insurance/admin build

FROM nginx:alpine AS runner
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
