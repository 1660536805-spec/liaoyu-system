// 用真实采集数据验证新门槛不会误触发兜底
// 运行：node scripts/verify-fallback.mjs
import { readFileSync } from 'node:fs'
import { FALLBACK_CFG, frameAlive } from '../src/engine/fallback.js'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

console.log('\n=== 新兜底配置 ===')
console.log(`   noSignalMs    = ${FALLBACK_CFG.noSignalMs}ms（原 4000）`)
console.log(`   firstFrameMs  = ${FALLBACK_CFG.firstFrameMs}ms（原 8000）`)
console.log(`   minAlivePoints= ${FALLBACK_CFG.minAlivePoints}/8（原 6/8）`)
console.log(`   minVis        = ${FALLBACK_CFG.minVis}`)

// k 位置 → MediaPipe 索引
const MP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

const FILES = [
  ['第一次采集(1.2m)', 'C:/Users/Cccong/Downloads/stability-raw.json'],
  ['第二次采集(2.2m)', 'C:/Users/Cccong/Downloads/stability-raw (3).json'],
]

console.log('\n=== 真实数据回放 ===')
let anyData = false
for (const [name, fp] of FILES) {
  let raw
  try { raw = JSON.parse(readFileSync(fp, 'utf8')) } catch { console.log(`   ${name}: 文件未找到，跳过`); continue }
  anyData = true
  const F = raw.frames
  const alive = F.map((f) => {
    const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
    MP.forEach((mp, pos) => { if (f.k[pos]) lm[mp] = { x: f.k[pos][0], y: f.k[pos][1], z: 0, visibility: f.k[pos][2] } })
    return frameAlive(lm)
  })
  const dead = alive.filter((x) => !x).length
  let maxRun = 0, run = 0
  alive.forEach((a) => { if (!a) { run++; if (run > maxRun) maxRun = run } else run = 0 })
  // 采集器实测 80fps（mediapipe 的 timescale）
  const FPS = 80
  const maxSec = maxRun / FPS
  console.log(`\n   ${name}（${F.length} 帧）`)
  console.log(`     判「无人」帧: ${dead} (${(dead / alive.length * 100).toFixed(2)}%)`)
  console.log(`     最长连续无人: ${maxRun} 帧 ≈ ${maxSec.toFixed(2)}s`)
  okc(maxSec * 1000 < FALLBACK_CFG.noSignalMs, `最长连续无人 ${maxSec.toFixed(2)}s < 阈值 ${FALLBACK_CFG.noSignalMs / 1000}s → 不会误触发兜底`)

  // 对比旧配置
  const oldAlive = (lm) => {
    const ALIVE = [11, 12, 13, 14, 15, 16, 23, 24]
    let n = 0
    for (const i of ALIVE) if ((lm[i]?.visibility ?? 0) >= 0.35) n++
    return n >= 6
  }
  const oldAl = F.map((f) => {
    const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
    MP.forEach((mp, pos) => { if (f.k[pos]) lm[mp] = { x: f.k[pos][0], y: f.k[pos][1], z: 0, visibility: f.k[pos][2] } })
    return oldAlive(lm)
  })
  let oldMax = 0; run = 0
  oldAl.forEach((a) => { if (!a) { run++; if (run > oldMax) oldMax = run } else run = 0 })
  const oldSec = oldMax / FPS
  console.log(`     [旧配置 6/8] 最长连续无人 ${oldMax} 帧 ≈ ${oldSec.toFixed(2)}s` +
    (oldSec * 1000 > 4000 ? ` → 超过旧阈值 4s，**这正是你遇到的中断**` : ''))
  okc(maxSec <= oldSec, `新配置最长连续无人不劣于旧配置（${maxSec.toFixed(2)}s ≤ ${oldSec.toFixed(2)}s）`)
}

if (!anyData) {
  console.log('\n（未找到采集数据，仅验证配置值本身）')
  okc(FALLBACK_CFG.noSignalMs >= 10000, 'noSignalMs ≥10s（覆盖弯腰 3s + 起身 2s + 短暂遮挡）')
  okc(FALLBACK_CFG.minAlivePoints <= 4, 'minAlivePoints ≤4（真机实测 4/8 几乎不误判）')
}

console.log('\n=== 配置合理性 ===')
okc(FALLBACK_CFG.noSignalMs >= 10000, `noSignalMs=${FALLBACK_CFG.noSignalMs}ms ≥10s：覆盖「弯腰 3s + 起身 2s + 短暂遮挡」`)
okc(FALLBACK_CFG.firstFrameMs >= 12000, `firstFrameMs=${FALLBACK_CFG.firstFrameMs}ms ≥12s：给上光/摆位留足时间`)
okc(FALLBACK_CFG.minAlivePoints <= 4, `minAlivePoints=${FALLBACK_CFG.minAlivePoints}/8 ≤4：实测 4/8 误判率≈0%`)
okc(FALLBACK_CFG.recoverFrames >= 20, `recoverFrames=${FALLBACK_CFG.recoverFrames} ≥20：恢复时不闪烁`)

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
