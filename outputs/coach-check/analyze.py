#!/usr/bin/env python3
# 分析探针产物：帧间差（证明在动）+ 拼一张对照图供人眼确认动作形态
import os, json, glob
from PIL import Image, ImageDraw

D = os.path.join(os.path.dirname(os.path.abspath(__file__)))
STYLES = ['baduanjin', 'wuqinxi', 'taiji']
LABEL = {'baduanjin': '八段锦', 'wuqinxi': '五禽戏', 'taiji': '太极'}


def diff_ratio(a, b):
    """两张同尺寸图的逐像素平均绝对差 / 255"""
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    if ia.size != ib.size:
        ib = ib.resize(ia.size)
    pa, pb = ia.getdata(), ib.getdata()
    n = len(pa)
    s = 0
    for (r1, g1, b1), (r2, g2, b2) in zip(pa, pb):
        s += abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
    return s / (n * 3 * 255)


rows = []
report = {}
for st in STYLES:
    plays = sorted(glob.glob(os.path.join(D, f'{st}-play-*.png')))
    switches = sorted(glob.glob(os.path.join(D, f'{st}-switch-*.png')))
    dd = [round(diff_ratio(plays[i], plays[i + 1]), 4) for i in range(len(plays) - 1)]
    report[st] = {'play_frames': len(plays), 'consecutive_diff': dd}
    if plays:
        ref = plays[0]
        vs_switch = [round(diff_ratio(ref, s), 4) for s in switches]
        report[st]['first_vs_switch_diff'] = vs_switch
    rows.append((st, plays, switches))

print(json.dumps(report, ensure_ascii=False, indent=2))

# ---- 拼对照图 ----
TH = 150
cols = 7  # play0..3 + switch0..2
pad, cap = 8, 22
cellw, cellh = TH, int(TH * 216 / 192)
W = cols * (cellw + pad) + pad
H = len(rows) * (cellh + cap + pad) + pad + 30
sheet = Image.new('RGB', (W, H), (250, 247, 240))
d = ImageDraw.Draw(sheet)
d.text((pad, 8), '教练小窗 · 播放(左4帧,间隔0.8s) + 换式(右3帧,每次跳过本式)', fill=(40, 40, 40))
y = 30
for st, plays, switches in rows:
    imgs = plays[:4] + switches[:3]
    d.text((pad, y), f'{LABEL[st]}', fill=(150, 60, 30))
    yy = y + cap
    for i in range(cols):
        x = pad + i * (cellw + pad)
        if i < len(imgs):
            im = Image.open(imgs[i]).convert('RGB').resize((cellw, cellh))
            sheet.paste(im, (x, yy))
            d.rectangle([x, yy, x + cellw, yy + cellh], outline=(210, 200, 180))
    y = yy + cellh + pad + 4
sheet.save(os.path.join(D, 'coach-contact-sheet.png'))
print('\ncontact sheet ->', os.path.join(D, 'coach-contact-sheet.png'), sheet.size)
