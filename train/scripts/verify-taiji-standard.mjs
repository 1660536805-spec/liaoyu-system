// 太极二十四式「示范动作 × 判定规则」回放验收 + 对照图
// ============================================================================
// 【为什么存在】
//   第二批内容工程（阶段 E2）为太极补了 24 式示范动画（src/data/demoAnim.js 的
//   taiji-1..24）与 24 式判定规则（src/engine/styleRules.js 的 TAIJI_RULES）。
//   两者必须自洽：把示范动画逐帧还原成 MediaPipe 33 点、喂给该拳种的判定器，
//   应当能「自己判中自己」。
//
// 【与 verify-wuqinxi-standard.mjs 的关系】
//   同一套几何（poseToLandmarks 照抄 DemoAnimation.vue 的绘制几何），只是拳种换成
//   taiji、式数换成 24。几何两处保持一致，任一处改绘制几何都要同步。
//
// 【「串扰」怎么看】
//   太极二十四式里**本来就存在重复式**：单鞭（9、11）与起势/收势（1、24）在正面
//   构型上就是同一式，分数必然互相命中 —— 这不是规则串扰。而每段示范动画的首尾
//   都经过「中立站姿」（= 起势/收势的姿势），所以**全帧口径**的串扰会把 1/24 刷满。
//   故这里给两个口径：
//     · raw  ：整段动画（含首尾中立帧）—— 只作参考
//     · core ：只取「停留段」t/dur ∈ [0.45,0.75]（该式定式）—— 判「是否真的像别的式」
//   产品默认走「顺序模式」（judge 的 order = 当前式，见 TrainView.resetStep），
//   只判当前式，重复式与串扰都不影响跟练；core 串扰只用来发现「规则太松」。
//
// 【跑法】node scripts/verify-taiji-standard.mjs
//   写出对照图 outputs/taiji-check/太极-对照图.svg
// ============================================================================

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEMO_ANIMS, POSE_KEYS } from '../src/data/demoAnim.js'
import { MoveJudge, THRESHOLD } from '../src/engine/judge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

// styles.js 直接 import 了 moves.json（Vite 能处理、纯 Node ESM 不能），
// 故这里从源文件里取「太极二十四式的 id/name」——单一真值仍在 styles.js。
const stylesSrc = readFileSync(resolve(__dirname, '..', 'src', 'data', 'styles.js'), 'utf8')
const block = stylesSrc.slice(stylesSrc.indexOf('const TAIJI_MOVES = ['),
  stylesSrc.indexOf(']\n\nconst TAIJI ='))
const IDS = [...block.matchAll(/id:\s*(\d+)/g)].map((m) => Number(m[1]))
const NAMES = [...block.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
const N = NAMES.length
if (N !== 24) { console.error(`从 styles.js 解析到 ${N} 式（期望 24）`); process.exit(1) }

// ---------------------------------------------------------------- 姿态插值
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
// 照抄 DemoAnimation.vue draw() 的几何（u=1 归一化），与 verify-wuqinxi-standard.mjs 一致。
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
const CORE = [0.45, 0.75]   // 「停留段」占比（见文件头说明）
function measure(keys, dur, moveIdx) {
  const frames = Math.max(12, Math.round(dur * FPS))
  const judge = new MoveJudge({ style: 'taiji', count: N, names: NAMES })
  const self = [], crossAll = new Array(N).fill(0), crossCore = new Array(N).fill(0)
  for (let f = 0; f < frames; f++) {
    const ratio = f / frames
    const tt = ratio * dur
    const lm = poseToLandmarks(samplePose(keys, tt))
    const sc = judge.scores(lm)
    const inCore = ratio >= CORE[0] && ratio <= CORE[1]
    for (let i = 0; i < N; i++) {
      crossAll[i] = Math.max(crossAll[i], sc[i] || 0)
      if (inCore) crossCore[i] = Math.max(crossCore[i], sc[i] || 0)
    }
    self.push(sc[moveIdx] || 0)
  }
  return {
    max: Math.max(...self),
    avg: self.reduce((a, b) => a + b, 0) / self.length,
    pass: self.filter((s) => s >= THRESHOLD).length / self.length,
    crossAll, crossCore,
  }
}

// ---------------------------------------------------------------- 报告
const bar = (v) => '█'.repeat(Math.round(v * 20)).padEnd(20, '·')
const rows = []
for (let m = 0; m < N; m++) {
  const anim = DEMO_ANIMS[`taiji-${m + 1}`]
  rows.push({ m, name: NAMES[m], id: IDS[m], anim, r: anim ? measure(anim.keys, anim.dur, m) : null })
}

console.log(`\n太极示范动作标准度（${N} 式）   合格线 ${THRESHOLD}`)
console.log('\n式  名称          最高分  均值   达标帧占比')
console.log('─'.repeat(64))
for (const x of rows) {
  if (!x.r) { console.log(`${x.m + 1}  ${x.name}  无动画数据`); continue }
  console.log(
    `${String(x.m + 1).padStart(2)}  ${x.name.padEnd(6, '　')}   ` +
    `${x.r.max.toFixed(2)}   ${x.r.avg.toFixed(2)}   ` +
    `${(x.r.pass * 100).toFixed(0)}%`.padEnd(6) + '   ' + bar(x.r.max))
}
console.log('─'.repeat(64))

// 重复式（套路本身同式）—— 报告里区分出来，避免误当串扰
const REPEATS = [[1, 24, '起势/收势'], [9, 11, '单鞭×2']]
const isRepeat = (a, b) => REPEATS.some(([i, j]) => (a === i - 1 && b === j - 1) || (a === j - 1 && b === i - 1))

console.log('\n串扰检查 · core 口径（定式停留段；>0.80 视为「构型太像」）')
let cross = 0, repeats = 0
for (const x of rows) {
  if (!x.r) continue
  const others = x.r.crossCore.map((v, i) => ({ v, i })).filter((o) => o.i !== x.m && o.v > 0.8)
  if (!others.length) continue
  const rep = others.filter((o) => isRepeat(x.m, o.i))
  const real = others.filter((o) => !isRepeat(x.m, o.i))
  if (rep.length) repeats++
  if (real.length) {
    cross++
    console.log(`  ${x.name} → ` + real.map((o) => `${NAMES[o.i]}(${o.v.toFixed(2)})`).join('、'))
  }
}
if (!cross) console.log('  无非重复式串扰')
if (repeats) console.log(`  （另有 ${repeats} 处命中「重复式」：${REPEATS.map(([a, b, n]) => n).join('、')} —— 套路本身同式，不计串扰）`)

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }
console.log('\n=== 验收闸门 ===')
for (const x of rows) {
  okc(x.r && x.r.max >= THRESHOLD,
    `${x.name}：示范动作能被自家判定器判中（最高分 ${x.r ? x.r.max.toFixed(2) : '—'}）`)
}
okc(cross === 0, `无非重复式串扰（${cross} 处）`)

// ---------------------------------------------------------------- 对照图（SVG）
// 版式：2 个面板并排，每板 12 行 × 4 相位；左侧标签注明式名与判定分。
const PH = [0.18, 0.42, 0.62, 0.82]
const PER_PANEL = 12, PANELS = Math.ceil(N / PER_PANEL)
const CELL = 104, GAP = 8, LBL = 138, PAD = 18, HEAD = 56, ROWGAP = 8, PANELGAP = 34
const PW = LBL + PH.length * CELL + (PH.length - 1) * GAP
const SVG_W = PAD * 2 + PANELS * PW + (PANELS - 1) * PANELGAP
const SVG_H = HEAD + PER_PANEL * (CELL + ROWGAP) + PAD

const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]]

function figure(lm, ox, oy, size) {
  const s = size * 0.86
  const X = (pt) => (ox + (size - s) / 2 + pt.x * s).toFixed(1)
  const Y = (pt) => (oy + (size - s) / 2 + pt.y * s).toFixed(1)
  let g = ''
  for (const [a, b] of BONES) {
    g += `<line x1="${X(lm[a])}" y1="${Y(lm[a])}" x2="${X(lm[b])}" y2="${Y(lm[b])}" ` +
         `stroke="#6E8F7C" stroke-width="2.2" stroke-linecap="round"/>`
  }
  g += `<circle cx="${X(lm[0])}" cy="${Y(lm[0])}" r="3.4" fill="#B0552E"/>`
  return g
}

const rowOf = (x, px, py) => {
  if (!x.anim) return ''
  let out = `<text x="${px + 4}" y="${py + 24}" font-size="13.5" font-weight="700" fill="#2b2b2b">${x.m + 1}. ${x.name}</text>`
  out += `<text x="${px + 4}" y="${py + 43}" font-size="10.5" fill="#8a7a63">最高 ${x.r.max.toFixed(2)} · 均 ${x.r.avg.toFixed(2)}</text>`
  for (let j = 0; j < PH.length; j++) {
    const ox = px + LBL + j * (CELL + GAP)
    const lm = poseToLandmarks(samplePose(x.anim.keys, PH[j] * x.anim.dur))
    out += `<rect x="${ox}" y="${py}" width="${CELL}" height="${CELL}" rx="9" fill="#FDF9EF" stroke="#E4D8C2"/>`
    out += figure(lm, ox, py, CELL)
  }
  return out
}

let body = ''
for (const x of rows) {
  const panel = Math.floor(x.m / PER_PANEL)
  const rowIn = x.m % PER_PANEL
  const px = PAD + panel * (PW + PANELGAP)
  const py = HEAD + rowIn * (CELL + ROWGAP)
  body += rowOf(x, px, py) + '\n'
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<rect width="${SVG_W}" height="${SVG_H}" fill="#FBF3E3"/>
<text x="${PAD}" y="26" font-size="17" font-weight="700" fill="#2b2b2b">太极 · 二十四式示范动作对照图</text>
<text x="${PAD}" y="45" font-size="11" fill="#8a7a63">每行一式，四列 = 该式 4 个相位；骨架由 demoAnim 关键帧经 DemoAnimation 同一套几何还原。判定器合格线 0.55。</text>
${body}</svg>`

const outDir = resolve(ROOT, 'outputs', 'taiji-check')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, '太极-对照图.svg'), svg, 'utf8')
writeFileSync(resolve(outDir, 'verify-taiji-standard.json'),
  JSON.stringify({
    style: 'taiji', threshold: THRESHOLD,
    rows: rows.map((x) => ({
      move: x.m + 1, name: x.name,
      max: x.r ? +x.r.max.toFixed(3) : null,
      avg: x.r ? +x.r.avg.toFixed(3) : null,
      pass: x.r ? x.r.pass : null,
      crossCore: x.r ? x.r.crossCore.map((v) => +v.toFixed(3)) : null,
    })),
  }, null, 2), 'utf8')
console.log(`\n对照图：outputs/taiji-check/太极-对照图.svg`)
console.log('明细：outputs/taiji-check/verify-taiji-standard.json')
console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
