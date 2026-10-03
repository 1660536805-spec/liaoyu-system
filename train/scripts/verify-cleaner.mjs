// 用真机实测数据验证净化器的效果
// 数据：stability-raw (3).json（8797 帧，2.2m 退后取景）
// 运行：STABILITY_FILE=... node scripts/verify-cleaner.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createLandmarkCleaner } from '../src/engine/cleaner.js'
import { MoveJudge, NAMES } from '../src/engine/judge.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = process.env.STABILITY_FILE || 'C:/Users/Cccong/Downloads/stability-raw (3).json'
const raw = JSON.parse(readFileSync(SRC, 'utf8'))
const F = raw.frames
const MP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
const NAME = ['鼻', '左肩', '右肩', '左肘', '右肘', '左腕', '右腕', '左髋', '右髋', '左膝', '右膝', '左踝', '右踝']

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

// 把采集格式还原成 MediaPipe landmarks
const build = (f) => {
  const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
  MP.forEach((mp, pos) => { lm[mp] = { x: f.k[pos][0], y: f.k[pos][1], z: 0, visibility: f.k[pos][2] } })
  return lm
}
const T = F.map((f) => Math.hypot(f.k[1][0] - f.k[2][0], f.k[1][1] - f.k[2][1]) || 0.16)

function jitter(frames) {
  // frames: [{x,y,vis}]，只统计 vis 仍 ≥0.3 的点（即真正参与判定的点）
  let s = 0, n = 0, mx = 0
  for (let f = 1; f < frames.length; f++) {
    const a = frames[f], b = frames[f - 1]
    if (a.vis < 0.3 || b.vis < 0.3) continue      // 不可信点不参与统计
    const t = T[f] || 0.16
    const d = Math.hypot(a.x - b.x, a.y - b.y) / t
    s += d; n++
    if (d > mx) mx = d
  }
  return { avg: s / Math.max(1, n), max: mx, n }
}

console.log('\n=== 0. 数据概况 ===')
console.log(`   ${F.length} 帧 / ${(F[F.length - 1].t).toFixed(0)} 秒，肩宽均值 ${(T.reduce((a, b) => a + b) / T.length).toFixed(3)}`)

console.log('\n=== 1. 净化前：各点抖动 ===')
const before = []
for (let i = 0; i < 13; i++) {
  const s = F.map((f) => ({ x: f.k[i][0], y: f.k[i][1], vis: f.k[i][2] }))
  const j = jitter(s)
  before.push(j)
  console.log(`   ${NAME[i].padEnd(5)} avg ${j.avg.toFixed(4)}  max ${j.max.toFixed(2)}`)
}

console.log('\n=== 2. 净化后：各点抖动（只统计仍可信的点）===')
const cleaner = createLandmarkCleaner()
const series = MP.map(() => [])
let nullFrames = 0
for (let f = 0; f < F.length; f++) {
  const out = cleaner.clean(build(F[f]))
  if (!out) { nullFrames++; continue }
  MP.forEach((mp, pos) => { series[pos].push({ x: out[mp].x, y: out[mp].y, vis: out[mp].visibility }) })
}
const after = []
for (let i = 0; i < 13; i++) {
  const j = jitter(series[i])
  after.push(j)
  const d = before[i].avg > 0 ? (1 - j.avg / before[i].avg) * 100 : 0
  console.log(`   ${NAME[i].padEnd(5)} avg ${j.avg.toFixed(4)}  max ${j.max.toFixed(2)}   ${d >= 0 ? '↓' + d.toFixed(0) + '%' : '↑' + (-d).toFixed(0) + '%'}`)
}

console.log('\n=== 3. 净化器统计 ===')
const st = cleaner.stats
console.log(`   处理 ${st.frames} 帧，剔除 ${st.rejected} 个点（${(st.rate * 100).toFixed(2)}% of ${13 * st.frames}）`)
console.log(`   整帧不可用（返回 null）: ${nullFrames} 帧 (${(nullFrames / F.length * 100).toFixed(1)}%)`)

console.log('\n=== 4. 关键指标是否改善 ===')
// 关注四个「参与判定的核心点」：肩/肘/腕
const CORE = [1, 2, 3, 4, 5, 6]
const bCore = CORE.reduce((s, i) => s + before[i].avg, 0) / CORE.length
const aCore = CORE.reduce((s, i) => s + after[i].avg, 0) / CORE.length
console.log(`   核心点（肩肘腕 6 个）平均抖动: ${bCore.toFixed(4)} → ${aCore.toFixed(4)}  (${((1 - aCore / bCore) * 100).toFixed(1)}% ↓)`)
okc(aCore < bCore, `核心点抖动下降（${bCore.toFixed(4)} → ${aCore.toFixed(4)}）`)
okc(aCore < 0.06, `核心点抖动降到 0.06 以下（实得 ${aCore.toFixed(4)}）`)
okc(st.rate > 0, `净化器确实生效（剔除率 ${(st.rate * 100).toFixed(2)}%）`)
okc(nullFrames / F.length < 0.2, `整帧不可用比例可控（${(nullFrames / F.length * 100).toFixed(1)}% < 20%）`)

console.log('\n=== 5. 净化后判定器行为（抗噪）===')
{
  const cleaner2 = createLandmarkCleaner()
  const j = new MoveJudge({ holdFrames: 10, order: null })
  const hits = []
  for (let f = 0; f < F.length; f++) {
    const out = cleaner2.clean(build(F[f]))
    if (!out) continue
    for (const h of j.update(out)) hits.push({ t: +F[f].t.toFixed(1), n: h.name, s: +h.score.toFixed(2) })
  }
  console.log(`   110 秒内命中 ${hits.length} 次：`)
  hits.slice(0, 10).forEach((h) => console.log(`      @${h.t}s ${h.n} ${h.s}`))
  // 净化会剔除低置信点 → 可用信息变少 → 命中应不增
  okc(hits.length <= 6, `净化后误触发未增加（${hits.length} 次）`)
}

console.log('\n=== 6. 回归：原有测试是否仍通过 ===')
{
  // 静立 300 帧不应触发（净化后仍应如此）
  const c3 = createLandmarkCleaner()
  const j3 = new MoveJudge({ holdFrames: 8, order: null })
  let n = 0
  for (let f = 0; f < 300; f++) {
    const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
    lm[11] = { x: 0.42, y: 0.35, z: 0, visibility: 1 }
    lm[12] = { x: 0.58, y: 0.35, z: 0, visibility: 1 }
    lm[15] = { x: 0.40 + Math.sin(f) * 0.01, y: 0.60, z: 0, visibility: 1 }
    lm[16] = { x: 0.60 + Math.cos(f) * 0.01, y: 0.60, z: 0, visibility: 1 }
    lm[23] = { x: 0.45, y: 0.55, z: 0, visibility: 1 }
    lm[24] = { x: 0.55, y: 0.55, z: 0, visibility: 1 }
    const out = c3.clean(lm)
    if (out) n += j3.update(out).length
  }
  okc(n === 0, `静立 300 帧零误触发（实得 ${n}）`)
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
