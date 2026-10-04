#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 zoom_mN_*.png 拼成两行条带（默认取第 6 式攀足）。用法：strip.py [moveIdx]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(HERE, 'shots')
M = sys.argv[1] if len(sys.argv) > 1 else '6'
imgs = sorted(f for f in os.listdir(SH) if f.startswith(f'zoom_m{M}_') and 'strip' not in f)
ims = [Image.open(os.path.join(SH, f)).convert('RGB') for f in imgs]
w, h = ims[0].size
sc = 0.72
w2, h2 = int(w * sc), int(h * sc)
per = 3
rows = (len(ims) + per - 1) // per
out = Image.new('RGB', (w2 * per, h2 * rows), (248, 248, 246))
d = ImageDraw.Draw(out)
try: fnt = ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc', 18)
except Exception: fnt = ImageFont.load_default()
for i, im in enumerate(ims):
    r, c = divmod(i, per)
    out.paste(im.resize((w2, h2), Image.LANCZOS), (c * w2, r * h2))
    d.rectangle([c * w2, r * h2, c * w2 + w2 - 1, r * h2 + h2 - 1], outline=(200, 210, 214))
    d.text((c * w2 + 8, r * h2 + 6), imgs[i].replace(f'zoom_m{M}_', 'u=').replace('.png', '%'), fill=(205, 70, 25), font=fnt)
p = os.path.join(SH, f'zoom_m{M}_strip.png')
out.save(p)
print('→', p, out.size)
