#!/bin/zsh
# 弦养 · 本机全量预览 · 一键启动（macOS 双击运行）
#
# 同一个端口里同时提供：
#   /                        → 主壳（问诊 → 首页 → 引导 → 打卡）
#   /s4/#/train              → 真跟练页（MediaPipe 姿态识别 + 陪练教练）
#   /outputs/preview/        → 启动台（各候选产物）
#   /outputs/experience/     → 完整体验入口
#
# 关闭：在这个窗口按 Control-C，或直接关掉窗口。

cd "$(dirname "$0")" || exit 1
PORT="${1:-5400}"

# 优先用托管版 node，找不到再退回 PATH 里的 node
NODE="/Users/leo/.workbuddy/binaries/node/versions/22.22.2-6/bin/node"
[ -x "$NODE" ] || NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  echo "✗ 找不到 node，请先安装 Node.js 20+"
  echo "按回车关闭…"; read -r _; exit 1
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠ 端口 $PORT 已被占用 —— 直接打开已有服务。"
  echo "（若页面不对，先执行： pkill -f preview-all.cjs ）"
  open "http://127.0.0.1:$PORT/"
  echo "按回车关闭本窗口…"; read -r _; exit 0
fi

echo "弦养 · 正在启动本机预览（端口 $PORT）…"
"$NODE" scripts/preview-all.cjs "$PORT" &
SRV=$!

# 等端口就绪再开浏览器（最多 10 秒）
for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then break; fi
  sleep 0.25
done

echo "✓ 已启动：http://127.0.0.1:$PORT/"
echo "  主壳 /  |  跟练 /s4/#/train  |  启动台 /outputs/preview/"
echo "  （跟练页首次进入浏览器会询问摄像头权限，请点「允许」）"
open "http://127.0.0.1:$PORT/"

echo ""
echo "——— 服务运行中，关掉窗口或按 Control-C 即可停止 ———"
wait $SRV
