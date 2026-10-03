// 用真实 3D 数据验证姿态判定（headPose / bodyPose / 转身跟踪）
// 运行：node scripts/verify-pose.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { headPose, bodyPose, createTurnTracker } from '../src/engine/pose.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'evidence', 'world-real.json')
if (!readFileSync && !exists(SRC)) { console.error('缺少 evidence/world-real.json，请先跑 capture-world'); process.exit(2) }
function exists(p) { try { readFileSync(p); return true } catch { return false } }

const D = JSON.parse(readFileSync(SRC, 'utf8'))
const S = D.samples
// 采集时的 KEY 顺序：[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,23,24,25,26,27,28]
// worldLandmarks 是完整 33 点，需还原索引
const FULL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

const toFull = (arr) => {
  const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
  FULL.forEach((mp, pos) => {
    const p = arr[pos]
    lm[mp] = p ? { x: p[0], y: p[1], z: p[2], visibility: p[3] ?? 1 } : { x: 0.5, y: 0.5, z: 0, visibility: 0 }
  })
  return lm
}

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

console.log(`\n=== 数据：${S.length} 帧真实 3D 坐标 ===\n`)

console.log('=== 1. headPose 逐帧输出（抽样）===')
const tracker = createTurnTracker()
const heads = []
const bodies = []
for (let f = 0; f < S.length; f++) {
  const sc = toFull(S[f].s)
  const wc = toFull(S[f].w.map((p) => [p[0], p[1], p[2]]))
  const h = headPose(sc, wc)
  const b = bodyPose(sc, wc)
  const t = tracker.update(b.available && b.yawDeg !== undefined ? b.yawDeg : null)
  heads.push(h); bodies.push(b)
  if (f % 40 === 0) {
    console.log(`   f${String(f).padStart(3)} t=${String(S[f].t).padStart(5)}s  头: yaw=${String(h.yawDeg).padStart(6)}° 耳距=${h.earSpan} 鼻耳z=${String(h.noseZRelEar).padStart(7)} → ${h.facing}`)
    console.log(`        体: yaw=${String(b.yawDeg).padStart(6)}° 肩距=${b.shoSpan} 鼻肩z=${String(b.noseZRelSho).padStart(7)} → ${b.facing}  转身:${t.phase}`)
  }
}

console.log('\n=== 2. 关键指标是否合理 ===')
const hs = heads.filter((x) => x.available)
const bs = bodies.filter((x) => x.available)
okc(hs.length / heads.length > 0.9, `headPose 可用率 ${(hs.length / heads.length * 100).toFixed(0)}%（3D 数据到位）`)
okc(bs.length / bodies.length > 0.9, `bodyPose 可用率 ${(bs.length / bodies.length * 100).toFixed(0)}%`)
okc(hs.every((h) => Math.abs(h.earSpan) > 0.05), '双耳 3D 距离均在合理范围（>0.05m）')
const yawAbs = hs.map((h) => Math.abs(h.yawDeg))
okc(Math.max(...yawAbs) <= 180.5, `yaw 在 ±180° 内（最大 ${Math.max(...yawAbs).toFixed(1)}°）`)

console.log('\n=== 3. facing 分类分布 ===')
const cnt = (arr, k) => arr.reduce((m, x) => (m[x.facing] = (m[x.facing] || 0) + 1, m), {})
console.log('   头部:', JSON.stringify(cnt(heads, 'facing')))
console.log('   身体:', JSON.stringify(cnt(bodies, 'facing')))

console.log('\n=== 4. 转身段识别（t=9.5~10.6s 那段实测确实在转身）===')
const turnWin = bodies.map((b, f) => ({ f, t: S[f].t, ...b })).filter((x) => x.t >= 9.5 && x.t <= 10.6)
const calmWin = bodies.map((b, f) => ({ f, t: S[f].t, ...b })).filter((x) => x.t < 9 || x.t > 11)
const avg = (a, k) => a.reduce((s, x) => s + x[k], 0) / Math.max(1, a.length)
console.log('   转身段 (n=' + turnWin.length + '): 肩距 ' + avg(turnWin, 'shoSpan').toFixed(4) + '  鼻肩z ' + avg(turnWin, 'noseZRelSho').toFixed(4))
console.log('   平稳段 (n=' + calmWin.length + '): 肩距 ' + avg(calmWin, 'shoSpan').toFixed(4) + '  鼻肩z ' + avg(calmWin, 'noseZRelSho').toFixed(4))
const turnSide = turnWin.filter((x) => x.facing === 'side').length
okc(turnSide / turnWin.length > 0.5, `转身段被识别为 side 的比例 ${(turnSide / turnWin.length * 100).toFixed(0)}%`)
// 头部判别应更准（实测 earYaw 差异/σ=2.97，noseEarZ 5.78）
const hTurn = heads.map((h, f2) => ({ t: S[f2].t, ...h })).filter((x) => x.t >= 9.5 && x.t <= 10.6)
const hCalm = heads.map((h, f2) => ({ t: S[f2].t, ...h })).filter((x) => x.t < 9 || x.t > 11)
const hSide = hTurn.filter((x) => x.facing === 'side').length
const hFront = hCalm.filter((x) => x.facing === 'front').length
okc(hSide / hTurn.length > 0.6, `头部在转身段识别为 side 的比例 ${(hSide / hTurn.length * 100).toFixed(0)}%（头部判别力应优于躯干）`)
okc(hFront / hCalm.length > 0.7, `头部在平稳段识别为 front 的比例 ${(hFront / hCalm.length * 100).toFixed(0)}%`)
const calmFront = calmWin.filter((x) => x.facing === 'front').length
okc(calmFront / calmWin.length > 0.5, `平稳段被识别为 front 的比例 ${(calmFront / calmWin.length * 100).toFixed(0)}%`)

console.log('\n=== 5. 转身过程跟踪 ===')
const phases = []
{
  const t2 = createTurnTracker()
  for (let f = 0; f < S.length; f++) {
    const wc = toFull(S[f].w.map((p) => [p[0], p[1], p[2]]))
    const sc = toFull(S[f].s)
    const b = bodyPose(sc, wc)
    phases.push(t2.update(b.yawDeg).phase)
  }
  const uniq = [...new Set(phases)]
  console.log('   出现的阶段:', uniq.join(', '))
  okc(uniq.length >= 1, `转身跟踪产出阶段（${uniq.length} 种）`)
}

console.log('\n=== 6. 边界：无 3D 数据时应降级不报错 ===')
{
  const sc = toFull(S[0].s)
  const h = headPose(sc, null)
  const b = bodyPose(sc, null)
  okc(h.source === 'screen', 'headPose 无 3D 时降级到 2D（source=screen）')
  okc(b.source === 'screen', 'bodyPose 无 3D 时降级到 2D')
  okc(b.back === null, '2D 降级时 back 明确为 null（不瞎猜前后）')
  const t = createTurnTracker()
  okc(t.update(null).phase === 'unknown', '无 yaw 时转身跟踪返回 unknown')
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
