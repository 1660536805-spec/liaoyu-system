#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 probe-wq10.cjs 抓的逐式教练小窗截图拼成一张对照图（改前 5 式 / 改后 10 式）。"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(HERE, 'summary.json'), encoding='utf-8'))

FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
f_title = ImageFont.truetype(FONT, 30)
f_lab = ImageFont.truetype(FONT, 22)

after = S['targets']['after']['steps']
before = S['targets']['before']['steps']

# 取第一张量尺寸
im0 = Image.open(os.path.join(HERE, after[0]['shot']))
CW, CH = im0.size
PAD, GAP, TOP, ROWGAP, LAB = 24, 12, 96, 40, 34

cols = max(len(after), len(before))
W = PAD * 2 + cols * CW + (cols - 1) * GAP
H = TOP + (CH + LAB) * 2 + ROWGAP + PAD
canvas = Image.new('RGB', (W, H), (251, 243, 227))  # 宣纸米
d = ImageDraw.Draw(canvas)
d.text((PAD, 18), '五禽戏 · 教练小窗逐式对照（上：改前 5 式 / 下：改后 10 式）', font=f_title, fill=(43, 43, 43))

def row(steps, y0):
    for i, st in enumerate(steps):
        x = PAD + i * (CW + GAP)
        p = os.path.join(HERE, st['shot'])
        if os.path.exists(p):
            im = Image.open(p).convert('RGB').resize((CW, CH))
            canvas.paste(im, (x, y0))
        # 序号 + 式名 + 形象
        lab = f"{i+1}. {st['curName']}"
        d.text((x + 4, y0 + CH + 6), lab, font=f_lab, fill=(176, 85, 46))
        d.text((x + 4, y0 + CH + 6 + 24), st['status'], font=f_lab, fill=(110, 143, 124))

row(before, TOP)
row(after, TOP + CH + LAB + ROWGAP)
out = os.path.join(HERE, '对照-教练小窗-改前vs改后.png')
canvas.save(out)
print('已写出', out, canvas.size)
