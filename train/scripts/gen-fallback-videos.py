#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「按拳种」的摄像头兜底预录视频（纯字幕卡）
================================================================
【为什么需要】
  三级兜底的第一级：摄像头失效（授权被拒/设备被占/识别不出）时，跟练页切到
  预录视频垫场。此前只有**一支八段锦字幕卡**、全拳种共用（train/public/assets/fallback.mp4），
  于是「App 状态与教练小窗在演五禽戏第 1 式、主画面却在念八段锦第 2 式」——
  招数对不上。本脚本按拳种各出一支，主画面的式名/序号永远与当前拳种一致。

【产出】train/public/assets/
    fallback-baduanjin.mp4   八段锦 8 式
    fallback-wuqinxi.mp4     五禽戏 10 式
    fallback-taiji.mp4       太极 24 式
  式名 / 要领 取自 train/src/data/{moves.json, styles.js}（单一真源，改了内容重跑本脚本即可）。

【为什么不沿用旧脚本的 drawtext】
  本机 ffmpeg（/opt/homebrew）**未编译 freetype ⇒ 没有 drawtext 滤镜**。
  故改为：Pillow 画好每式 3 张「字幕卡」PNG（分阶段出现，模拟逐行淡入），
  ffmpeg 只做「图片序列 → h264」的编码与拼接。零文字滤镜依赖。

跑法：python3 train/scripts/gen-fallback-videos.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TRAIN = os.path.abspath(os.path.join(HERE, '..'))
DATA = os.path.join(TRAIN, 'src', 'data')
OUTDIR = os.path.join(TRAIN, 'public', 'assets')

FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
W, H, FPS, EACH = 640, 1136, 25, 8          # 每式 8 秒（与原八段锦卡一致）
BG = (0x16, 0x13, 0x0f)
FG = (0xe8, 0xe0, 0xd0)
DIM = (0x8a, 0x80, 0x70)
ACC = (0xc8, 0x55, 0x3d)

# 一式 3 张卡（模拟「式序 → 式名 → +要领」逐行出现）；两个切换点（秒）
CUTS = [0.5, 1.1]
ORDER = ['baduanjin', 'wuqinxi', 'taiji']


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def moves_of(style_id):
    """返回 [(式名, 要领), ...]。八段锦读 moves.json；五禽戏/太极从 styles.js 抽 *_MOVES。"""
    if style_id == 'baduanjin':
        arr = json.loads(read(os.path.join(DATA, 'moves.json')))
        return [(m['name'], m.get('tip') or m.get('cue') or '') for m in arr]
    src = read(os.path.join(DATA, 'styles.js'))
    arr_name = {'wuqinxi': 'WUQINXI_MOVES', 'taiji': 'TAIJI_MOVES'}[style_id]
    m = re.search(r'const %s = \[(.*?)\n\]' % arr_name, src, re.S)
    if not m:
        raise SystemExit('styles.js 里找不到 %s 数组' % arr_name)
    pair = re.findall(r"name:\s*'([^']*)',\s*tip:\s*'([^']*)'", m.group(1), re.S)
    if not pair:
        raise SystemExit('%s 里没抽到 式名/要领' % arr_name)
    return pair


def wrap(text, font, max_w):
    """按像素宽度折行（CJK 友好）。"""
    lines, cur = [], ''
    for ch in text:
        if ch == '\n':
            lines.append(cur); cur = ''; continue
        if cur and font.getlength(cur + ch) > max_w:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def render_card(idx, total, name, tip, stage):
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    fT = ImageFont.truetype(FONT, 64)
    fN = ImageFont.truetype(FONT, 54)
    fC = ImageFont.truetype(FONT, 30)
    fX = ImageFont.truetype(FONT, 28)
    cx = W // 2
    d.text((cx, H * 0.30), '第 %d 式' % idx, font=fT, fill=ACC, anchor='mm')
    if stage >= 1:
        d.text((cx, H * 0.44), name, font=fN, fill=FG, anchor='mm')
    if stage >= 2:
        lines = wrap(tip, fC, W - 90)[:3]
        y = H * 0.60 - (len(lines) - 1) * 21
        for ln in lines:
            d.text((cx, y), ln, font=fC, fill=DIM, anchor='mm')
            y += 42
        d.text((cx, H * 0.86), '%d / %d' % (idx, total), font=fX, fill=DIM, anchor='mm')
    d.rectangle([0, H - 6, W, H], fill=ACC)
    return img


def ffmpeg(args):
    exe = shutil.which('ffmpeg') or 'ffmpeg'
    r = subprocess.run([exe, '-hide_banner', '-loglevel', 'error'] + args,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if r.returncode != 0:
        sys.stderr.write(r.stdout.decode('utf-8', 'replace'))
        raise SystemExit('ffmpeg 失败（退出码 %d）' % r.returncode)


def build_style(style_id, moves):
    total = len(moves)
    durs = [CUTS[0], CUTS[1] - CUTS[0], EACH - CUTS[1]]   # 0.5 / 0.6 / 6.9 = 8s
    tmp = tempfile.mkdtemp(prefix='fb-%s-' % style_id)
    try:
        entries = []
        for i, (name, tip) in enumerate(moves, 1):
            for s in range(3):
                p = os.path.join(tmp, 'm%02d_s%d.png' % (i, s))
                render_card(i, total, name, tip, s).save(p)
                entries.append((p, durs[s]))
        lines = []
        for p, du in entries:
            lines.append("file '%s'" % p)
            lines.append('duration %.3f' % du)
        lines.append("file '%s'" % entries[-1][0])        # concat demuxer：末帧需重复一次
        lst = os.path.join(tmp, 'list.txt')
        with open(lst, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
        out = os.path.join(OUTDIR, 'fallback-%s.mp4' % style_id)
        ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', lst,
                '-vf', 'fps=%d,format=yuv420p' % FPS,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
                '-t', '%.3f' % (total * EACH),   # 硬裁掉 concat 末帧重复带来的拖尾
                '-movflags', '+faststart', out])
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    for sid in ORDER:
        mv = moves_of(sid)
        out = build_style(sid, mv)
        print('  ✓ %-10s %2d 式 → %s（%.1f KB）' % (
            sid, len(mv), os.path.relpath(out, TRAIN), os.path.getsize(out) / 1024))
    print('完成。生成器读 styles.js/moves.json；改了式名/要领重跑本脚本即可。')


if __name__ == '__main__':
    main()
