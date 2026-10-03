from PIL import Image
import os

ART = "/Users/leo/WorkBuddy/疗愈/dist/art"

RENAME = {
    "Traditional_Chinese_ink_and_co_2026-10-03T07-40-57.png": "landscape.png",
    "Photorealistic_close_up_of_a_t_2026-10-03T07-40-49.png": "guqin.png",
    "Full_body_illustration_of_a_yo_2026-10-03T07-41-11.png": "figure-cloud.png",
    "Full_body_front_view_illustrat_2026-10-03T07-41-30.png": "figure-pose.png",
    "Seamless_tileable_pattern_of_t_2026-10-03T07-41-14.png": "cloud.png",
    "Small_traditional_Chinese_land_2026-10-03T07-41-47.png": "card-landscape.png",
}

# bottom fraction to crop so the bottom-right "AI生成 WORKBUDDY" watermark is removed
CROP = {
    "landscape.png": 0.06,
    "guqin.png": 0.07,
    "figure-cloud.png": 0.055,
    "figure-pose.png": 0.055,
    "cloud.png": 0.09,
    "card-landscape.png": 0.07,
}

for src, dst in RENAME.items():
    s = os.path.join(ART, src)
    if not os.path.exists(s):
        print("missing", src)
        continue
    im = Image.open(s).convert("RGB")
    w, h = im.size
    cut = int(h * CROP[dst])
    im = im.crop((0, 0, w, h - cut))
    out = os.path.join(ART, dst)
    im.save(out, "PNG", optimize=True)
    print(f"{dst:22s} {w}x{h} -> {im.size[0]}x{im.size[1]}")

for src in RENAME:
    p = os.path.join(ART, src)
    if os.path.exists(p):
        os.remove(p)
print("done")
