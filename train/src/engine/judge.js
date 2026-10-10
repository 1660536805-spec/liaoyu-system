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

import { WUQINXI_RULES, TAIJI_RULES } from './styleRules.js'

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

// 关键点可见性门槛：任一依赖点 visibility 低则该式记 0 分（宁可不判，不误判）。
// 阈值 0.35 而非 0.5：真机实测（2026-10-02，USB 摄像头）右手腕在
// 「手上有深色物体 / 运动模糊」时 MediaPipe 只给 0.47，0.5 门槛会把
// 真实动作整式拦掉（实测导致 7/8 式全判 0）。0.35 仍足以挡住真正出画的点（实测 <0.05）。
const VIS_MIN = 0.35

// ---- 半身模式（近距离取景）下的髋部门槛 ----
// 【为什么要单独放宽髋】
//   近距离（1~1.5m）时全身装不下，髋常贴在画面边缘或被遮挡 → visibility 掉到
//   0.2~0.35 之间。髋在躯干上、人体先验强，此时 MediaPipe 给的**坐标仍可信**；
//   但膝/踝是肢体末端，出画后返回的是 y>1 的瞎猜坐标（实测 visibility≈0.02），
//   所以膝踝门槛一律不放宽 —— 只放宽髋，且只到 0.15。
// 【触发方式】TrainView 的免标定取景伺服逐帧把 landmarks.__half 置位：
//   true = 当前画面装不下全身（半身取景）→ 髋门槛降到 0.15；其余情况完全同旧逻辑。
const HIP_VIS_HALF = 0.15
const hipGate = (p) => (p && p.__half ? HIP_VIS_HALF : VIS_MIN)

function need(p, ...idx) {
  for (const i of idx) {
    const pt = p[i]
    // 髋用可降级的门槛；其它关键点仍用 VIS_MIN
    const gate = (i === LM.L_HIP || i === LM.R_HIP) ? hipGate(p) : VIS_MIN
    if (!pt || (pt.visibility ?? 1) < gate) return false
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

// 下肢是否可靠可见。
// 真机实测（2026-10-02，USB 摄像头近距离取景）：膝 visibility ≈0.04、踝 ≈0.02，
// 但 MediaPipe 仍会返回 y>1 的「猜测坐标」。若直接拿来算距离会得到
// 「手到脚踝距离 = 负值类异常」从而误判。故凡依赖下肢的式子都要先过这一关。
const LEG_VIS = 0.35
const hasLegs = (p) =>
  (v(p, LM.L_KNE).visibility ?? 0) >= LEG_VIS && (v(p, LM.R_KNE).visibility ?? 0) >= LEG_VIS &&
  (v(p, LM.L_ANK).visibility ?? 0) >= LEG_VIS && (v(p, LM.R_ANK).visibility ?? 0) >= LEG_VIS

// ---------------------------------------------------------------- 规则上下文
// 八段锦用内置的 MOVES；五禽戏/太极用 styleRules.js 的规则集。
// 两者接口一致：ctx 提供归一化工具，规则只管打分。
const RULE_SETS = {
  baduanjin: null,          // null = 用内置 MOVES
  wuqinxi: WUQINXI_RULES,
  taiji: TAIJI_RULES,
}

/** 组装规则所需的归一化工具集。索引统一从 LM 取，供外部规则使用。 */
function makeCtx() {
  return {
    // 关键点索引（styleRules.js 里的规则用 c.L_WRI 等访问）
    NOSE: LM.NOSE, L_EYE: LM.L_EYE, R_EYE: LM.R_EYE,
    L_SHO: LM.L_SHO, R_SHO: LM.R_SHO, L_ELB: LM.L_ELB, R_ELB: LM.R_ELB,
    L_WRI: LM.L_WRI, R_WRI: LM.R_WRI,
    L_HIP: LM.L_HIP, R_HIP: LM.R_HIP,
    L_KNE: LM.L_KNE, R_KNE: LM.R_KNE,
    L_ANK: LM.L_ANK, R_ANK: LM.R_ANK,
    // 归一化工具
    need, angle, dist, torso, shoMid, hipMid, leanDeg, hasLegs, okUp, okDown, v,
  }
}

// ---------------------------------------------------------------- 八式打分（各返回 0~1）
// 打分只依赖「本帧姿态 + 一段髋部历史」（第 8 式），历史由 update() 注入到 __bob
const MOVES = [
  // 1 双手托天理三焦 —— 双臂高举过顶
  //    区间按真人比例标定（单位=肩宽 T）：手举过头顶时腕约在肩线上方 1.8~2.2T，
  //    双腕分开约 1.5~2.0T，肘接近伸直。低于 1.0T 只是抬手，不算托天。
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_ELB, LM.R_ELB)) return 0
    const both = okUp(Math.min(raiseL(p), raiseR(p)), 1.0, 1.9)   // 较低那只腕也要高过头
    const avg = okUp((raiseL(p) + raiseR(p)) / 2, 1.2, 2.2)
    const st = okUp((angle(v(p, LM.L_SHO), v(p, LM.L_ELB), v(p, LM.L_WRI)) + angle(v(p, LM.R_SHO), v(p, LM.R_ELB), v(p, LM.R_WRI))) / 360, 0.78, 0.94)
    const apart = okUp(dist(v(p, LM.L_WRI), v(p, LM.R_WRI)) / torso(p), 1.3, 2.4)
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
  //    注意：raise 为负表示手在肩线以下（按手），故「按得够低」要用 lowDrop = -lo，
  //    早前误写成 okUp(lo, …) 导致按手永远得 0 分（真机基底测试实测踩过）。
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_HIP, LM.R_HIP)) return 0
    const rl = raiseL(p), rr = raiseR(p)
    const hi = Math.max(rl, rr), lo = Math.min(rl, rr)
    if (hi < 1.2 || lo > -0.1) return 0                   // 举手要高过头顶，按手要低于肩线
    const gap = okUp(hi - lo, 2.0, 3.4)
    const upOk = okUp(hi, 1.2, 2.2)
    const lowOk = okUp(-lo, 0.4, 1.3)                    // 按手下探深度（正值越大越低）
    return gap * 0.34 + upOk * 0.36 + lowOk * 0.30
  },

  // 4 五劳七伤往后瞧 —— 躯干保持竖直 + 头明显转向一侧
  //    【真机实测驱动】俯身动作（式5/6）时鼻子也会大幅偏移，若只按偏移判会误触发。
  //    故加硬门槛：躯干必须站直（lean<28°），俯身一律判 0。
  (p) => {
    if (!need(p, LM.NOSE, LM.L_SHO, LM.R_SHO, LM.L_EYE, LM.R_EYE)) return 0
    const t = torso(p)
    const lean = leanDeg(p)
    if (lean > 28) return 0                               // 硬门槛：躯干不直 → 不是转头
    const dev = Math.abs(v(p, LM.NOSE).x - shoMid(p).x) / t
    if (dev < 0.22) return 0                             // 硬门槛：没明显转头 → 判 0
    const turn = okUp(dev, 0.22, 0.52)
    const upright = okDown(lean, 10, 28)                 // 站得越直越好
    const shoTilt = okDown(Math.abs(v(p, LM.L_SHO).y - v(p, LM.R_SHO).y) / t, 0.06, 0.20)
    return turn * 0.46 + upright * 0.34 + shoTilt * 0.20
  },

  // 5 摇头摆尾去心火 —— 俯身 + 左右摆动
  //    【真机实测驱动】近距离取景时膝/踝 visibility≈0.02，但肩/肘/腕≈1.0。
  //    故判定改用纯上半身信号：
  //      ① 躯干前倾角（肩-髋向量，髋 vis 0.9 仍可用）
  //      ② 双手「左右横摆」幅度（摇头摆尾的核心特征：手随身体左右摆）
  //      ③ 双肩「左右倾斜」（摆动时肩线一高一低）
  //    硬门槛：手必须明显下探（区别于站立），摆动才给高分。
  (p) => {
    if (!need(p, LM.L_SHO, LM.R_SHO, LM.L_HIP, LM.R_HIP, LM.L_WRI, LM.R_WRI)) return 0
    const t = torso(p)
    const sY = shoMid(p).y
    const bend = okUp(leanDeg(p), 35, 70)                       // 俯身
    const dropRaw = (Math.min(v(p, LM.L_WRI).y, v(p, LM.R_WRI).y) - sY) / t
    if (dropRaw < 1.9) return 0                                 // 硬门槛：手没下探 → 判 0
    // 与式6「攀足」区分：摇头摆尾必须真的在左右摆动手。
    // 硬门槛 1：时序窗口未就绪 → 判 0（否则静止的攀足会被当成摆动的摇头摆尾）
    // 硬门槛 2：双手中点横摆幅度 <0.18 肩宽 → 判 0（那是定点下探的攀足）
    if (p.__ready === false) return 0
    const swing = p.__handSwing ?? 0
    if (swing < 0.18) return 0
    const drop = okUp(dropRaw, 1.9, 3.0)
    const handSwing = okUp(swing, 0.18, 0.80)                   // 双手横摆幅度（主信号）
    // 躯干整体左右摆（肩中点横移）。不要用「肩线一高一低」——实测摇头摆尾时
    // 两肩基本同向平移，倾斜量仅 0.04 肩宽，恒不达标（踩过，见 §A 调试记录）。
    const bodySway = okUp(p.__sway ?? 0, 0.08, 0.34)
    if (hasLegs(p)) {
      const away = okUp(Math.min(handToAnkleL(p), handToAnkleR(p)), 0.85, 1.5)
      return bend * 0.30 + handSwing * 0.38 + bodySway * 0.18 + away * 0.14
    }
    return bend * 0.32 + handSwing * 0.42 + bodySway * 0.26
  },

  // 6 两手攀足固肾腰 —— 深前屈 + 双手够到最下
  //    【真机实测驱动】踝几乎不可见，改用「双手对称地探到躯干最低处」判定：
  //      ① 躯干前倾角
  //      ② 双手下探深度（越低越好）
  //      ③ 双手高度接近（攀足是双手一起下去；摇头摆尾是手交替摆动，高低不一）
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_HIP, LM.R_HIP)) return 0
    const t = torso(p)
    const sY = shoMid(p).y
    const bend = okUp(leanDeg(p), 30, 70)
    const dropL = (v(p, LM.L_WRI).y - sY) / t
    const dropR = (v(p, LM.R_WRI).y - sY) / t
    const minDrop = Math.min(dropL, dropR)
    if (minDrop < 2.1) return 0                                // 硬门槛：手没探到最低 → 判 0
    // 与式5「摇头摆尾」区分：攀足是双手定点下探（几乎不横摆），摇头摆尾是手大幅左右摆。
    // 硬门槛 1：时序窗口未就绪 → 判 0（同式5，避免互斥失效）
    // 硬门槛 2：手横摆幅度 >0.16 肩宽 → 判 0（那是式5，不是攀足）
    if (p.__ready === false) return 0
    const swing = p.__handSwing ?? 0
    // 0.26 而非 0.16：真机上做攀足时手也有微抖（§B 组 0.014 幅度噪声下
    // 双手中点仍会漂 0.2+ 肩宽），门槛太紧会导致真实攀足永远判不出来。
    if (swing > 0.26) return 0
    const still = okDown(swing, 0.08, 0.26)
    const reach = okUp(minDrop, 2.1, 3.4)
    // 双手高度一致（都探到底）
    const sync = okDown(Math.abs(dropL - dropR), 0.10, 0.75)
    if (hasLegs(p)) {
      const hand = Math.min(handToAnkleL(p), handToAnkleR(p))
      if (hand > 0.95) return 0
      return okDown(hand, 0.30, 0.95) * 0.30 + reach * 0.26 + sync * 0.20 + bend * 0.16 + still * 0.08
    }
    return reach * 0.34 + sync * 0.30 + bend * 0.24 + still * 0.12
  },

  // 7 攒拳怒目增气力 —— 一拳明确前伸 + 另一手收腰侧
  //    【真机实测驱动】原先硬编码「fwdL < 0」，即假设画面里左肩一定在左。
  //    实测 8797 帧发现 95.6% 的帧「左肩 x > 右肩」（画面被水平镜像，
  //    采集器未做 scaleX(-1) 而页面做了），硬编码会导致式7 在镜像下判定失效。
  //    现改为：从双肩实际位置推断「出拳方向」，与镜像/朝向无关。
  (p) => {
    if (!need(p, LM.L_WRI, LM.R_WRI, LM.L_SHO, LM.R_SHO, LM.L_ELB, LM.R_ELB, LM.L_HIP, LM.R_HIP)) return 0
    const t = torso(p)
    // 前伸量：腕相对同侧肩的 x 偏移（带符号）
    const fwdL = (v(p, LM.L_WRI).x - v(p, LM.L_SHO).x) / t
    const fwdR = (v(p, LM.R_WRI).x - v(p, LM.R_SHO).x) / t
    // 出拳方向：从双肩位置推断 —— 左肩在画面左（fwd 为负）还是右（fwd 为正）
    const L = v(p, LM.L_SHO), R = v(p, LM.R_SHO)
    const leftOnScreen = L.x < R.x
    // 出拳手 = 「更向外伸」的那只，即 fwd 与「出拳方向」同号
    const outward = leftOnScreen ? -1 : 1
    const scoreL = fwdL * outward
    const scoreR = fwdR * outward
    const punchL = scoreL >= scoreR && scoreL > 0.2
    const punchR = !punchL && scoreR > 0.2
    if (!punchL && !punchR) return 0                     // 没有一只手明确向前 → 直接 0
    const SH = punchL ? LM.L_SHO : LM.R_SHO
    const EL = punchL ? LM.L_ELB : LM.R_ELB
    const WR = punchL ? LM.L_WRI : LM.R_WRI
    const OTHER = punchL ? LM.R_WRI : LM.L_WRI
    // 前伸距离要够（约 0.55~1.15 肩宽）
    const reach = okUp(Math.max(scoreL, scoreR), 0.55, 1.15)
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

  // 8 背后七颠百病消 —— 踮脚起落，时序动作
  //    【真机实测驱动】踝 vis≈0.02 靠不住；改用「躯干中点垂直起伏」——
  //    踮脚时整个人上下动，肩中点同样上下动（肩 vis≈1.0，最稳）。
  //    髋可见时用髋（更直接），不可见时自动退回肩。
  (p) => {
    if (!need(p, LM.L_SHO, LM.R_SHO, LM.L_HIP, LM.R_HIP, LM.L_WRI, LM.R_WRI)) return 0
    const t = torso(p)
    const upright = okDown(leanDeg(p), 12, 30)     // 踮脚时躯干保持竖直
    if (p.__ready === false) return 0              // 时序窗口未就绪 → 判 0
    const bob = okUp(p.__bob ?? 0, 0.05, 0.20)      // 垂直起伏 / 肩宽
    if (bob < 0.02) return 0                        // 硬门槛：没起伏 → 判 0
    if (hasLegs(p)) {
      const together = okUp(1 - feetSpread(p) / 0.55, 0.15, 0.95)
      return together * 0.30 + upright * 0.24 + bob * 0.46
    }
    // 降级：看不到脚，用「双手垂于体侧」+ 躯干规律起伏当踮脚信号
    const armsDown = okDown((Math.min(v(p, LM.L_WRI).y, v(p, LM.R_WRI).y) - shoMid(p).y) / t, 0.5, 1.8)
    return armsDown * 0.26 + upright * 0.28 + bob * 0.46
  },
]

const NAMES = [
  '双手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
  '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消',
]

export const THRESHOLD = 0.55
export const MARGIN = 0.10
const BOB_WINDOW = 45  // 帧，约 1.5s @30fps
const MIN_WINDOW = 12  // 少于此帧数视为「时序信号未就绪」，相关式子一律判 0

// 判定状态机：保持 N 帧 + 互斥仲裁 + 每式锁存
export class MoveJudge {
  /**
   * @param {number} holdFrames 需连续保持的帧数（默认 12，约 0.4s@30fps）
   * @param {number} threshold  触发阈值（默认 0.55）
   * @param {number} margin     互斥仲裁所需的领先幅度（默认 0.10）
   * @param {number|null} order 非 null 时为「顺序模式」：只判定 order 指定的那一式
   *                             （八段锦是顺序练的，这是产品主用模式，可彻底消除串扰）
   */
  constructor({
    holdFrames = 12, threshold = THRESHOLD, margin = MARGIN, order = null,
    /** 期望的头部 yaw（度，绝对值）。null 表示该式不要求头部角度。
     *  太极/五禽戏里「转头」「转身」常是动作本身的一部分，故判定应看
     *  「有没有转到要求的角度」，而不是「是否正对镜头」。 */
    headYaw = null,
    headYawTol = 18,
    style = 'baduanjin',
    count = 8,
    /** 该拳种的式名（长度应与 count 一致）。
     *  八段锦沿用内置 NAMES；五禽戏/太极由调用方传 style.moves.map(m => m.name)。
     *  不传时退回 NAMES —— 保证老调用点（测试）行为不变。 */
    names = null,
  } = {}) {
    this.holdFrames = holdFrames
    this.threshold = threshold
    this.margin = margin
    this.order = order
    this.headYaw = headYaw
    this.headYawTol = headYawTol
    this.style = style
    this.count = count                    // 该拳种的式数
    this.names = Array.isArray(names) && names.length ? names : NAMES
    this.reset()
  }

  /** 当前拳种对应的规则集（数组，元素为 (p, ctx) => 0~1） */
  get rules() {
    const custom = RULE_SETS[this.style]
    return Array.isArray(custom) ? custom : MOVES
  }

  reset() {
    this.counts = new Array(this.count).fill(0)
    this.latched = new Array(this.count).fill(false)
    this.headHit = false
    this.headErr = null
    this.hipHist = []
    this.xHist = []
    this.shoXHist = []
    this.wriXHist = []
    this.wriGapHist = []
    this.lastScores = new Array(this.count).fill(0)
  }

  // 只算分，不触发（UI 显示实时强度用）
  scores(p) {
    if (!p || p.length < 29) return new Array(this.count).fill(0)
    return this.rules.map((fn) => fn(this._withBob(p), makeCtx()))
  }

  _withBob(p) {
    if (p.__bob !== undefined) return p
    const t = torso(p)
    // 起伏源：髋可见用髋，否则退回肩（肩 visibility 常年 0.99，最可靠）
    // 半身模式下髋即使贴边也可用（坐标仍可信），故用可降级的髋门槛而非固定 LEG_VIS
    const useHip = (v(p, LM.L_HIP).visibility ?? 0) >= hipGate(p) && (v(p, LM.R_HIP).visibility ?? 0) >= hipGate(p)
    const src = useHip ? hipMid(p) : shoMid(p)
    this.hipHist.push(src.y)
    this.xHist.push(src.x)
    // 肩中点横移：五禽戏「熊运」是「以腰为轴、上体画圆」，画的是**肩**的圆，
    // 髋基本是圆心不动；而 xHist 走的是「髋可见就用髋」的口径（为式8 踮脚设计），
    // 拿不到肩的圆。故单独记一条肩中点序列（不影响八段锦任何规则）。
    this.shoXHist.push(shoMid(p).x)
    // 双手横摆：摇头摆尾的核心信号（两手交替左右摆动 → 腕中点持续横移）
    this.wriXHist.push((v(p, LM.L_WRI).x + v(p, LM.R_WRI).x) / 2)
    this.wriGapHist.push(Math.abs(v(p, LM.L_WRI).x - v(p, LM.R_WRI).x) / t)
    if (this.hipHist.length > BOB_WINDOW) {
      this.hipHist.shift(); this.xHist.shift(); this.shoXHist.shift()
      this.wriXHist.shift(); this.wriGapHist.shift()
    }
    const enough = this.hipHist.length > MIN_WINDOW
    const rng = (a) => (enough ? Math.max(...a) - Math.min(...a) : 0)
    try {
      // 窗口未满时全部记 0，并置 __ready=false。
      // 关键：式5/6 靠 __handSwing 互斥，若未满就当 0，会让「静止的攀足」被
      // 误判成「摆动的摇头摆尾」（窗口未满 → 式6 的 still 门槛失效）。故显式标记。
      p.__ready = enough
      p.__bob = enough ? rng(this.hipHist) / t : 0     // 躯干垂直起伏（踮脚，式8）
      p.__sway = enough ? rng(this.xHist) / t : 0      // 躯干横摆（式5 辅助；髋可见时即髋）
      p.__shoSway = enough ? rng(this.shoXHist) / t : 0 // 肩中点横摆（五禽戏「熊运」画圆的信号）
      p.__handSwing = enough ? rng(this.wriXHist) / t : 0  // 双手中点横摆（式5 主信号）
      p.__handGap = enough ? rng(this.wriGapHist) : 0   // 双手间距变化（式5 辅助）
      p.__bobSrc = useHip ? 'hip' : 'shoulder'
    } catch { /* frozen */ }
    return p
  }

  /**
   * @param {PoseLandmark[]|null} p
   * @returns {{index:number,name:string,score:number}[]} 本帧命中的式
   */
  update(p, headYawDeg = null) {
    if (!p || p.length < 29) return []
    const sc = this.rules.map((fn) => fn(this._withBob(p), makeCtx()))
    this.lastScores = sc

    // 头部角度判据：若该式要求转头到位，且 3D yaw 不可用，则整式判 0
    if (this.headYaw !== null) {
      if (headYawDeg === null || headYawDeg === undefined) {
        this.headHit = false
        this.headErr = '无 3D 数据，无法判头部角度'
        sc.fill(0)
      } else {
        const a = Math.abs(headYawDeg)
        const want = Math.abs(this.headYaw)
        this.headErr = Math.abs(a - want).toFixed(0) + '° / 需要 ' + want + '°'
        this.headHit = Math.abs(a - want) <= this.headYawTol
        if (!this.headHit) sc.fill(0)     // 头没转到要求角度 → 本式不成立
      }
    }

    let best, second
    if (this.order !== null) {
      // 顺序模式：只看当前式，不做仲裁
      best = this.order
      second = Math.max(...sc.filter((_, i) => i !== best))
    } else {
      // 自由模式：最高分 + 领先幅度仲裁
      best = 0
      for (let i = 1; i < this.count; i++) if (sc[i] > sc[best]) best = i
      second = 0
      for (let i = 0; i < this.count; i++) if (i !== best && sc[i] > second) second = sc[i]
    }
    const lead = sc[best] - second
    const okBest = sc[best] >= this.threshold && (this.order !== null || lead >= this.margin)

    const hit = []
    for (let i = 0; i < this.count; i++) {
      if (okBest && i === best) {
        this.counts[i]++
        if (this.counts[i] >= this.holdFrames && !this.latched[i]) {
          this.latched[i] = true                 // 锁存：同式不再重复响
          hit.push({ index: i, name: this.names[i] ?? NAMES[i], score: sc[i] })
        }
      } else {
        this.counts[i] = 0
      }
    }
    return hit
  }
}

export { MOVES, NAMES, LM, angle, dist, torso, leanDeg, THRESHOLD as DEFAULT_THRESHOLD }
