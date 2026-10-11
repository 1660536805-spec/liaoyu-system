#!/usr/bin/env python3
# 构建产物(dist) vs 当前源码(dev) 教练小窗首帧对比
import os, glob
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(os.path.dirname(ROOT), 'coach-check-dist')
DEV = ROOT
STYLES = [('baduanjin', '八段锦'), ('wuqinxi', '五禽戏'), ('taiji', '太极')]

TH = 190
cw, ch = TH, int(TH * 216 / 192)
pad, cap = 12, 26
W = 2 * (cw + pad) + pad
H = 34 + len(STYLES) * (ch + cap + pad) + 10
sheet = Image.new('RGB', (W, H), (250, 247, 240))
d = ImageDraw.Draw(sheet)
d.text((pad, 8), '教练小窗 · 构建产物 dist/s4（左，线上现状） vs 当前源码 train/src（右，E1/E2 未重建）', fill=(30, 30, 30))
d.text((pad, 20), '左列多为「暂无示范动画」占位；右列已能画出可动小人', fill=(120, 90, 60))

y = 34
for sid, label in STYLES:
    lp = os.path.join(DIST, f'{sid}-play-0.png')
    rp = os.path.join(DEV, f'{sid}-play-0.png')
    d.text((pad, y), f'{label}', fill=(150, 60, 30))
    yy = y + cap
    for i, p in enumerate([lp, rp]):
        x = pad + i * (cw + pad)
        if os.path.exists(p):
            im = Image.open(p).convert('RGB').resize((cw, ch))
            sheet.paste(im, (x, yy))
        else:
            d.rectangle([x, yy, x + cw, yy + ch], outline=(200, 200, 200))
            d.text((x + 8, yy + 8), '(无截图)', fill=(150, 150, 150))
        d.rectangle([x, yy, x + cw, yy + ch], outline=(210, 200, 180))
    y = yy + ch + pad
d.text((pad, H - 16), '左=dist/s4  |  右=dev(train/src)', fill=(120, 120, 120))
sheet.save(os.path.join(ROOT, 'coach-dist-vs-dev.png'))
print('ok ->', sheet.size)
