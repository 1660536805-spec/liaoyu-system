// 取景指标单测：node scripts/framing.test.mjs
//
// 背景：跟练页顶部指标卡（上半身 / 下半身 / 取景完整度）原先是**写死的 92% / 88% / 92%**，
// 与摄像头里到底有没有人、站得远不远毫无关系。改成真值后，这里锁住三件事：
//   ① 没人体（null / 点数不足）→ 返回 null；文案给「—」、条宽 0%，绝不出现任何百分数
//   ② 关键点齐且可信 → 上半身 100%、取景 100%（不是靠猜的 92%）
//   ③ 近距离实拍特征（膝/踝 visibility≈0.02，肩/肘/腕≈1.0）→ 下半身明显低、上半身高
//   ④ 关键点跑到画面外 → 取景完整度按「出框点数」线性下降
import assert from 'node:assert/strict'
import {
  framingMetrics, pctText, barWidth, diagText, UPPER_IDX, LOWER_IDX, MIN_LANDMARKS,
} from '../src/engine/framing.js'

let pass = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ✓', name) }
  catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1 }
}

// ---- 造一个 33 点的姿态（MediaPipe Pose 的点数） ----
// vis: 统一 visibility；inFrame: 为 false 时把这些点挪到画面外
function pose({ vis = 1, lowVis = null, outOfFrame = [] } = {}) {
  const arr = Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, visibility: vis }))
  // 造一个像样的骨架：肩在 (0.4,0.3)/(0.6,0.3)，膝、踝往下排
  arr[11] = { x: 0.40, y: 0.30, visibility: vis }
  arr[12] = { x: 0.60, y: 0.30, visibility: vis }
  arr[13] = { x: 0.36, y: 0.42, visibility: vis }
  arr[14] = { x: 0.64, y: 0.42, visibility: vis }
  arr[15] = { x: 0.34, y: 0.55, visibility: vis }
  arr[16] = { x: 0.66, y: 0.55, visibility: vis }
  for (const i of LOWER_IDX) arr[i] = { x: 0.45 + (i % 2) * 0.1, y: 0.7 + (i % 4) * 0.05, visibility: lowVis == null ? vis : lowVis }
  for (const i of outOfFrame) arr[i] = { ...arr[i], x: 1.4 }   // 出框
  return arr
}

console.log('\n=== 取景指标单测 ===\n')

console.log('① 没人体 / 点数不足 → null（不许编数字）')
t('null 输入 → null', () => assert.equal(framingMetrics(null), null))
t('空数组 → null', () => assert.equal(framingMetrics([]), null))
t(`点数 < ${MIN_LANDMARKS} → null`, () => {
  assert.equal(framingMetrics(pose().slice(0, MIN_LANDMARKS - 1)), null)
  assert.notEqual(framingMetrics(pose().slice(0, MIN_LANDMARKS + 4)), null)
})

console.log('\n② 没人体时，界面文案不许出现百分数')
t('pctText(x,false) === "—"', () => {
  assert.equal(pctText(0.92, false), '—')
  assert.equal(pctText(0, false), '—')
  assert.equal(pctText(1, false), '—')
})
t('barWidth(x,false) === "0%"', () => assert.equal(barWidth(0.92, false), '0%'))
t('diagText(null) === 未检测到人体', () => assert.equal(diagText(null), '未检测到人体'))
t('未见人体时整行文案里没有任何 %', () => {
  const line = [pctText(0, false), pctText(0, false), pctText(0, false)].join(' ')
  assert.ok(!line.includes('%'), `实得「${line}」不该含 %`)
})

console.log('\n③ 全可见姿态 → 三个真值都是满的（不是写死的 92%）')
t('up = 1 / low = 1 / frame = 1', () => {
  const m = framingMetrics(pose())
  assert.equal(m.up, 1)
  assert.equal(m.low, 1)
  assert.equal(m.frame, 1)
  assert.equal(pctText(m.up, true), '100%')
  assert.equal(pctText(m.frame, true), '100%')
})
t('肩宽占比 = 0.2（肩点相距 0.2）', () => {
  const m = framingMetrics(pose())
  assert.ok(Math.abs(m.shoW - 0.2) < 1e-9, `实得 ${m.shoW}`)
})
t('上半身/下半身用的关键点下标固定且不重叠', () => {
  assert.deepEqual(UPPER_IDX, [11, 12, 13, 14, 15, 16])
  assert.deepEqual(LOWER_IDX, [25, 26, 27, 28])
  assert.equal(UPPER_IDX.some((i) => LOWER_IDX.includes(i)), false)
})

console.log('\n④ 近站实拍特征：膝/踝≈0.02、肩肘腕≈1.0')
t('下半身显著低于上半身，且 frame 因低可见点而下降', () => {
  const m = framingMetrics(pose({ lowVis: 0.02 }))
  assert.equal(m.up, 1)
  assert.ok(Math.abs(m.low - 0.02) < 1e-9, `实得 low=${m.low}`)
  // 33 点里只有 4 个低可见（LOWER_IDX），其余 29 个 >0.5
  assert.equal(m.frame, 29 / 33)
  assert.ok(m.low < 0.25, '下半身 < 25% ⇒ 触发「上半身已够用」的引导分支')
})

console.log('\n⑤ 出框 → 取景完整度按出框点数线性下降')
t('8 个点出框 ⇒ frame = 25/33', () => {
  const m = framingMetrics(pose({ outOfFrame: [11, 12, 13, 14, 15, 16, 25, 26] }))
  assert.equal(m.frame, 25 / 33)
})
t('33 个点全出框 ⇒ frame = 0，文案给 0%', () => {
  const m = framingMetrics(pose({ outOfFrame: Array.from({ length: 33 }, (_, i) => i) }))
  assert.equal(m.frame, 0)
  assert.equal(pctText(m.frame, true), '0%')
})
t('出框点即使 visibility 高也不算「被看见」', () => {
  const m = framingMetrics(pose({ outOfFrame: [0, 1, 2] }))
  assert.equal(m.frame, 30 / 33)
})

console.log('\n⑥ 文案与指标同源')
t('diagText 三项与 metrics 一致', () => {
  const m = framingMetrics(pose({ lowVis: 0.02 }))
  assert.equal(diagText(m), `上半身 100% · 下半身 2% · 取景 ${Math.round(29 / 33 * 100)}%`)
})
t('barWidth 夹在 0~100%', () => {
  assert.equal(barWidth(1.5, true), '100.0%')
  assert.equal(barWidth(-0.2, true), '0.0%')
  assert.equal(barWidth(0.876, true), '87.6%')
})

console.log('\n' + (process.exitCode ? '❌ 有用例失败' : `✅ 全部通过（${pass} 项）`))
