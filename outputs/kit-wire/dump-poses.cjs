/**
 * 姿态取样器 —— 把 kit 里指定几式的「绘制空间姿态」导成 JSON，供对照图脚本绘制。
 *
 * 用法：node dump-poses.cjs <moves 所在目录> <输出 json>
 *   <moves 所在目录> 需含 moves-wuqinxi.js / moves-taiji.js
 *   · 改后（真源）： outputs/room-figure-kit/
 *   · 改前（备份）： outputs/kit-wire/std-fix-before/
 *
 * 只读代码、不写前端；几何块两边完全同一份（roomFigureKit.js 未改），
 * 所以 JSON 的差异只可能来自 moves-*.js 的关键帧本身。
 */
const fs = require('fs')
const path = require('path')
const Module = require('module')

const KIT = path.resolve(__dirname, '..', 'room-figure-kit', 'roomFigureKit.js')
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'room-figure-kit'))
const out = path.resolve(process.argv[3] || path.join(__dirname, 'poses.json'))

const K = require(KIT)
globalThis.RoomFigureKit = K
// 两个动作库是「经典脚本」（读全局 RoomFigureKit 后 defineMoves），用 require 直接跑一遍即可
require(path.join(dir, 'moves-wuqinxi.js'))
require(path.join(dir, 'moves-taiji.js'))

// 抽查的 6 处修正点（style, 库里下标, 名称, 采样 u）
const CASES = [
  ['wuqinxi', 0, '虎举', [0.16, 0.34, 0.52, 0.62, 0.88]],
  ['wuqinxi', 1, '虎扑', [0.18, 0.34, 0.60, 0.82, 0.90]],
  ['wuqinxi', 2, '鹿抵', [0.18, 0.38, 0.56, 0.66, 0.84]],
  ['wuqinxi', 6, '猿提', [0.36, 0.52, 0.62, 0.72, 0.86]],
  ['wuqinxi', 9, '鸟飞', [0.16, 0.36, 0.52, 0.64, 0.82]],
  ['taiji', 23, '收势', [0.00, 0.26, 0.54, 0.76, 1.00]],
]

const r2 = (x) => Math.round(x * 1000) / 1000
const res = { dir: path.relative(path.resolve(__dirname, '..', '..'), dir), cases: [] }

for (const [style, idx, name, us] of CASES) {
  const mv = K.moves(style)[idx]
  if (!mv) throw new Error('取不到 ' + style + '[' + idx + ']')
  const frames = us.map((u) => {
    const st = mv.f ? mv.f(u) : K.kfAt(mv.kf, u)
    const p = K.toDrawPose(st)
    return {
      u,
      px: r2(p.px), py: r2(p.py),
      hL: p.hL.map(r2), hR: p.hR.map(r2),
      feet: p.feet.map((f) => f.map(r2)),
      lean: r2(p.lean), fold: r2(p.fold), headOff: r2(p.headOff),
      // 原始 v3 量（便于核对 lean/headOff 语义）
      v3: {
        root: st.root.map(r2), lean: r2(st.lean), fold: r2(st.fold), headOff: r2(st.headOff),
        wrists: st.wrists.map((w) => w.map(r2)),
        feet: st.feet.map((f) => f.map(r2)),
      },
    }
  })
  res.cases.push({ style, idx, name, dur: mv.dur, frames })
}

fs.writeFileSync(out, JSON.stringify(res, null, 1))
console.log('wrote', path.relative(process.cwd(), out), '·', res.cases.length, '式 ×',
  res.cases[0].frames.length, '帧  · 源 =', res.dir)
