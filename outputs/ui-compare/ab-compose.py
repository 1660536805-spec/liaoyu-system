"""把改版前/后的截图并排拼成一张对比图（PIL）。"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]


def load_font(size):
    for fp in FONT_CANDIDATES:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()


def compose(before_name, after_name, out_name, label_h=64, gap=28, margin=28, bg=(255, 255, 255)):
    b = Image.open(os.path.join(OUT, before_name)).convert("RGB")
    a = Image.open(os.path.join(OUT, after_name)).convert("RGB")

    max_h = max(b.height, a.height)
    canvas_w = margin * 3 + b.width + a.width
    canvas_h = margin * 2 + label_h + max_h
    canvas = Image.new("RGB", (canvas_w, canvas_h), bg)
    draw = ImageDraw.Draw(canvas)

    font = load_font(34)
    small = load_font(24)

    bx = margin
    ax = margin * 2 + b.width

    draw.text((bx, margin - 6), "改版前  BEFORE", font=font, fill=(90, 90, 90))
    draw.text((ax, margin - 6), "改版后  AFTER", font=font, fill=(196, 71, 47))

    draw.text((bx, margin + 40), "(189 行 / 顶部「今天想照顾哪里」起)", font=small, fill=(150, 150, 150))
    draw.text((ax, margin + 40), "(474 行 / 「弦养·点单」版式)", font=small, fill=(180, 120, 110))

    top = margin + label_h
    canvas.paste(b, (bx, top))
    canvas.paste(a, (ax, top))

    draw.line([(margin * 2 + b.width - gap // 2, top), (margin * 2 + b.width - gap // 2, top + max_h)],
              fill=(225, 225, 225), width=2)

    out_path = os.path.join(OUT, out_name)
    canvas.save(out_path, quality=92)
    print(f"{out_name}  {canvas_w}x{canvas_h}  ->  {out_path}")
    return out_path


if __name__ == "__main__":
    compose("before-full.png", "after-full.png", "compare-full.png")
    compose("before-top.png", "after-top.png", "compare-top.png")
