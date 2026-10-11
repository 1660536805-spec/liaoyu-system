#!/usr/bin/env python3
# 循环连续性分析：相邻帧差 + 自相关（找循环周期）+ 回卷点是否跳变
import os, glob, json
from PIL import Image, ImageDraw

D = os.path.join(os.path.dirname(os.path.abspath(__file__)))


def diff_ratio(a, b):
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    if ia.size != ib.size:
        ib = ib.resize(ia.size)
    pa = list(ia.getdata()); pb = list(ib.getdata())
    n = len(pa); s = 0
    for (r1, g1, b1), (r2, g2, b2) in zip(pa, pb):
        s += abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
    return s / (n * 3 * 255)


for st in ['taiji', 'wuqinxi']:
    fs = sorted(glob.glob(os.path.join(D, f'{st}-loop-[0-9][0-9].png')))
    if len(fs) < 4:
        continue
    adj = [diff_ratio(fs[i], fs[i + 1]) for i in range(len(fs) - 1)]
    mx = max(adj); mn = min(adj); avg = sum(adj) / len(adj)
    print(f'[{st}] 帧数={len(fs)}  相邻帧差: 均值={avg:.4f} 最大={mx:.4f} @i={adj.index(mx)} 最小={mn:.4f}')
    # 自相关：找非零 lag 的最小平均差 ≈ 周期
    best = None
    for lag in range(8, min(24, len(fs) - 1)):
        v = sum(diff_ratio(fs[i], fs[i + lag]) for i in range(0, len(fs) - lag)) / (len(fs) - lag)
        if best is None or v < best[1]:
            best = (lag, v)
    print(f'        最相似 lag={best[0]} 帧 ≈ {best[0] * 0.3:.1f}s（均差 {best[1]:.4f}）')
    # 拼条带（13 列 × 2 行，便于看清）
    TH = 120
    cw, ch = TH, int(TH * 216 / 192)
    cols = 13
    rows = (len(fs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cw + 4) + 4, rows * (ch + 20) + 24), (250, 247, 240))
    d = ImageDraw.Draw(sheet)
    d.text((6, 5), f'{st} 循环连续采样(每0.3s一帧, 共{len(fs)}帧)  上排 t=0~3.9s / 下排 t=3.9~7.8s', fill=(40, 40, 40))
    for i, f in enumerate(fs):
        r, c = divmod(i, cols)
        im = Image.open(f).convert('RGB').resize((cw, ch))
        sheet.paste(im, (4 + c * (cw + 4), 20 + r * (ch + 20)))
    sheet.save(os.path.join(D, f'{st}-loop-strip.png'))
    print(f'        strip -> {st}-loop-strip.png {sheet.size}')
