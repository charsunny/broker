# syntax=docker/dockerfile:1
# Flutter Web → 静态资源 → nginx。构建上下文 = 仓库根目录。
FROM ghcr.io/cirruslabs/flutter:stable AS builder
WORKDIR /app
COPY apps/app/pubspec.yaml apps/app/pubspec.lock ./
RUN flutter pub get
COPY apps/app ./
# API 基址在编译期注入 (生产指向 API 子域名)
ARG API_BASE=https://commission-api.wxenv.com/api/v1
RUN flutter build web --release --no-tree-shake-icons --dart-define=API_BASE=${API_BASE}

FROM nginx:alpine AS runner
COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build/web /usr/share/nginx/html
EXPOSE 80
