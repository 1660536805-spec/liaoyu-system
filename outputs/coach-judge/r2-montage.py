#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 r2-ab.cjs 采到的 before / after 小窗特写拼成「改前 | 改后」对照图，
   并在每行标注该式左臂肘角的峰值（改前 → 改后）。纯 PIL，不联网。
   用法：python outputs/coach-judge/r2-montage.py
"""
import json, os, glob
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
R2 = os.path.join(HERE, 'r2')
OUT = os.path.join(R2, 'P2-2-幅度治本-对照图.png')

FONT_S = '/System/Library/Fonts/Supplemental/Songti.ttc'
FONT_H = '/System/Library/Fonts/Hiragino Sans GB.ttc'
NAME = ['起势', '两手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
        '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消', '收势']

BG = (17, 24, 30)
ROW_H = 300
LBL_W = 330
PAD = 18
HEAD_H = 170


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def figure_bbox(im, thr=70):
    """找出非背景（亮部）区域；比背景暗/近黑的都当背景"""
    g = im.convert('L').point(lambda v: 255 if v > thr else 0)
    bb = g.getbbox()
    return bb


def crop_fig(im, pad=10):
    bb = figure_bbox(im)
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad); y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit(im, h):
    w = max(1, int(im.width * h / im.height))
    return im.resize((w, h), Image.LANCZOS)


def load(path):
    im = Image.open(path).convert('RGB')
    return crop_fig(im)


def main():
    b_stats = json.load(open(os.path.join(R2, 'before', 'before_stats.json'), encoding='utf-8'))
    a_stats = json.load(open(os.path.join(R2, 'after', 'after_stats.json'), encoding='utf-8'))
    bm = {m['idx']: m for m in b_stats['perMove']}
    am = {m['idx']: m for m in a_stats['perMove']}

    shots = sorted(os.path.basename(p) for p in glob.glob(os.path.join(R2, 'before', 'before_mv*.png')))
    rows = []
    for s in shots:
        a = os.path.join(R2, 'after', s.replace('before_', 'after_'))
        if not os.path.exists(a):
            continue
        bi, ai = load(os.path.join(R2, 'before', s)), load(a)
        # 统一高度
        h = ROW_H - 2 * PAD
        bi, ai = fit(bi, h), fit(ai, h)
        # 文件名解析 idx / u
        base = s[:-4]
        idx = int(base.split('_mv')[1].split('_')[0])
        u = int(base.split('_u')[1]) / 100
        rows.append((idx, u, bi, ai))

    W = LBL_W + 2 * (ROW_H + PAD) + 3 * PAD
    H = HEAD_H + len(rows) * (ROW_H + PAD) + PAD
    canvas = Image.new('RGB', (W, H), (250, 247, 240))
    d = ImageDraw.Draw(canvas)

    f_title = font(FONT_S, 34)
    f_sub = font(FONT_H, 18)
    f_name = font(FONT_S, 24)
    f_small = font(FONT_H, 17)
    f_col = font(FONT_S, 22)

    d.text((PAD + 4, 18), 'P2-2 幅度治本 · 教练小窗小人「改前 | 改后」对照', font=f_title, fill=(43, 37, 30))
    d.text((PAD + 4, 64),
           '触发点：手位半径上界 R_MAX=56 < 真实臂长 60 ⇒ 该伸直的手位数学上永远伸不直。',
           font=f_sub, fill=(110, 100, 88))
    d.text((PAD + 4, 90),
           '改法：R_MAX 56→60；托天/开弓/悬垂/单举手位外推；IK 上夹 UA+FA-0.5 → UA+FA。',
           font=f_sub, fill=(110, 100, 88))
    d.text((PAD + 4, 116),
           '肘角峰值越高越伸直（全展 ~180°）；摇头摆尾 / 攒拳本应弯曲，未改。',
           font=f_sub, fill=(150, 110, 80))
    d.text((PAD + 4, 142),
           '左列改前 · 右列改后；每行取该式造型高点。',
           font=f_sub, fill=(150, 110, 80))

    # 列标题
    y0 = HEAD_H - 26
    d.text((PAD + 4, y0), '动作 · 左臂肘角峰值', font=f_col, fill=(43, 37, 30))
    d.text((PAD + LBL_W + PAD, y0), '改前', font=f_col, fill=(163, 74, 36))
    d.text((PAD + LBL_W + PAD + ROW_H + PAD, y0), '改后', font=f_col, fill=(74, 115, 98))

    y = HEAD_H - 26 + 34
    for idx, u, bi, ai in rows:
        d.rectangle([PAD, y, W - PAD, y + ROW_H], fill=(255, 253, 248))
        nm = NAME[idx] if idx < len(NAME) else f'#{idx}'
        d.text((PAD + 12, y + 20), nm, font=f_name, fill=(43, 37, 30))
        d.text((PAD + 12, y + 54), f'房间版第 {idx} 式 · 进度 u={u:.2f}', font=f_small, fill=(130, 120, 108))
        bv, av = bm.get(idx, {}).get('max', '-'), am.get(idx, {}).get('max', '-')
        col = (74, 115, 98) if float(av) - float(bv) > 8 else (130, 120, 108)
        d.text((PAD + 12, y + 88), f'{bv}°  →  {av}°', font=f_name, fill=col)
        d.text((PAD + 12, y + 124), '全展参考 ~180° / 伸手上限 76.6', font=f_small, fill=(160, 152, 140))
        canvas.paste(bi, (PAD + LBL_W + PAD, y + PAD))
        canvas.paste(ai, (PAD + LBL_W + PAD + ROW_H + PAD, y + PAD))
        y += ROW_H + PAD

    canvas.save(OUT)
    print('对照图 →', OUT, canvas.size)


if __name__ == '__main__':
    main()
