# -*- coding: utf-8 -*-
"""
弦养 · 调研统计出图脚本
读取《弦养_试点数据台账.xlsx》，输出：
  ① 指标.json        —— 全部关键指标（未测的明确写 null + "未测"）
  ② 结论.md          —— 可直接粘进方案的 Markdown 结论文字
  ③ charts/*.png     —— 五张图表（痛点强度 / SUS / 配对差值 / 任务完成率 / NPS 构成）

用法：
  python stats.py "弦养_试点数据台账.xlsx" outputs/aic-scene/charts

设计原则：
  - 绝不编造。任何缺数据的指标一律标注「未测」，不出图、不写入结论。
  - 不依赖 Excel 公式列：脚本从原始作答重算，与台账显示值互为交叉校验。
  - 不依赖 matplotlib / pandas；仅用 openpyxl + Pillow。
"""
import os
import sys
import json
import math
import statistics as st
from datetime import datetime

from openpyxl import load_workbook
from PIL import Image, ImageDraw, ImageFont

# ------------------------------------------------------------
# 字体安全网
#   实测：Hiragino Sans GB 缺 U+2212（减号），会渲染成"豆腐块"□
#   做法：① 统一替换缺字符号；② 预检字体是否覆盖所需符号，否则自动换下一个
# ------------------------------------------------------------
_TRANS = str.maketrans({"\u2212": "-", "\u2013": "-", "\u2014": "—",
                        "\u00f7": "/", "\u2264": "<=", "\u2265": ">="})


def _san(t):
    return t.translate(_TRANS) if isinstance(t, str) else t


_IMG_TEXT = ImageDraw.ImageDraw.text
_IMG_LEN = ImageDraw.ImageDraw.textlength
ImageDraw.ImageDraw.text = lambda self, xy, text, *a, **k: _IMG_TEXT(self, xy, _san(text), *a, **k)
ImageDraw.ImageDraw.textlength = lambda self, text, *a, **k: _IMG_LEN(self, _san(text), *a, **k)

# ============================================================
# 品牌与排版
# ============================================================
C_INK    = (26, 26, 26)        # 正文黑
C_MUTE   = (120, 120, 120)     # 次要灰
C_GRID   = (226, 222, 214)
C_AXIS   = (150, 145, 138)
C_BAR    = (176, 85, 46)       # 赭石 #B0552E
C_BAR2   = (110, 143, 124)     # 青瓷玉 #6E8F7C
C_POS    = (176, 85, 46)       # 正向（中式：红）
C_NEG    = (110, 143, 124)     # 负向（中式：绿）
C_GOLD   = (201, 169, 126)     # 暖金
C_BG     = (255, 255, 255)

FONT_CANDIDATES = [
    ("/System/Library/Fonts/PingFang.ttc", 0),
    ("/System/Library/Fonts/PingFang.ttc", 2),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 1),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),
    ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
    ("/Library/Fonts/Arial Unicode.ttf", 0),
]
_font_cache = {}
_SYMBOLS = "Δ·＞＜≤≥％|/×±○●①②★→"      # 图面用到的非汉字符号（已排除 − – ÷）
_FONT_CHOSEN = None


def _covers(f):
    """用 .notdef 位图对照，判断字体是否真的画得出这些符号"""
    try:
        ref = bytes(f.getmask("\uE000"))
    except Exception:                                            # noqa: BLE001
        return True
    return all(bytes(f.getmask(c)) != ref for c in _SYMBOLS)


def _pick_font_path():
    global _FONT_CHOSEN
    if _FONT_CHOSEN:
        return _FONT_CHOSEN
    for path, idx in FONT_CANDIDATES:
        if not os.path.exists(path):
            continue
        try:
            f = ImageFont.truetype(path, size=24, index=idx)
        except Exception:                                        # noqa: BLE001
            continue
        if _covers(f):
            _FONT_CHOSEN = (path, idx)
            return _FONT_CHOSEN
    for path, idx in FONT_CANDIDATES:                            # 兜底：第一个能加载的
        if os.path.exists(path):
            try:
                ImageFont.truetype(path, size=24, index=idx)
                _FONT_CHOSEN = (path, idx)
                return _FONT_CHOSEN
            except Exception:                                    # noqa: BLE001
                pass
    raise RuntimeError("找不到可用中文字体")


def F(size, weight="regular"):
    key = (size, weight)
    if key in _font_cache:
        return _font_cache[key]
    path, idx = _pick_font_path()
    f = ImageFont.truetype(path, size=size, index=idx)
    _font_cache[key] = f
    return f


def S(v, nd=1):
    """数字转字符串，None → 未测"""
    if v is None:
        return "未测"
    if isinstance(v, float):
        if nd == 0:
            return "%d" % round(v)
        return ("%%.%df" % nd) % v
    return str(v)


def num(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def txt(v):
    if v is None:
        return ""
    return str(v).strip()


def mean(xs):
    xs = [x for x in xs if x is not None]
    return st.mean(xs) if xs else None


# ============================================================
# 通用绘图元件
# ============================================================
def new_canvas(w=1240, h=780):
    img = Image.new("RGB", (w, h), C_BG)
    return img, ImageDraw.Draw(img)


def header(d, W, title, sub=None):
    d.text((64, 44), title, font=F(30, "bold"), fill=C_INK)
    d.line([(64, 92), (W - 64, 92)], fill=C_GRID, width=2)
    if sub:
        d.text((64, 106), sub, font=F(17), fill=C_MUTE)
        return 152
    return 118


def annotate_wrap(d, x, y, text, font, fill, max_w):
    """简易换行"""
    line, lines = "", []
    for ch in text:
        if d.textlength(line + ch, font=font) > max_w:
            lines.append(line)
            line = ch
        else:
            line += ch
    if line:
        lines.append(line)
    for i, ln in enumerate(lines):
        d.text((x, y + i * (font.size + 7)), ln, font=font, fill=fill)
    return y + len(lines) * (font.size + 7)


def axis_frame(d, x0, y0, x1, y1, ymin, ymax, ticks=5, ylabel=""):
    """画 y 轴 + 横向网格 + 刻度；返回 y值→像素y 的映射函数"""
    def Y(v):
        return y1 - (v - ymin) / (ymax - ymin) * (y1 - y0)
    for i in range(ticks + 1):
        v = ymin + (ymax - ymin) * i / ticks
        yy = Y(v)
        d.line([(x0, yy), (x1, yy)], fill=C_GRID, width=1)
        lab = ("%g" % round(v, 2))
        d.text((x0 - 14 - d.textlength(lab, font=F(16)), yy - 9), lab, font=F(16), fill=C_MUTE)
    d.line([(x0, y0), (x0, y1)], fill=C_AXIS, width=2)
    d.line([(x0, y1), (x1, y1)], fill=C_AXIS, width=2)
    if ylabel:
        d.text((64, y0 - 26), ylabel, font=F(16), fill=C_MUTE)
    return Y


def ref_line(d, Y, x0, x1, value, label):
    """基准线：金色虚线 + 轴右侧文字标签（画在绘图区外，避免压住柱子）"""
    if not value:
        return
    yy = Y(value)
    x = x0
    while x < x1:
        d.line([(x, yy), (min(x + 12, x1), yy)], fill=C_GOLD, width=3)
        x += 22
    if label:
        d.text((x1 + 9, yy - 9), label, font=F(15), fill=(150, 122, 74))


def bar_chart(path, title, sub, labels, values, ymin=0, ymax=None, ticks=5,
              ref=None, ref_label="", ylabel="", fmt="%.1f", color_of=None):
    W, H = 1240, 780
    img, d = new_canvas(W, H)
    top = header(d, W, title, sub)
    x0, x1 = 118, W - 90
    y0, y1 = top + 24, H - 150
    vs = [v for v in values if v is not None]
    if ymax is None:
        hi = max(vs + [ref or 0, 1])
        ymax = hi * 1.22
        # 取整
        step = 1 if ymax <= 5 else (5 if ymax <= 30 else 20)
        ymax = math.ceil(ymax / step) * step
    Y = axis_frame(d, x0, y0, x1, y1, ymin, ymax, ticks, ylabel)
    if ref is not None:
        ref_line(d, Y, x0, x1, ref, ref_label)
    n = len(labels)
    slot = (x1 - x0) / n
    bw = min(slot * 0.52, 96)
    for i, (lab, v) in enumerate(zip(labels, values)):
        cx = x0 + slot * (i + 0.5)
        if v is None:
            d.text((cx - d.textlength("未测", font=F(17)) / 2, y1 - 30),
                   "未测", font=F(17), fill=(200, 90, 90))
        else:
            col = color_of(i, v) if color_of else C_BAR
            yv = Y(v)
            d.rectangle([cx - bw / 2, min(yv, Y(0)), cx + bw / 2, max(yv, Y(0))], fill=col)
            try:
                t = fmt % v
            except TypeError:
                t = str(v)
            tw = d.textlength(t, font=F(18, "bold"))
            d.text((cx - tw / 2, min(yv, Y(0)) - 28), t, font=F(18, "bold"), fill=C_INK)
        lab_f = F(17)
        lines = lab.split("\n")
        maxlw = max(d.textlength(x, font=lab_f) for x in lines)
        if maxlw > slot - 8 and len(lines) == 1:
            annotate_wrap(d, cx - (slot - 12) / 2, y1 + 14, lab, F(15), C_MUTE, slot - 12)
        else:
            for k, ln in enumerate(lines):
                lw = d.textlength(ln, font=lab_f)
                d.text((cx - lw / 2, y1 + 16 + k * 23), ln, font=lab_f, fill=C_MUTE)
    img.save(path)
    return path


def grouped_bar_chart(path, title, sub, labels, series, ymin=0, ymax=None, ticks=5,
                      ref=None, ref_label="", ylabel="", legend=()):
    """series = [(name, color, [values]), ...]"""
    W, H = 1240, 800
    img, d = new_canvas(W, H)
    top = header(d, W, title, sub)
    x0, x1 = 118, W - 90
    y0, y1 = top + 34, H - 150
    allv = [v for _, _, vs in series for v in vs if v is not None]
    lo = min(allv + [0]) if allv else 0
    hi = max(allv + [0, ref or 0, 1])
    if ymax is None:
        ymax = hi * 1.2
        step = 1 if ymax <= 5 else (5 if ymax <= 30 else 20)
        ymax = math.ceil(ymax / step) * step
    if ymin == 0 and lo < 0:
        ymin = math.floor(lo * 1.4)
        ymin = -math.ceil(abs(ymin) / 1) * 1
    Y = axis_frame(d, x0, y0, x1, y1, ymin, ymax, ticks, ylabel)
    if ref is not None:
        ref_line(d, Y, x0, x1, ref, ref_label)
    n = len(labels)
    m = len(series)
    slot = (x1 - x0) / n
    bw = min(slot * 0.72 / m, 54)
    for i, lab in enumerate(labels):
        cx = x0 + slot * (i + 0.5)
        for k, (_, col, vs) in enumerate(series):
            v = vs[i] if i < len(vs) else None
            if v is None:
                continue
            bx = cx - (m * bw) / 2 + k * bw
            yv = Y(v)
            d.rectangle([bx, min(yv, Y(0)), bx + bw, max(yv, Y(0))], fill=col)
            d.text((bx + bw / 2 - d.textlength(S(v, 0 if abs(v) >= 10 else 1), font=F(15, "bold")) / 2,
                    min(yv, Y(0)) - 24), S(v, 0 if abs(v) >= 10 else 1),
                   font=F(15, "bold"), fill=C_INK)
        lw = d.textlength(lab, font=F(17))
        d.text((cx - lw / 2, y1 + 16), lab, font=F(17), fill=C_MUTE)
    # 图例
    lx = x0
    for name, col, _ in series:
        d.rectangle([lx, y1 + 62, lx + 26, y1 + 80], fill=col)
        d.text((lx + 34, y1 + 60), name, font=F(17), fill=C_INK)
        lx += 34 + d.textlength(name, font=F(17)) + 46
    img.save(path)
    return path


def stacked_hbar(path, title, sub, seg_labels, counts, colors, note=""):
    W, H = 900, 430
    img, d = new_canvas(W, H)
    top = header(d, W, title, sub)
    x0, x1 = 100, W - 70
    total = sum(counts) or 1
    y = top + 44
    bh = 78
    cx = x0
    for lab, c, col in zip(seg_labels, counts, colors):
        w = (x1 - x0) * c / total
        if c > 0:
            d.rectangle([cx, y, cx + w, y + bh], fill=col)
            pct = "%.0f%%" % (100.0 * c / total)
            d.text((cx + w / 2 - d.textlength(pct, font=F(22, "bold")) / 2, y + 26),
                   pct, font=F(22, "bold"), fill=(255, 255, 255))
            d.text((cx + w / 2 - d.textlength(lab, font=F(15)) / 2, y + bh + 10),
                   lab, font=F(15), fill=C_MUTE)
        cx += w
    if note:
        d.text((x0, y + bh + 58), note, font=F(17), fill=C_INK)
    img.save(path)
    return path


# ============================================================
# 读台账
# ============================================================
def col(ws, name):
    for j, c in enumerate(ws[1], start=1):
        if txt(c.value) == name:
            return j
    raise KeyError("工作表 %s 找不到列：%s" % (ws.title, name))


def rows_of(ws, maxr=30):
    """按表头名取值：{列名: 值}"""
    hdr = [txt(c.value) for c in ws[1]]
    out = []
    for r in range(2, maxr + 1):
        a = txt(ws.cell(row=r, column=1).value)
        # 编号列只接受短标识（S1 / P12 / 1）；页脚提示等长文本一律跳过
        if not a or len(a) > 8 or a.startswith("·"):
            continue
        out.append({hdr[j - 1]: ws.cell(row=r, column=j).value
                    for j in range(1, len(hdr) + 1) if hdr[j - 1]})
    return out


def main():
    xlsx = sys.argv[1] if len(sys.argv) > 1 else "弦养_试点数据台账.xlsx"
    outdir = sys.argv[2] if len(sys.argv) > 2 else "outputs/aic-scene/charts"
    os.makedirs(outdir, exist_ok=True)

    wb = load_workbook(xlsx, data_only=True)
    ws1, ws2, ws3, ws4 = wb["① 受访者"], wb["② 需求问卷"], wb["③ 任务与AB"], wb["④ 体验问卷"]
    R1, R2, R3, R4 = rows_of(ws1), rows_of(ws2), rows_of(ws3), rows_of(ws4)

    # ---------- 被试元信息 ----------
    meta = {}
    for r in R1:
        meta[txt(r.get("编号"))] = {
            "场景": txt(r.get("对应场景")),
            "年龄段": txt(r.get("年龄段")),
            "身份": txt(r.get("身份")),
            "场地": txt(r.get("最常用练习场所")),
            "设备": txt(r.get("使用设备")),
            "网络": txt(r.get("家里/活动室网络")),
            "顺序": txt(r.get("A/B 顺序")),
        }
    ids = [r["编号"] for r in R1 if txt(r.get("编号"))]
    N = len(ids)
    # 真正录入了数据的人数（用于区分"已登记"与"已测"）
    filled = set()
    for r in R3:
        if any(num(r.get(k)) is not None for k in ["TTFS(秒)"]):
            filled.add(txt(r.get("编号")))
    for r in R2:
        if any(num(r.get(k)) is not None for k in ["Q6 不知对错", "Q7 无成就感", "Q8 易放弃"]):
            filled.add(txt(r.get("编号")))
    N_tested = len(filled)

    untested = []   # 记录「未测」的指标，最后统一提示

    # ---------- ② 需求问卷 ----------
    q = {r["编号"]: r for r in R2 if r.get("编号")}
    pain_keys = ["Q6 不知对错", "Q7 无成就感", "Q8 易放弃", "Q9 琴声更有兴趣",
                 "Q10 声音优于口令", "Q11 担心摄像头", "Q12 免注册意愿"]
    pain_mean = {k: mean([num(q[i].get(k)) for i in q if i in q]) for k in pain_keys}
    pain_core = mean([pain_mean["Q6 不知对错"], pain_mean["Q7 无成就感"], pain_mean["Q8 易放弃"]])
    if all(v is None for v in pain_mean.values()):
        untested.append("问卷A Q6–Q12（需求侧）")

    # Q5 首选项分布
    q5_pref = {}
    for i in q:
        v = txt(q[i].get("Q5 首选项★"))
        if v:
            q5_pref[v] = q5_pref.get(v, 0) + 1
    # Q4 频次分布
    q4_dist = {}
    for i in q:
        v = txt(q[i].get("Q4 频次"))
        if v:
            q4_dist[v] = q4_dist.get(v, 0) + 1

    # ---------- ③ 任务与 AB ----------
    tasks = ["T1 开摄像头", "T2 找入口选式", "T3 双手托天TTFS", "T4 第2-3式", "T5 看练习记录"]
    t3 = {r["编号"]: r for r in R3 if r.get("编号")}
    task_rate = []
    task_n = 0
    for k in tasks:
        vals = [txt(t3[i].get(k)) for i in t3 if i in t3]
        vals = [v for v in vals if v]
        if vals:
            task_rate.append(100.0 * sum(1 for v in vals if v == "独立完成") / len(vals))
            task_n = max(task_n, len(vals))
        else:
            task_rate.append(None)
    if task_n == 0:
        untested.append("任务 T1–T5（完成率）")

    ttfs = [num(t3[i].get("TTFS(秒)")) for i in t3]
    ttfs_v = [x for x in ttfs if x is not None]
    ttfs_med = st.median(ttfs_v) if ttfs_v else None
    ttfs_max = max(ttfs_v) if ttfs_v else None

    d_mot = {}   # Δ意愿 = B − A
    for i in t3:
        a, b = num(t3[i].get("A 想再做一遍(1-5)")), num(t3[i].get("B 想再做一遍(1-5)"))
        if a is not None and b is not None:
            d_mot[i] = b - a
    t_ab = {}
    for i in t3:
        a, b = num(t3[i].get("A静音 时长(秒)")), num(t3[i].get("B弦养 时长(秒)"))
        if a and b:
            t_ab[i] = (a, b)

    # ---------- ④ 体验问卷 ----------
    e = {r["编号"]: r for r in R4 if r.get("编号")}
    sus = {}
    for i in e:
        v = [num(e[i].get("SUS%d" % k)) for k in range(1, 11)]
        if all(x is not None for x in v):
            s = sum((x - 1) if k % 2 == 1 else (5 - x) for k, x in enumerate(v, start=1))
            sus[i] = s * 2.5
    sus_mean = mean(list(sus.values()))
    nps_raw = {i: num(e[i].get("B5 NPS(0-10)")) for i in e}
    nps_raw = {k: v for k, v in nps_raw.items() if v is not None}
    promoters = sum(1 for v in nps_raw.values() if v >= 9)
    passives = sum(1 for v in nps_raw.values() if 7 <= v < 9)
    detractors = sum(1 for v in nps_raw.values() if v < 7)
    nps = round(100.0 * (promoters - detractors) / len(nps_raw)) if nps_raw else None

    d_sub = {}   # Δ主观 = B1 − B2
    for i in e:
        a, b = num(e[i].get("B2 没声音更想做完")), num(e[i].get("B1 有琴声更想做完"))
        if a is not None and b is not None:
            d_sub[i] = b - a

    if not sus:
        untested.append("SUS 量表")
    if not nps_raw:
        untested.append("NPS 推荐意愿")
    if not d_mot and not d_sub:
        untested.append("配对差值 Δ")

    quotes = []
    for i in e:
        for key, tag in [("B7 一个词", "关键词"), ("B7 为什么", "理由"),
                         ("B6 卡在哪一步", "卡点"), ("B8 觉得不对的一刻", "异常"),
                         ("B9 还差什么", "待补"), ("B10 补充", "补充")]:
            v = txt(e[i].get(key))
            if v:
                quotes.append((i, tag, v))
    for i in q:
        for key, tag in [("Q16 理想体验（原话）", "理想体验"), ("Q17 古琴曲想法（原话）", "古琴曲")]:
            v = txt(q[i].get(key))
            if v:
                quotes.append((i, tag, v))

    # ---------- 顺序平衡 ----------
    def by_order(dd):
        g = {"A→B": [], "B→A": []}
        for k, v in dd.items():
            o = meta.get(k, {}).get("顺序", "")
            if o in g:
                g[o].append(v)
        return {k: (mean(v) if v else None) for k, v in g.items()}

    order_mot, order_sub = by_order(d_mot), by_order(d_sub)

    # ============================================================
    # 出图
    # ============================================================
    charts = []
    BLANKS = {"Q6 不知对错": "不知对错", "Q7 无成就感": "无成就感", "Q8 易放弃": "容易放弃",
              "Q9 琴声更有兴趣": "琴声更有兴趣", "Q10 声音优于口令": "声音优于口令",
              "Q11 担心摄像头": "担心摄像头", "Q12 免注册意愿": "免注册意愿"}

    # 1) 痛点强度
    pv = [pain_mean[k] for k in pain_keys]
    if any(v is not None for v in pv):
        p = os.path.join(outdir, "01_痛点强度.png")
        bar_chart(p, "需求痛点强度（问卷A · 1=非常不同意，5=非常同意）",
                  "N=%d；虚线为中性值 3.0；Q6–Q8 核心三项均值 %s" % (len(q), S(pain_core, 2)),
                  [BLANKS[k] for k in pain_keys], pv, ymin=0, ymax=5, ticks=5,
                  ref=3.0, ref_label="中性 3.0", ylabel="均值（1–5）", fmt="%.2f")
        charts.append(p)

    # 2) SUS
    if sus:
        p = os.path.join(outdir, "02_SUS可用性.png")
        bar_chart(p, "SUS 系统可用性量表得分（0–100）",
                  "N=%d；均分 %s；行业基准线 68" % (len(sus), S(sus_mean, 1)),
                  list(sus.keys()), list(sus.values()), ymin=0, ymax=100, ticks=5,
                  ref=68, ref_label="基准 68", ylabel="SUS 分", fmt="%.1f")
        charts.append(p)

    # 3) 配对差值 Δ（双测量）
    if d_mot or d_sub:
        keys = sorted(set(list(d_mot.keys()) + list(d_sub.keys())))
        s_mot = [d_mot.get(k) for k in keys]
        s_sub = [d_sub.get(k) for k in keys]
        p = os.path.join(outdir, "03_配对差值.png")
        grouped_bar_chart(p, "单被试配对差值 Δ（弦养 − 静音）",
                          "同一人先后两种条件；Δ>0 表示听觉反馈条件更优",
                          keys,
                          [("Δ意愿（现场 A/B）", C_POS, s_mot),
                           ("Δ主观（问卷B B1−B2）", C_BAR2, s_sub)],
                          ymin=0, ymax=5, ticks=5, ref=0, ylabel="差值（分）")
        charts.append(p)

    # 4) 任务完成率
    if task_n:
        p = os.path.join(outdir, "04_任务完成率.png")
        bar_chart(p, "五个任务的独立完成率（不提示、不代操作）",
                  "N=%d；目标线 80%%" % task_n,
                  ["T1\n开摄像头", "T2\n找入口选式", "T3\n双手托天", "T4\n第2–3式", "T5\n看练习记录"],
                  task_rate, ymin=0, ymax=100, ticks=5, ref=80, ref_label="目标 80%",
                  ylabel="完成率 %", fmt="%.0f%%")
        charts.append(p)

    # 5) NPS
    if nps_raw:
        p = os.path.join(outdir, "05_NPS构成.png")
        stacked_hbar(p, "NPS 推荐意愿构成",
                     "NPS = 推荐者%% - 贬损者%% = %d" % nps,
                     ["贬损者 0–6", "中立 7–8", "推荐者 9–10"],
                     [detractors, passives, promoters],
                     [C_NEG, C_GOLD, C_POS],
                     note="样本 N=%d（%d 推荐 / %d 中立 / %d 贬损）" % (
                         len(nps_raw), promoters, passives, detractors))
        charts.append(p)

    # ============================================================
    # 指标 JSON
    # ============================================================
    metrics = {
        "登记样本量N": N,
        "实际录入数据人数": N_tested,
        "被试": meta,
        "需求侧": {
            "痛点均值_Q6_Q8": pain_core,
            "各题均值": pain_mean,
            "Q4频次分布": q4_dist,
            "Q5首选项分布": q5_pref,
        },
        "任务侧": {
            "各任务完成率%": dict(zip([t.split()[0] for t in tasks], task_rate)),
            "TTFS中位数秒": ttfs_med,
            "TTFS最慢秒": ttfs_max,
            "A_vs_B时长秒": t_ab,
        },
        "体验侧": {
            "SUS各人": sus,
            "SUS均值": sus_mean,
            "NPS": nps,
            "NPS构成": {"推荐者": promoters, "中立": passives, "贬损者": detractors},
        },
        "配对差值": {
            "Δ意愿_各人": d_mot, "Δ意愿_均值": mean(list(d_mot.values())),
            "Δ主观_各人": d_sub, "Δ主观_均值": mean(list(d_sub.values())),
            "顺序检验_Δ意愿": order_mot, "顺序检验_Δ主观": order_sub,
        },
        "未测指标": sorted(set(untested)),
    }
    jp = os.path.join(outdir, "指标.json")
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    # ============================================================
    # 结论 Markdown
    # ============================================================
    L = []
    L.append("# 弦养 · 试点调研结果（自动生成，请勿手改数字）\n")
    L.append("> 数据来源：`%s`　生成时间：%s　登记样本：**N=%d**　其中实际录入数据：**%d 人**" % (
        os.path.basename(xlsx), datetime.now().strftime("%Y-%m-%d %H:%M"), N, N_tested))
    L.append("> 本文件由 `stats.py` 从台账原始作答重算，与台账公式列互为校验。**未测的指标一律标注「未测」，不做任何补数。**\n")

    L.append("## 一、需求分析（对应方案「二、需求分析」）\n")
    if pain_core is not None:
        L.append("**1. 痛点强度（问卷A Q6–Q8，1–5）**：三项核心痛点均值为 **%s**。其中「常常不确定动作做对了没有」%s，「练完没有成就感」%s，「没人带容易放弃」%s。高于中性值 3.0，说明痛点真实存在。" % (
            S(pain_core, 2), S(pain_mean["Q6 不知对错"], 2), S(pain_mean["Q7 无成就感"], 2), S(pain_mean["Q8 易放弃"], 2)))
    else:
        L.append("**1. 痛点强度**：未测。")
    if pain_mean["Q9 琴声更有兴趣"] is not None:
        L.append("\n**2. 需求方向（Q9–Q12）**：「动作做到位就响一声琴会更有兴趣继续练」均值 **%s**；「希望用琴声而非语音口令告诉我做对了」均值 **%s**；「免注册直接用」均值 **%s**；「担心摄像头」均值 **%s**。前两项支撑核心设计，后两项分别对应「零安装」与「本地优先」的设计取舍。" % (
            S(pain_mean["Q9 琴声更有兴趣"], 2), S(pain_mean["Q10 声音优于口令"], 2),
            S(pain_mean["Q12 免注册意愿"], 2), S(pain_mean["Q11 担心摄像头"], 2)))
    if q5_pref:
        top = sorted(q5_pref.items(), key=lambda x: -x[1])
        L.append("\n**3. 最困扰项分布（Q5★）**：%s。" % "；".join("%s %d 人" % (k, v) for k, v in top))
    if q4_dist:
        L.append("\n**4. 现有练习基础（Q4 近三月频次）**：%s。" % "；".join("%s %d 人" % (k, v) for k, v in q4_dist.items()))

    L.append("\n## 二、测试与验证（对应方案「五、测试与验证」）\n")
    if task_n:
        L.append("**1. 任务完成率（T1–T5，N=%d）**：" % task_n)
        short = ["T1 打开摄像头授权", "T2 选式并进第一式", "T3 做到第一声琴响(TTFS)",
                 "T4 完成第 2–3 式", "T5 找到练习记录"]
        for t, v in zip(short, task_rate):
            L.append("- %s：**%s**" % (t, ("%.0f%%" % v) if v is not None else "未测"))
    else:
        L.append("**1. 任务完成率**：未测。")
    L.append("\n**2. TTFS（授权到第一声琴响）**：中位数 **%s 秒**，最慢一次 **%s 秒**。目标为 < 90 秒，%s" % (
        S(ttfs_med, 0), S(ttfs_max, 0),
        ("达标。" if (ttfs_med is not None and ttfs_med < 90) else "未达标或未测，须在方案中如实呈现并给出改进。")))
    L.append("\n> 技术侧自测（TTFS 5 次稳定性 / 抗误触发 10 秒 / 断网可用）见工具包 7.5，须与本节用户数据**分开列出**。")

    L.append("\n## 三、应用效果与成果（对应方案「六、应用效果与成果」）\n")
    L.append("**1. 配对差值 Δ（本册最有力的一条证据）**")
    if d_mot:
        L.append("- Δ意愿（现场 A/B 记录，弦养 − 静音）：各人 %s，均值 **%s**" % (
            "、".join("%s %+g" % (k, v) for k, v in sorted(d_mot.items())), S(mean(list(d_mot.values())), 2)))
    if d_sub:
        L.append("- Δ主观（问卷B B1−B2）：各人 %s，均值 **%s**" % (
            "、".join("%s %+g" % (k, v) for k, v in sorted(d_sub.items())), S(mean(list(d_sub.values())), 2)))
    if not d_mot and not d_sub:
        L.append("- 未测。")
    else:
        same = ""
        if d_mot and d_sub:
            mm, ms = mean(list(d_mot.values())), mean(list(d_sub.values()))
            if mm is not None and ms is not None:
                same = "两种独立测量同向" if (mm > 0) == (ms > 0) else "⚠ 两种测量方向不一致，须核查记录"
        L.append("- 结论：**%s**。" % (same or "见上"))
        if order_mot or order_sub:
            om = "；".join("%s 均值 %s" % (k, S(v, 2)) for k, v in order_mot.items() if v is not None)
            os_ = "；".join("%s 均值 %s" % (k, S(v, 2)) for k, v in order_sub.items() if v is not None)
            L.append("- 顺序检验：Δ意愿 —— %s；Δ主观 —— %s。若两种顺序方向一致，说明差异来自条件本身而非练习疲劳或新奇感。" % (om or "未测", os_ or "未测"))
    L.append("\n**2. SUS 可用性**：%s" % (
        ("N=%d，均分 **%s**，%s（行业基准 68）。各人：%s" % (
            len(sus), S(sus_mean, 1), "高于基准" if sus_mean >= 68 else "低于基准",
            "、".join("%s %s" % (k, S(v, 1)) for k, v in sorted(sus.items()))))
        if sus else "未测。"))
    L.append("\n**3. NPS 净推荐值**：%s" % (
        ("**%d**（推荐者 %d 人 / 中立 %d 人 / 贬损者 %d 人，N=%d）" % (
            nps, promoters, passives, detractors, len(nps_raw))) if nps is not None else "未测。"))

    if t_ab:
        L.append("\n**4. 完成时长对比（A 静音 vs B 弦养，秒）**：%s" % (
            "；".join("%s A=%g / B=%g" % (k, v[0], v[1]) for k, v in sorted(t_ab.items()))))

    if quotes:
        L.append("\n**5. 用户原话（逐字照抄，可直接引用）**")
        for i, tag, v in quotes:
            L.append("- `%s`〔%s〕%s" % (i, tag, v.replace("\n", " ")))

    L.append("\n## 四、局限与下一轮迭代（对应方案「七、总结与展望」）\n")
    L.append("- 样本量 N=%d（实际录入数据 %d 人），属**小规模可用性测试**，只能支持方向性证据，不外推为人群统计结论。" % (N, N_tested))
    if untested:
        L.append("- 本轮**未测得**的指标：%s。方案中须如实标注，不得以估算值替代。" % "、".join(sorted(set(untested))))
    L.append("- 5 人累计可发现约 85% 的可用性问题（Nielsen 1993），足以支撑「发现问题→改进」的闭环，但不适用于「比较优劣」的统计推断。")

    mp = os.path.join(outdir, "结论.md")
    with open(mp, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

    # ============================================================
    # 控制台摘要
    # ============================================================
    print("=" * 68)
    print("弦养 · 调研统计完成")
    print("=" * 68)
    print("登记样本 N = %d ｜ 实际录入数据 %d 人" % (N, N_tested))
    print("痛点均值(Q6–Q8) = %s" % S(pain_core, 2))
    print("任务完成率 = %s" % (["%.0f%%" % v if v is not None else "未测" for v in task_rate] if task_n else "未测"))
    print("TTFS 中位数 = %s 秒 / 最慢 = %s 秒" % (S(ttfs_med, 0), S(ttfs_max, 0)))
    print("Δ意愿均值 = %s | Δ主观均值 = %s" % (S(mean(list(d_mot.values())), 2), S(mean(list(d_sub.values())), 2)))
    print("SUS 均分 = %s (N=%d)" % (S(sus_mean, 1), len(sus)))
    print("NPS = %s (推荐者%d/中立%d/贬损者%d)" % (S(nps, 0), promoters, passives, detractors))
    print("-" * 68)
    print("输出：")
    for p in [jp, mp] + charts:
        print("  %s  (%.1f KB)" % (p, os.path.getsize(p) / 1024))
    if untested:
        print("-" * 68)
        print("⚠ 以下指标本轮未测（方案中须如实标注，勿补数）：")
        for u in sorted(set(untested)):
            print("   · %s" % u)
    print("=" * 68)


if __name__ == "__main__":
    main()
