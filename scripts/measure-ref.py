from PIL import Image
import os, numpy as np

REF = "/Users/leo/Desktop/ui/最终版"

# 目标色（从量化结果推断的实心色）
TARGETS = {
    "orange_btn": (200, 110, 60),
    "green_btn": (85, 115, 95),
    "seal_red": (180, 60, 45),
    "card_white": (253, 250, 243),
}

def find_bbox(path, target, tol=42, minpix=400):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    H, W, _ = a.shape
    d = np.abs(a - np.array(target)).sum(axis=2)
    m = d < tol
    if m.sum() < minpix:
        return None
    ys = np.where(m.any(axis=1))[0]
    xs = np.where(m.any(axis=0))[0]
    return dict(x0=int(xs[0]), x1=int(xs[-1]), y0=int(ys[0]), y1=int(ys[-1]),
                w=int(xs[-1] - xs[0] + 1), h=int(ys[-1] - ys[0] + 1), px=int(m.sum()))

def rowprofile(path, target, tol=42, y0=0, y1=None):
    """在指定行区间内，逐行统计目标色像素，找出连续实心带（按钮）"""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    H = a.shape[0]
    y1 = y1 or H
    seg = a[y0:y1]
    d = np.abs(seg - np.array(target)).sum(axis=2)
    m = (d < tol)
    counts = m.sum(axis=1)
    rows = np.where(counts > 60)[0]
    if not len(rows):
        return None
    return dict(y0=int(rows[0] + y0), y1=int(rows[-1] + y0), h=int(rows[-1] - rows[0] + 1),
                maxrun=int(counts.max()))

def measure(path, label, target, tol=42):
    b = find_bbox(path, target, tol)
    print(f"\n--- {label}  ({os.path.basename(path)}) ---")
    if not b:
        print("   未找到该色块")
        return
    print(f"   bbox x {b['x0']}..{b['x1']} (宽 {b['w']})   y {b['y0']}..{b['y1']} (高 {b['h']})   像素数 {b['px']}")
    print(f"   → 2x CSS: 宽 {b['w']/2:.1f}px  高 {b['h']/2:.1f}px  左 {b['x0']/2:.1f}px  上 {b['y0']/2:.1f}px")

P = lambda n: os.path.join(REF, n)

# 1) 加载页：主按钮（描边金色圆角按钮）与加载文字
measure(P("00 进入加载页.png"), "加载页 主按钮区域(下部实心/描边)", (200, 110, 60), 60)

# 2) 首次问答：选中卡片边框
measure(P("01首次进入问题页.png"), "问答页 选中卡片(橙色描边)", (200, 110, 60), 55)

# 3) 音疗页：底部导航 + 卡片
measure(P("1-音疗页面.png"), "音疗页 导航选中项(橙色)", (200, 110, 60), 60)

# 4) 结束页：完成打卡按钮（深绿实心）
measure(P("2-4 结束页.png"), "结束页 完成打卡(深绿实心)", TARGETS["green_btn"], 55)
measure(P("2-4 结束页.png"), "结束页 印章/强调红", TARGETS["seal_red"], 60)

# 5) 首页：主行动按钮
measure(P("2-1 首页.png"), "首页 主按钮(橙色实心)", (200, 110, 60), 60)

# 6) 身体数据页：底部大按钮
measure(P("3-2 我的-身体数据页.png"), "身体数据页 底部按钮(橙色实心)", (205, 115, 60), 60)
measure(P("3-2 我的-身体数据页.png"), "身体数据页 标题棕色字", (146, 96, 74), 60)

# 7) 底部导航高度测量（最下方实色带）
for f in ["1-音疗页面.png", "2-1 首页.png", "3-1 我的.png"]:
    im = Image.open(P(f)).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    H, W, _ = a.shape
    bottom = a[int(H*0.88):]
    # 找导航条上边沿：与上方内容差异明显的行
    print(f"\n--- 底栏高度候选 ({f}) ---")
    for y in range(int(H*0.86), H, 4):
        row = a[y]
        d = np.abs(row - np.array([253,248,238])).sum(axis=1)
        print(f"    y={y} 非底色占比 {100*(d>26).mean():.0f}%", end="")
        if y % 20 == 0:
            print()
    print()
