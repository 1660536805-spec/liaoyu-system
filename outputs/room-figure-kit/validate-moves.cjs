/* ============================================================================
 * 校验两套题库（五禽戏 10 式 / 太极 24 式）—— 纯 node，不依赖浏览器
 * 跑法： node outputs/room-figure-kit/validate-moves.cjs
 * 检查项：
 *   1) 式数 / id / 名称 / 次序
 *   2) 逐式密采样：NaN、腕位极坐标 r 越界（= 动作幅度被静默夹断）、
 *      足部沉入地面（y > 266）、手位过低（穿透地面）
 *   3) 首尾闭合（除太极起势/收势按套路例外）
 *   4) 跨式回卷差（末式→首式、式 i 末帧→式 i+1 首帧）
 *   5) 逐帧最大跳变（检测瞬跳；kfAt 有 ease，理论上应平滑）
 * ========================================================================== */
'use strict'
const path = require('path')
global.window = global
global.RoomFigureKit = require(path.join(__dirname, 'roomFigureKit.js'))
require(path.join(__dirname, 'moves-wuqinxi.js'))
require(path.join(__dirname, 'moves-taiji.js'))

const K = global.RoomFigureKit
const consts = K.consts
const R_MIN = consts.R_MIN, R_MAX = consts.R_MAX
const VSH0L = consts.VSH0L, VSH0R = consts.VSH0R
const FLOOR = 266

const SAMP = 240           // 每式采样点数（密采）
const EPS = 1e-4

function flat(st) {
  return [
    st.wrists[0][0], st.wrists[0][1], st.wrists[1][0], st.wrists[1][1],
    st.feet[0][0], st.feet[0][1], st.feet[1][0], st.feet[1][1],
    st.root[0], st.root[1], st.lean, st.fold, st.headOff,
  ]
}
/* θ（下标 1、3）是极角：359.9° 与 0.1° 其实相邻，直接相减会假报 359.8 的「瞬跳」。
   lerpWrist 实际走最短弧 ⇒ 这里也必须按最短弧取差。 */
function dth(a, b) { var d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return d }
function linf(a, b) {
  var m = 0
  for (var i = 0; i < a.length; i++) {
    var d = (i === 1 || i === 3) ? Math.abs(dth(a[i], b[i])) : Math.abs(a[i] - b[i])
    if (d > m) m = d
  }
  return m
}
function anyNaN(a) { return a.some(function (v) { return typeof v !== 'number' || !isFinite(v) }) }

/* 原始（未夹断）腕距 —— P() 用 pol() 夹到 [28,60]，这里复算原距离以发现被夹断的帧 */
function rawR(origin, p) { return Math.hypot(p[0] - origin[0], p[1] - origin[1]) }

const REPORT = { styles: {}, errors: [], warnings: [] }

function checkStyle(styleId, expect) {
  const lib = K.library(styleId)
  if (!lib) { REPORT.errors.push(`缺少题库 ${styleId}`); return null }
  const moves = lib.moves
  const out = {
    title: lib.title, count: moves.length, expectCount: expect.count,
    ids: moves.map(m => m.id), names: moves.map(m => m.name),
    perMove: [], clampEvents: [], minWristY: Infinity, maxFootY: -Infinity,
    maxFrameStep: 0, wraps: [],
  }
  if (moves.length !== expect.count) REPORT.errors.push(`${styleId} 式数 ${moves.length} != 期望 ${expect.count}`)

  let prevLast = null
  moves.forEach((mv, i) => {
    const pts = []
    for (let s = 0; s <= SAMP; s++) pts.push(flat(K.moveState(mv, s / SAMP)))
    const nan = pts.filter(anyNaN).length
    const first = pts[0], last = pts[pts.length - 1]

    // 腕位 r 越界 + 足部
    let rViol = 0, footSink = 0, wristLow = 0, maxStep = 0
    for (let s = 0; s <= SAMP; s++) {
      const st = K.moveState(mv, s / SAMP)
      ;[0, 1].forEach(k => {
        const r = st.wrists[k][0]
        if (r < R_MIN - EPS || r > R_MAX + EPS) rViol++
      })
      ;[0, 1].forEach(k => {
        const fy = st.feet[k][1]
        if (fy > FLOOR + EPS) footSink++
        out.maxFootY = Math.max(out.maxFootY, fy)
      })
      // 手位（绝对）不穿地
      const dp = K.toDrawPose(st)
      ;[dp.hL, dp.hR].forEach(h => { out.minWristY = Math.min(out.minWristY, h[1]) })
      if (dp.hL[1] > consts.vy(FLOOR) + 1 || dp.hR[1] > consts.vy(FLOOR) + 1) wristLow++
      if (s > 0) maxStep = Math.max(maxStep, linf(pts[s], pts[s - 1]))
    }

    // 原始腕距夹断检测（只看关键帧定义，逐帧）
    let clamped = 0, clampWorst = 0
    ;(mv.kf || []).forEach(fr => {
      const st = fr[1]
      // 由极坐标反推绝对需要先算肩；用 toDrawPose 的近似不便，这里用「构造前原始点」不可得，
      // 故改用：极坐标 r 已夹断 ⇒ 与原意图的差无法反推。改判据：r 恰等于 R_MIN/R_MAX 即疑似夹断。
      ;[0, 1].forEach(k => {
        const r = st.wrists[k][0]
        if (Math.abs(r - R_MAX) < 1e-6 || Math.abs(r - R_MIN) < 1e-6) clamped++
      })
    })

    const closed = linf(first, last)
    const wrap = prevLast ? linf(prevLast, first) : null
    out.maxFrameStep = Math.max(out.maxFrameStep, maxStep)
    out.perMove.push({ i, id: mv.id, name: mv.name, dur: mv.dur, kfN: (mv.kf || []).length, nan, rViol, footSink, wristLow, closed: +closed.toFixed(6), wrap: wrap === null ? null : +wrap.toFixed(6), maxStep: +maxStep.toFixed(4), symR: clamped })
    if (wrap !== null) out.wraps.push({ from: moves[i - 1].name, to: mv.name, d: +wrap.toFixed(6) })
    prevLast = last
  })

  out.minWristY = +out.minWristY.toFixed(2)
  out.maxFootY = +out.maxFootY.toFixed(2)
  out.maxFrameStep = +out.maxFrameStep.toFixed(4)
  return out
}

const WQ = checkStyle('wuqinxi', { count: 10 })
const TJ = checkStyle('taiji', { count: 24 })
REPORT.styles.wuqinxi = WQ
REPORT.styles.taiji = TJ

/* ---- 与产品 styles.js 对齐（名称/次序）---- */
const fs = require('fs')
const stylesSrc = fs.readFileSync(path.join(__dirname, '../../train/src/data/styles.js'), 'utf8')
function grabMoves(constName) {
  const m = stylesSrc.match(new RegExp(constName + '\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*\\n'))
  if (!m) return null
  return [...m[1].matchAll(/name\s*:\s*'([^']+)'/g)].map(x => x[1])
}
const prodTaiji = grabMoves('TAIJI_MOVES')
const prodWq = grabMoves('WUQINXI_MOVES')
REPORT.prodCompare = {
  taiji: { prod: prodTaiji, kit: TJ && TJ.names, same: !!(prodTaiji && TJ) && prodTaiji.join('|') === TJ.names.join('|') },
  wuqinxi: { prod: prodWq, kit: WQ && WQ.names },
}

/* ---- 汇总打印 ---- */
function line(s) { console.log(s) }
line('='.repeat(78))
line(' 五禽戏 · 十式')
line('='.repeat(78))
WQ.perMove.forEach(r => line(`  ${String(r.i + 1).padStart(2)}. ${r.name.padEnd(6, '　')} dur=${String(r.dur).padStart(4)}  kf=${r.kfN}  闭环=${r.closed.toFixed(4)}  回卷=${r.wrap === null ? '  -  ' : r.wrap.toFixed(4)}  步进=${r.maxStep.toFixed(3)}  NaN=${r.nan}  r越界=${r.rViol}  足沉=${r.footSink}  手穿地=${r.wristLow}  端点夹断=${r.symR}`))
line(`  合计：式数=${WQ.count} 最大帧步进=${WQ.maxFrameStep} 最低手位y=${WQ.minWristY} 最低足y=${WQ.maxFootY}`)
line('')
line('='.repeat(78))
line(' 太极拳 · 二十四式')
line('='.repeat(78))
TJ.perMove.forEach(r => line(`  ${String(r.i + 1).padStart(2)}. ${r.name.padEnd(8, '　')} dur=${String(r.dur).padStart(4)}  kf=${r.kfN}  闭环=${r.closed.toFixed(4)}  回卷=${r.wrap === null ? '  -  ' : r.wrap.toFixed(4)}  步进=${r.maxStep.toFixed(3)}  NaN=${r.nan}  r越界=${r.rViol}  足沉=${r.footSink}  手穿地=${r.wristLow}  端点夹断=${r.symR}`))
line(`  合计：式数=${TJ.count} 最大帧步进=${TJ.maxFrameStep} 最低手位y=${TJ.minWristY} 最低足y=${TJ.maxFootY}`)
line('')
line('--- 与 styles.js 名称/次序对齐 ---')
line(`  太极   产品${prodTaiji ? prodTaiji.length : '?'}式 / 套件${TJ.count}式 → ${REPORT.prodCompare.taiji.same ? '完全一致 ✓' : '不一致 ✗'}`)
if (!REPORT.prodCompare.taiji.same && prodTaiji) {
  prodTaiji.forEach((n, i) => { if (n !== TJ.names[i]) line(`    [${i}] 产品="${n}" 套件="${TJ.names[i]}"`) })
}
if (prodWq) {
  const miss = prodWq.filter(n => !WQ.names.includes(n))
  line(`  五禽戏 产品${prodWq.length}式 → 套件10式包含: ${miss.length === 0 ? '全部包含 ✓' : '缺 ' + miss.join('/')}  （产品次序: ${prodWq.join('/')}）`)
  const idx = prodWq.map(n => WQ.names.indexOf(n))
  line(`         产品式名在套件中的下标: ${idx.join(',')}  ${idx.every((v, i) => i === 0 || v > idx[i - 1]) ? '次序单调一致 ✓' : '次序不一致 ✗'}`)
}

/* ---- 断言 ---- */
const all = [WQ, TJ]
all.forEach(st => st.perMove.forEach(r => {
  if (r.nan) REPORT.errors.push(`${r.name} 含 NaN ${r.nan} 帧`)
  if (r.rViol) REPORT.errors.push(`${r.name} 腕位 r 越界 ${r.rViol} 次`)
  if (r.footSink) REPORT.errors.push(`${r.name} 足部沉入地面 ${r.footSink} 次`)
}))
// 闭环：五禽戏 10/10；太极除 qishi/shoushi 外 22/22
WQ.perMove.forEach(r => { if (r.closed > 1e-3) REPORT.errors.push(`五禽戏 ${r.name} 首尾不闭合 ${r.closed}`) })
TJ.perMove.forEach(r => {
  if (r.id === 'qishi' || r.id === 'shoushi') return
  if (r.closed > 1e-3) REPORT.errors.push(`太极 ${r.name} 首尾不闭合 ${r.closed}`)
})
// 回卷差：以「本式最大帧步进」为地板（同量纲），回卷不应显著大于逐帧步进的总量
WQ.perMove.concat(TJ.perMove).forEach(r => {
  if (r.wrap !== null && r.wrap > 0.05) REPORT.warnings.push(`${r.name} 回卷差 ${r.wrap}（>0.05）`)
})

line('')
line('='.repeat(78))
if (REPORT.errors.length) { line(' ✗ 错误：'); REPORT.errors.forEach(e => line('   - ' + e)) } else line(' ✓ 全部断言通过')
if (REPORT.warnings.length) { line(' ⚠ 警告：'); REPORT.warnings.forEach(e => line('   - ' + e)) }
line('='.repeat(78))

fs.writeFileSync(path.join(__dirname, 'validate-moves.json'), JSON.stringify(REPORT, null, 2))
console.log('\n报告已写 validate-moves.json')
