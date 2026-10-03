from PIL import Image
import os, numpy as np

REF = "/Users/leo/Desktop/ui/最终版"
FILES = sorted(f for f in os.listdir(REF) if f.endswith(".png"))

BG = np.array([253, 248, 238], dtype=np.int16)  # 近似奶白底

def analyze(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    H, W, _ = a.shape
    # 距底色距离：越大越"非背景"
    dist = np.abs(a - BG).sum(axis=2)
    nonbg = dist > 26
    rowcov = nonbg.mean(axis=1)
    colcov = nonbg.mean(axis=0)
    return im, a, nonbg, rowcov, colcov, H, W

def blocks(rowcov, thr=0.30, minh=8):
    """找出连续的内容行区间"""
    out, start = [], None
    for y, v in enumerate(rowcov):
        if v > thr and start is None:
            start = y
        elif v <= thr and start is not None:
            if y - start >= minh:
                out.append((start, y, y - start))
            start = None
    if start is not None and len(rowcov) - start >= minh:
        out.append((start, len(rowcov), len(rowcov) - start))
    return out

print("=" * 78)
print("B. 版面结构：内容区块（按行覆盖率切分，单位 px，参考图 941x1672）")
print("=" * 78)
for f in FILES:
    path = os.path.join(REF, f)
    im, a, nonbg, rowcov, colcov, H, W = analyze(path)
    bs = blocks(rowcov)
    # 内容左右边界
    cols = np.where(colcov > 0.02)[0]
    l, r = (int(cols[0]), int(cols[-1])) if len(cols) else (0, W - 1)
    print(f"\n### {f}   {W}x{H}   内容左右边界 x={l}..{r} (宽 {r-l+1})")
    print(f"    区块数 {len(bs)}：")
    for s, e, h in bs[:26]:
        seg = nonbg[s:e]
        cc = np.where(seg.mean(axis=0) > 0.05)[0]
        sl = int(cc[0]) if len(cc) else 0
        sr = int(cc[-1]) if len(cc) else W - 1
        print(f"      y {s:5d}–{e:5d}  高 {h:4d}   x {sl:4d}–{sr:4d}  宽 {sr-sl+1:4d}")
