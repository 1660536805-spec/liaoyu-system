# -*- coding: utf-8 -*-
"""改前(s4b) vs 改后(s4) 教练小窗逐式对照图 —— PIL 自绘（本机无 PingFang，用 Hiragino Sans GB）"""
import os, json, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = "/Users/leo/WorkBuddy/疗愈"
OUT = os.path.join(ROOT, "outputs/kit-wire")

BG      = (250, 248, 243)
CARD    = (255, 255, 255)
INK     = (34, 30, 26)
SUB     = (120, 110, 100)
ACCENT  = (176, 85, 46)     # 赭石
GREEN   = (110, 143, 124)   # 青瓷玉
LINE    = (214, 206, 194)
BAD     = (198, 85, 61)

def font(sz, w=3):
    cands = [("/System/Library/Fonts/Hiragino Sans GB.ttc", 0 if w <= 3 else 1),
             ("/System/Library/Fonts/STHeiti Medium.ttc", 0)]
    for p, idx in cands:
        try:
            return ImageFont.truetype(p, sz, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()

F_TITLE = font(40, 6)
F_SUB   = font(21, 3)
F_SEC   = font(26, 6)
F_NAME  = font(17, 3)
F_SMALL = font(15, 3)

def load_walk(base):
    return json.load(open(os.path.join(base, "walk.json"), encoding="utf-8"))

W_B, A_B = load_walk(os.path.join(OUT, "before")), load_walk(os.path.join(OUT, "after"))

def shot_dir(base):
    return os.path.join(OUT, "before") if "s4b" in base else os.path.join(OUT, "after")

B_DIR, A_DIR = shot_dir(W_B["base"]), shot_dir(A_B["base"])

def find(dirp, style, i):
    g = sorted(glob.glob(os.path.join(dirp, f"{style}-step-{i:02d}-*.png")))
    return g[0] if g else None

STYLES = [
    ("baduanjin", "八段锦 · 对照组（路径未改动，应逐式不变）"),
    ("wuqinxi",   "五禽戏 · 5 式：canvas 小人 → 房间版小人"),
    ("taiji",     "太极 · 24 式：canvas 小人 → 房间版小人"),
]

CELL_W, CELL_H = 150, 176
GAP, PAD = 8, 16
COLS = 6
BLOCK_HEAD = 46

def kind_of(steps, style, i):
    for s in steps:
        if s["i"] == i:
            return s["kind"]
    return "?"

def build(style, title):
    bs = W_B["styles"][style]["steps"]
    as_ = A_B["styles"][style]["steps"]
    n = len(as_)
    rows = (n + COLS - 1) // COLS
    block_w = PAD * 2 + COLS * CELL_W + (COLS - 1) * GAP
    block_h = BLOCK_HEAD + PAD + rows * (CELL_H + 22) + PAD
    mid = 56
    margin = 40
    title_h = 108
    W = margin * 2 + block_w * 2 + mid
    H = title_h + block_h + margin

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((margin, 26), title, font=F_TITLE, fill=INK)
    d.text((margin, 74), "同一式左右对齐 · 小窗即跟练页教练形象 · 截图 192×216 @2x", font=F_SUB, fill=SUB)

    def block(x0, y0, label, steps, dirp, tint):
        d.rounded_rectangle([x0, y0, x0 + block_w, y0 + block_h], 14, fill=CARD, outline=LINE, width=1)
        d.rounded_rectangle([x0, y0, x0 + block_w, y0 + BLOCK_HEAD], 14, fill=tint)
        d.rectangle([x0, y0 + BLOCK_HEAD - 14, x0 + block_w, y0 + BLOCK_HEAD], fill=tint)
        d.text((x0 + PAD, y0 + 11), label, font=F_SEC, fill=(255, 255, 255))
        for k in range(n):
            r, c = divmod(k, COLS)
            cx = x0 + PAD + c * (CELL_W + GAP)
            cy = y0 + BLOCK_HEAD + PAD + r * (CELL_H + 22)
            p = find(dirp, style, k)
            st = next((s for s in steps if s["i"] == k), None)
            if p:
                im = Image.open(p).convert("RGB").resize((CELL_W, CELL_H - 6))
                img.paste(im, (cx, cy + 4))
                d.rectangle([cx, cy + 4, cx + CELL_W - 1, cy + CELL_H - 3], outline=LINE, width=1)
            else:
                d.rectangle([cx, cy + 4, cx + CELL_W, cy + CELL_H - 2], outline=BAD, width=2)
                d.text((cx + 12, cy + 60), "缺失", font=F_NAME, fill=BAD)
            # 标号 + 式名
            nm = (st["name"].split("·")[-1].strip() if st else "?")
            d.text((cx + 2, cy + CELL_H + 1), f"{k+1}. {nm}", font=F_NAME, fill=INK)

    label_b = "改前 · dist/s4b"
    label_a = "改后 · dist/s4"
    # 在区块标题右侧加形象分布
    def kinds(steps):
        m = {}
        for s in steps:
            m[s["kind"]] = m.get(s["kind"], 0) + 1
        return "  ".join(f"{k}×{v}" for k, v in m.items())
    x_a = margin
    x_b = margin + block_w + mid
    block(x_a, title_h, label_b + "   " + kinds(bs), bs, B_DIR, SUB)
    block(x_b, title_h, label_a + "   " + kinds(as_), as_, A_DIR, GREEN)
    d.text((x_a + block_w + 12, title_h + block_h // 2), "→", font=font(64, 6), fill=ACCENT)

    out = os.path.join(OUT, f"对照-改前vs改后-{style}.png")
    img.save(out)
    print("saved", out, img.size)
    return out

outs = [build(s, t) for s, t in STYLES]
print("\\n".join(outs))
