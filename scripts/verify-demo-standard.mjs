// 示范动作「标准度」验收闸门
// ============================================================================
// 【为什么存在】
//   示范动画（src/data/demoAnim.js）是 11 个手工标量角度（aL/eL/aR/eR/lean/bend/…）
//   驱动的柔和小人。这套数值标准不标准，一直没有度量衡。
//   但本项目**已经有度量衡**：src/engine/judge.js 的 MoveJudge（MediaPipe 33 点、
//   八式规则集、阈值 0.55）。它判的是「真人动作像不像该式」。
//
//   本脚本把示范动作的每一帧 → 还原成 MediaPipe 33 点 → 喂 MoveJudge，
//   看这套「示范动作」自己能拿多少分。换真值前 / 换真值后各跑一次即得对比报告。
//
// 【跑法】
//   node scripts/verify-demo-standard.mjs                                   # 测现有手工数据（基线）
//   node scripts/verify-demo-standard.mjs --poses poses/baduanjin-8.json    # 测视频提取的真值
//
// 【依赖】纯相对路径，无第三方库（复用项目自己的 demoAnim / judge）
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEMO_ANIMS, POSE_KEYS } from '../src/data/demoAnim.js'
import { MoveJudge, THRESHOLD } from '../src/engine/judge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const args = process.argv.slice(2)
const posesPath = args.includes('--poses') ? args[args.indexOf('--poses') + 1] : null

const NAMES = [
  '双手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
  '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消',
]

// ---------------------------------------------------------------- 姿态插值
// 与 DemoAnimation.vue 的 ease / lerpPose 完全一致（保证测的就是播放出来的画面）
function ease(k) { return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k))) }
function lerpPose(a, b, k) {
  const out = {}
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * k
  return out
}
function samplePose(keys, tt) {
  let i = 0
  while (i < keys.length - 2 && tt >= keys[i + 1].t) i++
  const k0 = keys[i], k1 = keys[i + 1] || keys[i]
  const span = Math.max(0.001, k1.t - k0.t)
  return lerpPose(k0.pose, k1.pose, ease((tt - k0.t) / span))
}

/** 真值数据：33 点关键帧 → 任意时刻的 landmarks（逐点 ease 插值） */
function sampleTruth(keys, tt) {
  let i = 0
  while (i < keys.length - 2 && tt >= keys[i + 1].t) i++
  const a = keys[i], b = keys[i + 1] || keys[i]
  const span = Math.max(0.001, b.t - a.t)
  const k = ease((tt - a.t) / span)
  const fa = a.pts || [], fb = b.pts || fa
  const out = new Array(33)
  for (let j = 0; j < 33; j++) {
    const p = fa[j] || fb[j] || [0.5, 0.5, 0, 0]
    const q = fb[j] || p
    out[j] = { x: p[0] + ((q[0] ?? 0.5) - p[0]) * k,
               y: p[1] + ((q[1] ?? 0.5) - p[1]) * k,
               z: p[2] || 0, visibility: p[3] ?? 1 }
  }
  return out
}

// ---------------------------------------------------------------- 正向运动学
// 照抄 DemoAnimation.vue draw() 的几何（u=1 归一化）。约定：
//   x 向右为正、y 向下为正 —— 与 MediaPipe 一致
//   dir = -1 → 图像左（MediaPipe L_*），dir = +1 → 图像右（R_*）
function poseToLandmarks(p) {
  const rad = Math.PI / 180
  const w = 1, h = 1, u = 1

  const groundY = h * 0.88
  const legLen = u * 0.15
  const pelvisY = groundY - legLen * 2 * (1 - p.crouch * 0.32) - p.lift * u * 0.025
  const spineLen = u * 0.23 * (1 - p.bend * 0.42)
  const leanR = p.lean * rad
  const pelvis = { x: w / 2, y: pelvisY }
  const neck = { x: w / 2 + Math.sin(leanR) * spineLen,
                 y: pelvisY - Math.cos(leanR) * spineLen + p.bend * u * 0.05 }
  const headR = u * 0.052
  const head = { x: neck.x + Math.sin(leanR) * headR * 1.1 + (p.head / 60) * headR * 1.6,
                 y: neck.y - headR * 1.45 }

  const hipW = u * 0.045, kb = p.crouch * 58
  const mkLeg = (dir, ang) => {
    const hip = { x: pelvis.x + dir * hipW, y: pelvis.y }
    const a = ang * rad
    const knee = { x: hip.x + Math.sin(a) * legLen * dir, y: hip.y + Math.cos(a) * legLen }
    const shinAng = (dir === 1 ? ang - kb : ang + kb) * rad
    const foot = { x: knee.x + Math.sin(shinAng) * legLen * dir, y: knee.y + Math.cos(shinAng) * legLen }
    return { hip, knee, foot }
  }
  const legL = mkLeg(-1, p.legL), legR = mkLeg(1, p.legR)

  const shW = u * 0.075, upper = u * 0.11, fore = u * 0.10
  const mkArm = (dir, a, e) => {
    const sh = { x: neck.x + dir * shW, y: neck.y }
    const a1 = a * rad
    const el = { x: sh.x + Math.sin(a1) * upper * dir, y: sh.y + Math.cos(a1) * upper }
    const a2 = (a - e) * rad
    const hand = { x: el.x + Math.sin(a2) * fore * dir, y: el.y + Math.cos(a2) * fore }
    return { sh, el, hand }
  }
  const armL = mkArm(-1, p.aL, p.eL), armR = mkArm(1, p.aR, p.eR)

  const lm = new Array(33)
  const put = (i, pt, vis = 0.95) => { lm[i] = { x: pt.x, y: pt.y, z: 0, visibility: vis } }
  put(0, head)
  put(2, { x: head.x - headR * 0.35, y: head.y - headR * 0.15 })
  put(5, { x: head.x + headR * 0.35, y: head.y - headR * 0.15 })
  put(7, { x: head.x - headR * 0.9, y: head.y + headR * 0.1 })
  put(8, { x: head.x + headR * 0.9, y: head.y + headR * 0.1 })
  put(9, { x: head.x - headR * 0.3, y: head.y + headR * 0.9 })
  put(10, { x: head.x + headR * 0.3, y: head.y + headR * 0.9 })
  put(11, armL.sh);    put(12, armR.sh)
  put(13, armL.el);    put(14, armR.el)
  put(15, armL.hand);  put(16, armR.hand)
  put(17, armL.hand);  put(18, armR.hand)
  put(19, armL.hand);  put(20, armR.hand)
  put(21, armL.hand);  put(22, armR.hand)
  put(23, legL.hip);   put(24, legR.hip)
  put(25, legL.knee);  put(26, legR.knee)
  put(27, legL.foot);  put(28, legR.foot)
  put(29, legL.foot);  put(30, legR.foot)
  put(31, legL.foot);  put(32, legR.foot)
  return lm
}

// ---------------------------------------------------------------- 逐式打分
const FPS = 30
function measure(keys, dur, manual, moveIdx) {
  const N = Math.max(12, Math.round(dur * FPS))
  const judge = new MoveJudge({ order: null })
  const self = [], cross = new Array(8).fill(0)
  for (let f = 0; f < N; f++) {
    const tt = (f / N) * dur
    const lm = manual ? poseToLandmarks(samplePose(keys, tt)) : sampleTruth(keys, tt)
    const sc = judge.scores(lm)
    for (let i = 0; i < 8; i++) cross[i] = Math.max(cross[i], sc[i] || 0)
    self.push(sc[moveIdx] || 0)
  }
  return {
    max: Math.max(...self),
    avg: self.reduce((a, b) => a + b, 0) / self.length,
    pass: self.filter((s) => s >= THRESHOLD).length / self.length,
    self, cross,
  }
}

// ---------------------------------------------------------------- 载入真值
let truth = null
if (posesPath) {
  const file = posesPath.startsWith('.') ? resolve(ROOT, posesPath) : posesPath
  if (!existsSync(file)) { console.error(`找不到真值文件：${file}`); process.exit(1) }
  truth = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(truth.moves)) { console.error('真值文件格式不对：缺少 moves[]'); process.exit(1) }
}

// ---------------------------------------------------------------- 报告
const bar = (v) => '█'.repeat(Math.round(v * 20)).padEnd(20, '·')
const fmt = (x) => (x ? `${x.max.toFixed(2)} (${(x.pass * 100).toFixed(0)}%)` : '—')
const rows = []

for (let m = 0; m < 8; m++) {
  const man = DEMO_ANIMS[`baduanjin-${m + 1}`]
  const found = truth ? truth.moves.find((x) => x.move === `baduanjin-${m + 1}`) : null
  const tru = found ? { keys: found.keys, dur: found.dur } : null
  rows.push({
    m, name: NAMES[m],
    a: man ? measure(man.keys, man.dur, true, m) : null,
    b: tru ? measure(tru.keys, tru.dur, false, m) : null,
  })
}

console.log('')
if (truth) {
  console.log(`示范动作标准度（真值：${posesPath}）   合格线 ${THRESHOLD}`)
  console.log('\n式  名称                手工数据        视频真值        变化')
  console.log('─'.repeat(76))
  for (const r of rows) {
    const d = r.a && r.b ? (r.b.max - r.a.max >= 0 ? '+' : '') + (r.b.max - r.a.max).toFixed(2) : ''
    console.log(
      `${r.m + 1}   ${NAMES[r.m].padEnd(7, '　').slice(0, 6)}   ` +
      `${fmt(r.a).padEnd(15)}  ${fmt(r.b).padEnd(15)}  ${d}`
    )
  }
  console.log('─'.repeat(76))
  const up = rows.filter((r) => r.a && r.b && r.a.max < THRESHOLD && r.b.max >= 0.9).length
  const low = rows.filter((r) => r.b && r.b.max < 0.9).length
  const noData = rows.filter((r) => !r.b).length
  console.log(`\n换真值后：${up} 式从「不达标」→「≥0.9」；仍 <0.9 的 ${low} 式；无数据的 ${noData} 式`)
} else {
  console.log(`示范动作标准度（现有手工数据）   合格线 ${THRESHOLD}`)
  console.log('\n式  名称                最高分  均值   达标帧占比')
  console.log('─'.repeat(76))
  for (const r of rows) {
    if (!r.a) { console.log(`${r.m + 1}  ${r.name}  无数据`); continue }
    console.log(
      `${r.m + 1}   ${NAMES[r.m].padEnd(7, '　').slice(0, 6)}  ` +
      `${r.a.max.toFixed(2)}   ${r.a.avg.toFixed(2)}   ` +
      `${(r.a.pass * 100).toFixed(0)}%`.padEnd(6) + '   ' + bar(r.a.max)
    )
  }
  console.log('─'.repeat(76))
}

console.log('\n串扰检查（演示某式时其它式的最高分，>0.8 视为长得像）')
let anyCross = false
for (const r of rows) {
  const pick = truth ? (r.b || r.a) : r.a
  if (!pick) continue
  const others = pick.cross.map((v, i) => ({ v, i })).filter((o) => o.i !== r.m && o.v > 0.8)
  if (others.length) {
    anyCross = true
    console.log(`  式${r.m + 1} ${r.name} → 被判成 ` +
      others.map((o) => `式${o.i + 1} ${NAMES[o.i]}(${o.v.toFixed(2)})`).join('、'))
  }
}
if (!anyCross) console.log('  无（没有一式被误认成别的式）')

const live = rows.filter((r) => (truth ? r.b : r.a))
if (live.length) {
  const worst = Math.min(...live.map((r) => (truth ? r.b : r.a).max))
  console.log(`\n最弱一式最高分 = ${worst.toFixed(2)}` +
    (worst < THRESHOLD ? '  → 该式示范动作按自家判定器永远不达标' : '  → 全部达标'))
}

const outDir = resolve(ROOT, 'evidence/demo-standard')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'verify-demo-standard.json'),
  JSON.stringify({
    mode: truth ? 'truth' : 'manual', source: posesPath,
    rows: rows.map((r) => ({
      move: r.m + 1, name: r.name,
      manual: r.a ? { max: +r.a.max.toFixed(3), avg: +r.a.avg.toFixed(3), pass: r.a.pass } : null,
      truth: r.b ? { max: +r.b.max.toFixed(3), avg: +r.b.avg.toFixed(3), pass: r.b.pass } : null,
    })),
  }, null, 2))
console.log(`\n明细已写入 evidence/demo-standard/verify-demo-standard.json\n`)
