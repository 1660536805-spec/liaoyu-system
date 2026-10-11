#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抽帧核验三支兜底预录视频：每式取中间一帧，拼成对照图，顺带校验时长=8×式数。"""
import json
import os
import re
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TRAIN = os.path.abspath(os.path.join(HERE, '..'))
ASSETS = os.path.join(TRAIN, 'public', 'assets')
OUT = os.path.abspath(os.path.join(TRAIN, '..', 'outputs', 'fallback-check'))
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
EACH = 8
STYLES = {'baduanjin': 8, 'wuqinxi': 10, 'taiji': 24}

os.makedirs(OUT, exist_ok=True)


def dur(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'default=nw=1:nk=1', p], capture_output=True, text=True)
    return float(r.stdout.strip())


def frame(p, t, dst):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t), '-i', p,
                    '-frames:v', '1', '-vf', 'scale=320:568', dst], check=True)


ok = True
for sid, n in STYLES.items():
    p = os.path.join(ASSETS, 'fallback-%s.mp4' % sid)
    d = dur(p)
    exp = n * EACH
    good = abs(d - exp) <= 0.6
    ok = ok and good
    print('%-10s 时长 %.2fs（期望 %ds）%s' % (sid, d, exp, '✓' if good else '✗'))

# 拼五禽戏十式对照（最能说明问题的一组）
tmp = tempfile.mkdtemp(prefix='fbchk-')
thumbs = []
for i in range(10):
    dst = os.path.join(tmp, 'w%02d.png' % i)
    frame(os.path.join(ASSETS, 'fallback-wuqinxi.mp4'), i * EACH + EACH * 0.8, dst)
    thumbs.append(dst)

cols, cw, ch = 5, 320, 568
canvas = Image.new('RGB', (cols * cw + 20 * (cols - 1) + 40, 2 * ch + 20 + 60), (251, 243, 227))
d = ImageDraw.Draw(canvas)
d.text((20, 18), '五禽戏兜底预录 · 每式抽中间一帧（第1式起）', font=ImageFont.truetype(FONT, 30), fill=(43, 43, 43))
for i, t in enumerate(thumbs):
    x = 20 + (i % cols) * (cw + 20)
    y = 60 + (i // cols) * (ch + 20)
    canvas.paste(Image.open(t), (x, y))
outp = os.path.join(OUT, '兜底预录-五禽戏抽帧.png')
canvas.save(outp)
print('对照图 →', outp)
sys.exit(0 if ok else 1)
