#!/usr/bin/env python3
"""裁除新生成插画右下角 AI 水印，重命名并压缩到网页尺寸。"""
import os
from PIL import Image

ART = "/Users/leo/WorkBuddy/疗愈/dist/art"

MAPPING = {
    "Delicate_Chinese_watercolor_il_2026-10-03T09-08-57.png": ("q-neck.jpg", (520, 700)),
    "Delicate_Chinese_watercolor_il_2026-10-03T09-09-35.png": ("q-back.jpg", (520, 700)),
    "Delicate_Chinese_watercolor_il_2026-10-03T09-11-18.png": ("q-food.jpg", (760, 760)),
    "Delicate_Chinese_watercolor_il_2026-10-03T09-13-25.png": ("q-sleep.jpg", (520, 700)),
    "Delicate_Chinese_watercolor_il_2026-10-03T09-13-58.png": ("q-mood.jpg", (520, 700)),
    "Serene_Chinese_ink_and_wash_la_2026-10-03T09-14-37.png": ("q-none.jpg", (520, 700)),
}

for src, (dst, size) in MAPPING.items():
    p = os.path.join(ART, src)
    if not os.path.exists(p):
        print("missing:", src)
        continue
    im = Image.open(p).convert("RGB")
    w, h = im.size
    # 裁掉底部约 11%（水印区域）
    im = im.crop((0, 0, w, int(h * 0.89)))
    im.thumbnail(size, Image.LANCZOS)
    out = os.path.join(ART, dst)
    im.save(out, quality=82)
    print(dst, im.size, f"{os.path.getsize(out)//1024}KB")
    os.remove(p)

print("done")
