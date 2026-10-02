#!/usr/bin/env bash
# 生成兜底预录视频（60 秒）
#
# 【为什么需要】三级兜底的第一级。此前 public/assets/ 只有 README，
# 导致「摄像头失效 → 切预录」永远失败，直接退到错误页（真机遇到过）。
#
# 【本脚本生成什么】8 段各 7.5 秒的定格引导片（式名 + 要领 + 序号），
# 纯文字动画，不需要照片素材。够用于「摄像头挂了就放这个垫着」的场景。
# 拿到真实演示视频后，直接覆盖 public/assets/fallback.mp4 即可。
#
# 用法：bash scripts/gen-fallback-video.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/assets/fallback.mp4"
FF="${FFMPEG:-ffmpeg}"
FONT="C\\:/Windows/Fonts/msyh.ttc"
W=640; H=1136; FPS=25; EACH=8      # 8 式 × 8 秒 = 64 秒
BG="0x16130f"; FG="0xe8e0d0"; DIM="0x8a8070"; ACC="0xc8553d"

if [ ! -f "$OUT" ]; then
  echo "=== 生成兜底预录视频 → $OUT ==="
fi

# 8 式的式名与要领（与 src/data/speech.js 保持一致）
declare -a NAMES=(
  "双手托天理三焦|双臂向上举过头顶"
  "左右开弓似射雕|一手臂平举，另一手屈肘"
  "调理脾胃须单举|一手高举，一手向下按"
  "五劳七伤往后瞧|身体不动，只把头转向一侧"
  "摇头摆尾去心火|俯身深屈，身体左右摆动"
  "两手攀足固肾腰|俯身向下，双手够向脚"
  "攒拳怒目增气力|马步站稳，一拳缓缓推出"
  "背后七颠百病消|两脚并拢，脚跟起落七次"
)

# 逐段生成后拼接
TMP="$ROOT/.tmp-fallback"
rm -rf "$TMP" 2>/dev/null || true
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
for i in $(seq 0 7); do
  NUM=$((i + 1))
  NAME="${NAMES[$i]%%|*}"
  CUE="${NAMES[$i]##*|}"
  "$FF" -y -loglevel error \
    -f lavfi -i "color=c=${BG}:s=${W}x${H}:d=${EACH}:r=${FPS}" \
    -vf "drawtext=fontfile='${FONT}':text='第 ${NUM} 式':fontcolor=${ACC}:fontsize=64:x=(w-text_w)/2:y=H*0.30:enable='gte(t,0.5)'\
,drawtext=fontfile='${FONT}':text='${NAME}':fontcolor=${FG}:fontsize=52:x=(w-text_w)/2:y=H*0.44:enable='gte(t,0.8)'\
,drawtext=fontfile='${FONT}':text='${CUE}':fontcolor=${DIM}:fontsize=32:x=(w-text_w)/2:y=H*0.58:enable='gte(t,1.2)'\
,drawtext=fontfile='${FONT}':text='${NUM} / 8':fontcolor=${DIM}:fontsize=28:x=(w-text_w)/2:y=H*0.86:enable='gte(t,0.3)'\
,drawbox=x=0:y=ih-6:w=iw:h=6:color=${ACC}@0.9:t=fill" \
    -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 30 \
    "$TMP/seg$i.mp4"
  echo "  ✓ 第 $NUM 式"
done

# 拼接
LIST="$TMP/list.txt"
: > "$LIST"
for i in $(seq 0 7); do echo "file 'seg$i.mp4'" >> "$LIST"; done
"$FF" -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
DUR=$("$FF" -i "$OUT" 2>&1 | grep Duration | cut -d' ' -f3)
echo
echo "✓ 已生成 $OUT"
echo "  体积 $SIZE · 时长 $DUR"
echo
echo "提示：拿到真实演示视频后，直接覆盖此文件即可（建议 H.264 + yuv420p + 无音轨，60 秒内）"
