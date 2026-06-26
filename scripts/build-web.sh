#!/usr/bin/env bash
# 本地构建 Broker Flutter Web 静态产物 → apps/app/web_dist (提交后由 nginx 镜像直接托管)。
# 用法: bash scripts/build-web.sh [API_BASE]
set -euo pipefail

API_BASE="${1:-https://broker.wxenv.com/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/app"

echo "[build-web] flutter build web (API_BASE=$API_BASE)"
flutter build web --release --no-tree-shake-icons --dart-define=API_BASE="$API_BASE"

rm -rf web_dist
cp -r build/web web_dist

# 精简体积: 删调试符号 + 未启用的渲染变体
# (未开 COOP/COEP 跨域隔离时 Flutter 用 canvaskit, 不会用 skwasm/wimp)
find web_dist -name '*.symbols' -delete
rm -f web_dist/canvaskit/skwasm* web_dist/canvaskit/wimp*

echo "[build-web] done: web_dist = $(du -sh web_dist | cut -f1); 记得 git add apps/app/web_dist 并提交"
