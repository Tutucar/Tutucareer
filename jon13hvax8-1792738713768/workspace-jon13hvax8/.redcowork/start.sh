#!/bin/sh
# demandradar（薯愿）STATIC_SITE 预览恢复脚本（幂等，可重复执行）
# 项目：小红书评论商机挖掘工具，已迁为纯前端静态 SPA
# 形态：/workspace 根目录 index.html + assets/（相对路径 ./assets/）
#       .redcowork-app.json = {"appType":"STATIC_SITE","buildMode":"STATIC_SITE"}
# 端口：3030（python3 http.server 静态伺服，无后端/数据库）
set -e

ROOT="/workspace"
PORT=3030
LOG_DIR="/workspace/.logs"

cd "$ROOT" || exit 1

echo "[recovery] 1/4 自检静态资源"
test -f "$ROOT/index.html"
test -f "$ROOT/assets/index-N7K_68KI.js"
test -f "$ROOT/assets/index-CROO59K2.css"
mkdir -p "$LOG_DIR"

echo "[recovery] 2/4 停旧预览与旧进程"
redcowork-preview stop 2>/dev/null || true
# 结束旧静态 server（沙箱无 pkill 进程名匹配但 pkill -f 可用；无 ps/ss 时兜底跳过）
pkill -f "python3 -m http.server $PORT" 2>/dev/null || true
# 用 /proc 兜底结束占用该端口的旧 python http.server
for p in /proc/[0-9]*; do
  pid=${p#/proc/}
  [ -r "$p/cmdline" ] || continue
  cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null || true)
  case "$cmd" in
    *"http.server $PORT"*) kill -9 "$pid" 2>/dev/null || true ;;
  esac
done
sleep 1

echo "[recovery] 3/4 起静态 server"
nohup python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$ROOT" \
  > "$LOG_DIR/app.log" 2>&1 &
sleep 2

echo "[recovery] 4/4 端到端自检"
curl -fsS "http://127.0.0.1:$PORT/" -o /dev/null
curl -fsS "http://127.0.0.1:$PORT/assets/index-N7K_68KI.js" -o /dev/null
curl -fsS "http://127.0.0.1:$PORT/assets/index-CROO59K2.css" -o /dev/null

echo "[recovery] register preview + log"
redcowork-preview start "$PORT" "$ROOT"
redcowork-log start

echo "[recovery] done — preview on port $PORT ($ROOT)"