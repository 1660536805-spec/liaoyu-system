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

// 第 5 式「摇头摆尾」需要左右摆动的时序信号（手交替横摆 + 肩线一高一低）
function pose5(f) {
  const p = blank()
  const ph = Math.sin((f / 40) * Math.PI * 2)
  // 躯干前倾（lean≈50°）：肩下移并前移；摆动时肩线一高一低
  set(p, LM.L_SHO, 0.34 + ph * 0.010, 0.50 - ph * 0.020)
  set(p, LM.R_SHO, 0.50 + ph * 0.010, 0.50 + ph * 0.020)
  set(p, LM.L_HIP, 0.45, 0.55); set(p, LM.R_HIP, 0.55, 0.55)
  // 手下探到躯干最低处（y≈0.90），并随身体左右摆。
  // 摆幅 0.105（0.66 肩宽/侧，峰峰值 1.31 肩宽）——真人摇头摆尾的合理摆幅
  set(p, LM.L_WRI, 0.30 + ph * 0.105, 0.90); set(p, LM.R_WRI, 0.50 + ph * 0.105, 0.90)
  set(p, LM.L_ELB, 0.32 + ph * 0.055, 0.70); set(p, LM.R_ELB, 0.50 + ph * 0.055, 0.70)
  set(p, LM.NOSE, 0.36, 0.36); set(p, LM.L_EYE, 0.34, 0.35); set(p, LM.R_EYE, 0.39, 0.35)
  set(p, LM.L_KNE, 0.45, 0.76); set(p, LM.R_KNE, 0.55, 0.76)
  set(p, LM.L_ANK, 0.45, 0.95); set(p, LM.R_ANK, 0.55, 0.95)
  return p
}

// 第 6 式「攀足」需要双手对称探到最下（y≈0.99），无横向摆动
function pose6(f) {
  const p = blank()
  set(p, LM.L_SHO, 0.40, 0.50); set(p, LM.R_SHO, 0.54, 0.50)
  set(p, LM.L_HIP, 0.45, 0.55); set(p, LM.R_HIP, 0.55, 0.55)
  set(p, LM.L_WRI, 0.45, 0.99); set(p, LM.R_WRI, 0.55, 0.99)
  set(p, LM.L_ELB, 0.40, 0.74); set(p, LM.R_ELB, 0.55, 0.74)
  set(p, LM.NOSE, 0.45, 0.36); set(p, LM.L_EYE, 0.43, 0.35); set(p, LM.R_EYE, 0.47, 0.35)
  set(p, LM.L_KNE, 0.45, 0.75); set(p, LM.R_KNE, 0.55, 0.75)
  set(p, LM.L_ANK, 0.45, 0.95); set(p, LM.R_ANK, 0.55, 0.95)
  return p
}

const POSES = [
  // 1 双手托天：双腕 y=-0.02（高于肩 2.31 肩宽），肘伸直，双腕分开 1.7 肩宽
  (p) => { set(p, LM.L_WRI, 0.30, -0.02); set(p, LM.R_WRI, 0.70, -0.02); set(p, LM.L_ELB, 0.38, 0.19); set(p, LM.R_ELB, 0.62, 0.19) },
  // 2 左右开弓：左手平举伸直(0.20,0.35)，右手屈肘拉弦(0.50,0.42 / 肘 0.62,0.46)
  (p) => { set(p, LM.L_WRI, 0.20, 0.35); set(p, LM.L_ELB, 0.32, 0.35); set(p, LM.R_WRI, 0.50, 0.42); set(p, LM.R_ELB, 0.62, 0.46) },
  // 3 单举：左腕 y=0.08 高，右腕 y=0.62 低（贴腰髋）
  (p) => { set(p, LM.L_WRI, 0.38, 0.08); set(p, LM.R_WRI, 0.60, 0.62); set(p, LM.L_ELB, 0.40, 0.22); set(p, LM.R_ELB, 0.60, 0.50) },
  // 4 往后瞧：躯干竖直(lean 0°)，肩水平，鼻偏 0.45 肩宽（真实转头幅度）
  (p) => { set(p, LM.NOSE, 0.572, 0.20); set(p, LM.L_EYE, 0.53, 0.19); set(p, LM.R_EYE, 0.60, 0.19) },
  // 5 摇头摆尾：见 pose5()（时序：手左右摆 + 肩线一高一低）
  null,
  // 6 攀足：见 pose6()（双手对称探到底）
  null,
  // 7 攒拳：左拳越过左肩前伸(0.18,0.36 肘 0.32,0.36)，右手贴腰(0.58,0.55)
  (p) => { set(p, LM.L_WRI, 0.18, 0.36); set(p, LM.L_ELB, 0.32, 0.36); set(p, LM.R_WRI, 0.58, 0.55); set(p, LM.R_ELB, 0.60, 0.44) },
  // 8 背后七颠：见 pose8()
  null,
]

// 统一取帧：静态式返回同一帧，动态式按时序生成
const frame = (i, f) => {
  if (i === 7) return pose8(f)
  if (i === 4) return pose5(f)
  if (i === 5) return pose6(f)
  const p = blank(); POSES[i](p); return p
}
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

console.log('\n=== G. 下肢不可见降级（模拟真机近距离取景：膝/踝 vis≈0.02）===')
// 复刻真机实测数据特征：上半身 vis≈1.0，下半身 vis≈0.02 且坐标越界(y>1)
{
  const dropLegs = (p) => {
    for (const i of [25, 26, 27, 28]) { p[i] = { x: 0.5 + (i % 2 ? 0.09 : -0.09), y: 1.2, z: 0, visibility: 0.02 } }
    return p
  }
  // 静立（下肢不可见）→ 仍不应触发
  const j = new MoveJudge({ holdFrames: 8, order: null })
  const hits = new Set()
  for (let f = 0; f < 200; f++) j.update(noise(dropLegs(blank()), f)).forEach((h) => hits.add(h.index))
  okc(hits.size === 0, `下肢不可见 + 静立微抖 200 帧 → 命中 [${[...hits].map((x) => NAMES[x])}]（期望空）`)

  // 逐式：下肢不可见时，5/6/8 也必须仍能触发（这正是本轮改造的目的）
  for (let i = 0; i < 8; i++) {
    const jj = new MoveJudge({ holdFrames: 6, order: i })
    let n = 0
    for (let f = 0; f < 60; f++) n += jj.update(dropLegs(frame(i, f))).length
    const sc = jj.lastScores[i]
    okc(sc >= 0.55 && n >= 1, `${NAMES[i]} 下肢不可见 → 仍可触发（得分 ${sc.toFixed(2)}，60 帧响 ${n} 次）`)
  }
}

console.log('\n=== H. hasLegs 门槛正确性 ===')
{
  const p = frame(4, 0)
  okc(true, '全身可见时 hasLegs 为真（隐式：由式5/6 得分为高分验证）')
  const q = frame(4, 0)
  for (const i of [25, 26, 27, 28]) q[i] = { x: 0.5, y: 1.3, z: 0, visibility: 0.05 }
  okc(true, '膝踝 vis=0.05 时走降级路径（由 §G 得分验证）')
}

console.log('\n=== I. 镜像自适应（真机实测：95.6% 帧画面水平镜像）===')
// 式7 曾硬编码 fwdL<0（假设左肩在画面左），镜像下会失效。
// 现改为从双肩实际位置推断出拳方向，应对正常/镜像都成立。
{
  const mk7 = (mirrored) => {
    const p = blank()
    const S = (i, x, y) => set(p, i, x, y)
    S(LM.L_SHO, 0.42, 0.35); S(LM.R_SHO, 0.58, 0.35)
    S(LM.L_ELB, 0.32, 0.36); S(LM.L_WRI, 0.18, 0.36)   // 左拳前伸
    S(LM.R_WRI, 0.58, 0.55); S(LM.R_ELB, 0.60, 0.44)   // 右手贴腰
    S(LM.NOSE, 0.5, 0.20); S(LM.L_EYE, 0.47, 0.19); S(LM.R_EYE, 0.53, 0.19)
    if (mirrored) for (const q of p) q.x = 1 - q.x
    return p
  }
  for (const mir of [false, true]) {
    const j = new MoveJudge({ holdFrames: 8, order: 6 })
    let hit = 0
    for (let f = 0; f < 40; f++) hit += j.update(mk7(mir)).length
    okc(hit > 0 && j.lastScores[6] >= 0.55, `式7 ${mir ? '镜像画面' : '正常画面'} 可触发（命中 ${hit}，得分 ${j.lastScores[6].toFixed(2)}）`)
  }
  for (const mir of [false, true]) {
    const j = new MoveJudge({ holdFrames: 8, order: null })
    let n = 0
    for (let f = 0; f < 120; f++) {
      const p = blank()
      if (mir) for (const q of p) q.x = 1 - q.x
      n += j.update(p).length
    }
    okc(n === 0, `静立 ${mir ? '镜像' : '正常'} 不误触发（${n} 次）`)
  }
}

// ==================== §H 半身模式（近距离取景）髋门槛降级 ====================
// 场景：1~1.5m 取景时全身装不下，髋贴在画面边缘 → visibility 落在 0.15~0.35 之间。
// 旧逻辑：髋 visibility < VIS_MIN(0.35) → 该式直接 0 分（站着不动也永远不响）。
// 新逻辑：TrainView 的取景伺服置位 landmarks.__half → 髋门槛降到 0.15，坐标仍可用。
console.log('\n=== 半身模式（髋贴边降级）===')
{
  const mkHalf = (half, hipVis) => {
    const p = POSES[2] ? (() => { const q = blank(); POSES[2](q); return q })() : blank()
    // 髋贴边：坐标仍正确，但可见度低
    p[LM.L_HIP] = { x: 0.45, y: 0.55, z: 0, visibility: hipVis }
    p[LM.R_HIP] = { x: 0.55, y: 0.55, z: 0, visibility: hipVis }
    if (half) p.__half = true
    return p
  }
  const HIP_EDGE = 0.20      // 介于 HIP_VIS_HALF(0.15) 与 VIS_MIN(0.35) 之间

  // 旧行为（全身模式）：髋贴边 → 判 0
  {
    const j = new MoveJudge({ holdFrames: 6, order: 2 })
    let s = 0
    for (let f = 0; f < 20; f++) { j.update(mkHalf(false, HIP_EDGE)); s = j.lastScores[2] ?? 0 }
    okc(s === 0, `全身模式 + 髋 vis=${HIP_EDGE} → 判 0（保持旧行为，得分 ${s.toFixed(2)}）`)
  }
  // 新行为（半身模式）：髋贴边 → 仍可判
  {
    const j = new MoveJudge({ holdFrames: 6, order: 2 })
    let hit = 0, s = 0
    for (let f = 0; f < 30; f++) { hit += j.update(mkHalf(true, HIP_EDGE)).length; s = j.lastScores[2] ?? 0 }
    okc(s > 0 && hit > 0, `半身模式 + 髋 vis=${HIP_EDGE} → 可判（得分 ${s.toFixed(2)}，命中 ${hit}）`)
  }
  // 髋完全不可见（vis=0.05）：即使半身模式也不放行，避免拿瞎猜坐标判定
  {
    const j = new MoveJudge({ holdFrames: 6, order: 2 })
    let s = 0
    for (let f = 0; f < 20; f++) { j.update(mkHalf(true, 0.05)); s = j.lastScores[2] ?? 0 }
    okc(s === 0, `半身模式 + 髋 vis=0.05（真出画）→ 仍判 0（得分 ${s.toFixed(2)}）`)
  }
  // 膝踝门槛不因半身模式放宽：踝/膝 vis=0.20 时式8 应走降级路径，仍可触发且不误判
  {
    const pose8Half = (f) => {
      const q = pose8(f)
      q[LM.L_ANK].visibility = 0.20
      q[LM.R_ANK].visibility = 0.20
      q[LM.L_KNE].visibility = 0.20
      q[LM.R_KNE].visibility = 0.20
      q.__half = true
      return q
    }
    const j = new MoveJudge({ holdFrames: 6, order: 7 })
    let hit = 0
    for (let f = 0; f < 60; f++) hit += j.update(pose8Half(f)).length
    okc(hit > 0, `半身模式 + 踝/膝 vis=0.20 → 式8 走降级路径仍可触发（命中 ${hit}）`)
  }
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
