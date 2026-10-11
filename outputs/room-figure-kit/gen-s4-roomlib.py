#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 train/src/data/roomMovesExtra.js —— 把 kit 里的「太极 24 式 / 五禽戏 10 式」
动作库接进 s4 跟练页的教练小窗。

设计要点
--------
* **几何块逐行复制自 train/src/data/roomMoves.js**（VS…BALL0）。不是抄一份常量，
  而是运行时从该文件里切出来 —— 这样两边的坐标系/夹断范围/插值算法**结构上不可能漂移**。
* **关键帧从 outputs/room-figure-kit/{moves-taiji,moves-wuqinxi}.js 抽取**，
  照搬 `var MOVES = [...]` 原文 ⇒ kit 是唯一真源；要改动作改 kit 再重跑本脚本。
* 生成后由 check-s4-roomlib.cjs 逐点比对「ESM 版 vs UMD 版」的输出（容差 1e-12），
  任何不一致都会让生成器报错退出。

跑法：  python3 outputs/room-figure-kit/gen-s4-roomlib.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
ROOM_MOVES = os.path.join(REPO, 'train', 'src', 'data', 'roomMoves.js')
OUT = os.path.join(REPO, 'train', 'src', 'data', 'roomMovesExtra.js')

STYLES = [
    ('taiji', 'moves-taiji.js', 'MOVES_TAIJI',
     '太极 24 式（式名 / 次序逐条对齐 train/src/data/styles.js 的 TAIJI_MOVES）'),
    ('wuqinxi', 'moves-wuqinxi.js', 'MOVES_WUQINXI',
     '五禽戏 10 式（式名 / 次序逐条对齐 train/src/data/styles.js 的 WUQINXI_MOVES）'),
]


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def geometry_block():
    """从 roomMoves.js 切出几何块（const VS … const BALL0 那一行）"""
    lines = read(ROOM_MOVES).split('\n')
    i0 = next(i for i, l in enumerate(lines) if l.startswith('const VS = 1.367;'))
    i1 = next(i for i, l in enumerate(lines) if l.startswith('const BALL0'))
    block = '\n'.join(lines[i0:i1 + 1])
    # 保险：块里必须包含这几个关键符号
    for sym in ('function pol(', 'function P(', 'function kfAt(', 'function wristsAbs(',
                'const NEUTRAL', 'const BALL0', 'const VFOLD_K', 'const R_MIN'):
        if sym not in block:
            raise SystemExit('几何块切取失败，缺 %r' % sym)
    return block


def move_body(fname, target_name):
    """从 kit 的 moves-*.js 里抽出「辅助常量 + MOVES 数组」，并把 var MOVES 改名"""
    src = read(os.path.join(HERE, fname))
    lines = src.split('\n')
    i0 = next(i for i, l in enumerate(lines) if re.match(r'\s*var P = K\.P', l))
    i1 = next(i for i, l in enumerate(lines) if re.match(r"\s*K\.defineMoves\(", l))
    body = '\n'.join(lines[i0 + 1:i1])
    # 去掉头部多余空行
    body = body.lstrip('\n')
    # var MOVES = [ → const MOVES_TAIJI = [
    new_body, n = re.subn(r'^(\s*)var MOVES = \[', r'\1const %s = [' % target_name,
                          body, count=1, flags=re.M)
    if n != 1:
        raise SystemExit('%s：没找到 `var MOVES = [`' % fname)
    # 去掉尾部多余空行 + 缩进对齐（原文带 2 空格缩进，整块去掉最外层 2 空格）
    return new_body.rstrip() + '\n'


HEADER = '''// 太极 24 式 / 五禽戏 10 式 · 房间版动作库（**生成物，勿手改**）
// ---------------------------------------------------------------------------
// 由 outputs/room-figure-kit/gen-s4-roomlib.py 生成：
//   · 几何块 —— 逐行复制自 train/src/data/roomMoves.js（与八段锦同一套坐标系：
//     v3 空间，地面 y=266、静止肩点 L=(100,110)/R=(140,110)、臂长 32+28=60，
//     腕位存「相对肩的极坐标 (r,θ°)」、r 夹在 [28,60]）
//   · 关键帧 —— 从 outputs/room-figure-kit/{moves-taiji,moves-wuqinxi}.js 抽取
// 要改动作，请改 kit 里的 moves-*.js 再重跑生成器；本文件的手改会在下次生成时被覆盖。
//
// 【为什么需要它】教练小窗（CoachFigure.vue）原本只有八段锦有房间版小人。
//   这里把同一套几何 + 另外两套动作库接进来，让太极 / 五禽戏也能用同一个形象演示。
//
// 【两套库的口径】
//   太极   24 式，与应用 styles.js 的 TAIJI_MOVES **同名同次序**（含两次「单鞭」、
//          左右「揽雀尾」），所以「应用第 i 式」→「本库下标 i」是 1:1。
//   五禽戏 10 式，与应用 styles.js 的 WUQINXI_MOVES **同名同次序**
//          （虎举/虎扑/鹿抵/鹿奔/熊运/熊晃/猿提/猿摘/鸟伸/鸟飞）⇒ 同样 1:1。
//   两套库除太极「起势 / 收势」外，**每式都首尾同姿**（起收于抱球位）⇒ 切式不跳。
'''

FOOTER_TMPL = '''
/* ---------------- 取式 / 姿态 ---------------- */
const LIB = { taiji: MOVES_TAIJI, wuqinxi: MOVES_WUQINXI };

function moveStateV3(styleId, idx, u) {
  const list = LIB[styleId];
  const mv = list && list[idx];
  if (!mv) return BALL0;
  return mv.f ? mv.f(u) : kfAt(mv.kf, u);
}

/** 与 roomMoves.js 的 roomPose() 同一算法，只是按 styleId 取式再解算。 */
export function roomPoseExtra(styleId, idx, u) {
  const st = moveStateV3(styleId, idx, u);
  const w = wristsAbs(st);
  return {
    px: vx(st.root[0]), py: vy(st.root[1]),
    hL: [vx(w[0][0]), vy(w[0][1])], hR: [vx(w[1][0]), vy(w[1][1])],
    feet: [[vx(st.feet[0][0]), vy(st.feet[0][1])], [vx(st.feet[1][0]), vy(st.feet[1][1])]],
    lean: st.lean, fold: st.fold, headOff: st.headOff * VS,
  };
}

/* ---------------- 对外接口 ---------------- */
/** 只导出展示需要的字段，避免下游依赖内部结构 */
export const ROOM_EXTRA_MOVES = {
  taiji: MOVES_TAIJI.map((m) => ({ id: m.id, name: m.name, dur: m.dur, hint: m.hint || '' })),
  wuqinxi: MOVES_WUQINXI.map((m) => ({ id: m.id, name: m.name, dur: m.dur, hint: m.hint || '' })),
};

/**
 * 五禽戏：应用内的 10 式 → 本库 10 式里的下标。
 * 自 2026-10-11 起应用补齐到 10 式、与套件同名同次序 ⇒ 恒等映射。
 * 保留常量（而非删掉）是为了让闸门/外部核对脚本仍能打印「应用式 → 本库式」对照。
 */
export const WUQINXI_APP_TO_LIB = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * 应用式号 → 本库式号。
 *   taiji   应用 24 式 ↔ 本库 24 式，同名同次序 ⇒ 1:1
 *   wuqinxi 应用 10 式 ↔ 本库 10 式，同名同次序 ⇒ 1:1
 * @param {string} styleId 拳种 id（styles.js）
 * @param {number} stepIdx 应用内第几式（0-based）
 * @returns {number|null} 本库式号；该拳种没有房间版形象时返回 null
 */
export function roomIdxForStyle(styleId, stepIdx) {
  if (!Number.isInteger(stepIdx) || stepIdx < 0) return null;
  if (styleId === 'taiji') return stepIdx < MOVES_TAIJI.length ? stepIdx : null;
  if (styleId === 'wuqinxi') {
    const i = WUQINXI_APP_TO_LIB[stepIdx];
    return i === undefined ? null : i;
  }
  return null;
}
'''


def main():
    parts = [HEADER, '\n', geometry_block(), '\n']
    for style_id, fname, target, title in STYLES:
        parts.append('\n/* ============ %s ============ */\n' % title)
        parts.append(move_body(fname, target))
    parts.append(FOOTER_TMPL)
    out = ''.join(parts)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(out)
    print('已写出 %s（%d 行 / %d 字节）' % (
        os.path.relpath(OUT, REPO), out.count('\n') + 1, len(out.encode('utf-8'))))

    # 闸门：产物必须与 kit 真源逐点一致，否则中止（返回非 0）
    import subprocess
    node = os.environ.get('NODE_BIN') or 'node'
    chk = os.path.join(HERE, 'check-s4-roomlib.cjs')
    print('\n--- 漂移闸门 ---')
    rc = subprocess.call([node, chk])
    if rc != 0:
        raise SystemExit('✗ 闸门未通过：产物与 kit 不一致，请检查生成逻辑')
    print('✓ 生成 + 闸门 均通过')


if __name__ == '__main__':
    main()
