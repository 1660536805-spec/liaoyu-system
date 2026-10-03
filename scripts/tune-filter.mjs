// 滤波参数寻优 —— 用真实采集数据（6039 帧）离线比较
// 目标：把腕/肘抖动压下来，同时不能把真实动作也滤掉（会延迟判定）
// 运行：node scripts/tune-filter.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = process.env.STABILITY_FILE || 'C:/Users/Cccong/Downloads/stability-raw.json'
const raw = JSON.parse(readFileSync(SRC, 'utf8'))
const F = raw.frames
const NAME = ['鼻', '左肩', '右肩', '左肘', '右肘', '左腕', '右腕', '左髋', '右髋', '左膝', '右膝', '左踝', '右踝']

// 逐帧肩宽（归一化基准）
const T = F.map((f) => Math.hypot(f.k[1][0] - f.k[2][0], f.k[1][1] - f.k[2][1]) || 0.16)

function jitter(series) {
  // series: [{x,y,vis}]，返回 {avg, max, jumpRate}
  let s = 0, n = 0, mx = 0, big = 0
  for (let f = 1; f < series.length; f++) {
    const t = T[f] || 0.16
    const d = Math.hypot(series[f].x - series[f - 1].x, series[f].y - series[f - 1].y) / t
    s += d; n++
    if (d > mx) mx = d
    if (d > 0.12) big++
  }
  return { avg: s / n, max: mx, jump: (big / n) * 100 }
}

// 滤波 1：置信度加权中值滤波（3 点，按 vis 加权投票）
function medianFilterVis(src, win = 3) {
  const out = []
  const hist = []
  for (let f = 0; f < src.length; f++) {
    hist.push({ ...src[f] })
    if (hist.length > win) hist.shift()
    const p = src[f]
    if (p.vis < 0.2) {          // 不可信点：不参与，直接沿用上一个可信值
      const last = out[out.length - 1]
      out.push(last ? { ...last } : { ...p })
      continue
    }
    // 按 vis 加权：对高置信点给更高权重，用「重复计数」近似加权中值
    const pts = []
    for (const q of hist) {
      if (q.vis < 0.2) continue
      const w = Math.max(1, Math.round(q.vis * 3))
      for (let i = 0; i < w; i++) pts.push(q)
    }
    if (!pts.length) { out.push({ ...p }); continue }
    const xs = pts.map((q) => q.x).sort((a, b) => a - b)
    const ys = pts.map((q) => q.y).sort((a, b) => a - b)
    const mid = xs.length >> 1
    out.push({ x: xs[mid], y: ys[mid], vis: p.vis })
  }
  return out
}

// 滤波 2：再叠一层指数平滑（只对高置信点，α 越大越平滑但越滞后）
function emaFilter(src, alpha = 0.5) {
  const out = []
  let prev = null
  for (let f = 0; f < src.length; f++) {
    const p = src[f]
    if (p.vis < 0.2) { out.push(prev ? { ...prev, vis: p.vis } : { ...p }); continue }
    if (!prev) { out.push({ ...p }); prev = p; continue }
    const nx = prev.x + (p.x - prev.x) * alpha
    const ny = prev.y + (p.y - prev.y) * alpha
    prev = { x: nx, y: ny, vis: p.vis }
    out.push({ ...prev })
  }
  return out
}

// 判定「真实动作」：连续多帧同向移动 → 是真动作，不是抖动
function motionEnergy(src) {
  // 取位移最大的一段前后，算平均速度（肩宽/秒）
  const v = []
  for (let f = 1; f < src.length; f++) {
    const t = T[f] || 0.16
    v.push(Math.hypot(src[f].x - src[f - 1].x, src[f].y - src[f - 1].y) / t)
  }
  v.sort((a, b) => a - b)
  return { p50: v[v.length >> 1], p95: v[Math.floor(v.length * 0.95)], p99: v[Math.floor(v.length * 0.99)] }
}

console.log('\n=== 滤波前（原始）===')
console.log('   点位     平均抖动   最大     跳变率')
const rawStat = []
for (let i = 0; i < 13; i++) {
  const s = F.map((f) => ({ x: f.k[i][0], y: f.k[i][1], vis: f.k[i][2] }))
  const j = jitter(s)
  rawStat.push(j)
  console.log('   ' + NAME[i].padEnd(6) + j.avg.toFixed(4).padStart(8) + j.max.toFixed(3).padStart(9) + (j.jump.toFixed(2) + '%').padStart(10))
}

console.log('\n=== 候选参数对比（关注可靠点：肘/腕 idx 3,4,5,6）===')
const RELIABLE = [3, 4, 5, 6]
const cands = [
  { name: '仅中值3', med: 3, ema: 1 },
  { name: '中值3+EMA0.7', med: 3, ema: 0.7 },
  { name: '中值5+EMA0.6', med: 5, ema: 0.6 },
  { name: '中值5+EMA0.5', med: 5, ema: 0.5 },
  { name: '中值7+EMA0.5', med: 7, ema: 0.5 },
  { name: '中值5+EMA0.4', med: 5, ema: 0.4 },
]
console.log('   ' + '参数'.padEnd(16) + '平均抖动  ' + '降幅    ' + '最大    ' + '跳变率  ' + '真实动作p95(保留)')
for (const c of cands) {
  let a = 0, n = 0, mx = 0, big = 0
  const p95s = []
  for (const i of RELIABLE) {
    const s = F.map((f) => ({ x: f.k[i][0], y: f.k[i][1], vis: f.k[i][2] }))
    const out = c.ema === 1 ? medianFilterVis(s, c.med) : emaFilter(medianFilterVis(s, c.med), c.ema)
    const j = jitter(out)
    a += j.avg; n++; mx = Math.max(mx, j.max); big += j.jump
    p95s.push(motionEnergy(out).p95)
  }
  const avgA = a / n, avgB = rawStat.filter((_, i) => RELIABLE.includes(i)).reduce((s, x) => s + x.avg, 0) / 4
  const keep = (p95s.reduce((a, b) => a + b, 0) / p95s.length)
  const keepRaw = RELIABLE.reduce((s, i) => s + motionEnergy(F.map((f) => ({ x: f.k[i][0], y: f.k[i][1], vis: f.k[i][2] }))).p95, 0) / 4
  console.log('   ' + c.name.padEnd(16) + avgA.toFixed(4).padStart(8) +
    '  ' + ((1 - avgA / avgB) * 100).toFixed(0).padStart(3) + '%' +
    mx.toFixed(3).padStart(9) + (big / n).toFixed(2).padStart(8) + '%' +
    '  ' + keep.toFixed(4) + ' (' + ((keep / keepRaw) * 100).toFixed(0) + '% 保留)')
}

console.log('\n=== 不可靠点（膝踝）滤波后是否还被使用 ===')
{
  const i = 11 // 左踝
  const s = F.map((f) => ({ x: f.k[i][0], y: f.k[i][1], vis: f.k[i][2] }))
  const out = medianFilterVis(s, 5)
  const j = jitter(out)
  console.log('   左踝 滤波前 avg=' + rawStat[i].avg.toFixed(4) + ' max=' + rawStat[i].max.toFixed(3))
  console.log('   左踝 滤波后 avg=' + j.avg.toFixed(4) + ' max=' + j.max.toFixed(3) + '  → 仍应被 hasLegs() 排除')
}
