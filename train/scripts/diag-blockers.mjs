// 真值「被哪一条卡住」诊断
// ============================================================================
// verify-demo-standard.mjs 只告诉你「每式最高几分」。本脚本进一步回答：
//   这一式到底是**哪一条子项**把分压住了？是硬门槛直接归零，还是满分区间够不着？
//
// 做法：把 judge.js 八式的子项公式在本文件里**逐条复算一遍**（公式与 judge.js 一一对应，
// 见每条注释后的行号），然后对着一份 poses 文件逐帧统计：
//   · 该子项恒 0（= 满分区间在人体可达范围之外，或判据用错了基准）
//   · 该子项达 1 的帧占比
//   · 硬门槛命中率
//
// 用法: node scripts/diag-blockers.mjs [poses/baduanjin-8.json]
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MoveJudge } from '../src/engine/judge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const NAMES = ['两手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
  '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消']

const file = process.argv[2] || 'poses/baduanjin-8.json'
const P = resolve(ROOT, file)
if (!existsSync(P)) { console.error('找不到', P); process.exit(1) }
const truth = JSON.parse(readFileSync(P, 'utf8'))

// ---- 与 judge.js 同源的归一化工具（judge.js:22-94）----
const LM = { NOSE: 0, L_EYE: 2, R_EYE: 5, L_SHO: 11, R_SHO: 12, L_ELB: 13, R_ELB: 14, L_WRI: 15, R_WRI: 16, L_HIP: 23, R_HIP: 24, L_KNE: 25, R_KNE: 26, L_ANK: 27, R_ANK: 28 }
const v = (p, i) => p[i] || { x: 0.5, y: 0.5, z: 0, visibility: 0 }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const torso = (p) => Math.max(1e-3, dist(v(p, LM.L_SHO), v(p, LM.R_SHO)))
const shoMid = (p) => mid(v(p, LM.L_SHO), v(p, LM.R_SHO))
const hipMid = (p) => mid(v(p, LM.L_HIP), v(p, LM.R_HIP))
const okUp = (x, lo, hi) => Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
const okDown = (x, g, b) => 1 - Math.min(1, Math.max(0, (x - g) / (b - g)))
const leanDeg = (p) => (Math.atan2(Math.abs(shoMid(p).x - hipMid(p).x), Math.abs(hipMid(p).y - shoMid(p).y)) * 180) / Math.PI
const raiseL = (p) => (shoMid(p).y - v(p, LM.L_WRI).y) / torso(p)
const raiseR = (p) => (shoMid(p).y - v(p, LM.R_WRI).y) / torso(p)
function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y }
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
  if (m < 1e-6) return 0
  return (Math.acos(Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / m))) * 180) / Math.PI
}

// ---- 逐式的子项复算（返回 {名称: 值}，硬门槛返回 gate 名）----
function terms(p, m) {
  const t = torso(p), sY = shoMid(p).y
  if (m === 0) {                                                    // judge.js:126-133
    return {
      'both 较低腕上举(1.0→1.9)': okUp(Math.min(raiseL(p), raiseR(p)), 1.0, 1.9),
      'avg 双腕均上举(1.2→2.2)': okUp((raiseL(p) + raiseR(p)) / 2, 1.2, 2.2),
      'st 双肘伸直(0.78→0.94)': okUp((angle(v(p, LM.L_SHO), v(p, LM.L_ELB), v(p, LM.L_WRI)) + angle(v(p, LM.R_SHO), v(p, LM.R_ELB), v(p, LM.R_WRI))) / 360, 0.78, 0.94),
      'apart 双腕分开(1.3→2.4)': okUp(dist(v(p, LM.L_WRI), v(p, LM.R_WRI)) / t, 1.3, 2.4),
    }
  }
  if (m === 1) {                                                    // judge.js:137-146
    const aL = angle(v(p, LM.L_SHO), v(p, LM.L_ELB), v(p, LM.L_WRI)) / 180
    const aR = angle(v(p, LM.R_SHO), v(p, LM.R_ELB), v(p, LM.R_WRI)) / 180
    return {
      'wide 双腕拉开(1.5→2.4)': okUp(dist(v(p, LM.L_WRI), v(p, LM.R_WRI)) / t, 1.5, 2.4),
      'atShoulder 手与肩同高': okUp(1 - Math.abs(Math.max(v(p, LM.L_WRI).y, v(p, LM.R_WRI).y) - sY) / t, 0, 0.45),
      'straightOne 一手伸直(.80→.95)': okUp(Math.max(aL, aR), 0.80, 0.95),
      'bentOne 一手屈肘(.35→.60倒)': okUp(1 - Math.min(aL, aR), 0.35, 0.60),
    }
  }
  if (m === 2) {                                                    // judge.js:153-160
    const rl = raiseL(p), rr = raiseR(p)
    const hi = Math.max(rl, rr), lo = Math.min(rl, rr)
    const g = {}
    if (hi < 1.2) g['GATE_举手需高过肩1.2'] = hi
    if (lo > -0.1) g.GATE_按手需低于肩线 = lo
    return { ...g, 'gap 高低落差(2.0→3.4)': okUp(hi - lo, 2.0, 3.4), 'upOk 举手高度(1.2→2.2)': okUp(hi, 1.2, 2.2), 'lowOk 按手下探(0.4→1.3)': okUp(-lo, 0.4, 1.3) }
  }
  if (m === 3) {                                                    // judge.js:167-176
    const lean = leanDeg(p)
    const dev = Math.abs(v(p, LM.NOSE).x - shoMid(p).x) / t
    const g = {}
    if (lean > 28) g.GATE_躯干不直 = lean
    if (dev < 0.22) g.GATE_没转头 = dev
    return { ...g, 'turn 转头幅度(.22→.52)': okUp(dev, 0.22, 0.52), 'upright 站直(10→28倒)': okDown(lean, 10, 28), 'shoTilt 肩水平': okDown(Math.abs(v(p, LM.L_SHO).y - v(p, LM.R_SHO).y) / t, 0.06, 0.20) }
  }
  if (m === 4) {                                                    // judge.js:187-208
    const dropRaw = (Math.min(v(p, LM.L_WRI).y, v(p, LM.R_WRI).y) - sY) / t
    const swing = p.__handSwing ?? 0
    const g = {}
    if (dropRaw < 1.9) g['GATE_手低于肩1.9'] = dropRaw
    if (p.__ready === false) g.GATE_时序窗口未满 = 0
    if (swing < 0.18) g['GATE_横摆不足0.18'] = swing
    return { ...g, 'bend 俯身(35→70)': okUp(leanDeg(p), 35, 70), 'drop 下探(1.9→3.0)': okUp(dropRaw, 1.9, 3.0), 'handSwing 手横摆': okUp(swing, 0.18, 0.80), 'bodySway 躯干横摆': okUp(p.__sway ?? 0, 0.08, 0.34) }
  }
  if (m === 5) {                                                    // judge.js:217-242
    const dropL = (v(p, LM.L_WRI).y - sY) / t, dropR = (v(p, LM.R_WRI).y - sY) / t
    const minDrop = Math.min(dropL, dropR), swing = p.__handSwing ?? 0
    const g = {}
    if (minDrop < 2.1) g['GATE_手低于肩2.1'] = minDrop
    if (p.__ready === false) g.GATE_时序窗口未满 = 0
    if (swing > 0.26) g.GATE_横摆过大 = swing
    return { ...g, 'bend 前屈(30→70)': okUp(leanDeg(p), 30, 70), 'reach 下探(2.1→3.4)': okUp(minDrop, 2.1, 3.4), 'sync 双手齐平': okDown(Math.abs(dropL - dropR), 0.10, 0.75), 'still 定点不摆': okDown(swing, 0.08, 0.26) }
  }
  if (m === 6) {                                                    // judge.js:250-283
    const fwdL = (v(p, LM.L_WRI).x - v(p, LM.L_SHO).x) / t
    const fwdR = (v(p, LM.R_WRI).x - v(p, LM.R_SHO).x) / t
    const leftOnScreen = v(p, LM.L_SHO).x < v(p, LM.R_SHO).x
    const outward = leftOnScreen ? -1 : 1
    const scoreL = fwdL * outward, scoreR = fwdR * outward
    const punchL = scoreL >= scoreR && scoreL > 0.2
    const punchR = !punchL && scoreR > 0.2
    const g = {}
    if (!punchL && !punchR) g.GATE_没有手前伸 = Math.max(scoreL, scoreR)
    const SH = punchL ? LM.L_SHO : LM.R_SHO, EL = punchL ? LM.L_ELB : LM.R_ELB
    const WR = punchL ? LM.L_WRI : LM.R_WRI, OTHER = punchL ? LM.R_WRI : LM.L_WRI
    const waistDist = Math.abs(v(p, OTHER).y - hipMid(p).y) / t
    const atWaist = 1 - Math.min(1, waistDist / 0.28)
    if (atWaist < 0.45) g.GATE_另一手不在腰侧 = atWaist
    return { ...g, 'reach 前伸(.55→1.15)': okUp(Math.max(scoreL, scoreR), 0.55, 1.15), 'level 拳肩同高': okUp(1 - Math.abs(v(p, WR).y - v(p, SH).y) / t, 0, 0.35), 'straight 肘伸直(.82→.95)': okUp(angle(v(p, SH), v(p, EL), v(p, WR)) / 180, 0.82, 0.95), 'atWaist 收手腰侧': atWaist }
  }
  // m === 7                                                          // judge.js:290-300
  const g = {}
  if (p.__ready === false) g.GATE_时序窗口未满 = 0
  const bob = okUp(p.__bob ?? 0, 0.05, 0.20)
  if (bob < 0.02) g.GATE_没起伏 = p.__bob ?? 0
  return { ...g, 'upright 站直(12→30倒)': okDown(leanDeg(p), 12, 30), 'bob 起伏(.05→.20)': bob }
}

function sampleTruth(keys, tt) {
  let i = 0
  while (i < keys.length - 2 && tt >= keys[i + 1].t) i++
  const a = keys[i], b = keys[i + 1] || keys[i]
  const k = Math.max(0, Math.min(1, (tt - a.t) / Math.max(0.001, b.t - a.t)))
  const s = 0.5 - 0.5 * Math.cos(Math.PI * k)
  const out = new Array(33)
  for (let j = 0; j < 33; j++) {
    const q = (a.pts || [])[j] || (b.pts || [])[j] || [0.5, 0.5, 0, 0]
    const r = (b.pts || [])[j] || q
    out[j] = { x: q[0] + ((r[0] ?? 0.5) - q[0]) * s, y: q[1] + ((r[1] ?? 0.5) - q[1]) * s, z: q[2] || 0, visibility: q[3] ?? 1 }
  }
  return out
}

const FPS = 30
console.log(`\n源文件：${file}`)
console.log('='.repeat(96))
for (let m = 0; m < 8; m++) {
  const mv = truth.moves.find((x) => x.move === `baduanjin-${m + 1}`)
  if (!mv) { console.log(`\n式${m + 1} ${NAMES[m]}：无数据`); continue }
  const N = Math.max(12, Math.round((mv.dur || 4) * FPS))
  const judge = new MoveJudge({ order: null })
  const agg = {}       // 子项：{zero, one, sum, n}
  const gate = {}      // 硬门槛命中次数
  let best = 0, bestT = 0
  for (let f = 0; f < N; f++) {
    const tt = (f / N) * (mv.dur || 4)
    const lm = sampleTruth(mv.keys, tt)
    const sc = judge.scores(lm)
    if ((sc[m] || 0) > best) { best = sc[m]; bestT = tt }
    const T = terms(lm, m)
    for (const [k, val] of Object.entries(T)) {
      if (k.startsWith('GATE_')) { gate[k] = (gate[k] || 0) + 1; continue }
      const o = agg[k] || (agg[k] = { zero: 0, one: 0, sum: 0, n: 0 })
      o.n++; o.sum += val
      if (val < 0.02) o.zero++
      if (val > 0.98) o.one++
    }
  }
  console.log(`\n式${m + 1} ${NAMES[m]}   最高分 ${best.toFixed(3)} @ ${bestT.toFixed(1)}s / ${(mv.range || []).map((x) => x.toFixed(1)).join('~')}   合格线 0.55`)
  for (const [k, o] of Object.entries(agg)) {
    const flag = o.zero === o.n ? '  ← 全片恒 0（满分区间够不着）' : (o.zero / o.n > 0.6 ? '  ← 多数帧为 0' : '')
    console.log(`    ${k.padEnd(30)} 均值 ${(o.sum / o.n).toFixed(2)}  恒0 ${(o.zero / o.n * 100).toFixed(0)}%  满分 ${(o.one / o.n * 100).toFixed(0)}%${flag}`)
  }
  for (const [k, c] of Object.entries(gate)) {
    console.log(`    [硬门槛] ${k.padEnd(24)} 命中 ${(c / N * 100).toFixed(0)}% 帧`)
  }
}
console.log('')
