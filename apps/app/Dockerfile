# syntax=docker/dockerfile:1
# Broker Flutter Web: 直接托管"预构建静态产物" apps/app/web_dist, 部署端不装 Flutter SDK
# (避免拉 3GB+ 的 ghcr Flutter 镜像, 国内极慢)。
#
# 改前端后, 本地重建并提交 web_dist:
#   bash scripts/build-web.sh                       # 用默认 API_BASE=broker.wxenv.com
#   bash scripts/build-web.sh https://别的域名/api/v1
#   git add apps/app/web_dist && git commit
FROM nginx:alpine
COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/app/web_dist /usr/share/nginx/html
EXPOSE 80
