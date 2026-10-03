#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成「最终版设计稿 vs 当前主壳 vs 当前 s4」三列对照长图。
用法: python compare-final.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

WS = "/Users/leo/WorkBuddy/疗愈"
REF = "/Users/leo/Desktop/ui/最终版"
CUR = os.path.join(WS, "outputs/ui-compare/out/current")
OUT = os.path.join(WS, "outputs/ui-compare/out/最终版-当前形态-对照.png")

COLS = ["最终版设计稿（你要的）", "当前·主壳 dist/", "当前·s4 应用 /s4/"]
ROWS = [
    ("首页",            "2-1 首页.png",              "main-2-1-home.png",  "s4-root.png"),
    ("音疗页",          "1-音疗页面.png",            "main-1-audio.png",   "s4-sound.png"),
    ("八段锦进入页",    "2-2 八段锦练习进入页.png",  "main-2-2-intro.png", "s4-prepare.png"),
    ("跟我练主页面",    "2-3 跟我练主页面.png",      "main-2-3-practice.png", "s4-train.png"),
    ("结束页",          "2-4 结束页.png",            "main-2-4-done.png",  None),
    ("我的",            "3-1 我的.png",              "main-3-1-profile.png", "s4-me.png"),
    ("我的·身体数据",   "3-2 我的-身体数据页.png",   "main-3-2-body.png",  None),
    ("首次进入问题页",  "01首次进入问题页.png",      "main-01-question.png", None),
    ("进入加载页",      "00 进入加载页.png",         "main-00-loading.png", None),
]

W = 330          # 每列图宽
GAP = 14
LBL_H = 26       # 行标题高
HDR_H = 46       # 表头高
BG = (250, 248, 243)
LINE = (200, 190, 175)
INK = (60, 50, 40)
RED = (178, 92, 61)


def font(sz, bold=False):
    for p in ["/System/Library/Fonts/PingFang.ttc",
              "/System/Library/Fonts/STHeiti Medium.ttc",
              "/System/Library/Fonts/Hiragino Sans GB.ttc"]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz, index=1 if bold else 0)
            except Exception:
                try:
                    return ImageFont.truetype(p, sz)
                except Exception:
                    pass
    return ImageFont.load_default()


F_HDR = font(20, True)
F_ROW = font(19, True)
F_COL = font(17, True)


def load(path):
    if not path:
        return None
    p = path if os.path.isabs(path) else os.path.join(
        REF if path.endswith(".png") and not path.startswith("main-") and not path.startswith("s4-") else CUR, path)
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert("RGB")
    r = W / im.width
    return im.resize((W, max(1, int(im.height * r))), Image.LANCZOS)


# 预载所有行
loaded = []
col_h = [0, 0, 0]
for name, a, b, c in ROWS:
    ims = [load(a), load(b), load(c)]
    loaded.append((name, ims))
    for i, im in enumerate(ims):
        if im:
            col_h[i] = max(col_h[i], im.height)

canvas_w = GAP + 3 * (W + GAP)

CHUNK = 3
chunks = [loaded[i:i + CHUNK] for i in range(0, len(loaded), CHUNK)]
for ci, group in enumerate(chunks):
    row_heights = [max((im.height if im else 0) for im in ims) for _, ims in group]
    total_h = HDR_H + GAP + sum(LBL_H + h + GAP for h in row_heights) + GAP
    canvas = Image.new("RGB", (canvas_w, total_h), BG)
    d = ImageDraw.Draw(canvas)

    y = GAP
    for i, cn in enumerate(COLS):
        x = GAP + i * (W + GAP)
        d.text((x, y), cn, font=F_COL, fill=RED if i == 0 else INK)
    y = HDR_H

    for name, ims in group:
        d.line([(GAP, y - 6), (canvas_w - GAP, y - 6)], fill=LINE, width=1)
        d.text((GAP, y + 2), name, font=F_ROW, fill=INK)
        rh = max((im.height if im else 0) for im in ims)
        ty = y + LBL_H
        for i, im in enumerate(ims):
            x = GAP + i * (W + GAP)
            if im:
                canvas.paste(im, (x, ty))
                d.rectangle([x, ty, x + im.width - 1, ty + im.height - 1], outline=LINE, width=1)
            else:
                d.rectangle([x, ty, x + W - 1, ty + 300], outline=LINE, width=1)
                d.text((x + 12, ty + 12), "—", font=F_COL, fill=LINE)
        y = ty + rh + GAP

    path = OUT.replace(".png", "-%d.png" % (ci + 1))
    canvas.save(path)
    print("saved", path, canvas.size)
