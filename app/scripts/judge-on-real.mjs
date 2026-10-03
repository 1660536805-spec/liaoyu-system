// 真机数据上的八式判定验证 —— 用「真实骨架 + 真实人体比例」合成八式姿态
// 为什么需要：cam-verify 抓到的只是某一瞬间的随机姿态，无法覆盖 8 式。
// 本脚本以真机骨架为基底（保留真实 visibility 分布、真实肩宽比），
// 按八式的几何特征做仿射变形，再喂判定器 —— 验证「真实数据条件下 8 式可区分」。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LM_PATH = path.join(ROOT, 'evidence/landmarks-real.json')
if (!existsSync(LM_PATH)) {
  console.error(
    '缺少 evidence/landmarks-real.json（真机骨架样本）。\n' +
    '请先跑一次真机验证生成：\n' +
    '  npm run dev            # 另开一个终端\n' +
    '  npm run verify:cam     # 需本机有摄像头且镜前有人\n'
  )
  process.exit(2)
}
const mod = await import(pathToFileURL(path.join(ROOT, 'src/engine/judge.js')).href)
const { MoveJudge, MOVES, NAMES, LM, torso, leanDeg } = mod
const real = JSON.parse(readFileSync(LM_PATH, 'utf8'))
const base = real.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }))

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

console.log('\n=== 0. 真机基底数据 ===')
{
  const T = torso(base)
  const up = [11, 12, 13, 14, 15, 16].map((i) => base[i].visibility)
  const lo = [25, 26, 27, 28].map((i) => base[i].visibility)
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length
  console.log(`   肩宽(归一化基准)=${T.toFixed(4)}  上半身vis=${avg(up).toFixed(3)}  下肢vis=${avg(lo).toFixed(3)}`)
  okc(avg(up) > 0.6, '上半身可见度足够（八式判定只依赖上半身）')
}

// 以下变形全部以「肩宽 T」为单位，数值取自真机观察到的比例关系
const T = torso(base)
const shoMid = (p) => ({ x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 })

/** 把 33 点搬到「以 sh 为原点、T 为单位」的局部坐标下，按动作重排，再搬回原位 */
function build(place) {
  const p = base.map((q) => ({ ...q }))
  const sh = shoMid(base)
  // 局部化（以肩中点为原点，单位=肩宽）
  for (const q of p) { q.x = (q.x - sh.x) / T; q.y = (q.y - sh.y) / T }
  place(p)
  // 搬回，并夹到画面内 [0.03,0.97]
  for (const q of p) {
    q.x = Math.max(0.03, Math.min(0.97, sh.x + q.x * T))
    q.y = Math.max(0.03, Math.min(0.97, sh.y + q.y * T))
  }
  return p
}
const P = { nose: [0, -0.5], lEye: [-0.05, -0.53], rEye: [0.05, -0.53] }
const put = (p, i, x, y) => { p[i].x = x; p[i].y = y }
const baseArm = (p) => {   // 自然下垂
  put(p, LM.L_SHO, -0.5, 0); put(p, LM.R_SHO, 0.5, 0)
  put(p, LM.L_ELB, -0.6, 0.55); put(p, LM.R_ELB, 0.6, 0.55)
  put(p, LM.L_WRI, -0.62, 1.05); put(p, LM.R_WRI, 0.62, 1.05)
  put(p, LM.L_HIP, -0.3, 1.05); put(p, LM.R_HIP, 0.3, 1.05)
  put(p, LM.NOSE, 0, -0.5); put(p, LM.L_EYE, -0.05, -0.53); put(p, LM.R_EYE, 0.05, -0.53)
}

// 8 式的真实几何（局部坐标，T=1）
const POSES = [
  // 1 双手托天：双臂高举过头顶
  (p) => { baseArm(p); put(p, LM.L_ELB, -0.78, -0.7); put(p, LM.R_ELB, 0.78, -0.7); put(p, LM.L_WRI, -0.95, -2.3); put(p, LM.R_WRI, 0.95, -2.3) },
  // 2 左右开弓：一臂平举伸直 + 另一臂屈肘拉弦
  (p) => { baseArm(p); put(p, LM.L_WRI, -1.5, 0.05); put(p, LM.L_ELB, -0.95, 0.05); put(p, LM.R_ELB, 0.5, 0.3); put(p, LM.R_WRI, -0.05, 0.28) },
  // 3 调理脾胃须单举：一手高举 + 一手下按到髋
  (p) => { baseArm(p); put(p, LM.L_ELB, -0.72, -0.6); put(p, LM.L_WRI, -0.82, -2.1); put(p, LM.R_WRI, 0.58, 1.3); put(p, LM.R_ELB, 0.62, 0.62) },
  // 4 五劳七伤往后瞧：躯干竖直 + 头转（鼻偏 0.45T）+ 眼连线同转
  (p) => { baseArm(p); put(p, LM.NOSE, 0.45, -0.5); put(p, LM.L_EYE, 0.35, -0.53); put(p, LM.R_EYE, 0.55, -0.52) },
  // 5 摇头摆尾：俯身 lean≈50° + 双手下探（pose 会在下面加摆动序列）
  (p) => { baseArm(p); put(p, LM.L_SHO, -0.42, 0.78); put(p, LM.R_SHO, 0.08, 0.78); put(p, LM.L_ELB, -0.5, 1.35); put(p, LM.R_ELB, 0.05, 1.35); put(p, LM.L_WRI, -0.5, 1.85); put(p, LM.R_WRI, 0.05, 1.85); put(p, LM.NOSE, -0.3, 0.12) },
  // 6 两手攀足：深前倾 + 双手探到最底
  (p) => { baseArm(p); put(p, LM.L_SHO, -0.3, 0.35); put(p, LM.R_SHO, 0.2, 0.35); put(p, LM.L_ELB, -0.35, 1.1); put(p, LM.R_ELB, 0.25, 1.1); put(p, LM.L_WRI, -0.2, 1.85); put(p, LM.R_WRI, 0.3, 1.85); put(p, LM.NOSE, -0.1, -0.2) },
  // 7 攒拳怒目：一拳前伸 + 另一手贴腰
  (p) => { baseArm(p); put(p, LM.L_WRI, -1.25, 0.02); put(p, LM.L_ELB, -0.85, 0.02); put(p, LM.R_WRI, 0.35, 1.0); put(p, LM.R_ELB, 0.45, 0.6) },
  // 8 背后七颠：并拢双脚 + 躯干上下起伏（pose 下面加起伏序列）
  (p) => { baseArm(p); put(p, LM.L_KNE, -0.3, 1.95); put(p, LM.R_KNE, 0.3, 1.95); put(p, LM.L_ANK, -0.25, 2.8); put(p, LM.R_ANK, 0.25, 2.8) },
]

// 时序包装：式5 加左右摆，式8 加上下起伏
const seqFor = (i, f) => {
  const ph = Math.sin((f / 40) * Math.PI * 2)
  // 摇头摆尾：躯干整体左右摆（肩/髋/手同步横移），肩要俯得够深
  if (i === 4) return (p) => {
    POSES[4](p)
    const d = ph * 0.62
    for (const k of [13, 14, 15, 16]) p[k].x += d
    for (const k of [11, 12, 23, 24]) p[k].x += d * 0.35   // 躯干也摆 → 产生 __sway
  }
  if (i === 7) return (p) => { POSES[7](p); const d = ph * 0.16; for (let k = 0; k < 29; k++) p[k].y += d }
  return POSES[i]
}

console.log('\n=== A. 顺序模式：真机数据基底上，8 式各自可触发且唯一 ===')
for (let i = 0; i < 8; i++) {
  const j = new MoveJudge({ holdFrames: 10, order: i })
  const hits = []
  for (let f = 0; f < 70; f++) hits.push(...j.update(build(seqFor(i, f))))
  const names = [...new Set(hits.map((h) => h.name))]
  okc(names.length === 1 && names[0] === NAMES[i],
    `${NAMES[i]}：命中 [${names}] 自身分 ${j.lastScores[i].toFixed(2)}`)
  if (!(names.length === 1 && names[0] === NAMES[i])) {
    console.log('    ' + j.lastScores.map((x, k) => `${k + 1}:${x.toFixed(2)}`).join(' '))
  }
}

console.log('\n=== B. 自由模式：逐式测试零串扰 ===')
for (let i = 0; i < 8; i++) {
  const j = new MoveJudge({ holdFrames: 8, order: null })
  const hits = new Set()
  for (let f = 0; f < 70; f++) j.update(build(seqFor(i, f))).forEach((h) => hits.add(h.index))
  const strays = [...hits].filter((x) => x !== i)
  okc(strays.length === 0, `喂「${NAMES[i]}」→ 命中 [${[...hits].map((x) => NAMES[x])}]`)
}

console.log('\n=== C. 真机站立（含 0.014 噪声）300 帧零误触发 ===')
{
  const j = new MoveJudge({ holdFrames: 10, order: null })
  const hits = new Set()
  for (let f = 0; f < 300; f++) {
    const p = build(() => {})   // 保持真机当下姿态
    p.forEach((q, k) => { q.x += Math.sin(f * 1.7 + k) * 0.008; q.y += Math.cos(f * 2.1 + k) * 0.008 })
    j.update(p).forEach((h) => hits.add(h.index))
  }
  okc(hits.size === 0, `真机姿态 + 噪声 → 命中 [${[...hits].map((x) => NAMES[x])}]（期望空）`)
}

console.log('\n=== D. 距离鲁棒性：整体缩放 0.6× / 1.8×（模拟远近）判定一致 ===')
{
  for (const k of [0.6, 1.8]) {
    const j = new MoveJudge({ holdFrames: 8, order: null })
    const hits = new Set()
    for (let i = 0; i < 8; i++) {
      for (let f = 0; f < 70; f++) {
        const p = build(seqFor(i, f))
        p.forEach((q) => { q.x = 0.5 + (q.x - 0.5) * k; q.y = 0.5 + (q.y - 0.5) * k })
        j.update(p).forEach((h) => hits.add(h.index))
      }
      j.latched.fill(false)   // 逐式检查时解锁
    }
    const n = hits.size
    okc(n === 8, `缩放 ${k}× → 8 式全部仍可判定（命中 ${n} 式）`)
  }
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
