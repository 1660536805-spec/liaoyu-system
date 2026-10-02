// 判定器自测 —— 对应交付文档 D2（8 式全通）与 D7（不误触发）
// 运行：node src/engine/judge.test.mjs
import { MoveJudge, MOVES, NAMES, LM } from './judge.js'

function blank() {
  const p = new Array(33)
  for (let i = 0; i < 33; i++) p[i] = { x: 0.5, y: 0.5, z: 0, visibility: 1 }
  const S = (i, x, y) => { p[i] = { x, y, z: 0, visibility: 1 } }
  S(LM.L_SHO, 0.42, 0.35); S(LM.R_SHO, 0.58, 0.35)
  S(LM.L_HIP, 0.45, 0.55); S(LM.R_HIP, 0.55, 0.55)
  S(LM.L_KNE, 0.45, 0.75); S(LM.R_KNE, 0.55, 0.75)
  S(LM.L_ANK, 0.45, 0.95); S(LM.R_ANK, 0.55, 0.95)
  S(LM.L_ELB, 0.40, 0.47); S(LM.R_ELB, 0.60, 0.47)
  S(LM.L_WRI, 0.40, 0.60); S(LM.R_WRI, 0.60, 0.60)
  S(LM.NOSE, 0.5, 0.20); S(LM.L_EYE, 0.47, 0.19); S(LM.R_EYE, 0.53, 0.19)
  return p
}
const set = (p, i, x, y) => { p[i] = { x, y, z: 0, visibility: 1 } }

// 第 8 式是时序动作（踮脚），需按帧号生成起伏序列
function pose8(f) {
  const p = blank()
  const off = Math.sin((f / 40) * Math.PI * 2) * 0.038
  set(p, LM.L_ANK, 0.485, 0.95); set(p, LM.R_ANK, 0.515, 0.95)
  set(p, LM.L_KNE, 0.45, 0.75 + off * 0.4); set(p, LM.R_KNE, 0.55, 0.75 + off * 0.4)
  set(p, LM.L_HIP, 0.45, 0.55 + off); set(p, LM.R_HIP, 0.55, 0.55 + off)
  set(p, LM.L_SHO, 0.42, 0.35 + off); set(p, LM.R_SHO, 0.58, 0.35 + off)
  set(p, LM.L_ELB, 0.40, 0.47 + off); set(p, LM.R_ELB, 0.60, 0.47 + off)
  set(p, LM.L_WRI, 0.40, 0.60 + off); set(p, LM.R_WRI, 0.60, 0.60 + off)
  set(p, LM.NOSE, 0.5, 0.20 + off); set(p, LM.L_EYE, 0.47, 0.19 + off); set(p, LM.R_EYE, 0.53, 0.19 + off)
  return p
}

const POSES = [
  // 1 双手托天：双腕 y=0.12（高于肩 1.44 肩宽），肘伸直，腕分开
  (p) => { set(p, LM.L_WRI, 0.36, 0.12); set(p, LM.R_WRI, 0.64, 0.12); set(p, LM.L_ELB, 0.40, 0.23); set(p, LM.R_ELB, 0.60, 0.23) },
  // 2 左右开弓：左手平举伸直(0.20,0.35)，右手屈肘拉弦(0.50,0.42 / 肘 0.62,0.46)
  (p) => { set(p, LM.L_WRI, 0.20, 0.35); set(p, LM.L_ELB, 0.32, 0.35); set(p, LM.R_WRI, 0.50, 0.42); set(p, LM.R_ELB, 0.62, 0.46) },
  // 3 单举：左腕 y=0.08 高，右腕 y=0.62 低（贴腰髋）
  (p) => { set(p, LM.L_WRI, 0.38, 0.08); set(p, LM.R_WRI, 0.60, 0.62); set(p, LM.L_ELB, 0.40, 0.22); set(p, LM.R_ELB, 0.60, 0.50) },
  // 4 往后瞧：躯干竖直(lean 0°)，肩水平，鼻偏 0.45 肩宽（真实转头幅度）
  (p) => { set(p, LM.NOSE, 0.572, 0.20); set(p, LM.L_EYE, 0.53, 0.19); set(p, LM.R_EYE, 0.60, 0.19) },
  // 5 摇头摆尾：躯干深俯 lean≈67°，手离开脚（≈1.5 肩宽），屈膝（膝踝距≈0.8 肩宽）
  (p) => { set(p, LM.L_SHO, 0.30, 0.50); set(p, LM.R_SHO, 0.46, 0.50); set(p, LM.L_ELB, 0.30, 0.66); set(p, LM.R_ELB, 0.46, 0.68); set(p, LM.L_WRI, 0.28, 0.78); set(p, LM.R_WRI, 0.46, 0.80); set(p, LM.NOSE, 0.32, 0.36); set(p, LM.L_KNE, 0.44, 0.82); set(p, LM.R_KNE, 0.56, 0.82) },
  // 6 攀足：躯干前倾 + 手到脚踝
  (p) => { set(p, LM.L_SHO, 0.40, 0.50); set(p, LM.R_SHO, 0.54, 0.50); set(p, LM.L_ELB, 0.40, 0.72); set(p, LM.R_ELB, 0.55, 0.72); set(p, LM.L_WRI, 0.45, 0.92); set(p, LM.R_WRI, 0.55, 0.92); set(p, LM.NOSE, 0.45, 0.36) },
  // 7 攒拳：左拳越过左肩前伸(0.18,0.36 肘 0.32,0.36)，右手贴腰(0.58,0.55)
  (p) => { set(p, LM.L_WRI, 0.18, 0.36); set(p, LM.L_ELB, 0.32, 0.36); set(p, LM.R_WRI, 0.58, 0.55); set(p, LM.R_ELB, 0.60, 0.44) },
  // 8 背后七颠：见 pose8()
  null,
]

const frame = (i, f) => (i === 7 ? pose8(f) : (() => { const p = blank(); POSES[i](p); return p })())
const noise = (p, f, amp = 0.014) => p.map((pt, k) => ({
  x: Math.max(0, Math.min(1, pt.x + Math.sin(f * 1.7 + k) * amp)),
  y: Math.max(0, Math.min(1, pt.y + Math.cos(f * 2.1 + k) * amp)),
  z: 0, visibility: 1,
}))

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

console.log('\n=== A. 顺序模式（产品主用）：每式只判自己，60 帧内必触发且不响别式 ===')
for (let i = 0; i < 8; i++) {
  const j = new MoveJudge({ holdFrames: 10, order: i })
  const hits = []
  for (let f = 0; f < 60; f++) hits.push(...j.update(frame(i, f)))
  const names = [...new Set(hits.map((h) => h.name))]
  okc(names.length === 1 && names[0] === NAMES[i] && j.lastScores[i] >= 0.55,
    `${NAMES[i]}：触发 [${names}]，自身分 ${j.lastScores[i].toFixed(2)}`)
  if (!(names.length === 1 && names[0] === NAMES[i])) {
    console.log('    分数: ' + j.lastScores.map((x, k) => `${k + 1}:${x.toFixed(2)}`).join(' '))
  }
}

console.log('\n=== B. 顺序模式 + 原地晃动 300 帧：锁存后不多响 ===')
for (let i = 0; i < 8; i++) {
  const j = new MoveJudge({ holdFrames: 10, order: i })
  let n = 0
  for (let f = 0; f < 300; f++) n += j.update(noise(frame(i, f), f)).length
  okc(n === 1, `${NAMES[i]}：300 帧共响 ${n} 次（期望 1）`)
}

console.log('\n=== C. 自由模式（逐式测试用）：喂 i 式命中 i 式，不串到别式 ===')
for (let i = 0; i < 8; i++) {
  const j = new MoveJudge({ holdFrames: 8, order: null })
  const hits = new Set()
  for (let f = 0; f < 40; f++) j.update(frame(i, f)).forEach((h) => hits.add(h.index))
  const arr = [...hits]
  const strays = arr.filter((x) => x !== i)
  okc(strays.length === 0 && (arr.includes(i) || i === 7),
    `喂「${NAMES[i]}」→ 命中 [${arr.map((x) => NAMES[x] || '无')}]${strays.length ? ' 串扰!' : ''}`)
}

console.log('\n=== D. 静立不动 300 帧：任何模式都不触发 ===')
{
  const j1 = new MoveJudge({ holdFrames: 8, order: null })
  const h1 = new Set()
  for (let f = 0; f < 300; f++) { const p = blank(); p.forEach((_, k) => { p[k] = { x: p[k].x + Math.sin(f * 1.3 + k) * 0.01, y: p[k].y + Math.cos(f * 1.9 + k) * 0.01, z: 0, visibility: 1 } }); j1.update(p).forEach((h) => h1.add(h.index)) }
  okc(h1.size === 0, `自由模式静立 → 命中 [${[...h1].map((x) => NAMES[x])}]（期望空）`)

  let h2 = 0
  for (let i = 0; i < 8; i++) {
    const j = new MoveJudge({ holdFrames: 8, order: i })
    for (let f = 0; f < 120; f++) h2 += j.update(noise(blank(), f)).length
  }
  okc(h2 === 0, `顺序模式静立（8 式各 120 帧）→ 命中 ${h2} 次（期望 0）`)
}

console.log('\n=== E. visibility 不足记 0 分 ===')
{
  const p = frame(0, 0); p[LM.L_WRI].visibility = 0.1
  okc(MOVES[0](p) === 0, '式1 手腕 visibility 0.1 → 0 分')
  const q = frame(0, 0)
  okc(MOVES[0](q) > 0.55, '式1 手腕 visibility 1.0 → 正常得分')
}

console.log('\n=== F. 尺度不变性：整体放大 1.6 倍（远离摄像头）判定不变 ===')
{
  const p = frame(0, 0)
  const big = p.map((pt) => ({ x: 0.5 + (pt.x - 0.5) * 1.6, y: 0.5 + (pt.y - 0.5) * 1.6, z: 0, visibility: 1 }))
  const a = MOVES[0](p), b = MOVES[0](big)
  okc(Math.abs(a - b) < 0.02, `式1 原尺度 ${a.toFixed(3)} vs 放大 1.6× ${b.toFixed(3)}`)
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
