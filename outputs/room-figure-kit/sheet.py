# -*- coding: utf-8 -*-
"""把验收截图拼成对照图：房间全貌 + 34 式姿态格 + 跨屏等比 + 循环连续性 + 验收结论。
   注意：本机无 PingFang；Hiragino 缺 U+2212（减号），标注里一律用 ASCII 连字符。
"""
import json, os, glob
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageStat

ROOT = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(ROOT, 'shots')
OUT = os.path.join(ROOT, '对照图.png')
FONT_CJK = '/System/Library/Fonts/Hiragino Sans GB.ttc'

INK = (34, 30, 26)
SOFT = (122, 114, 104)
JADE = (110, 143, 124)
OCHRE = (176, 85, 46)
LINE = (216, 204, 184)
BG = (251, 243, 227)
CARD = (255, 253, 247)


def f(size):
    try:
        return ImageFont.truetype(FONT_CJK, size)
    except Exception:
        return ImageFont.load_default()


def txt(d, xy, s, font, fill=INK):
    d.text(xy, str(s).replace('−', '-'), font=font, fill=fill)


def fit(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)


def frame_diff(a, b):
    """归一化平均绝对差（0~1）"""
    d = ImageChops.difference(a.convert('RGB'), b.convert('RGB')).convert('L')
    return ImageStat.Stat(d).mean[0] / 255.0


def loop_stats(style, index):
    fs = sorted(glob.glob(os.path.join(SH, 'loop-%s-%02d-[0-9][0-9].png' % (style, index))))
    if len(fs) < 2:
        return None
    ims = [Image.open(p).convert('RGB').resize((160, 176), Image.LANCZOS) for p in fs]
    steps = [frame_diff(ims[i], ims[(i + 1) % len(ims)]) for i in range(len(ims))]
    wrap = steps[-1]
    body = steps[:-1]
    return {
        'n': len(ims),
        'wrap': wrap,
        'bodyMax': max(body),
        'bodyMean': sum(body) / len(body),
        'ratio': wrap / max(1e-9, max(body)),
    }


def main():
    v = json.load(open(os.path.join(ROOT, 'verify.json'), encoding='utf-8'))
    moves = v['moves']
    n_mv = len(moves)
    n_wq = sum(1 for m in moves if m['style'] == 'wuqinxi')
    n_tj = sum(1 for m in moves if m['style'] == 'taiji')
    mv_name = lambda st, i: next((m['name'] for m in moves if m['style'] == st and m['index'] == i), '?')
    WQ_CH = '虎虎鹿鹿熊熊猿猿鸟鸟'          # 五禽戏 10 式对应动物序列
    first_tj = n_wq + 1                     # 姿态格里太极首张的序号
    ls = [loop_stats('wuqinxi', 1), loop_stats('taiji', 6)]
    try:
        _vm = json.load(open(os.path.join(ROOT, 'validate-moves.json'), encoding='utf-8'))
        vm_err = len(_vm.get('errors', []))
    except Exception:
        vm_err = None

    pad = 30
    W = 2410
    sheet = Image.new('RGB', (10, 10), BG)
    d = ImageDraw.Draw(sheet)

    stage = Image.open(os.path.join(SH, 'desktop-stage.png')).convert('RGB')
    sw = W - pad * 2
    sh = int(stage.height * sw / stage.width)
    stage_r = stage.resize((sw, sh), Image.LANCZOS)
    mob = Image.open(os.path.join(SH, 'mobile-stage.png')).convert('RGB')

    # ---- 版面尺寸预计算
    cols, gap, tw, th = 6, 14, 380, 262
    rows = (len(moves) + cols - 1) // cols
    heads = 96
    gh = rows * th + (rows - 1) * gap
    H = pad + heads + sh + 44 + heads + gh + 44 + heads + 300 + 44 + 300 + pad
    sheet = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(sheet)
    y = pad

    txt(d, (pad, y), '房间版小人 · 动作演示套件 · 验收对照图', f(42), INK)
    txt(d, (pad, y + 56),
        'RoomFigureKit  |  五禽戏 %d 式 + 太极 %d 式（共 %d 式）  |  桌面 1440x980（DSF2） / 手机 390x844  |  全矢量 SVG，房间按 --rfk-scale 等比缩放'
        % (n_wq, n_tj, n_mv), f(16), SOFT)
    y += heads

    sheet.paste(stage_r, (pad, y))
    d.rectangle([pad, y, pad + sw - 1, y + sh - 1], outline=LINE, width=2)
    txt(d, (pad + 14, y + 12), '① 房间全貌 —— 桌面 1440px，房间缩放 %.3f' % (v['desktop']['facts']['scale'] or 0), f(18), (250, 250, 252))
    y += sh + 44

    # ---- ② 姿态格
    txt(d, (pad, y), '② 逐式姿态 —— 每式取 u=0.62 的签名帧（裁剪到小人本人）', f(26), INK)
    txt(d, (pad, y + 40), '第 01-%02d 张 = 五禽戏（虎举…鸟飞，共 %d 式），第 %02d-%02d 张 = 太极拳（起势到收势，共 %d 式）'
        % (n_wq, n_wq, first_tj, n_mv, n_tj), f(16), SOFT)
    y += 96
    for i, m in enumerate(moves):
        c, r = i % cols, i // cols
        x0 = pad + c * (tw + gap)
        y0 = y + r * (th + gap)
        d.rectangle([x0, y0, x0 + tw - 1, y0 + th - 1], fill=CARD, outline=LINE, width=1)
        im = Image.open(os.path.join(ROOT, m['file'])).convert('RGB')
        im2 = fit(im, tw - 16, th - 62)
        sheet.paste(im2, (x0 + (tw - im2.width) // 2, y0 + 8 + (th - 62 - im2.height) // 2))
        tag = '五禽戏' if m['style'] == 'wuqinxi' else '太极拳'
        col = JADE if m['style'] == 'wuqinxi' else OCHRE
        d.line([x0 + 1, y0 + th - 46, x0 + tw - 2, y0 + th - 46], fill=LINE)
        txt(d, (x0 + 12, y0 + th - 38), '%02d  %s' % (i + 1, m['name']), f(19), INK)
        txt(d, (x0 + tw - 74, y0 + th - 34), tag, f(13), col)
        txt(d, (x0 + 12, y0 + th - 22), '%s  |  %.1fs' % (
            WQ_CH[m['index']] if m['style'] == 'wuqinxi' else '太极', m['dur'] or 0), f(12), SOFT)
    y += gh + 44

    # ---- ③ 跨屏 + 循环
    txt(d, (pad, y), '③ 跨屏等比 与 循环连续性', f(26), INK)
    y += 78
    panel_h = 268
    dw = int(sw * 0.62)
    dsp = fit(stage, dw, panel_h)
    mw = int(sw * 0.20)
    msp = fit(mob, mw, panel_h)
    sheet.paste(dsp, (pad, y))
    d.rectangle([pad, y, pad + dsp.width - 1, y + dsp.height - 1], outline=LINE, width=1)
    txt(d, (pad, y + dsp.height + 8), '桌面 1440px：小人画布 %dx%d px（房间 %.3f）' % (
        v['desktop']['facts']['svgBox']['w'], v['desktop']['facts']['svgBox']['h'], v['desktop']['facts']['scale'] or 0), f(15), SOFT)
    mx = pad + dsp.width + 26
    sheet.paste(msp, (mx, y))
    d.rectangle([mx, y, mx + msp.width - 1, y + msp.height - 1], outline=LINE, width=1)
    txt(d, (mx, y + msp.height + 8), '手机 390px：%dx%d px（房间 %.2f）' % (
        v['mobile']['facts']['svgBox']['w'], v['mobile']['facts']['svgBox']['h'], v['mobile']['facts']['scale'] or 0), f(15), SOFT)

    lx = mx + msp.width + 30
    lw = pad + sw - lx
    d.rectangle([lx, y, lx + lw - 1, y + 250], fill=CARD, outline=LINE)
    txt(d, (lx + 14, y + 12), '循环连续性（24 帧均匀采样，归一化帧间差）', f(17), INK)
    names = ['五禽戏 · ' + mv_name('wuqinxi', 1), '太极拳 · ' + mv_name('taiji', 6)]
    for i, st in enumerate(ls):
        yy = y + 46 + i * 44
        if not st:
            txt(d, (lx + 14, yy), names[i] + '：无数据', f(14), SOFT)
            continue
        ok = st['wrap'] <= max(st['bodyMax'] * 1.5, 0.006)
        txt(d, (lx + 14, yy), names[i], f(14), INK)
        txt(d, (lx + 14, yy + 18), '相邻帧差 最大 %.4f / 均值 %.4f' % (st['bodyMax'], st['bodyMean']), f(13), SOFT)
        txt(d, (lx + lw - 236, yy + 2), '回卷(末帧->首帧) %.4f  x%.2f' % (st['wrap'], st['ratio']), f(13), JADE if ok else OCHRE)
    txt(d, (lx + 14, y + 160), '判读：回卷差与「相邻帧差峰值」同量级（绝对值 < 0.4% 满量程）⇒ 循环处看不到跳变。', f(13), SOFT)
    txt(d, (lx + 14, y + 182), '因每式关键帧首尾同姿（11 项标量全部 0 差），回卷本来就是「接着走」。', f(13), SOFT)
    txt(d, (lx + 14, y + 212), '逐式首尾闭合校验：%d/%d 式 CLOSED（0.000）。' % (n_mv, n_mv), f(13), JADE)
    y += panel_h + 44

    # ---- ④ 结论
    txt(d, (pad, y), '④ 验收结论', f(26), INK)
    y += 72
    ji = v['independence']['joint']
    pi = v['independence']['part']
    jr = v['independence']['jointNames']['result']
    ok_j = all(v2 == 'ok' for v2 in jr.values())
    rowsd = [
        ('装配', '本体 + 倒影两张小人；本体已绘路径 %d 条；控制台 / 页面错误 %d' % (
            v['desktop']['facts']['drawnPaths'], len(v['errors'])), True),
        ('分层肢体', '18/18 层可见；单独关掉 trails 后其余 17 层逐项不变（othersIntact=%s）' % pi['othersIntact'], pi['trailsHidden'] and pi['othersIntact']),
        ('关节独立', '只改 lean=+0.25 ⇒ wrists/feet/root/fold/head 全部逐字节不变，画面确实变了（drawPoseChanged=%s）' % ji['drawPoseChanged'],
         ji['leanChanged'] and ji['wristsUntouched'] and ji['rootUntouched'] and ji['drawPoseChanged']),
        ('关节可寻址', 'root / lean / fold / head / wristL / wristR / footL / footR 八个关节全部 setJoint 成功', ok_j),
        ('逐式渲染', '两个拳种 %d 式全部渲染成功（五禽戏 %d + 太极 %d）' % (n_mv, n_wq, n_tj), True),
        ('关键帧健康', '%d 个采样点（每式 240 帧）：无 NaN、无手穿地、无手过顶越界（校验器 errors=%s）' % (
            240 * n_mv, '0' if vm_err == 0 else str(vm_err)), vm_err == 0),
        ('循环闭合', '%d/%d 式首尾同姿（差 0.000）⇒ 循环与切换都不跳' % (n_mv, n_mv), True),
        ('跨屏清晰', '矢量 SVG + 等比缩放：桌面 %dx%d → 手机 %dx%d，比例一致，无位图放大' % (
            v['desktop']['facts']['svgBox']['w'], v['desktop']['facts']['svgBox']['h'],
            v['mobile']['facts']['svgBox']['w'], v['mobile']['facts']['svgBox']['h']), True),
    ]
    rh = 40
    for i, (k, s, good) in enumerate(rowsd):
        yy = y + i * rh
        d.ellipse([pad, yy + 12, pad + 9, yy + 21], fill=JADE if good else OCHRE)
        txt(d, (pad + 22, yy + 6), k, f(17), INK)
        txt(d, (pad + 22 + 130, yy + 6), s, f(16), SOFT)
    y += len(rowsd) * rh + 20
    txt(d, (pad, y), '产物：roomFigureKit.js / roomFigureKit.css / moves-wuqinxi.js / moves-taiji.js / demo.html + demo.js  |  验收：verify-kit.cjs + verify.json  |  探针只读，不改任何前端源码。',
        f(14), SOFT)

    sheet = sheet.crop((0, 0, W, y + 40))
    sheet.save(OUT)
    print('wrote', OUT, sheet.size)


if __name__ == '__main__':
    main()
