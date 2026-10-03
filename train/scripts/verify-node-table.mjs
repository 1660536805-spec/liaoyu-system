// 校验《动作可见性需求表》节点声明的准确性
// 方法：给每式喂「正确动作姿态」，然后逐个把声明的节点 visibility 置 0，
//       看关掉哪个节点会导致判不出 → 反证该节点确为必需。
// 运行：node scripts/verify-node-table.mjs
import { MoveJudge, NAMES, LM } from '../src/engine/judge.js'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const N = { NOSE: LM.NOSE, L_EYE: LM.L_EYE, R_EYE: LM.R_EYE, L_SHO: LM.L_SHO, R_SHO: LM.R_SHO, L_ELB: LM.L_ELB, R_ELB: LM.R_ELB, L_WRI: LM.L_WRI, R_WRI: LM.R_WRI, L_HIP: LM.L_HIP, R_HIP: LM.R_HIP, L_KNE: LM.L_KNE, R_KNE: LM.R_KNE, L_ANK: LM.L_ANK, R_ANK: LM.R_ANK }
const CN = { NOSE: '鼻', L_EYE: '左眼', R_EYE: '右眼', L_SHO: '左肩', R_SHO: '右肩', L_ELB: '左肘', R_ELB: '右肘', L_WRI: '左腕', R_WRI: '右腕', L_HIP: '左髋', R_HIP: '右髋', L_KNE: '左膝', R_KNE: '右膝', L_ANK: '左踝', R_ANK: '右踝' }

function blank() {
  const p = new Array(33)
  for (let i = 0; i < 33; i++) p[i] = { x: 0.5, y: 0.5, z: 0, visibility: 1 }
  const S = (i, x, y) => { p[i] = { x, y, z: 0, visibility: 1 } }
  S(N.L_SHO, 0.42, 0.35); S(N.R_SHO, 0.58, 0.35)
  S(N.L_HIP, 0.45, 0.55); S(N.R_HIP, 0.55, 0.55)
  S(N.L_KNE, 0.45, 0.75); S(N.R_KNE, 0.55, 0.75)
  S(N.L_ANK, 0.45, 0.95); S(N.R_ANK, 0.55, 0.95)
  S(N.L_ELB, 0.40, 0.47); S(N.R_ELB, 0.60, 0.47)
  S(N.L_WRI, 0.40, 0.60); S(N.R_WRI, 0.60, 0.60)
  S(N.NOSE, 0.5, 0.20); S(N.L_EYE, 0.47, 0.19); S(N.R_EYE, 0.53, 0.19)
  return p
}
const set = (p, k, x, y) => { p[k] = { x, y, z: 0, visibility: 1 } }

// POSE 里写的是「以肩中点为原点、肩宽 T 为单位」的局部坐标
// （与 judge.test.mjs / judge-on-real.mjs 保持一致），
// 需先转成归一化坐标，判定器才能正确算。
// 注意：须用 blank() 的原始肩位做基准，不能用 POSE 改过后的肩。
const BASE_SH = { x: 0.5, y: 0.35 }
const BASE_T = 0.16
// NORMALIZED 里的式子直接写归一化坐标，跳过 toNorm
const NORMALIZED = new Set([5])
function toNorm(p) {
  for (const q of p) { q.x = BASE_SH.x + q.x * BASE_T; q.y = BASE_SH.y + q.y * BASE_T }
  return p
}

// 各式的「正确动作姿态」生成器（f 为帧号，用于时序动作）
const POSE = {
  0: () => (p => { set(p, N.L_WRI, 0.30, -0.02); set(p, N.R_WRI, 0.70, -0.02); set(p, N.L_ELB, 0.38, 0.19); set(p, N.R_ELB, 0.62, 0.19) }),
  // 式2 开弓：左手平举伸直，右手屈肘拉弦（屈肘角度需够深以过 0.35~0.60 区间）
  1: () => (p => {
    set(p, N.L_WRI, 0.18, 0.35); set(p, N.L_ELB, 0.32, 0.35)
    set(p, N.R_ELB, 0.58, 0.30); set(p, N.R_WRI, 0.10, 0.40)
  }),
  2: () => (p => { set(p, N.L_ELB, -0.72, -0.6); set(p, N.L_WRI, -0.82, -2.1); set(p, N.R_WRI, 0.58, 1.3); set(p, N.R_ELB, 0.62, 0.62) }),
  3: () => (p => { set(p, N.NOSE, 0.572, 0.20); set(p, N.L_EYE, 0.53, 0.19); set(p, N.R_EYE, 0.60, 0.19) }),
  4: (f) => {
    const ph = Math.sin((f / 40) * Math.PI * 2)
    return (p) => {
      set(p, N.L_SHO, -0.42, 0.78); set(p, N.R_SHO, 0.08, 0.78)
      set(p, N.L_ELB, -0.5, 1.35); set(p, N.R_ELB, 0.05, 1.35)
      set(p, N.L_WRI, -0.5, 1.85); set(p, N.R_WRI, 0.05, 1.85)
      set(p, N.NOSE, -0.3, 0.12)
      const d = ph * 0.62
      for (const k of [N.L_ELB, N.R_ELB, N.L_WRI, N.R_WRI]) p[k].x += d
      for (const k of [N.L_SHO, N.R_SHO, N.L_HIP, N.R_HIP]) p[k].x += d * 0.35
    }
  },
  // 式6 攀足：直接照抄 judge.test.mjs 里已验证通过的 pose6（归一化坐标写法）。
  // 注意：本文件的 blank() 已是归一化坐标（肩 0.42/0.58、踝 0.95），
  //      与单测一致，故这里也直接写归一化值，不做 toNorm 转换。
  5: () => (p => {
    set(p, N.L_SHO, 0.40, 0.50); set(p, N.R_SHO, 0.54, 0.50)
    set(p, N.L_HIP, 0.45, 0.55); set(p, N.R_HIP, 0.55, 0.55)
    set(p, N.L_WRI, 0.45, 0.99); set(p, N.R_WRI, 0.55, 0.99)
    set(p, N.L_ELB, 0.40, 0.74); set(p, N.R_ELB, 0.55, 0.74)
    set(p, N.NOSE, 0.45, 0.36); set(p, N.L_EYE, 0.43, 0.35); set(p, N.R_EYE, 0.47, 0.35)
    set(p, N.L_KNE, 0.45, 0.75); set(p, N.R_KNE, 0.55, 0.75)
    set(p, N.L_ANK, 0.45, 0.95); set(p, N.R_ANK, 0.55, 0.95)
  }),
  6: () => (p => { set(p, N.L_WRI, 0.18, 0.36); set(p, N.L_ELB, 0.32, 0.36); set(p, N.R_WRI, 0.58, 0.55); set(p, N.R_ELB, 0.60, 0.44) }),
  7: (f) => {
    const off = Math.sin((f / 40) * Math.PI * 2) * 0.038
    return (p) => {
      set(p, N.L_ANK, 0.485, 0.95); set(p, N.R_ANK, 0.515, 0.95)
      p[N.L_KNE] = { x: 0.45, y: 0.75 + off * 0.4, z: 0, visibility: 1 }
      p[N.R_KNE] = { x: 0.55, y: 0.75 + off * 0.4, z: 0, visibility: 1 }
      set(p, N.L_HIP, 0.45, 0.55 + off); set(p, N.R_HIP, 0.55, 0.55 + off)
      set(p, N.L_SHO, 0.42, 0.35 + off); set(p, N.R_SHO, 0.58, 0.35 + off)
      p[N.L_ELB] = { x: 0.40, y: 0.47 + off, z: 0, visibility: 1 }
      p[N.R_ELB] = { x: 0.60, y: 0.47 + off, z: 0, visibility: 1 }
      p[N.L_WRI] = { x: 0.40, y: 0.60 + off, z: 0, visibility: 1 }
      p[N.R_WRI] = { x: 0.60, y: 0.60 + off, z: 0, visibility: 1 }
    }
  },
}

// 需求表声明的节点（与文档 §三 主表一致）
const DECLARED = {
  0: ['L_SHO', 'R_SHO', 'L_ELB', 'R_ELB', 'L_WRI', 'R_WRI'],
  1: ['L_SHO', 'R_SHO', 'L_ELB', 'R_ELB', 'L_WRI', 'R_WRI'],
  2: ['L_SHO', 'R_SHO', 'L_HIP', 'R_HIP', 'L_WRI', 'R_WRI'],
  3: ['NOSE', 'L_EYE', 'R_EYE', 'L_SHO', 'R_SHO'],
  4: ['L_SHO', 'R_SHO', 'L_HIP', 'R_HIP', 'L_WRI', 'R_WRI'],
  5: ['L_SHO', 'R_SHO', 'L_HIP', 'R_HIP', 'L_WRI', 'R_WRI'],
  6: ['L_SHO', 'R_SHO', 'L_ELB', 'R_ELB', 'L_HIP', 'R_HIP', 'L_WRI', 'R_WRI'],
  7: ['L_SHO', 'R_SHO', 'L_HIP', 'R_HIP', 'L_KNE', 'R_KNE', 'L_ANK', 'R_ANK'],
}

// 文档标注为「L1/L2/L3」复杂度
// 定级依据消融实验结果：式6 双肘非必需（关掉仍 0.84）→ L2；式8 膝踝非必需 → 按必需 4 点但属时序复杂动作，仍记 L3
// L1 静态单平面 / L2 需躯干或左右不对称 / L3 时序动作或三组以上关节联动
const LEVEL = { 0: 'L1', 1: 'L1', 2: 'L2', 3: 'L1', 4: 'L2', 5: 'L2', 6: 'L3', 7: 'L3' }
// 各式「必需节点数」（式8 膝踝为可选加强，不计入）
const REQUIRED = { 0: 6, 1: 6, 2: 6, 3: 5, 4: 6, 5: 6, 6: 8, 7: 4 }

function run(i, kill) {
  const j = new MoveJudge({ holdFrames: 8, order: i })
  for (let f = 0; f < 70; f++) {
    const p = blank()
    POSE[i](f)(p)
    if (!NORMALIZED.has(i)) toNorm(p)
    // kill 传的是节点名（如 'L_SHO'），也允许直接传索引
    for (const k of kill) {
      const idx = typeof k === 'number' ? k : N[k]
      if (p[idx]) p[idx].visibility = 0.02
    }
    j.update(p)
  }
  return j.lastScores[i]
}

console.log('\n=== 1. 基准：全部节点可见时，各式应可判定 ===')
for (let i = 0; i < 8; i++) {
  const s = run(i, [])
  okc(s >= 0.55, `式${i + 1} ${NAMES[i]} 得分 ${s.toFixed(2)} ≥ 0.55`)
}

console.log('\n=== 2. 盲测：全部节点 visibility=0.02 时应判不出 ===')
for (let i = 0; i < 8; i++) {
  const all = Object.values(N)
  const s = run(i, all)
  okc(s === 0, `式${i + 1} 全盲 → 0 分（实得 ${s.toFixed(2)}）`)
}

console.log('\n=== 3. 消融：逐个关掉声明节点，记录影响 ===')
for (let i = 0; i < 8; i++) {
  const base = run(i, [])
  const critical = []
  for (const k of DECLARED[i]) {
    const s = run(i, [k])
    if (s < 0.55) critical.push(CN[k])
  }
  const soft = DECLARED[i].filter((k) => !critical.includes(CN[k])).map((k) => CN[k])
  console.log(`\n式${i + 1} ${NAMES[i]}（${LEVEL[i]}，声明 ${DECLARED[i].length} 点，基准 ${base.toFixed(2)}）`)
  console.log(`   必需（关掉即失效）: ${critical.length ? critical.join('、') : '无'}`)
  console.log(`   可选（关掉仍可判）: ${soft.length ? soft.join('、') : '无'}`)
}

console.log('\n=== 4. 复杂度定级与节点数是否自洽 ===')
// L3 允许点数区间放宽：时序动作（式8）只需 4 点但复杂度等同 8 点
const RANGE = { L1: [4, 6], L2: [6, 8], L3: [4, 10] }
for (let i = 0; i < 8; i++) {
  const n = REQUIRED[i]
  const [lo, hi] = RANGE[LEVEL[i]]
  okc(n >= lo && n <= hi, `式${i + 1} 必需 ${n} 点，在 ${LEVEL[i]} 区间 [${lo},${hi}] 内`)
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
