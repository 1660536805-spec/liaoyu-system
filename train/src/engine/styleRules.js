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
//   猿提：两手成猿钩上提至胸，重在「手提到胸肩前 + 屈肘收拢 + 提踵耸肩」
//   鸟飞：双手下按再上提后展翅，重在「双手开合 + 踮脚」

/**
 * @param {Array} p  MediaPipe landmarks（33 点）
 * @param {object} ctx 由 judge.js 注入的归一化工具集
 * @returns {number} 0~1
 */
// 【标定口径（2026-10-10 二次标定）】
//   ① 只依赖**上半身**（肩/肘/腕/躯干）—— 与八段锦同一哲学：近距离取景时膝/踝
//      visibility≈0.02，靠腿的判据在真机上不可用；且示范小人（demoAnim 的 11 个
//      标量角）本就画不出髋部平移，「靠腿」的分项在回放验收里恒为定值、无区分度。
//   ② 各式的**区分性证据**（回放验收 gates：自判 ≥0.55、跨式 <0.80）：
//      虎举 = 双腕高过肩 + 手距张开 + 肘伸直（"举"）
//      鹿抵 = 单腕明显越肩前伸 + 腕在肩上方 + 躯干前后偏移（"抵"）
//      熊运 = 肩中点横向画圆 + 躯干前倾 + 双手垂在肩线以下（"以腰为轴画圆"）
//      猿提 = 腕提到腹前~肩前的「带状」高度 + 双手收拢 + 屈肘（"提"，与虎举的"举"互斥）
//      鸟飞 = 腕与肩同高 + 手距张开 + 躯干上下起伏（"展翅 + 踮脚"）
export const WUQINXI_RULES = [
  // 1 虎举 —— 双手上举过头顶，十指张开如虎爪，肘基本伸直
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO)) return 0
    const t = c.torso(p)
    const sY = c.shoMid(p).y
    // 双腕都高于肩 0.75T 以上
    const both = c.okUp(Math.min((sY - v(p, c.L_WRI).y) / t, (sY - v(p, c.R_WRI).y) / t), 0.75, 1.5)
    // 双腕分开（虎爪开）
    const apart = c.okUp(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 1.0, 2.0)
    // 双臂伸直
    const st = c.okUp(
      (c.angle(v(p, c.L_SHO), v(p, c.L_ELB), v(p, c.L_WRI)) +
       c.angle(v(p, c.R_SHO), v(p, c.R_ELB), v(p, c.R_WRI))) / 360, 0.80, 0.93)
    return both * 0.46 + apart * 0.30 + st * 0.24
  },

  // 2 鹿抵 —— 双臂向前上方伸出（腕越肩），躯干偏移（前俯/后弓），微屈膝
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_SHO, c.R_SHO, c.L_HIP, c.R_HIP)) return 0
    const t = c.torso(p)
    const s = c.shoMid(p), h = c.hipMid(p)
    // 双臂前伸：一腕明显越过同侧肩（左右都算，取幅度大的那只）
    const fwdL = (v(p, c.L_WRI).x - v(p, c.L_SHO).x) / t
    const fwdR = (v(p, c.R_WRI).x - v(p, c.R_SHO).x) / t
    const reach = c.okUp(Math.max(Math.abs(fwdL), Math.abs(fwdR)), 0.45, 1.05)
    // 双手在肩线之上（向前上方伸）
    const up = c.okUp((s.y - Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y)) / t, 0.15, 0.70)
    // 躯干前后偏移（俯身或后弓 → 肩相对髋有水平位移）
    const back = c.okUp(Math.abs(s.x - h.x) / t, 0.20, 0.65)
    return reach * 0.42 + up * 0.34 + back * 0.24
  },

  // 3 熊运 —— 以腰为轴、上体画圆（肩中点横移）+ 躯干前倾 + 双手垂在肩线以下
  //    【信号说明】横移取「肩中点」而非髋：髋是画圆的圆心、基本不动。
  //    __shoSway 由 judge 注入（与 __sway 不同：__sway 髋可见时取髋，为式8 踮脚设计）。
  (p, c) => {
    if (!c.need(p, c.L_SHO, c.R_SHO, c.L_WRI, c.R_WRI)) return 0
    const t = c.torso(p)
    // 肩中点横向画圆幅度（时序极差）；同时兼容「腿不可见时 __sway 已退回肩」的情形
    const circle = Math.max(c.okUp(p.__shoSway ?? 0, 0.10, 0.32), c.okUp(p.__sway ?? 0, 0.10, 0.32))
    // 躯干略弯（熊的圆背）
    const lean = c.okUp(c.leanDeg(p), 6, 28)
    // 双手收在腹前（低于肩线）—— 把「鹿抵/虎举」这类抬手动作挡在外面
    const handsLow = c.okUp((Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y) - c.shoMid(p).y) / t, 0.05, 0.55)
    return circle * 0.40 + lean * 0.28 + handsLow * 0.32
  },

  // 4 猿提 —— 两手成猿钩上提至腹前~肩前，屈肘收拢
  //    【与虎举区分】虎举是「双腕高过肩 0.75T 以上」；猿提只提到胸腹前，
  //    故用「带状」评分：rel 落在 [−1.1, −0.5] 最像，高过 −0.1T 就归「举」。
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO)) return 0
    const t = c.torso(p)
    const rel = (c.shoMid(p).y - Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y)) / t   // 正 = 高于肩
    const band = c.okUp(rel, -1.10, -0.50) * c.okDown(rel, -0.10, 0.50)
    // 双手收拢成钩（手间距小）
    const near = c.okDown(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 0.75, 0.30)
    // 屈肘上提
    const bend = c.okUp(
      1 - (c.angle(v(p, c.L_SHO), v(p, c.L_ELB), v(p, c.L_WRI)) +
           c.angle(v(p, c.R_SHO), v(p, c.R_ELB), v(p, c.R_WRI))) / 360, 0.12, 0.40)
    return band * 0.40 + near * 0.26 + bend * 0.34
  },

  // 5 鸟飞 —— 双臂平展如翅 + 展开 + 躯干上下起伏（踮脚）
  //    踮脚信号用 __bob（躯干垂直起伏，与式8 同源）：示范小人的「提踵」是整体上浮，
  //    踝膝距不变，故不能用「踝膝距缩短」这种在合成小人和抖动真机都测不准的口径。
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_SHO, c.R_SHO)) return 0
    const t = c.torso(p)
    // 双臂平展（腕与肩同高）
    const level = c.okUp(1 - Math.abs(v(p, c.L_WRI).y - v(p, c.L_SHO).y) / t, 0.0, 0.30) *
      c.okUp(1 - Math.abs(v(p, c.R_WRI).y - v(p, c.R_SHO).y) / t, 0.0, 0.30)
    // 双臂展开（腕间距大，展翅）
    const spread = c.okUp(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 1.2, 2.1)
    // 踮脚起落（躯干垂直起伏）
    const rise = c.okUp(p.__bob ?? 0, 0.04, 0.16)
    return level * 0.34 + spread * 0.38 + rise * 0.28
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
