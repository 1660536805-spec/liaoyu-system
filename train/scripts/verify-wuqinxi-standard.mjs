// 五禽戏五式「示范动作 × 判定规则」回放验收 + 对照图
// ============================================================================
// 【为什么存在】
//   第二批内容工程（阶段 E1）为五禽戏补了 5 式示范动画（src/data/demoAnim.js 的
//   wuqinxi-1..5）与 5 式判定规则（src/engine/styleRules.js 的 WUQINXI_RULES）。
//   两者必须自洽：把示范动画逐帧还原成 MediaPipe 33 点、喂给该拳种的判定器，
//   应当能「自己判中自己」，且不串到别的式。
//
// 【与 verify-demo-standard.mjs 的关系】
//   那个脚本只覆盖八段锦 8 式（写死 8 与内置 MOVES）。本脚本复用它同一套几何
//   （poseToLandmarks 照抄 DemoAnimation.vue 的绘制几何），但走「按拳种取规则」的
//   新接口（MoveJudge 的 style/count/names），因此能测五禽戏。
//
// 【跑法】node scripts/verify-wuqinxi-standard.mjs
//   同时写出对照图 outputs/wuqinxi-check/五禽戏-对照图.svg
// ============================================================================

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEMO_ANIMS, POSE_KEYS } from '../src/data/demoAnim.js'
import { MoveJudge, THRESHOLD } from '../src/engine/judge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

// styles.js 直接 import 了 moves.json（Vite 能处理、纯 Node ESM 不能），
// 故这里从源文件里取「五禽戏五式的 id/name」——单一真值仍在 styles.js。
const stylesSrc = readFileSync(resolve(__dirname, '..', 'src', 'data', 'styles.js'), 'utf8')
const wqBlock = stylesSrc.slice(stylesSrc.indexOf('const WUQINXI_MOVES = ['),
  stylesSrc.indexOf(']\n\nconst WUQINXI'))
const IDS = [...wqBlock.matchAll(/id:\s*(\d+)/g)].map((m) => Number(m[1]))
const NAMES = [...wqBlock.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
const N = NAMES.length
if (N !== 5) { console.error(`从 styles.js 解析到 ${N} 式（期望 5）`); process.exit(1) }

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

// ---------------------------------------------------------------- 正向运动学
// 照抄 DemoAnimation.vue draw() 的几何（u=1 归一化），与 verify-demo-standard.mjs 一致。
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
  put(11, armL.sh);    put(12, armR.sh)
  put(13, armL.el);    put(14, armR.el)
  put(15, armL.hand);  put(16, armR.hand)
  put(23, legL.hip);   put(24, legR.hip)
  put(25, legL.knee);  put(26, legR.knee)
  put(27, legL.foot);  put(28, legR.foot)
  return lm
}

// ---------------------------------------------------------------- 逐式打分
const FPS = 30
function measure(keys, dur, moveIdx) {
  const frames = Math.max(12, Math.round(dur * FPS))
  const judge = new MoveJudge({ style: 'wuqinxi', count: N, names: NAMES })
  const self = [], cross = new Array(N).fill(0)
  for (let f = 0; f < frames; f++) {
    const tt = (f / frames) * dur
    const lm = poseToLandmarks(samplePose(keys, tt))
    const sc = judge.scores(lm)
    for (let i = 0; i < N; i++) cross[i] = Math.max(cross[i], sc[i] || 0)
    self.push(sc[moveIdx] || 0)
  }
  return {
    max: Math.max(...self),
    avg: self.reduce((a, b) => a + b, 0) / self.length,
    pass: self.filter((s) => s >= THRESHOLD).length / self.length,
    cross,
  }
}

// ---------------------------------------------------------------- 报告
const bar = (v) => '█'.repeat(Math.round(v * 20)).padEnd(20, '·')
const rows = []
for (let m = 0; m < N; m++) {
  const anim = DEMO_ANIMS[`wuqinxi-${m + 1}`]
  rows.push({ m, name: NAMES[m], id: IDS[m], anim, r: anim ? measure(anim.keys, anim.dur, m) : null })
}

console.log(`\n五禽戏示范动作标准度（${NAMES.length} 式）   合格线 ${THRESHOLD}`)
console.log('\n式  名称      最高分  均值   达标帧占比')
console.log('─'.repeat(60))
for (const x of rows) {
  if (!x.r) { console.log(`${x.m + 1}  ${x.name}  无动画数据`); continue }
  console.log(
    `${x.m + 1}   ${x.name.padEnd(4, '　')}   ` +
    `${x.r.max.toFixed(2)}   ${x.r.avg.toFixed(2)}   ` +
    `${(x.r.pass * 100).toFixed(0)}%`.padEnd(6) + '   ' + bar(x.r.max))
}
console.log('─'.repeat(60))

console.log('\n串扰检查（演示某式时其它式的最高分，>0.8 视为长得像）')
let cross = 0
for (const x of rows) {
  if (!x.r) continue
  const others = x.r.cross.map((v, i) => ({ v, i })).filter((o) => o.i !== x.m && o.v > 0.8)
  if (others.length) {
    cross++
    console.log(`  ${x.name} → 被判成 ` + others.map((o) => `${NAMES[o.i]}(${o.v.toFixed(2)})`).join('、'))
  }
}
if (!cross) console.log('  无（没有一式被误认成别的式）')

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }
console.log('\n=== 验收闸门 ===')
for (const x of rows) {
  okc(x.r && x.r.max >= THRESHOLD,
    `${x.name}：示范动作能被自家判定器判中（最高分 ${x.r ? x.r.max.toFixed(2) : '—'}）`)
}
okc(cross === 0, `无跨式串扰（${cross} 处）`)

// ---------------------------------------------------------------- 对照图（SVG）
// 版式：5 行（每式一行）× 4 列（一路取 4 个相位）。左侧标签注明式名与判定分。
const COL = 4
const CELL = 132, GAP = 10, LBL = 118, PAD = 20, HEAD = 58, ROWGAP = 8
const SVG_W = PAD * 2 + LBL + COL * CELL + (COL - 1) * GAP
const SVG_H = HEAD + N * (CELL + ROWGAP) + PAD - ROWGAP + 14
const PHASES = [0.15, 0.40, 0.65, 0.90]

const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]]

function figure(lm, ox, oy, size) {
  const s = size * 0.84
  const X = (pt) => (ox + (size - s) / 2 + pt.x * s).toFixed(1)
  const Y = (pt) => (oy + (size - s) / 2 + pt.y * s).toFixed(1)
  let g = ''
  for (const [a, b] of BONES) {
    g += `<line x1="${X(lm[a])}" y1="${Y(lm[a])}" x2="${X(lm[b])}" y2="${Y(lm[b])}" ` +
         `stroke="#6E8F7C" stroke-width="2.4" stroke-linecap="round"/>`
  }
  g += `<circle cx="${X(lm[0])}" cy="${Y(lm[0])}" r="4" fill="#B0552E"/>`
  return g
}

const rowOf = (x, oy) => {
  if (!x.anim) return ''
  let out = `<text x="${PAD + 6}" y="${oy + 26}" font-size="15" font-weight="700" fill="#2b2b2b">${x.m + 1}. ${x.name}</text>`
  out += `<text x="${PAD + 6}" y="${oy + 48}" font-size="11.5" fill="#8a7a63">最高分 ${x.r.max.toFixed(2)}</text>`
  out += `<text x="${PAD + 6}" y="${oy + 65}" font-size="11.5" fill="#8a7a63">均值 ${x.r.avg.toFixed(2)} · 达标 ${(x.r.pass * 100).toFixed(0)}%</text>`
  for (let j = 0; j < COL; j++) {
    const ox = PAD + LBL + j * (CELL + GAP)
    const lm = poseToLandmarks(samplePose(x.anim.keys, PHASES[j] * x.anim.dur))
    out += `<rect x="${ox}" y="${oy}" width="${CELL}" height="${CELL}" rx="10" fill="#FDF9EF" stroke="#E4D8C2"/>`
    out += figure(lm, ox, oy, CELL)
  }
  return out
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<rect width="${SVG_W}" height="${SVG_H}" fill="#FBF3E3"/>
<text x="${PAD}" y="30" font-size="18" font-weight="700" fill="#2b2b2b">五禽戏 · 五式示范动作对照图</text>
<text x="${PAD}" y="50" font-size="12" fill="#8a7a63">每行一式，四列 = 该式 4 个相位；骨架由 demoAnim 关键帧经 DemoAnimation 同一套几何还原。判定器合格线 0.55。</text>
${rows.map((x, i) => rowOf(x, HEAD + i * (CELL + ROWGAP))).join('\n')}
</svg>`

const outDir = resolve(ROOT, 'outputs', 'wuqinxi-check')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, '五禽戏-对照图.svg'), svg, 'utf8')
writeFileSync(resolve(outDir, 'verify-wuqinxi-standard.json'),
  JSON.stringify({
    style: 'wuqinxi', threshold: THRESHOLD,
    rows: rows.map((x) => ({
      move: x.m + 1, name: x.name,
      max: x.r ? +x.r.max.toFixed(3) : null,
      avg: x.r ? +x.r.avg.toFixed(3) : null,
      pass: x.r ? x.r.pass : null,
      cross: x.r ? x.r.cross.map((v) => +v.toFixed(3)) : null,
    })),
  }, null, 2), 'utf8')
console.log(`\n对照图：outputs/wuqinxi-check/五禽戏-对照图.svg`)
console.log('明细：outputs/wuqinxi-check/verify-wuqinxi-standard.json')
console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
