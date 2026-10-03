#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""最终版 2-3 跟练页 vs s4 真实识别页 并排对照"""
import os
from PIL import Image, ImageDraw, ImageFont

WS = "/Users/leo/WorkBuddy/疗愈"
A = "/Users/leo/Desktop/ui/最终版/2-3 跟我练主页面.png"
B = os.path.join(WS, "outputs/ui-compare/out/current/s4-train-fakecam.png")
OUT = os.path.join(WS, "outputs/ui-compare/out/跟练页-最终版vs实际识别页.png")

W = 470
GAP, HDR = 16, 44
BG, LINE, INK, RED = (250, 248, 243), (200, 190, 175), (60, 50, 40), (178, 92, 61)


def f(sz, bold=False):
    for p in ["/System/Library/Fonts/Hiragino Sans GB.ttc",
              "/System/Library/Fonts/STHeiti Medium.ttc",
              "/System/Library/Fonts/PingFang.ttc"]:
        if os.path.exists(p):
            for idx in ([1, 0] if bold else [0, 1]):
                try:
                    return ImageFont.truetype(p, sz, index=idx)
                except Exception:
                    pass
    return ImageFont.load_default()


def load(p):
    im = Image.open(p).convert("RGB")
    return im.resize((W, max(1, int(im.height * W / im.width))), Image.LANCZOS)


a, b = load(A), load(B)
H = max(a.height, b.height)
canvas = Image.new("RGB", (GAP + 2 * (W + GAP), HDR + H + GAP), BG)
d = ImageDraw.Draw(canvas)
d.text((GAP, 12), "最终版设计稿 2-3（你要的）", font=f(19, True), fill=RED)
d.text((GAP + W + GAP, 12), "实际运行的 s4 摄像头识别页（假摄像头）", font=f(19, True), fill=INK)
for i, im in enumerate([a, b]):
    x = GAP + i * (W + GAP)
    canvas.paste(im, (x, HDR))
    d.rectangle([x, HDR, x + im.width - 1, HDR + im.height - 1], outline=LINE, width=1)
canvas.save(OUT)
print("saved", OUT, canvas.size)
