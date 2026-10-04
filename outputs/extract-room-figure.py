"""从 outputs/room-baduanjin/room.js 精确抽取「房间版小人」所需代码，生成 train/src/data/roomMoves.js。
原则：不改一个字符地搬运（只做 ES module 的 export 包装），保证形象与动作与房间版逐像素一致。
用法：python outputs/extract-room-figure.py
"""
import re, pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
SRC = REPO / 'outputs/room-baduanjin/room.js'
DST = REPO / 'train/src/data/roomMoves.js'

lines = SRC.read_text(encoding='utf-8').split('\n')


def seg(a, b):
    """取 1-based 闭区间 [a,b] 的原文（去掉行尾 \r）"""
    return [ln.rstrip('\r') for ln in lines[a - 1:b]]


def find(pattern, start=1):
    rx = re.compile(pattern)
    for i in range(start - 1, len(lines)):
        if rx.search(lines[i]):
            return i + 1
    raise SystemExit('not found: ' + pattern)


# --- 定位 ---
L_VS = find(r'^const VS = ')
L_MOVES = find(r'^const MOVES = \[')
L_MOVES_END = None
for i in range(L_MOVES, len(lines)):
    if lines[i].strip() == '];' and L_MOVES_END is None and i > L_MOVES + 5:
        L_MOVES_END = i + 1
        break
L_MSV3 = find(r'^const moveStateV3 = ')
L_RP = find(r'^function roomPose\(idx, u\) \{')
L_RP_END = find(r'^\}', L_RP)

print('抽出区间：常量 %d-%d / MOVES %d-%d / moveStateV3 %d / roomPose %d-%d'
      % (L_VS, L_MOVES - 1, L_MOVES, L_MOVES_END, L_MSV3, L_RP, L_RP_END))

body = []
body += [
    "// 八段锦 · 房间版动作库与姿态解算（**由 outputs/extract-room-figure.py 从",
    "//   outputs/room-baduanjin/room.js 逐行抽取**，请勿手改；要改请改房间版再重跑脚本）",
    "//",
    "// 【为什么搬这套】应用自己的 coach 小人（train/src/components/DemoAnimation.vue 里的",
    "//   圆头粗线「疗养风」小人）与房间版不是同一个形象。用户要求把教练小窗换成房间版",
    "//   这个「白练功服 + 腰带 + 发髻 + 飘带 + 拖影」的小人，但**不要 3D 房间场景**。",
    "//",
    "// 【坐标系】房间版 viewBox = \"-100 150 600 300\"：地面 y=434、中轴 x=200、",
    "//   字面身高约 147~434（≈287 单位）。关键帧存的是 v3 空间坐标，经 vx()/vy() 换算。",
    "//",
    "// 【与应用的对应关系】房间版 10 式 = 起势 + 应用的 8 式 + 收势，名称逐条对齐，",
    "//   所以「应用第 i 式(0-based)」→「房间版 index i+1」。",
    "",
]

# 常量段：VS .. BALL0（含 pol/polar2/P/lerp/ease/clamp01/mixP/add/lerpP/kfAt/wristsAbs/NEUTRAL/BALL0）
body += seg(L_VS, L_MOVES - 1)
body += ['', '/* ---------------- 10 式关键帧（原文搬运） ---------------- */']
body += seg(L_MOVES, L_MOVES_END)
body += ['']
body += ['/* ---------------- 取式 / 姿态 ---------------- */']
body += seg(L_MSV3, L_MSV3)
body += ['']
body += seg(L_RP, L_RP_END)
body += [
    '',
    '/* ---------------- 对外接口 ---------------- */',
    '/** 应用第 i 式(0-based) 对应的房间版下标：房间版头部多一个「起势」 */',
    'export const roomIndexForAppStep = (appStepIdx) => Math.min(MOVES.length - 1, appStepIdx + 1)',
    '/** 只导出展示需要的字段，避免下游依赖内部结构 */',
    'export const ROOM_MOVES = MOVES.map((m) => ({ id: m.id, name: m.name, dur: m.dur, hint: m.hint || \'\' }))',
    '/** 房间版小人所在的 viewBox（含手臂完全展开的余量） */',
    'export const ROOM_VIEWBOX = \'60 126 280 322\'',
    'export { roomPose, VFOLD_K, lerp, ease, add, mixP }',
    '',
]

DST.parent.mkdir(parents=True, exist_ok=True)
DST.write_text('\n'.join(body), encoding='utf-8')
print('已写出', DST, len(body), '行')
