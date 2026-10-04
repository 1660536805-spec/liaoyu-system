#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 shots/mXX_uYYY.png 拼成「10 式 × 5 帧」总览图（裁到画面中间的小人区域）"""
import os, glob
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(HERE, 'shots')
NAMES = ['起势', '两手托天', '左右开弓', '调理脾胃', '往后瞧',
         '摇头摆尾', '两手攀足', '攒拳怒目', '背后七颠', '收势']
US = [0, 25, 50, 75, 100]
CW, CH = 200, 200          # 每格
LAB = 74                   # 左侧文字栏
PAD = 6

rows, cols = 10, len(US)
W = LAB + cols * (CW + PAD) + PAD
H = rows * (CH + PAD) + PAD
canvas = Image.new('RGB', (W, H), (245, 248, 248))
d = ImageDraw.Draw(canvas)

def font(sz):
    for p in ['/System/Library/Fonts/Supplemental/Songti.ttc',
              '/System/Library/Fonts/PingFang.ttc',
              '/Library/Fonts/Arial Unicode.ttf']:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

f = font(15)
fh = font(12)

for r in range(rows):
    y = PAD + r * (CH + PAD)
    d.text((8, y + 78), f'{r+1}. {NAMES[r]}', fill=(30, 46, 59), font=f)
    for c, u in enumerate(US):
        fp = os.path.join(SH, f'm{r:02d}_u{u:03d}.png')
        if not os.path.exists(fp):
            continue
        im = Image.open(fp).convert('RGB')
        w, h = im.size
        # 裁中心偏下（小人站在画面中央偏下）
        cw, ch = int(w * 0.34), int(h * 0.62)
        left = (w - cw) // 2
        top = int(h * 0.20)
        top = min(top, h - ch)
        im = im.crop((left, top, left + cw, top + ch)).resize((CW, CH), Image.LANCZOS)
        x = LAB + PAD + c * (CW + PAD)
        canvas.paste(im, (x, y))
        d.rectangle([x, y, x + CW - 1, y + CH - 1], outline=(190, 205, 210))
        d.text((x + 4, y + 4), f'u={u}%', fill=(210, 90, 40), font=fh)

out = os.path.join(HERE, 'overview-10x5.png')
canvas.save(out)
print('总览 →', out, canvas.size)
