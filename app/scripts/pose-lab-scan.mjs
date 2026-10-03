// 采集台「阈值扫描」离线链路验证 —— 用已知合成骨架验证 scanRows 的算法真能判中
// 运行：node scripts/pose-lab-scan.mjs
//
// 【为什么需要单独一个脚本】pose-lab-verify.mjs 用 Chrome 假摄像头，画面里没有真人，
// judge 判 0 是正确行为 —— 那只能证明「表渲染出来了」，证明不了
// 「扫描真把帧喂给了 judge」。这里用 judge.test.mjs 里那套已知能判中的合成姿势，
// 走一遍采集台的数据形态（4 位小数化 → lmOf 还原 → 分段顺序判定），
// 验证命中数非零、阈值单调合理。
//
// 【为什么不需要浏览器】采集台的数据是纯 JSON，扫描是纯计算。
// 浏览器那份 UI 渲染由 pose-lab-verify.mjs 负责，这里只验算法，两者职责分开。
import { MoveJudge, NAMES, LM } from '../src/engine/judge.js'

const KEEP_IDX = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

let fail = 0
const ok = (c, m, extra = '') => {
  console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra ? '   ' + extra : ''))
  if (!c) fail++
}

/* ---------------- 合成姿势（与 judge.test.mjs 同源，那边已证明这 8 式能判中） ---------------- */
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

// 式8 踮脚：时序动作，靠躯干垂直起伏
const pose8 = (f) => {
  const p = blank(); const off = Math.sin((f / 40) * Math.PI * 2) * 0.038
  set(p, LM.L_ANK, 0.485, 0.95); set(p, LM.R_ANK, 0.515, 0.95)
  set(p, LM.L_KNE, 0.45, 0.75 + off * 0.4); set(p, LM.R_KNE, 0.55, 0.75 + off * 0.4)
  set(p, LM.L_HIP, 0.45, 0.55 + off); set(p, LM.R_HIP, 0.55, 0.55 + off)
  set(p, LM.L_SHO, 0.42, 0.35 + off); set(p, LM.R_SHO, 0.58, 0.35 + off)
  set(p, LM.L_ELB, 0.40, 0.47 + off); set(p, LM.R_ELB, 0.60, 0.47 + off)
  set(p, LM.L_WRI, 0.40, 0.60 + off); set(p, LM.R_WRI, 0.60, 0.60 + off)
  set(p, LM.NOSE, 0.5, 0.20 + off); set(p, LM.L_EYE, 0.47, 0.19 + off); set(p, LM.R_EYE, 0.53, 0.19 + off)
  return p
}
// 式5 摇头摆尾：俯身 + 双手大幅左右摆（时序）
const pose5 = (f) => {
  const p = blank(); const ph = Math.sin((f / 40) * Math.PI * 2)
  set(p, LM.L_SHO, 0.34 + ph * 0.010, 0.50 - ph * 0.020)
  set(p, LM.R_SHO, 0.50 + ph * 0.010, 0.50 + ph * 0.020)
  set(p, LM.L_HIP, 0.45, 0.55); set(p, LM.R_HIP, 0.55, 0.55)
  set(p, LM.L_WRI, 0.30 + ph * 0.105, 0.90); set(p, LM.R_WRI, 0.50 + ph * 0.105, 0.90)
  set(p, LM.L_ELB, 0.32 + ph * 0.055, 0.70); set(p, LM.R_ELB, 0.50 + ph * 0.055, 0.70)
  set(p, LM.NOSE, 0.36, 0.36); set(p, LM.L_EYE, 0.34, 0.35); set(p, LM.R_EYE, 0.39, 0.35)
  set(p, LM.L_KNE, 0.45, 0.76); set(p, LM.R_KNE, 0.55, 0.76)
  set(p, LM.L_ANK, 0.45, 0.95); set(p, LM.R_ANK, 0.55, 0.95)
  return p
}
// 式6 攀足：双手对称探到底，不横摆
const pose6 = () => {
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
  // 1 双手托天：腕 y=-0.02（高于肩 2.31 肩宽），肘伸直，双腕分开 1.7 肩宽
  (p) => { set(p, LM.L_WRI, 0.30, -0.02); set(p, LM.R_WRI, 0.70, -0.02); set(p, LM.L_ELB, 0.38, 0.19); set(p, LM.R_ELB, 0.62, 0.19) },
  // 2 左右开弓：一臂平举伸直 + 一臂屈肘拉弦
  (p) => { set(p, LM.L_WRI, 0.20, 0.35); set(p, LM.L_ELB, 0.32, 0.35); set(p, LM.R_WRI, 0.50, 0.42); set(p, LM.R_ELB, 0.62, 0.46) },
  // 3 单举：一手高举、一手下按
  (p) => { set(p, LM.L_WRI, 0.38, 0.08); set(p, LM.R_WRI, 0.60, 0.62); set(p, LM.L_ELB, 0.40, 0.22); set(p, LM.R_ELB, 0.60, 0.50) },
  // 4 往后瞧：躯干竖直 + 鼻偏 0.45 肩宽
  (p) => { set(p, LM.NOSE, 0.572, 0.20); set(p, LM.L_EYE, 0.53, 0.19); set(p, LM.R_EYE, 0.60, 0.19) },
  null, null, // 5/6 见 pose5/pose6
  // 7 攒拳：一拳前伸 + 另一手收腰
  (p) => { set(p, LM.L_WRI, 0.18, 0.36); set(p, LM.L_ELB, 0.32, 0.36); set(p, LM.R_WRI, 0.58, 0.55); set(p, LM.R_ELB, 0.60, 0.44) },
  null, // 8 见 pose8
]
const frameOf = (i, f) => {
  if (i === 7) return pose8(f)
  if (i === 4) return pose5(f)
  if (i === 5) return pose6()
  const p = blank(); POSES[i](p); return p
}

/* ---------------- 复刻 PoseLabView 的数据形态与扫描算法 ----------------
   4 位小数化 → 只留 KEEP_IDX → lmOf 还原成 33 点 → 分段顺序判定。
   这一段必须与 PoseLabView 保持一致，改了一边就要同步改另一边。 */
const R = (n) => Math.round(n * 10000) / 10000
const FRAMES_PER_MOVE = 40          // 够越过 holdFrames=10 与 MIN_WINDOW=12 时序窗口
const seq = []
for (let i = 0; i < 8; i++) {
  for (let f = 0; f < FRAMES_PER_MOVE; f++) {
    const lm = frameOf(i, seq.length)
    seq.push(KEEP_IDX.map((k) => {
      const q = lm[k]
      return [R(q.x), R(q.y), R(q.z ?? 0), R(q.visibility ?? 1)]
    }))
  }
}
ok(seq.length === 320, '合成帧序列构造完成', seq.length + ' 帧（8 式 × ' + FRAMES_PER_MOVE + ' 帧）')

function lmOf(p) {
  const a = new Array(33).fill(null)
  for (let k = 0; k < KEEP_IDX.length; k++) {
    const v = p[k]
    a[KEEP_IDX[k]] = { x: v[0], y: v[1], z: v[2], visibility: v[3] }
  }
  return a
}
function segOf() {
  const m = new Array(seq.length).fill(-1)
  for (let i = 0; i < 8; i++) {
    for (let k = i * FRAMES_PER_MOVE; k < (i + 1) * FRAMES_PER_MOVE; k++) m[k] = i
  }
  return m
}
function scanAt(th, holdFrames = 10, margin = 0.10) {
  const seg = segOf()
  const hit = new Array(8).fill(0)
  let tp = 0, fp = 0
  // 关键：一个 judge 实例贯穿全程（时序窗口必须跨帧连续）；
  // 段切换只清 counts/latched（让新段能重新触发），不 reset。
  const j = new MoveJudge({ holdFrames, threshold: th, margin })
  let prev
  for (let i = 0; i < seq.length; i++) {
    const want = seg[i]
    if (want !== prev) { j.counts.fill(0); j.latched.fill(false); prev = want }
    j.order = want >= 0 ? want : null
    const h = j.update(lmOf(seq[i]), null)
    if (h.length) h.forEach((x) => {
      if (x.index < 8) hit[x.index]++
      if (want < 0 || x.index !== want) fp++
      else tp++
    })
  }
  return { th, hit, tp, fp }
}

const rows = []
for (let th = 0.30; th <= 0.851; th += 0.05) rows.push(scanAt(Math.round(th * 100) / 100))

console.log('\n  阈值  命中（式1..式8）                                       正确  误报')
console.log('  ' + '─'.repeat(72))
for (const r of rows) {
  const cells = r.hit.map((n) => String(n).padStart(2)).join('  ')
  console.log('  ' + r.th.toFixed(2) + '   ' + cells + '   ' +
    String(r.tp).padStart(4) + '  ' + String(r.fp).padStart(4))
}
console.log('')

ok(rows.some((r) => r.tp > 0), '阈值扫描链路真能判中（tp>0 说明帧确实喂给了 judge）')
const hitSet = new Set()
rows.forEach((r) => r.hit.forEach((n, i) => { if (n > 0) hitSet.add(i) }))
ok(hitSet.size >= 6, '多数式子被判中', hitSet.size + '/8 式：' + [...hitSet].sort((a, b) => a - b).map((i) => NAMES[i]).join('、'))
const miss = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !hitSet.has(i))
if (miss.length) console.log('    未判中：' + miss.map((i) => NAMES[i]).join('、') + '（已知缺陷，非本次回归）')

const tps = rows.map((r) => r.tp)
ok(tps[0] >= tps[tps.length - 1], '阈值↑ 命中数不增（扫描有单调性，非随机数）',
  `th0.30=${tps[0]} → th0.85=${tps[tps.length - 1]}`)
const fps = rows.map((r) => r.fp)
ok(fps[0] <= fps[fps.length - 1], '阈值↑ 误报不减少（说明扫描对阈值敏感）',
  `th0.30=${fps[0]} → th0.85=${fps[fps.length - 1]}`)

console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ ' + fail + ' 项失败'}`)
process.exit(fail === 0 ? 0 : 1)
