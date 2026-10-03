// 五禽戏 · 五式判定规则（华佗五禽戏标准）
//
// 【与八段锦的关系】
//   八段锦判定逻辑在 judge.js 内部（MOVES 数组），与拳种耦合。
//   五禽戏/太极将来式数会变（5 式、24 式…），故独立成一个「规则集」，
//   由 judge.js 按当前拳种选用。式名/文案仍走 moves.json / speech.js。
//
// 【设计】
//   每式规则 = (p, ctx) => 0~1 分，与八段锦同样的接口。
//   ctx 提供：torso/shoMid/hipMid/leanDeg/hasLegs/角/距离 等归一化工具。
//   复用 judge.js 里的 4/8、leanDeg、hasLegs，保证两套拳种口径一致。
//
// 【五式核心特征】（来自华佗五禽戏要领）
//   虎举：双手上举如虎爪，重在十指撑开 + 上举
//   鹿抵：腰部后弓，一腿后抬成鹿角，重在「后弓 + 单腿抬」
//   熊运：躯干画圆，重在「髋部绕环（时序）+ 重心左右移」
//   猿攀：猿手引体上攀，重在「双手高举过头 + 身体上提」
//   鸟飞：双手下按再上提后展翅，重在「双手开合 + 踮脚」

/**
 * @param {Array} p  MediaPipe landmarks（33 点）
 * @param {object} ctx 由 judge.js 注入的归一化工具集
 * @returns {number} 0~1
 */
export const WUQINXI_RULES = [
  // 1 虎举 —— 双手上举过头顶，十指张开如虎爪开合
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO)) return 0
    const t = c.torso(p)
    const sY = c.shoMid(p).y
    // 双腕都高于肩 0.8T 以上
    const both = c.okUp(Math.min((sY - v(p, c.L_WRI).y) / t, (sY - v(p, c.R_WRI).y) / t), 0.8, 1.6)
    // 双臂伸直
    const st = c.okUp(
      (c.angle(v(p, c.L_SHO), v(p, c.L_ELB), v(p, c.L_WRI)) +
       c.angle(v(p, c.R_SHO), v(p, c.R_ELB), v(p, c.R_WRI))) / 360, 0.8, 0.95)
    // 双腕分开（虎爪开）
    const apart = c.okUp(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 1.2, 2.2)
    return both * 0.42 + st * 0.28 + apart * 0.30
  },

  // 2 鹿抵 —— 后腿抬起成鹿角，躯干后弓
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_SHO, c.R_SHO, c.L_HIP, c.R_HIP)) return 0
    const t = c.torso(p)
    // 躯干后弓：肩在髋的「前方」（镜像后为负），用 lean 角 + 水平偏移判断
    const s = c.shoMid(p), h = c.hipMid(p)
    const back = c.okUp(Math.abs(s.x - h.x) / t, 0.25, 0.8)   // 前后偏移（俯身或后弓）
    // 双臂前伸：一腕明显越过同侧肩
    const fwdL = (v(p, c.L_WRI).x - v(p, c.L_SHO).x) / t
    const fwdR = (v(p, c.R_WRI).x - v(p, c.R_SHO).x) / t
    const reach = c.okUp(Math.max(Math.abs(fwdL), Math.abs(fwdR)), 0.5, 1.1)
    // 双臂在身前（y 高于肩）
    const up = c.okUp((s.y - Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y)) / t, 0.2, 0.8)
    return back * 0.34 + reach * 0.40 + up * 0.26
  },

  // 3 熊运 —— 躯干画圆，髋部左右绕环（时序动作）
  (p, c) => {
    if (!c.need(p, c.L_SHO, c.R_SHO, c.L_HIP, c.R_HIP)) return 0
    const t = c.torso(p)
    // 髋部横向摆动幅度（时序极差，由 judge 注入的 __sway 提供）
    const sway = c.okUp(p.__sway ?? 0, 0.10, 0.32)
    // 躯干保持略弯（熊的圆背）
    const lean = c.okUp(c.leanDeg(p), 8, 32)
    // 双膝微屈：膝踝距缩短
    const ka = Math.abs(v(p, c.L_KNE).y - v(p, c.L_ANK).y) / t
    const knee = c.okDown(ka, 0.9, 1.35)
    return sway * 0.44 + lean * 0.34 + knee * 0.22
  },

  // 4 猿攀 —— 猿手引体，双手高举过头
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO, c.L_HIP, c.R_HIP)) return 0
    const t = c.torso(p)
    const sY = c.shoMid(p).y
    const hY = c.hipMid(p).y
    // 双腕高举过头（肩上方 1.2T 以上）
    const high = c.okUp(Math.min((sY - v(p, c.L_WRI).y) / t, (sY - v(p, c.R_WRI).y) / t), 1.2, 2.0)
    // 双手贴近头顶（手间距小，猿手引体）
    const near = c.okDown(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 1.2, 0.4)
    // 肘弯曲（引体上攀时肘弯曲）
    const bend = c.okUp(
      1 - (c.angle(v(p, c.L_SHO), v(p, c.L_ELB), v(p, c.L_WRI)) +
           c.angle(v(p, c.R_SHO), v(p, c.R_ELB), v(p, c.R_WRI))) / 360, 0.25, 0.45)
    return high * 0.42 + near * 0.30 + bend * 0.28
  },

  // 5 鸟飞 —— 双手开合如翅 + 踮脚起立
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_SHO, c.R_SHO, c.L_ANK, c.R_ANK)) return 0
    const t = c.torso(p)
    // 双臂平展（腕与肩同高）
    const level = c.okUp(
      1 - Math.abs(v(p, c.L_WRI).y - v(p, c.L_SHO).y) / t, 0.0, 0.30) *
      c.okUp(
      1 - Math.abs(v(p, c.R_WRI).y - v(p, c.R_SHO).y) / t, 0.0, 0.30)
    // 双臂展开（腕间距大，展翅）
    const spread = c.okUp(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 1.5, 2.4)
    // 踮脚（踝膝距缩短）
    const ka = Math.abs(v(p, c.L_KNE).y - v(p, c.L_ANK).y) / t
    const rise = c.okDown(ka, 1.1, 1.5)
    return level * 0.36 + spread * 0.40 + rise * 0.24
  },
]

// 局部工具（规则内部用，避免每次都从 ctx 拿）
function v(p, i) { return p[i] || { x: 0.5, y: 0.5, z: 0, visibility: 0 } }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }

// ---------------------------------------------------------------- 太极（起势）
// 太极式数多（24 式），当前只落地「起势」作为第一式。
// 起势特征：两脚开立与肩同宽，两臂自然下垂，双手松沉 —— 看似「静」，但要判准得靠「站定 + 微沉」
export const TAIJI_RULES = [
  // 1 起势 —— 静桩：双臂下垂松沉、肩平、身正（以「站定」为达标）
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_SHO, c.R_SHO, c.L_ANK, c.R_ANK)) return 0
    const t = c.torso(p)
    // 躯干正（不前倾不后仰）
    const upright = c.okDown(c.leanDeg(p), 8, 26)
    // 肩平
    const shoLevel = c.okDown(Math.abs(v(p, c.L_SHO).y - v(p, c.R_SHO).y) / t, 0.14, 0.04)
    // 双臂自然下垂（腕在髋附近）
    const hY = c.hipMid(p).y
    const down = c.okUp(
      (Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y) - hY) / t, -0.2, 0.5)
    // 双脚开立与肩同宽
    const spread = c.okUp(dist(v(p, c.L_ANK), v(p, c.R_ANK)) / t, 0.8, 1.5)
    return upright * 0.32 + shoLevel * 0.24 + down * 0.26 + spread * 0.18
  },
]
