// 八段锦八式判定器 —— 纯函数，不依赖 Vue / DOM / MediaPipe
// 单测：node src/engine/judge.test.mjs
//
// 设计要点（对应交付文档 D2/D7）：
//  1. 归一化：以「肩宽」为尺度基准，判定与离摄像头远近无关
//  2. 互斥仲裁：每帧算 8 式分数，只允许「最高分且领先次名 ≥ MARGIN」的那式触发 → 防串扰
//  3. 时序特征：第 8 式「背后七颠」是踮脚动作，单帧姿态判不出，改用髋部起伏（bob）
//  4. 保持 N 帧 + 每式锁存：原地晃动不误触发、同式不重复响
//  5. 关键点 visibility 不足记 0 分：宁可不判，不误判
//
// MediaPipe Pose 索引：0鼻 2左眼 5右眼 11左肩 12右肩 13左肘 14右肘 15左腕 16右腕
//                     23左髋 24右髋 25左膝 26右膝 27左踝 28右踝

const LM = {
  NOSE: 0, L_EYE: 2, R_EYE: 5,
  L_SHO: 11, R_SHO: 12, L_ELB: 13, R_ELB: 14, L_WRI: 15, R_WRI: 16,
  L_HIP: 23, R_HIP: 24, L_KNE: 25, R_KNE: 26, L_ANK: 27, R_ANK: 28,
}

const v = (p, i) => p[i] || { x: 0.5, y: 0.5, z: 0, visibility: 0 }
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const torso = (p) => Math.max(1e-3, dist(v(p, LM.L_SHO), v(p, LM.R_SHO)))

// 越小越好 → 0~1（x ≤ lo 得 1，x ≥ hi 得 0；要求 lo < hi）
const ok = (x, lo, hi) => 1 - Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
// 越大越好 → 0~1
const okUp = (x, lo, hi) => Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
// 「x 越小越好」：x ≤ good 得 1，x ≥ bad 得 0（要求 good < bad）。
// 独立于 ok()，避免把 ok(lo>hi) 写成倒序而踩 Math.max(0,·) 的坑。
const okDown = (x, good, bad) => 1 - Math.min(1, Math.max(0, (x - good) / (bad - good)))

function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
  if (m < 1e-6) return 0
  const d = (v1.x * v2.x + v1.y * v2.y) / m
  return (Math.acos(Math.min(1, Math.max(-1, d))) * 180) / Math.PI
}

function need(p, ...idx) {
  for (const i of idx) {
    const pt = p[i]
    if (!pt || (pt.visibility ?? 1) < 0.5) return false
  }
  return true
}

const shoMid = (p) => mid(v(p, LM.L_SHO), v(p, LM.R_SHO))
const hipMid = (p) => mid(v(p, LM.L_HIP), v(p, LM.R_HIP))

// 躯干前倾角（度）：0° = 完全竖直，90° = 躯干水平
function leanDeg(p) {
  const s = shoMid(p), h = hipMid(p)
  return (Math.atan2(Math.abs(s.x - h.x), Math.abs(h.y - s.y)) * 180) / Math.PI
}
// 双腕的「上升量 / 肩宽」（正=高于肩）
const raiseL = (p) => (shoMid(p).y - v(p, LM.L_WRI).y) / torso(p)
const raiseR = (p) => (shoMid(p).y - v(p, LM.R_WRI).y) / torso(p)
// 手到同侧脚踝的距离 / 肩宽
const handToAnkleL = (p) => dist(v(p, LM.L_WRI), v(p, LM.L_ANK)) / torso(p)
const handToAnkleR = (p) => dist(v(p, LM.R_WRI), v(p, LM.R_ANK)) / torso(p)
const feetSpread = (p) => dist(v(p, LM.L_ANK), v(p, LM.R_ANK)) / torso(p)

// ---------------------------------------------------------------- 八式打分（各返回 0~1）
// 打分只依赖「本帧姿态 + 一段髋部历史」（第 8 式），历史由 update() 注入到 __bob
const MOVES = [
  // 1 双手托天理三焦 —— 双臂高举过顶
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_ELB, LM.R_ELB)) return 0
    const both = okUp(Math.min(raiseL(p), raiseR(p)), 0.6, 1.3)   // 较低那只腕也要高
    const avg = okUp((raiseL(p) + raiseR(p)) / 2, 0.8, 1.6)
    const st = okUp((angle(v(p, LM.L_SHO), v(p, LM.L_ELB), v(p, LM.L_WRI)) + angle(v(p, LM.R_SHO), v(p, LM.R_ELB), v(p, LM.R_WRI))) / 360, 0.78, 0.94)
    const apart = okUp(dist(v(p, LM.L_WRI), v(p, LM.R_WRI)) / torso(p), 1.2, 2.2)
    return both * 0.28 + avg * 0.26 + st * 0.24 + apart * 0.22
  },

  // 2 左右开弓似射雕 —— 一臂平举伸直 + 另一臂屈肘拉弦
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_ELB, LM.R_ELB)) return 0
    const t = torso(p)
    const wide = okUp(dist(v(p, LM.L_WRI), v(p, LM.R_WRI)) / t, 1.5, 2.4)
    const sY = shoMid(p).y
    const atShoulder = okUp(1 - Math.abs(Math.max(v(p, LM.L_WRI).y, v(p, LM.R_WRI).y) - sY) / t, 0, 0.45)
    const aL = angle(v(p, LM.L_SHO), v(p, LM.L_ELB), v(p, LM.L_WRI)) / 180
    const aR = angle(v(p, LM.R_SHO), v(p, LM.R_ELB), v(p, LM.R_WRI)) / 180
    const straightOne = okUp(Math.max(aL, aR), 0.80, 0.95)   // 至少一只手伸直（张开的那只）
    const bentOne = okUp(1 - Math.min(aL, aR), 0.35, 0.60)    // 至少一只手明显屈肘（拉弦）
    return wide * 0.30 + atShoulder * 0.22 + straightOne * 0.26 + bentOne * 0.22
  },

  // 3 调理脾胃须单举 —— 一手高举、一手下按
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_HIP, LM.R_HIP)) return 0
    const t = torso(p)
    const rl = raiseL(p), rr = raiseR(p)
    const hi = Math.max(rl, rr), lo = Math.min(rl, rr)
    if (hi < 0.8 || lo > 0.0) return 0                   // 举手要高、按手不能高于肩
    const gap = okUp(hi - lo, 1.4, 2.8)
    const upOk = okUp(hi, 0.8, 1.6)
    const lowOk = okUp(lo, 0.2, 0.9)                    // 按手接近腰髋
    return gap * 0.38 + upOk * 0.32 + lowOk * 0.30
  },

  // 4 五劳七伤往后瞧 —— 躯干保持竖直 + 头明显转向一侧
  (p) => {
    if (!need(p, LM.NOSE, LM.L_SHO, LM.R_SHO, LM.L_EYE, LM.R_EYE)) return 0
    const t = torso(p)
    const dev = Math.abs(v(p, LM.NOSE).x - shoMid(p).x) / t
    // 硬门槛：没明显转头直接 0（静立时鼻子偏移 <0.2 肩宽，判 0）
    if (dev < 0.22) return 0
    const turn = okUp(dev, 0.22, 0.52)
    const upright = okDown(leanDeg(p), 10, 28)     // 没弯腰 = 纯转头
    const shoTilt = okDown(Math.abs(v(p, LM.L_SHO).y - v(p, LM.R_SHO).y) / t, 0.06, 0.20)
    return turn * 0.46 + upright * 0.34 + shoTilt * 0.20
  },

  // 5 摇头摆尾去心火 —— 深俯身摆动（手不碰脚，与式6 区分）
  (p) => {
    if (!need(p, LM.L_SHO, LM.R_SHO, LM.L_HIP, LM.R_HIP, LM.L_WRI, LM.R_WRI, LM.L_ANK, LM.R_ANK, LM.L_KNE)) return 0
    const t = torso(p)
    // 摇头摆尾：躯干深俯 40~72°，且手离开脚（与式6 攀足的区分点，权重给足）
    const bend = okUp(leanDeg(p), 40, 72)
    const away = okUp(Math.min(handToAnkleL(p), handToAnkleR(p)), 0.85, 1.5)
    // 摆动时屈膝：膝踝距从站立 ~1.25 肩宽缩到 ~0.6~0.9
    const kneeAnkle = Math.abs(v(p, LM.L_KNE).y - v(p, LM.L_ANK).y) / t
    const kneeBend = okDown(kneeAnkle, 0.65, 1.20)
    return bend * 0.36 + away * 0.42 + kneeBend * 0.22
  },

  // 6 两手攀足固肾腰 —— 深前屈 + 手明确够到脚（硬门槛：够不到就 0 分）
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_ANK, LM.R_ANK, LM.L_SHO, LM.R_SHO, LM.L_HIP)) return 0
    const t = torso(p)
    const hand = Math.min(handToAnkleL(p), handToAnkleR(p))
    if (hand > 0.95) return 0                            // 手离脚太远 → 不是攀足
    const reach = okDown(hand, 0.30, 0.95)
    const bend = okUp(leanDeg(p), 30, 68)
    return reach * 0.55 + bend * 0.45
  },

  // 7 攒拳怒目增气力 —— 一拳明确前伸 + 另一手收在腰侧
  //    收紧点：拳必须「向前」(x 明显越过同侧肩) 且 拳肘伸直 + 另一手贴腰。
  //    三者同时成立才给高分，避免「一只手随便远一点」在静立时就误判。
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_ELB, LM.R_ELB, LM.L_HIP, LM.R_HIP)) return 0
    const t = torso(p)
    // 前伸量：(腕x - 同侧肩x) 归一化；出拳手应是「越过肩线」的那只
    const fwdL = (v(p, LM.L_WRI).x - v(p, LM.L_SHO).x) / t
    const fwdR = (v(p, LM.R_WRI).x - v(p, LM.R_SHO).x) / t
    const punchL = Math.abs(fwdL) >= Math.abs(fwdR) && fwdL < 0
    const punchR = !punchL && fwdR > 0
    if (!punchL && !punchR) return 0                     // 没有一只手明确向前 → 直接 0
    const SH = punchL ? LM.L_SHO : LM.R_SHO
    const EL = punchL ? LM.L_ELB : LM.R_ELB
    const WR = punchL ? LM.L_WRI : LM.R_WRI
    const OTHER = punchL ? LM.R_WRI : LM.L_WRI
    // 前伸距离要够（约 0.55~1.15 肩宽）
    const reach = okUp(Math.abs(punchL ? fwdL : fwdR), 0.55, 1.15)
    // 拳与肩同高（水平打出）
    const level = okUp(1 - Math.abs(v(p, WR).y - v(p, SH).y) / t, 0.0, 0.35)
    // 拳肘伸直
    const straight = okUp(angle(v(p, SH), v(p, EL), v(p, WR)) / 180, 0.82, 0.95)
    // 攒拳时双手一高一低（拳在肩线、另一手在腰）；开弓时双手都在肩线附近。
    // 这条把「开弓」挡在外面，避免式2 被式7 压过。
    const handSplit = okUp(Math.abs(v(p, WR).y - v(p, OTHER).y) / t, 0.35, 0.75)
    // 另一手必须收在腰侧：既是得分项，也是硬门槛（拉开弓时另一手在胸前/肩高，会被判 0）
    const waistDist = Math.abs(v(p, OTHER).y - hipMid(p).y) / t
    const atWaist = 1 - Math.min(1, waistDist / 0.28)      // 距腰 0 得 1，超过 0.28 肩宽得 0
    if (atWaist < 0.45) return 0
    return reach * 0.28 + level * 0.22 + straight * 0.22 + atWaist * 0.18 + handSplit * 0.10
  },

  // 8 背后七颠百病消 —— 双脚并拢 + 踮脚起落（时序：髋部起伏）
  (p) => {
    if (!need(p, LM.L_ANK, LM.R_ANK, LM.L_KNE, LM.R_KNE, LM.L_HIP, LM.R_HIP, LM.L_SHO, LM.R_SHO)) return 0
    const together = okUp(1 - feetSpread(p) / 0.55, 0.15, 0.95)
    const upright = okDown(leanDeg(p), 12, 30)
    // 髋部起伏：门槛下调到 0.05~0.22，踮脚幅度约 0.25~0.4 肩宽
    const bob = okUp(p.__bob ?? 0, 0.05, 0.22)
    return together * 0.32 + upright * 0.24 + bob * 0.44
  },
]

const NAMES = [
  '双手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
  '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消',
]

export const THRESHOLD = 0.55
export const MARGIN = 0.10
const BOB_WINDOW = 45 // 帧，约 1.5s @30fps

// 判定状态机：保持 N 帧 + 互斥仲裁 + 每式锁存
export class MoveJudge {
  /**
   * @param {number} holdFrames 需连续保持的帧数（默认 12，约 0.4s@30fps）
   * @param {number} threshold  触发阈值（默认 0.55）
   * @param {number} margin     互斥仲裁所需的领先幅度（默认 0.10）
   * @param {number|null} order 非 null 时为「顺序模式」：只判定 order 指定的那一式
   *                             （八段锦是顺序练的，这是产品主用模式，可彻底消除串扰）
   */
  constructor({ holdFrames = 12, threshold = THRESHOLD, margin = MARGIN, order = null } = {}) {
    this.holdFrames = holdFrames
    this.threshold = threshold
    this.margin = margin
    this.order = order
    this.reset()
  }

  reset() {
    this.counts = new Array(8).fill(0)
    this.latched = new Array(8).fill(false)
    this.hipHist = []
    this.lastScores = new Array(8).fill(0)
  }

  // 只算分，不触发（UI 显示实时强度用）
  scores(p) {
    if (!p || p.length < 29) return new Array(8).fill(0)
    return MOVES.map((fn) => fn(this._withBob(p)))
  }

  _withBob(p) {
    if (p.__bob !== undefined) return p
    const t = torso(p)
    const h = hipMid(p).y
    this.hipHist.push(h)
    if (this.hipHist.length > BOB_WINDOW) this.hipHist.shift()
    const range = this.hipHist.length > 8
      ? Math.max(...this.hipHist) - Math.min(...this.hipHist)
      : 0
    try { p.__bob = range / t } catch { /* frozen */ }
    return p
  }

  /**
   * @param {PoseLandmark[]|null} p
   * @returns {{index:number,name:string,score:number}[]} 本帧命中的式
   */
  update(p) {
    if (!p || p.length < 29) return []
    const sc = MOVES.map((fn) => fn(this._withBob(p)))
    this.lastScores = sc

    let best, second
    if (this.order !== null) {
      // 顺序模式：只看当前式，不做仲裁
      best = this.order
      second = Math.max(...sc.filter((_, i) => i !== best))
    } else {
      // 自由模式：最高分 + 领先幅度仲裁
      best = 0
      for (let i = 1; i < 8; i++) if (sc[i] > sc[best]) best = i
      second = 0
      for (let i = 0; i < 8; i++) if (i !== best && sc[i] > second) second = sc[i]
    }
    const lead = sc[best] - second
    const okBest = sc[best] >= this.threshold && (this.order !== null || lead >= this.margin)

    const hit = []
    for (let i = 0; i < 8; i++) {
      if (okBest && i === best) {
        this.counts[i]++
        if (this.counts[i] >= this.holdFrames && !this.latched[i]) {
          this.latched[i] = true                 // 锁存：同式不再重复响
          hit.push({ index: i, name: NAMES[i], score: sc[i] })
        }
      } else {
        this.counts[i] = 0
      }
    }
    return hit
  }
}

export { MOVES, NAMES, LM, angle, dist, torso, leanDeg, THRESHOLD as DEFAULT_THRESHOLD }
