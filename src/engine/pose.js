// 姿态分析 —— 头部朝向与身体朝向
//
// 【为什么不能用 2D 判朝向】
// 2D 归一化坐标是投影，背对镜头时左右会镜像，投影形状与正对几乎一样，
// 只有 z 轴（深度）能区分前后。所以必须用 worldLandmarks（3D 米制坐标）。
//
// 【MediaPipe 头部 11 点】
//   0 鼻 / 1-3 左眼(内中外) / 4-6 右眼(内中外) / 7 左耳 / 8 右耳 / 9 左口 / 10 右口
// 原先只用「鼻 + 双眼」判转头，有两个实测问题：
//   ① 鼻子只有一个，正侧面转 90° 时鼻子投影不动，完全测不出
//   ② 分不清「头在转」还是「身体在转」
// 补上双耳与双口后：
//   · 双耳间距 / 头宽 → 侧面程度（转 90° 时两耳前后重叠，投影耳距最小）
//   · 鼻相对双耳中点的横向偏移 → 头部 yaw
//   · 鼻相对双耳中点的 z 偏移 → 头部是否正对（背对时鼻子在后）
//
// 【坐标约定】
//   screen：归一化 2D，x/y ∈ [0,1]，原点在画面左上
//   world：3D 米制，原点在髋中心，+x 向人的左侧，+y 向上，+z 向后（MediaPipe 约定）

const HP = { NOSE: 0, L_EYE_IN: 1, L_EYE: 2, L_EYE_OUT: 3, R_EYE_IN: 4, R_EYE: 5, R_EYE_OUT: 6, L_EAR: 7, R_EAR: 8, L_MOUTH: 9, R_MOUTH: 10 }
const SH = { L_SHO: 11, R_SHO: 12, L_HIP: 23, R_HIP: 24, L_ANK: 27, R_ANK: 28 }

const v3 = (p, i) => (p && p[i] ? p[i] : null)
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const mid2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const mid3 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 })

/** 角度（度）：向量 a-b 与 c-b 的夹角 */
function angleBetween(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
  if (m < 1e-6) return 0
  const d = (v1.x * v2.x + v1.y * v2.y) / m
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI
}

/** 3D 空间两向量夹角（度） */
function angle3(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const m = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z)
  if (m < 1e-6) return 0
  const d = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / m
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI
}

// 【真机实测标定 2026-10-02，415 帧 / 25 秒】
// 判别力对比（平稳段 vs 转身段，中位差 / 平稳段 σ）：
//   earYaw      差异/σ = 2.97  ★ 头部 yaw 最好用
//   noseEarZ    差异/σ = 5.78  ★ 鼻-耳深度差最灵敏
//   shoYaw      差异/σ = 0.82  ○ 身体 yaw 噪声大
//   shoSpan     NaN            ✗ 肩 3D 距几乎不变，判别不出
// 结论：判「转身」主要靠头部，不是躯干 —— 与用户直觉一致。
// 实测值：正对 earYaw 中位 3.8°、转身 25.3°；正对 noseEarZ −0.107、转身 −0.056
const HEAD_W = 0.140
const HEAD_SIDE_3D = 0.125     // 双耳 3D 距离低于此值 → 侧对
const SHO_W = 0.320
const SHO_SIDE_3D = 0.285      // 双肩 3D 距离低于此值 → 侧对
// 鼻-耳 z 差阈值（实测标定）
const NOSE_EAR_Z_FRONT = -0.085 // 高于此值（绝对值变小）→ 偏离正对
const NOSE_EAR_Z_BACK = -0.030  // 低于此值（趋近 0 或为正）→ 背对
// 头部 yaw 阈值（实测标定）
const YAW_SIDE = 15            // |earYaw| > 15° → 头侧转
const YAW_TURN = 12            // |earYaw| > 12° 视为偏离正对（比 YAW_SIDE 略松，用于 early warning）

/**
 * 计算 yaw（水平转角，度）—— 绕 y 轴
 * 物体朝向向量 (dx, dz)；返回 -180~180，0 表示鼻指向 -z（面向镜头）
 */
function yawOf(dx, dz) {
  // 用 atan2(dx, -dz)：正对时鼻在 -z 侧（MediaPipe +z 向后）
  let a = (Math.atan2(dx, -dz) * 180) / Math.PI
  if (a > 180) a -= 360
  if (a < -180) a += 360
  return a
}

/**
 * 头部姿态分析
 * @param {Array} screen MediaPipe 2D landmarks（判定器在用）
 * @param {Array} world  MediaPipe 3D landmarks（可空 → 降级到 2D 估计）
 * @returns 头部姿态信息
 */
export function headPose(screen, world) {
  const out = {
    available: false,
    yawDeg: 0,          // 头部左右转角（正对=0，左转+，右转−）
    pitchDeg: 0,        // 抬头/低头
    rollDeg: 0,         // 头部左右倾
    sideRatio: 0,       // 侧面程度 0~1（0=正对，1=正侧面 90°）
    facing: 'front',    // front | side | back
    confidence: 0,      // 依据的点数
    source: 'none',     // world | screen
  }

  const noseS = v3(screen, HP.NOSE)
  const earLS = v3(screen, HP.L_EAR)
  const earRS = v3(screen, HP.R_EAR)
  let pts = 0
  if (noseS) pts++
  if (earLS) pts++
  if (earRS) pts++
  if (pts < 2) return out
  out.confidence = pts

  // ---- 3D 优先（能区分前后）----
  const noseW = v3(world, HP.NOSE)
  const earLW = v3(world, HP.L_EAR)
  const earRW = v3(world, HP.R_EAR)
  if (noseW && earLW && earRW) {
    out.source = 'world'
    const earMid = mid3(earLW, earRW)
    // 双耳 3D 间距：转 90° 时两耳在深度方向重叠，距离最小
    // 实测：正对 0.1400m，侧对 0.1143m
    const earSpan3 = dist3(earLW, earRW)
    out.earSpan = +earSpan3.toFixed(4)
    out.sideRatio = Math.max(0, Math.min(1, (HEAD_W - earSpan3) / (HEAD_W - HEAD_SIDE_3D)))
    // 头部 yaw：耳中点 → 鼻 向量的水平转角（实测判别力最高，差异/σ=2.97）
    out.yawDeg = +yawOf(noseW.x - earMid.x, noseW.z - earMid.z).toFixed(1)
    // pitch：向量与水平面夹角
    const fx = noseW.x - earMid.x, fy = noseW.y - earMid.y, fz = noseW.z - earMid.z
    out.pitchDeg = +((Math.atan2(fy, Math.hypot(fx, fz)) * 180) / Math.PI).toFixed(1)
    // roll：双耳连线与水平面夹角
    const er = { x: earRW.x - earLW.x, y: earRW.y - earLW.y, z: earRW.z - earLW.z }
    out.rollDeg = +((Math.atan2(er.y, Math.hypot(er.x, er.z)) * 180) / Math.PI).toFixed(1)
    // 鼻相对耳中点的 z。正对时鼻在耳前方（z 明显更负）—— 最灵敏的深度信号
    out.noseZRelEar = +(noseW.z - earMid.z).toFixed(4)
    // 背对：鼻 z 趋近 0 或为正（脸在脑后）
    out.headBack = out.noseZRelEar > NOSE_EAR_Z_BACK
    // 偏离正对：yaw 超阈值 或 深度差绝对值缩小
    out.offAxis = Math.abs(out.yawDeg) > YAW_TURN || out.noseZRelEar > NOSE_EAR_Z_FRONT
    out.sideByYaw = Math.abs(out.yawDeg) > YAW_SIDE
    out.available = true
    // 优先级：背对 > 侧转（yaw 判别力最强）> 正对
    out.facing = out.headBack ? 'back' : (out.sideByYaw || out.offAxis ? 'side' : 'front')
    out.facingText = out.headBack ? '头部背对' : (out.facing === 'side' ? `头侧转 ${Math.abs(out.yawDeg).toFixed(0)}°` : '头部正对')
    return out
  }

  // ---- 2D 降级（无 3D 时）：只能测左右转，无法区分前后 ----
  out.source = 'screen'
  if (earLS && earRS && noseS) {
    const earMid = mid2(earLS, earRS)
    const earSpan2 = dist2(earLS, earRS)
    // 2D 下双耳投影间距也会随转头缩小，但幅度不如 3D 可靠
    out.sideRatio = Math.max(0, Math.min(1, 1 - earSpan2 / (HEAD_W * 1.6)))
    const dev = noseS.x - earMid.x
    // 归一化到「头宽」，得到大致偏转角
    out.yawDeg = Math.max(-90, Math.min(90, (dev / (HEAD_W * 1.6)) * 90))
    // 眼/口连线（若有）与耳连线夹角可补充判断
    const lEye = v3(screen, HP.L_EYE), rEye = v3(screen, HP.R_EYE)
    if (lEye && rEye) {
      const eyeAng = Math.abs(angleBetween(lEye, noseS, rEye) - 180)
      out.pitchDeg = 0
      out.eyeTilt = eyeAng
    }
    out.available = true
    out.facing = out.sideRatio > 0.55 ? 'side' : 'front'
    out.headBack = null     // 2D 无法判断前后，明确标 null 而非瞎猜
  }
  return out
}

/**
 * 身体朝向分析 —— 判「正对 / 斜侧 / 背对」
 * 原理：3D 下肩宽会随转身投影变化；更可靠的是用「鼻 vs 髋」的 z 关系，
 * 以及肩/髋中点的 z 差（背对时肩略后于髋，正对时略前或齐平）。
 */
export function bodyPose(screen, world) {
  const out = {
    available: false,
    facing: 'front',      // front | side | side-back | back
    yawDeg: 0,            // 身体左右转角
    turnPhase: 'unknown', // 转身过程判断：still | turning-left | turning-right | turning-around
    facingText: '正对镜头',
    source: 'none',
  }
  const noseS = v3(screen, HP.NOSE)
  const shoLS = v3(screen, SH.L_SHO), shoRS = v3(screen, SH.R_SHO)
  if (!shoLS || !shoRS) return out

  // 2D 侧向程度：双肩投影间距 / 典型肩宽
  const shoSpan2 = dist2(shoLS, shoRS)
  const sideRatio2 = Math.max(0, Math.min(1, 1 - shoSpan2 / (SHO_W * 1.15)))

  // 3D 优先
  const noseW = v3(world, HP.NOSE)
  const shoLW = v3(world, SH.L_SHO), shoRW = v3(world, SH.R_SHO)
  const hipLW = v3(world, SH.L_HIP), hipRW = v3(world, SH.R_HIP)
  if (shoLW && shoRW) {
    out.source = 'world'
    const shoMid = mid3(shoLW, shoRW)
    const span3 = dist3(shoLW, shoRW)
    out.shoSpan = +span3.toFixed(4)
    // 侧对（90°）时两肩在深度方向重叠，3D 距离缩小
    // 实测：正对 0.3229m（p10 0.2926 / p90 0.3369）
    out.sideRatio = Math.max(0, Math.min(1, (SHO_W - span3) / (SHO_W - SHO_SIDE_3D)))
    if (noseW) {
      // 身体 yaw：用鼻相对肩中点。实测噪声较大（差异/σ=0.82），仅作参考
      out.yawDeg = +yawOf(noseW.x - shoMid.x, noseW.z - shoMid.z).toFixed(1)
      // 背对/侧对判据：改用头部信号（判别力强 2 倍以上）
      // 【实测标定】鼻-肩 z 差 区分度 σ=0.94，鼻-耳 z 差 σ=5.78，earYaw σ=2.97。
      // 原因：转身时躯干 z 关系变化不大，但脸相对头的位置关系必然反转。
      const eL = v3(world, HP.L_EAR), eR = v3(world, HP.R_EAR)
      if (eL && eR) {
        const earMidW = { x: (eL.x + eR.x) / 2, y: (eL.y + eR.y) / 2, z: (eL.z + eR.z) / 2 }
        out.noseEarZ = +(noseW.z - earMidW.z).toFixed(4)
        out.earYaw = +yawOf(noseW.x - earMidW.x, noseW.z - earMidW.z).toFixed(1)
        out.back = out.noseEarZ > NOSE_EAR_Z_BACK
        // 偏离正对：与 headPose 同判据，保证两者一致
        out.offAxis = Math.abs(out.earYaw) > YAW_TURN || out.noseEarZ > NOSE_EAR_Z_FRONT
      } else {
        // 无耳点时退回肩 z 差（区分度较低，仅作兜底）
        out.noseZRelSho = +(noseW.z - shoMid.z).toFixed(4)
        out.back = out.noseZRelSho > -0.075
        out.offAxis = Math.abs(out.yawDeg) > 20
      }
    } else {
      out.back = null
    }
    if (hipLW && hipRW) {
      const hipMid = mid3(hipLW, hipRW)
      out.shoHipZ = +(shoMid.z - hipMid.z).toFixed(4)
    }
    out.available = true
    // 躯干判别力实测偏弱（转身段识别率仅 24%，vs 头部 95%）。
    // 原因：转身时躯干 z 关系变化不大（双肩 3D 距几乎不变，差异/σ=0.82），
    //      而头部的「鼻-耳深度差」差异/σ=5.78。
    // 故躯干的 facing 直接采用头部信号（人转身时头与身体基本同步），
    // 躯干自身的 yaw/肩距仅作参考输出。
    out.facing = out.back ? 'back' : ((out.offAxis ?? (out.sideRatio > 0.5)) ? 'side' : 'front')
  } else {
    // 2D 降级
    out.source = 'screen'
    out.sideRatio = sideRatio2
    out.available = true
    out.back = null   // 2D 判不了前后
    out.facing = sideRatio2 > 0.5 ? 'side' : 'front'
  }

  out.facingText = {
    front: '正对镜头',
    side: '侧身（斜侧向）',
    'side-back': '侧身偏背',
    back: '背对镜头',
  }[out.facing] || '正对镜头'

  return out
}

/**
 * 转身过程跟踪 —— 区分「正在转身」与「已转到位」
 *
 * 【为什么需要】用户反馈要能识别「转身了还是正对着」。静态判定只能告诉你
 * 当前朝向（front/side/back），但「从正面转到背面」这个过程本身也需要识别：
 *   · 转身过程中判定会失效（姿态既不像正对也不像任何一式）→ 应暂停判定并提示
 *   · 转到位后应重新开始判定
 * 用 yaw 的变化率即可：连续多帧 yaw 单向变化超阈值 = 正在转身。
 *
 * 用法：每帧调用 update(bodyPose)，读 turnPhase：
 *   still（稳定） / turning-left（右转中） / turning-right（左转中） / returning（回正）
 */
export function createTurnTracker() {
  const hist = []          // 最近的 yaw
  let phase = 'still'
  let stableCount = 0

  return {
    /** @param {number|null} yawDeg bodyPose().yawDeg；null 表示无 3D 数据 */
    update(yawDeg) {
      if (yawDeg === null || yawDeg === undefined) {
        phase = 'unknown'
        return { phase, text: '朝向未知' }
      }
      hist.push(yawDeg)
      if (hist.length > 20) hist.shift()
      if (hist.length < 6) {
        phase = 'unknown'
        return { phase, text: '朝向未知' }
      }
      // 取最近 8 帧算变化率（度/帧）
      const seg = hist.slice(-8)
      const delta = seg[seg.length - 1] - seg[0]
      const perFrame = delta / (seg.length - 1)
      // 阈值：1.2 度/帧 ≈ 36°/秒，人体转身约 90°/秒 → 灵敏但不噪声
      if (Math.abs(perFrame) > 1.2) {
        phase = perFrame > 0 ? 'turning-left' : 'turning-right'
        stableCount = 0
      } else {
        stableCount++
        // 连续 8 帧变化很小 → 稳定
        phase = stableCount >= 8 ? 'still' : phase
      }
      const text = {
        'turning-left': '正在向左转身',
        'turning-right': '正在向右转身',
        still: '姿态稳定',
        unknown: '朝向未知',
        returning: '正在转回',
      }[phase]
      return { phase, text, perFrame: +perFrame.toFixed(2), stableCount }
    },
    get phase() { return phase },
    reset() { hist.length = 0; phase = 'still'; stableCount = 0 },
  }
}

export { HP as HEAD_IDX, SH as SHAPE_IDX, angle3, angleBetween }
