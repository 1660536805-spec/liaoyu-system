from PIL import Image
import os

ART = "/Users/leo/WorkBuddy/疗愈/dist/art"

# target longest edge, output format
SPEC = {
    "landscape.png": (900, "jpg"),
    "guqin.png": (760, "png"),
    "figure-cloud.png": (700, "png"),
    "figure-pose.png": (700, "png"),
    "cloud.png": (700, "jpg"),
    "card-landscape.png": (520, "jpg"),
}

for name, (longest, fmt) in SPEC.items():
    p = os.path.join(ART, name)
    im = Image.open(p).convert("RGB")
    w, h = im.size
    scale = longest / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    base = name.rsplit(".", 1)[0]
    if fmt == "jpg":
        out = os.path.join(ART, base + ".jpg")
        im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
        if name.endswith(".png"):
            os.remove(p)
    else:
        out = p
        im.save(out, "PNG", optimize=True)
    print(f"{os.path.basename(out):22s} {os.path.getsize(out)//1024:5d} KB  {im.size}")

print("\nfinal:")
for f in sorted(os.listdir(ART)):
    print(f"  {f:24s} {os.path.getsize(os.path.join(ART,f))//1024:5d} KB")
print("total KB:", sum(os.path.getsize(os.path.join(ART,f)) for f in os.listdir(ART))//1024)
