// 试教动画关键帧数据 —— 连续插值的柔和小人动画（无外部资源，离线可用）
//
// 【为什么自绘而不是找现成素材】
//   已实测过两条开源路线：workout-guide 3 帧插画（跳帧不连贯、健身风不符）、
//   LottieFiles 瑜伽/冥想动画（无八段锦对应式、下载需账号）。
//   八段锦八式的「连续动画」在开源世界没有现成的 —— 姿态关键帧必须自己定义，
//   但渲染与插值是标准做法（缓动 + rAF），视觉风格按「疗养」定制。
//
// 【姿态模型】正面柔和小人，数值参数描述，关键帧间缓入缓出插值（60fps 连贯）：
//   aL/aR   肩角（度）：0 = 垂臂，90 = 侧平举，180 = 上举过头
//   eL/eR   肘弯（度）：0 = 手臂伸直，越大前臂越向身体内侧折
//   lean    躯干侧倾（度，左右摆）
//   bend    前屈量 0~1（示意：脊柱视觉缩短、肩头下沉）
//   head    头部转/偏（度，-60~60）
//   crouch  屈膝下蹲量 0~1（马步/俯身用）
//   lift    提踵量 0~1（脚跟抬起，全身微升）
//   legL/legR  两腿外开角（度，马步用）

export const POSE_KEYS = ['aL', 'eL', 'aR', 'eR', 'lean', 'bend', 'head', 'crouch', 'lift', 'legL', 'legR']

export const DEFAULT_POSE = {
  aL: 8, eL: 6, aR: 8, eR: 6,
  lean: 0, bend: 0, head: 0,
  crouch: 0, lift: 0, legL: 5, legR: 5,
}

const P = (o) => ({ ...DEFAULT_POSE, ...o })

export const PHASE_TEXT = { start: '起始姿态', work: '发力过程', end: '结束姿态' }

// 每式一条时间线：keys 按 t 升序，最后一帧与第一帧一致（循环无缝）。
// phase 标注该段属于 起始/发力/结束 —— 用于阶段提示与「停留结束姿态」。
export const DEMO_ANIMS = {
  // 一、双手托天理三焦：两臂从体侧缓缓上托过头顶，撑住，再落下
  'baduanjin-1': {
    dur: 5.2,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.2, phase: 'work', pose: P({ aL: 92, aR: 92, eL: 8, eR: 8 }) },
      { t: 2.6, phase: 'end', pose: P({ aL: 168, aR: 168, eL: 6, eR: 6 }) },
      { t: 4.0, phase: 'end', pose: P({ aL: 168, aR: 168, eL: 6, eR: 6 }) },
      { t: 5.2, phase: 'start', pose: P({}) },
    ],
  },

  // 二、左右开弓似射雕：一侧平举如拉弓、另一侧屈肘回拉，左右交替
  'baduanjin-2': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.2, phase: 'work', pose: P({ aL: 92, eL: 0, aR: 35, eR: 118 }) },
      { t: 2.4, phase: 'end', pose: P({ aL: 92, eL: 0, aR: 35, eR: 118 }) },
      { t: 3.6, phase: 'work', pose: P({ aR: 92, eR: 0, aL: 35, eL: 118 }) },
      { t: 4.8, phase: 'end', pose: P({ aR: 92, eR: 0, aL: 35, eL: 118 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 三、调理脾胃须单举：一手上托、一手下按，两侧交替
  'baduanjin-3': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.2, phase: 'work', pose: P({ aL: 165, eL: 4, aR: 18, eR: 8 }) },
      { t: 2.4, phase: 'end', pose: P({ aL: 165, eL: 4, aR: 18, eR: 8 }) },
      { t: 3.6, phase: 'work', pose: P({ aR: 165, eR: 4, aL: 18, eL: 8 }) },
      { t: 4.8, phase: 'end', pose: P({ aR: 165, eR: 4, aL: 18, eL: 8 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 四、五劳七伤往后瞧：站定，头缓缓转向一侧再另一侧，双臂外旋
  'baduanjin-4': {
    dur: 5.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ head: 45, aL: 28, eL: 18, aR: 28, eR: 18 }) },
      { t: 2.3, phase: 'end', pose: P({ head: 45, aL: 28, eL: 18, aR: 28, eR: 18 }) },
      { t: 3.4, phase: 'work', pose: P({ head: -45, aL: 28, eL: 18, aR: 28, eR: 18 }) },
      { t: 4.6, phase: 'end', pose: P({ head: -45, aL: 28, eL: 18, aR: 28, eR: 18 }) },
      { t: 5.8, phase: 'start', pose: P({}) },
    ],
  },

  // 五、摇头摆尾去心火：屈膝半蹲，上体与头左右摇摆
  'baduanjin-5': {
    dur: 5.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.0, phase: 'work', pose: P({ crouch: 0.5, legL: 30, legR: 30, lean: -14, head: -18, aL: 30, eL: 12, aR: 30, eR: 12 }) },
      { t: 2.1, phase: 'work', pose: P({ crouch: 0.5, legL: 30, legR: 30, lean: 14, head: 18, aL: 30, eL: 12, aR: 30, eR: 12 }) },
      { t: 3.2, phase: 'work', pose: P({ crouch: 0.5, legL: 30, legR: 30, lean: -14, head: -18, aL: 30, eL: 12, aR: 30, eR: 12 }) },
      { t: 4.3, phase: 'end', pose: P({ crouch: 0.5, legL: 30, legR: 30, lean: 0, head: 0, aL: 30, eL: 12, aR: 30, eR: 12 }) },
      { t: 5.6, phase: 'start', pose: P({}) },
    ],
  },

  // 六、两手攀足固肾腰：缓慢前屈，双手顺腿向下攀足，再直起
  'baduanjin-6': {
    dur: 4.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.5, phase: 'work', pose: P({ bend: 0.62, aL: 14, eL: 4, aR: 14, eR: 4 }) },
      { t: 3.0, phase: 'end', pose: P({ bend: 0.70, aL: 12, eL: 2, aR: 12, eR: 2 }) },
      { t: 4.6, phase: 'start', pose: P({}) },
    ],
  },

  // 七、攒拳怒目增气力：马步站稳，两拳交替缓缓冲出
  'baduanjin-7': {
    dur: 6.2,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.9, phase: 'work', pose: P({ crouch: 0.42, legL: 26, legR: 26 }) },
      { t: 1.8, phase: 'work', pose: P({ crouch: 0.42, legL: 26, legR: 26, aR: 88, eR: 0, aL: 16, eL: 112 }) },
      { t: 2.9, phase: 'end', pose: P({ crouch: 0.42, legL: 26, legR: 26, aR: 88, eR: 0, aL: 16, eL: 112 }) },
      { t: 3.9, phase: 'work', pose: P({ crouch: 0.42, legL: 26, legR: 26, aL: 88, eL: 0, aR: 16, eR: 112 }) },
      { t: 5.0, phase: 'end', pose: P({ crouch: 0.42, legL: 26, legR: 26, aL: 88, eL: 0, aR: 16, eR: 112 }) },
      { t: 6.2, phase: 'start', pose: P({}) },
    ],
  },

  // 八、背后七颠百病消：脚跟提起落下共七次，收势归原
  'baduanjin-8': {
    dur: 7.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.5, phase: 'work', pose: P({ lift: 1 }) },
      { t: 1.0, phase: 'work', pose: P({}) },
      { t: 1.5, phase: 'work', pose: P({ lift: 1 }) },
      { t: 2.0, phase: 'work', pose: P({}) },
      { t: 2.5, phase: 'work', pose: P({ lift: 1 }) },
      { t: 3.0, phase: 'work', pose: P({}) },
      { t: 3.5, phase: 'work', pose: P({ lift: 1 }) },
      { t: 4.0, phase: 'work', pose: P({}) },
      { t: 4.5, phase: 'work', pose: P({ lift: 1 }) },
      { t: 5.0, phase: 'work', pose: P({}) },
      { t: 5.5, phase: 'work', pose: P({ lift: 1 }) },
      { t: 6.0, phase: 'end', pose: P({}) },
      { t: 7.0, phase: 'end', pose: P({}) },
    ],
  },

  // ============================== 五禽戏五式 ==============================
  // 一、虎举：双手十指张开如虎爪，缓缓上举过头，停一拍，再缓缓落下
  'wuqinxi-1': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.4, phase: 'work', pose: P({ aL: 104, aR: 104, eL: 26, eR: 26 }) },
      { t: 2.8, phase: 'end', pose: P({ aL: 170, aR: 170, eL: 8, eR: 8 }) },
      { t: 4.2, phase: 'end', pose: P({ aL: 170, aR: 170, eL: 8, eR: 8 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 二、鹿抵：双臂向前上方伸出，躯干向一侧舒展（左右交替），微屈膝
  'wuqinxi-2': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.3, phase: 'work', pose: P({ aL: 150, eL: 12, aR: 150, eR: 12, lean: -15, crouch: 0.12 }) },
      { t: 2.5, phase: 'end', pose: P({ aL: 150, eL: 12, aR: 150, eR: 12, lean: -15, crouch: 0.12 }) },
      { t: 3.8, phase: 'work', pose: P({ aL: 150, eL: 12, aR: 150, eR: 12, lean: 15, crouch: 0.12 }) },
      { t: 5.0, phase: 'end', pose: P({ aL: 150, eL: 12, aR: 150, eR: 12, lean: 15, crouch: 0.12 }) },
      { t: 6.6, phase: 'start', pose: P({}) },
    ],
  },

  // 三、熊运：屈膝含胸，双肩圆拱，腰腹带动躯干画圆（左右绕环）
  'wuqinxi-3': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.0, phase: 'work', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: -16, aL: 34, eL: 82, aR: 58, eR: 62 }) },
      { t: 2.1, phase: 'work', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: 0, aL: 48, eL: 72, aR: 48, eR: 72 }) },
      { t: 3.2, phase: 'work', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: 16, aL: 58, eL: 62, aR: 34, eR: 82 }) },
      { t: 4.3, phase: 'end', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: 0, aL: 48, eL: 72, aR: 48, eR: 72 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 四、猿提：两手成猿钩收至胸前，屈肘上提；同时耸肩上顶、脚跟提起，再慢慢放下
  'wuqinxi-4': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.2, phase: 'work', pose: P({ aL: 58, eL: 96, aR: 58, eR: 96 }) },
      { t: 2.6, phase: 'end', pose: P({ aL: 80, eL: 108, aR: 80, eR: 108, lift: 0.65 }) },
      { t: 3.6, phase: 'end', pose: P({ aL: 80, eL: 108, aR: 80, eR: 108, lift: 0.65 }) },
      { t: 4.8, phase: 'work', pose: P({ aL: 58, eL: 96, aR: 58, eR: 96 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 五、鸟飞：双手如鸟翅向两侧展开，再上举合拢（提踵），随后展翅回落
  'wuqinxi-5': {
    dur: 6.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.3, phase: 'work', pose: P({ aL: 92, eL: 6, aR: 92, eR: 6 }) },
      { t: 2.7, phase: 'end', pose: P({ aL: 162, eL: 22, aR: 162, eR: 22, lift: 1 }) },
      { t: 4.0, phase: 'end', pose: P({ aL: 162, eL: 22, aR: 162, eR: 22, lift: 1 }) },
      { t: 5.3, phase: 'work', pose: P({ aL: 92, eL: 6, aR: 92, eR: 6 }) },
      { t: 6.8, phase: 'start', pose: P({}) },
    ],
  },
}

/** 查询某式的动画数据；没有则返回 null（调用方降级为静态图示） */
export function getAnim(animKey) {
  if (!animKey) return null
  return DEMO_ANIMS[animKey] || null
}
