# -*- coding: utf-8 -*-
"""「按标准修正」前后 · 姿态对照图

数据：dump-poses.cjs 导出的 std-fix-before.json / std-fix-after.json
几何：与 roomFigureKit.js 的 render() 同式（省略飘带/拖影/相机摆动，手臂直连）
说明：本机无 PingFang；Hiragino 缺 U+2212，标注一律用 ASCII 连字符。
"""
import json, os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BEFORE = json.load(open(os.path.join(HERE, 'std-fix-before.json'), encoding='utf-8'))
AFTER = json.load(open(os.path.join(HERE, 'std-fix-after.json'), encoding='utf-8'))
OUT = os.path.join(HERE, '对照-按标准修正-改前vs改后.png')

FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
INK = (34, 30, 26); SOFT = (122, 114, 104); LINE = (216, 204, 184)
BG = (251, 243, 227); CARD = (255, 253, 247)
OLD = (176, 85, 46); NEW = (110, 143, 124); GROUND = (208, 194, 172)

VFOLD_K = 0.62


def f(size):
    try:
        return ImageFont.truetype(FONT, size)
    except Exception:
        return ImageFont.load_default()


def txt(d, xy, s, font, fill=INK):
    d.text(xy, str(s).replace('\u2212', '-'), font=font, fill=fill)


def add(a, b, k=1.0):
    return [a[0] + b[0] * k, a[1] + b[1] * k]


def pose_points(fr):
    """draw 空间姿态 -> 各部位点（与 render() 同式）"""
    feet = fr['feet']; px, py = fr['px'], fr['py']
    mid = (feet[0][0] + feet[1][0]) / 2.0
    lean = (px - mid) * 0.006 + fr['lean']
    up = [math.sin(lean), -math.cos(lean)]
    dn = [-up[0], -up[1]]
    u = [math.cos(lean), math.sin(lean)]
    torsoH = 88 * (1 - VFOLD_K * fr['fold'])
    headGap = 25 * (1 - 0.30 * fr['fold'])
    N = add([px, py], up, torsoH)
    H = add(N, up, headGap)
    H = [H[0] + fr['headOff'], H[1]]                    # 头左右偏移（已含 VS 缩放）
    Pp = [px, py]
    legs = []
    for i in (-1, 1):
        hip = add(Pp, u, i * 12)
        ank = [feet[0 if i < 0 else 1][0], feet[0 if i < 0 else 1][1] - 4]
        d0 = math.hypot(ank[0] - hip[0], ank[1] - hip[1])
        b = math.sqrt(max(0.0, 142 * 142 - d0 * d0)) * 0.22
        knee = [(hip[0] + ank[0]) / 2 + i * b, (hip[1] + ank[1]) / 2]
        legs.append((hip, knee, ank))
    return {
        'Pp': Pp, 'N': N, 'H': H, 'legs': legs,
        'shL': add(add(N, u, -24), dn, 10), 'shR': add(add(N, u, 24), dn, 10),
        'hL': fr['hL'], 'hR': fr['hR'], 'up': up, 'u': u,
        'feet': [feet[0], feet[1]],
    }


# ---------------- 全局包围盒（改前 + 改后 共用同一缩放） ----------------
pts = []
for case in BEFORE['cases'] + AFTER['cases']:
    for fr in case['frames']:
        p = pose_points(fr)
        pts += [p['Pp'], p['N'], p['H'], p['hL'], p['hR'], p['shL'], p['shR']]
        for hip, knee, ank in p['legs']:
            pts += [hip, knee, ank]
        pts += p['feet']
M = 22.0
bb = [min(q[0] for q in pts) - M, min(q[1] for q in pts) - M,
      max(q[0] for q in pts) + M, max(q[1] for q in pts) + M]
BW, BH = bb[2] - bb[0], bb[3] - bb[1]

CW, CH = 150, 176
SCALE = min((CW - 12) / BW, (CH - 12) / BH)


def mapper(box):
    x0, y0, x1, y1 = box
    s = SCALE
    ox = x0 + ((x1 - x0) - BW * s) / 2.0 - bb[0] * s
    oy = y0 + ((y1 - y0) - BH * s) / 2.0 - bb[1] * s
    return lambda p: (ox + p[0] * s, oy + p[1] * s), s


def figure(d, box, fr, col):
    P, s = mapper(box)
    p = pose_points(fr)
    w = lambda v: max(1, int(v))
    # 地面（draw 空间 y=266 处的一条横线）
    gx0 = P([bb[0], 266])[0]
    gx1 = P([bb[2], 266])[0]
    gy = P([0, 266])[1]
    d.line([gx0, gy, gx1, gy], fill=GROUND, width=w(2 * s))
    # 腿
    for hip, knee, ank in p['legs']:
        d.line([P(hip), P(knee)], fill=col, width=w(2.4 * s))
        d.line([P(knee), P(ank)], fill=col, width=w(2.4 * s))
        ax, ay = P(ank)
        d.ellipse([ax - 5 * s, ay - 2.6 * s, ax + 6 * s, ay + 3.0 * s], outline=col, width=w(1.3 * s))
    # 躯干
    corners = [add(p['N'], p['u'], -8), add(p['N'], p['u'], 8),
               add(p['Pp'], p['u'], 21), add(p['Pp'], p['u'], -21)]
    d.polygon([P(c) for c in corners], fill=(255, 255, 255), outline=col)
    # 臂
    for sh, hd in ((p['shL'], p['hL']), (p['shR'], p['hR'])):
        d.line([P(sh), P(hd)], fill=col, width=w(2.2 * s))
        hx, hy = P(hd)
        d.ellipse([hx - 3.0 * s, hy - 3.0 * s, hx + 3.0 * s, hy + 3.0 * s], fill=col)
    # 头
    hx, hy = P(p['H']); r = 13.5
    d.ellipse([hx - r * s, hy - r * s, hx + r * s, hy + r * s], fill=(255, 255, 255), outline=col, width=w(1.6 * s))
    fx, fy = P([p['H'][0] + fr['headOff'] * 0.45, p['H'][1]])
    d.line([P(p['H']), (fx, fy)], fill=col, width=w(1.3 * s))


# ---------------- 逐式量化差异 ----------------
def metrics(case):
    fr = case['frames']
    VMX = 200 - 120 * 1.367
    cx = VMX + 120 * 1.367
    def mdist(x):
        return min(abs(x['hL'][0] - cx), abs(x['hR'][0] - cx))
    return {
        'lean_absmax': max(abs(x['v3']['lean']) for x in fr),
        'foot_lift': max(266 - min(x['v3']['feet'][0][1], x['v3']['feet'][1][1]) for x in fr),
        'hand_top': min(min(x['hL'][1], x['hR'][1]) for x in fr),
        'mid_dist': min(mdist(x) for x in fr),
        'head_absmax': max(abs(x['v3']['headOff']) for x in fr),
        'fold_min': min(x['v3']['fold'] for x in fr),
    }


DIFF_LINE = {
    '虎举': lambda b, a: '手离身体中轴最近横向距离  %.0f px  ->  %.0f px（越小越贴体前中线）' % (b['mid_dist'], a['mid_dist']),
    '虎扑': lambda b, a: '躯干后仰量 fold 最小值  %.2f  ->  %.2f（越负=越向后拔长/后仰）' % (b['fold_min'], a['fold_min']),
    '鹿抵': lambda b, a: '躯干侧屈 |lean| 峰值  %.2f rad  ->  %.2f rad   ｜   后足离地  %.0f px  ->  %.0f px' % (
        b['lean_absmax'], a['lean_absmax'], b['foot_lift'], a['foot_lift']),
    '猿提': lambda b, a: '头部左右偏移 |headOff| 峰值  %.0f  ->  %.0f（左右观）' % (b['head_absmax'], a['head_absmax']),
    '鸟飞': lambda b, a: '抬腿高度（足离地）  %.0f px  ->  %.0f px' % (b['foot_lift'], a['foot_lift']),
    '收势': lambda b, a: '双手最高点  %.0f px  ->  %.0f px（数值越大=手越低，不再上举额前）' % (b['hand_top'], a['hand_top']),
}

STD = {
    '虎举': '沿体前中线上提 + 掌拳转化',
    '虎扑': '起身末拍要「伸膝送髋 · 上体后仰」',
    '鹿抵': '迈步成弓步 + 以腰为轴侧屈拧转 + 肘抵腰侧 + 目视后腿脚跟',
    '猿提': '提踵耸肩缩项 +「左右观」转头',
    '鸟飞': '一腿独立、另一腿屈膝上提',
    '收势': '翻掌分手 -> 垂臂落手 -> 并步还原（全程不上举）',
}

# ---------------- 版面 ----------------
COLS = 5
LBLW = 330
PAD = 34
TITLE_H = 84
ROWLAB = 26
ROWGAP = 12
GAPY = 22
BLOCK_H = TITLE_H + 2 * (ROWLAB + CH + ROWGAP)

W = PAD * 2 + LBLW + COLS * CW + 10
H = PAD + 128 + len(BEFORE['cases']) * (BLOCK_H + GAPY) + 44

sheet = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(sheet)

txt(d, (PAD, PAD - 6), '按标准修正 · 改前 vs 改后 姿态对照', f(40), INK)
txt(d, (PAD, PAD + 52),
    '数据源 outputs/room-figure-kit/moves-{wuqinxi,taiji}.js（套件真源）；几何与 roomFigureKit.js 的 render() 同式，'
    '姿态由 toDrawPose() 导出后重绘（未用浏览器）。', f(15), SOFT)
txt(d, (PAD, PAD + 78),
    '标准：国家体育总局《健身气功 · 五禽戏》十式 ｜ 1956 国家体委《简化二十四式太极拳》收势。'
    '   改前 = outputs/kit-wire/std-fix-before/ 备份，改后 = 当前真源。', f(15), SOFT)

y = PAD + 128
for cb, ca in zip(BEFORE['cases'], AFTER['cases']):
    name = ca['name']
    mb, ma = metrics(cb), metrics(ca)
    d.rectangle([PAD, y, W - PAD, y + BLOCK_H - ROWGAP], fill=CARD, outline=LINE, width=1)
    txt(d, (PAD + 16, y + 10), name, f(25), INK)
    txt(d, (PAD + 16 + 96, y + 17), '标准：' + STD.get(name, ''), f(16), SOFT)
    txt(d, (PAD + 16, y + 48), DIFF_LINE.get(name, lambda b, a: '')(mb, ma), f(16), NEW)

    yy = y + TITLE_H
    for tag, case, col, sub in (('改前', cb, OLD, 'legacy'), ('改后', ca, NEW, 'standard')):
        txt(d, (PAD + 16, yy + 3), tag, f(20), col)
        txt(d, (PAD + 16 + 66, yy + 8), sub, f(12), SOFT)
        for i, fr in enumerate(case['frames']):
            x0 = PAD + LBLW + i * CW
            d.rectangle([x0, yy, x0 + CW - 2, yy + ROWLAB + CH], fill=(255, 255, 255), outline=LINE, width=1)
            figure(d, (x0 + 5, yy + ROWLAB - 4, x0 + CW - 7, yy + ROWLAB + CH - 4), fr, col)
            txt(d, (x0 + 7, yy + 5), 'u=%.2f' % fr['u'], f(13), SOFT)
        yy += ROWLAB + CH + ROWGAP
    y += BLOCK_H + GAPY

txt(d, (PAD, y),
    '判读：同一式上下两行即「改前 / 改后」，绿色差异行给出该式被修正的那个量。'
    '（示意重绘：手臂直连肩到腕，真实渲染走两骨 IK，肘位会略不同；飘带/拖影未画。）', f(14), SOFT)

sheet = sheet.crop((0, 0, W, y + 36))
sheet.save(OUT)
print('wrote', os.path.relpath(OUT), sheet.size)
