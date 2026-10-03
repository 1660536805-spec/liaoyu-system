from PIL import Image
import os, collections, sys

REF = "/Users/leo/Desktop/ui/最终版"
FILES = sorted(f for f in os.listdir(REF) if f.endswith(".png"))

def hexc(t):
    return "#%02X%02X%02X" % t[:3]

print("=" * 72)
print("A. 主导色（量化后按占比排序）")
print("=" * 72)
for f in FILES:
    im = Image.open(os.path.join(REF, f)).convert("RGB")
    im2 = im.resize((im.width // 3, im.height // 3))
    q = im2.quantize(colors=12, method=Image.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    print(f"\n{f}")
    for n, idx in counts[:9]:
        rgb = tuple(pal[idx * 3: idx * 3 + 3])
        pct = 100.0 * n / (im2.width * im2.height)
        print(f"   {hexc(rgb)}  {pct:5.1f}%  rgb{rgb}")
