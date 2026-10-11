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

  // ============================== 五禽戏十式 ==============================
  // 虎戏 1-2 / 鹿戏 3-4 / 熊戏 5-6 / 猿戏 7-8 / 鸟戏 9-10（国家体育总局《健身气功 · 五禽戏》）。
  // 姿态口径与 WUQINXI_RULES 的签名对齐：
  //   aL/aR 决定腕的上举量（0=垂臂、90=侧平举、180=上举过头）与腕间距（越接近 90° 越宽、
  //     越接近 180° 越窄）；eL/eR 决定肘的屈伸；bend 决定前俯（判定用**相对量** __bendRel，
  //     基准是本段最挺直的一帧，故每段首帧一律 P({}) 中立）；lift/crouch 决定躯干垂直起伏
  //     （__bob，猿提/鸟飞用）；lean 决定肩中点横移（__shoSway，熊运用）；head 决定头随手动。
  // 三对「构型相近」的式靠关键帧拉开：虎举/鸟伸（上举时两腕张开 vs 并拢）·
  //   虎扑/鹿奔（双腕沉到肩下且分开 vs 齐肩收臂屈肘）· 熊运/熊晃（手贴小腹屈肘 vs 垂臂肘伸侧倾大）。

  // 一、虎举：两手成虎爪沿体前上举，举过头顶时两腕张开，停一拍，再落下
  'wuqinxi-1': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.4, phase: 'work', pose: P({ aL: 104, eL: 26, aR: 104, eR: 26 }) },
      { t: 2.8, phase: 'end', pose: P({ aL: 158, eL: 6, aR: 158, eR: 6 }) },
      { t: 4.2, phase: 'end', pose: P({ aL: 158, eL: 6, aR: 158, eR: 6 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 二、虎扑：两手成虎爪上举，再以腰胯带动上体前俯、两爪向体前下方扑落，停一拍，再起身
  'wuqinxi-2': {
    dur: 6.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.2, phase: 'work', pose: P({ aL: 135, eL: 10, aR: 135, eR: 10 }) },
      { t: 2.0, phase: 'work', pose: P({ aL: 100, eL: 10, aR: 100, eR: 10, bend: 0.22 }) },
      { t: 3.0, phase: 'end', pose: P({ aL: 35, eL: 12, aR: 35, eR: 12, bend: 0.60 }) },
      { t: 4.2, phase: 'end', pose: P({ aL: 35, eL: 12, aR: 35, eR: 12, bend: 0.60 }) },
      { t: 5.6, phase: 'start', pose: P({}) },
    ],
  },

  // 三、鹿抵：迈步成弓步，双臂向侧上方伸抵、躯干左右交替侧屈拧转（先右后左，末段停在左转）
  'wuqinxi-3': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.3, phase: 'work', pose: P({ aL: 140, eL: 12, aR: 140, eR: 12, lean: 15, crouch: 0.12 }) },
      { t: 2.5, phase: 'work', pose: P({ aL: 140, eL: 12, aR: 140, eR: 12, lean: 15, crouch: 0.12 }) },
      { t: 3.8, phase: 'work', pose: P({ aL: 140, eL: 12, aR: 140, eR: 12, lean: -15, crouch: 0.12 }) },
      { t: 5.0, phase: 'end', pose: P({ aL: 140, eL: 12, aR: 140, eR: 12, lean: -15, crouch: 0.12 }) },
      { t: 6.6, phase: 'start', pose: P({}) },
    ],
  },

  // 四、鹿奔：两臂前伸齐肩、含胸收腹弓背，如鹿疾奔前冲，停一拍再展开还原
  'wuqinxi-4': {
    dur: 6.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.2, phase: 'work', pose: P({ aL: 85, eL: 30, aR: 85, eR: 30, bend: 0.20 }) },
      { t: 2.6, phase: 'end', pose: P({ aL: 85, eL: 50, aR: 85, eR: 50, bend: 0.60 }) },
      { t: 3.8, phase: 'end', pose: P({ aL: 85, eL: 50, aR: 85, eR: 50, bend: 0.60 }) },
      { t: 5.4, phase: 'start', pose: P({}) },
    ],
  },

  // 五、熊运：屈膝马步、含胸弓背，腰腹带动肩画立圆，两手轻贴小腹、肘屈
  'wuqinxi-5': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.0, phase: 'work', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: -16, aL: 34, eL: 82, aR: 58, eR: 62 }) },
      { t: 2.1, phase: 'work', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: 0, aL: 48, eL: 72, aR: 48, eR: 72 }) },
      { t: 3.2, phase: 'work', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: 16, aL: 58, eL: 62, aR: 34, eR: 82 }) },
      { t: 4.3, phase: 'end', pose: P({ crouch: 0.45, legL: 26, legR: 26, lean: 0, aL: 48, eL: 72, aR: 48, eR: 72 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 六、熊晃：提髋提腿、落步踏实，身体随之大幅左右晃动，两臂自然下垂摆动
  'wuqinxi-6': {
    dur: 8.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.0, phase: 'work', pose: P({ lean: -22, aL: 12, eL: 6, aR: 12, eR: 6, legL: 26, legR: 6, crouch: 0.08 }) },
      { t: 2.0, phase: 'work', pose: P({ lean: 0, aL: 14, eL: 6, aR: 14, eR: 6, legL: 20, legR: 20, crouch: 0.10 }) },
      { t: 3.0, phase: 'work', pose: P({ lean: 22, aL: 12, eL: 6, aR: 12, eR: 6, legL: 6, legR: 26, crouch: 0.08 }) },
      { t: 4.0, phase: 'work', pose: P({ lean: 0, aL: 14, eL: 6, aR: 14, eR: 6, legL: 20, legR: 20, crouch: 0.10 }) },
      { t: 5.0, phase: 'work', pose: P({ lean: -22, aL: 12, eL: 6, aR: 12, eR: 6, legL: 26, legR: 6, crouch: 0.08 }) },
      { t: 5.8, phase: 'end', pose: P({ lean: 0, aL: 14, eL: 6, aR: 14, eR: 6, legL: 20, legR: 20, crouch: 0.10 }) },
      { t: 8.0, phase: 'start', pose: P({}) },
    ],
  },

  // 七、猿提：两手成猿钩收于体前、屈肘上提至胸，同时耸肩缩项、提踵，再慢慢放下
  'wuqinxi-7': {
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

  // 八、猿摘：一手猿钩收于腰侧、另一手向斜上方摘取，眼随手动（末段停在左手高摘）
  'wuqinxi-8': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.4, phase: 'work', pose: P({ aL: 140, eL: 15, aR: 12, eR: 10, head: 30 }) },
      { t: 2.8, phase: 'end', pose: P({ aL: 140, eL: 15, aR: 12, eR: 10, head: 30 }) },
      { t: 4.0, phase: 'end', pose: P({ aL: 140, eL: 15, aR: 12, eR: 10, head: 30 }) },
      { t: 5.4, phase: 'start', pose: P({}) },
    ],
  },

  // 九、鸟伸：两手在腹前相叠、上举过头（两腕并拢），停一拍，再沿体前下按还原
  //    【时间轴】签名姿态在 ≤0.40 就位、保持到 ≥0.90（同太极约定）—— 举臂与回落都在
  //    停留段之外，「双臂上举且张开」的过渡构型不会落进判定窗口（否则会与「虎举」撞车）。
  'wuqinxi-9': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 100, eL: 20, aR: 100, eR: 20 }) },
      { t: 2.6, phase: 'end', pose: P({ aL: 178, eL: 0, aR: 178, eR: 0 }) },
      { t: 5.94, phase: 'end', pose: P({ aL: 178, eL: 0, aR: 178, eR: 0 }) },
      { t: 6.6, phase: 'start', pose: P({}) },
    ],
  },

  // 十、鸟飞：双手如鸟翅向两侧展开、再上举合拢（提踵），随后展翅回落
  'wuqinxi-10': {
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

  // ============================== 太极二十四式 ==============================
  // 姿态口径与 TAIJI_RULES 的签名对齐：腕的上举量（aL/aR 决定）+ 肘弯（eL/eR）+
  // 腕间距（aL/aR 越接近 90° 越宽）+ 前俯（bend）+ 转身（head）+ 腰转（lean）。
  //
  // 【时间轴约定（2026-10-11 三版）】判定器验收取「停留段」t/dur ∈ [0.45,0.75]，
  //   故每式的**签名姿态必须在 ≤0.40 时长就位、并保持到 ≥0.90 时长**，末段才回中立。
  //   这样「核心窗口」里只剩该式的定式，过渡姿态（会扫过别的式的构型）全落在
  //   0.45 之前，不参与串扰统计。二版曾把签名放在 ~0.62 才到位，导致「起势」下落
  //   途中扫过「左揽雀尾 / 右蹬脚」的宽胸架而串扰（core 1.00/0.99）。
  //   「左右」式：先做一侧热身、再定在规则签名那一侧（末段保持侧 = 规则侧）。
  //   云手例外：它是**持续划圆**的式，签名「腰随手转」是时序信号，故整段保持划圆、
  //   仅在最末 1s 收式；若中途静止，肩中点横移（__shoSway）会归零反而不像云手。
  //   右蹬脚 / 转身左蹬脚用 head=±45 拉开转身体；单鞭用「双腕大幅张开」拉开距离。

  // 1 起势：两臂向前平举至肩高，再缓缓下落还原（气沉丹田）—— 定式 = 松沉站定
  'taiji-1': {
    dur: 5.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
      { t: 1.0, phase: 'work', pose: P({ aL: 88, eL: 15, aR: 88, eR: 15 }) },
      { t: 2.2, phase: 'end', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
      { t: 5.2, phase: 'end', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
      { t: 5.8, phase: 'start', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
    ],
  },

  // 2 左右野马分鬃：一手前上掤、一手下按，左右交替（末段定式 = 左手在上）
  'taiji-2': {
    dur: 6.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.8, phase: 'work', pose: P({ aL: 26, eL: 20, aR: 100, eR: 8 }) },
      { t: 1.7, phase: 'work', pose: P({ aL: 18, eL: 12, aR: 110, eR: 0 }) },
      { t: 2.6, phase: 'end', pose: P({ aL: 110, eL: 0, aR: 18, eR: 12 }) },
      { t: 6.1, phase: 'end', pose: P({ aL: 110, eL: 0, aR: 18, eR: 12 }) },
      { t: 6.8, phase: 'start', pose: P({}) },
    ],
  },

  // 3 白鹤亮翅：一手举于额前、一手按于胯旁（右手在上）
  'taiji-3': {
    dur: 6.2,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 12, eL: 8, aR: 90, eR: 20 }) },
      { t: 2.35, phase: 'end', pose: P({ aL: 12, eL: 8, aR: 155, eR: 20 }) },
      { t: 5.6, phase: 'end', pose: P({ aL: 12, eL: 8, aR: 155, eR: 20 }) },
      { t: 6.2, phase: 'start', pose: P({}) },
    ],
  },

  // 4 左右搂膝拗步：一手搂膝、一手前推，弓步前俯（末段定式 = 左手前推）
  'taiji-4': {
    dur: 6.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.8, phase: 'work', pose: P({ aL: 40, eL: 60, aR: 100, eR: 15, bend: 0.18 }) },
      { t: 1.7, phase: 'work', pose: P({ aL: 12, eL: 8, aR: 100, eR: 15, bend: 0.28 }) },
      { t: 2.6, phase: 'end', pose: P({ aL: 100, eL: 15, aR: 12, eR: 8, bend: 0.28 }) },
      { t: 6.1, phase: 'end', pose: P({ aL: 100, eL: 15, aR: 12, eR: 8, bend: 0.28 }) },
      { t: 6.8, phase: 'start', pose: P({}) },
    ],
  },

  // 5 手挥琵琶：两手合抱于胸前，虚步站定不动
  'taiji-5': {
    dur: 5.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.05, phase: 'work', pose: P({ aL: 55, eL: 95, aR: 62, eR: 88 }) },
      { t: 2.15, phase: 'end', pose: P({ aL: 55, eL: 95, aR: 62, eR: 88 }) },
      { t: 5.05, phase: 'end', pose: P({ aL: 55, eL: 95, aR: 62, eR: 88 }) },
      { t: 5.6, phase: 'start', pose: P({}) },
    ],
  },

  // 6 左右倒卷肱：一手向后卷收、一手向前推出，退步左右交替（末段定式 = 左手前推）
  'taiji-6': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.75, phase: 'work', pose: P({ aL: 65, eL: 55, aR: 95, eR: 120 }) },
      { t: 1.6, phase: 'work', pose: P({ aL: 95, eL: 120, aR: 65, eR: 55 }) },
      { t: 2.45, phase: 'end', pose: P({ aL: 95, eL: 120, aR: 65, eR: 55 }) },
      { t: 5.75, phase: 'end', pose: P({ aL: 95, eL: 120, aR: 65, eR: 55 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 7 左揽雀尾：掤捋挤按，双手收于胸前同一高度、张得较开
  'taiji-7': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 70, eL: 40, aR: 70, eR: 40 }) },
      { t: 2.45, phase: 'end', pose: P({ aL: 90, eL: 70, aR: 90, eR: 70 }) },
      { t: 5.75, phase: 'end', pose: P({ aL: 90, eL: 70, aR: 90, eR: 70 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 8 右揽雀尾：右手在前上、左手在后下
  'taiji-8': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 55, eL: 40, aR: 85, eR: 15 }) },
      { t: 2.45, phase: 'end', pose: P({ aL: 75, eL: 55, aR: 105, eR: 20 }) },
      { t: 5.75, phase: 'end', pose: P({ aL: 75, eL: 55, aR: 105, eR: 20 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 9 单鞭：一手成勾手侧伸、一手立掌前推（双臂大幅展开）
  'taiji-9': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.85, phase: 'work', pose: P({ aL: 62, eL: 40, aR: 62, eR: 40 }) },
      { t: 2.3, phase: 'end', pose: P({ aL: 92, eL: 0, aR: 85, eR: 60 }) },
      { t: 5.4, phase: 'end', pose: P({ aL: 92, eL: 0, aR: 85, eR: 60 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 10 云手：两手在体前上下交替划圆，腰（躯干）随手左右转（全程划圆，末段收式）
  'taiji-10': {
    dur: 7.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({ aL: 58, eL: 72, aR: 66, eR: 88, lean: -16 }) },
      { t: 1.1, phase: 'work', pose: P({ aL: 66, eL: 88, aR: 58, eR: 72, lean: 16 }) },
      { t: 2.2, phase: 'work', pose: P({ aL: 58, eL: 72, aR: 66, eR: 88, lean: -16 }) },
      { t: 3.3, phase: 'work', pose: P({ aL: 66, eL: 88, aR: 58, eR: 72, lean: 16 }) },
      { t: 4.4, phase: 'work', pose: P({ aL: 58, eL: 72, aR: 66, eR: 88, lean: -16 }) },
      { t: 5.5, phase: 'work', pose: P({ aL: 66, eL: 88, aR: 58, eR: 72, lean: 16 }) },
      { t: 6.5, phase: 'end', pose: P({ aL: 62, eL: 80, aR: 62, eR: 80, lean: 0 }) },
      { t: 7.4, phase: 'start', pose: P({ aL: 58, eL: 72, aR: 66, eR: 88, lean: -16 }) },
    ],
  },

  // 11 单鞭（定式重复）
  'taiji-11': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.85, phase: 'work', pose: P({ aL: 62, eL: 40, aR: 62, eR: 40 }) },
      { t: 2.3, phase: 'end', pose: P({ aL: 92, eL: 0, aR: 85, eR: 60 }) },
      { t: 5.4, phase: 'end', pose: P({ aL: 92, eL: 0, aR: 85, eR: 60 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 12 高探马：一手立掌向前探（与肩平）、一手收于腰侧
  'taiji-12': {
    dur: 5.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.95, phase: 'work', pose: P({ aL: 92, eL: 12, aR: 50, eR: 40 }) },
      { t: 2.2, phase: 'end', pose: P({ aL: 92, eL: 12, aR: 30, eR: 20 }) },
      { t: 5.25, phase: 'end', pose: P({ aL: 92, eL: 12, aR: 30, eR: 20 }) },
      { t: 5.8, phase: 'start', pose: P({}) },
    ],
  },

  // 13 右蹬脚：两手交叉后向两侧平展，右腿缓缓蹬出，身体正对
  'taiji-13': {
    dur: 6.2,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 88, eL: 25, aR: 88, eR: 25, lift: 0.4, legR: 45 }) },
      { t: 2.4, phase: 'end', pose: P({ aL: 88, eL: 25, aR: 88, eR: 25, lift: 0.7, legR: 70 }) },
      { t: 5.6, phase: 'end', pose: P({ aL: 88, eL: 25, aR: 88, eR: 25, lift: 0.7, legR: 70 }) },
      { t: 6.2, phase: 'start', pose: P({}) },
    ],
  },

  // 14 双峰贯耳：两拳自两侧向前上方合击于耳前
  'taiji-14': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 120, eL: 80, aR: 120, eR: 80 }) },
      { t: 2.3, phase: 'end', pose: P({ aL: 165, eL: 135, aR: 165, eR: 135 }) },
      { t: 5.4, phase: 'end', pose: P({ aL: 165, eL: 135, aR: 165, eR: 135 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 15 转身左蹬脚：身体左转，两手分开、左腿蹬出（head 拉到 45° 拉开转身体）
  'taiji-15': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 88, eL: 25, aR: 88, eR: 25, head: -18, legL: 45 }) },
      { t: 2.45, phase: 'end', pose: P({ aL: 88, eL: 25, aR: 88, eR: 25, head: -45, legL: 70 }) },
      { t: 5.75, phase: 'end', pose: P({ aL: 88, eL: 25, aR: 88, eR: 25, head: -45, legL: 70 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 16 左下势独立：先屈膝下蹲穿掌，再起身一腿独立、左手上举
  'taiji-16': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.05, phase: 'work', pose: P({ aL: 40, eL: 30, aR: 90, eR: 40, crouch: 0.5 }) },
      { t: 2.5, phase: 'end', pose: P({ aL: 170, eL: 8, aR: 30, eR: 20, lift: 0.6 }) },
      { t: 5.95, phase: 'end', pose: P({ aL: 170, eL: 8, aR: 30, eR: 20, lift: 0.6 }) },
      { t: 6.6, phase: 'start', pose: P({}) },
    ],
  },

  // 17 右下势独立：同 16，右腿独立、右手上举
  'taiji-17': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.05, phase: 'work', pose: P({ aL: 90, eL: 40, aR: 40, eR: 30, crouch: 0.5 }) },
      { t: 2.5, phase: 'end', pose: P({ aL: 30, eL: 20, aR: 170, eR: 8, lift: 0.6 }) },
      { t: 5.95, phase: 'end', pose: P({ aL: 30, eL: 20, aR: 170, eR: 8, lift: 0.6 }) },
      { t: 6.6, phase: 'start', pose: P({}) },
    ],
  },

  // 18 左右穿梭（玉女穿梭）：一手架于额前、一手前推（末段定式 = 左手在上）
  'taiji-18': {
    dur: 6.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 0.85, phase: 'work', pose: P({ aL: 90, eL: 30, aR: 150, eR: 20 }) },
      { t: 1.7, phase: 'work', pose: P({ aL: 90, eL: 30, aR: 150, eR: 20 }) },
      { t: 2.5, phase: 'end', pose: P({ aL: 150, eL: 20, aR: 90, eR: 30 }) },
      { t: 5.95, phase: 'end', pose: P({ aL: 150, eL: 20, aR: 90, eR: 30 }) },
      { t: 6.6, phase: 'start', pose: P({}) },
    ],
  },

  // 19 海底针：上体前俯，右手向下插出，左手护于右腕内侧
  'taiji-19': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 20, eL: 15, aR: 70, eR: 60, bend: 0.30 }) },
      { t: 2.3, phase: 'end', pose: P({ aL: 20, eL: 15, aR: 95, eR: 130, bend: 0.55 }) },
      { t: 5.4, phase: 'end', pose: P({ aL: 20, eL: 15, aR: 95, eR: 130, bend: 0.55 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 20 闪通臂：一手架额、一手前推，弓步前后撑开
  'taiji-20': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 90, eL: 40, aR: 100, eR: 40 }) },
      { t: 2.3, phase: 'end', pose: P({ aL: 145, eL: 10, aR: 100, eR: 15 }) },
      { t: 5.4, phase: 'end', pose: P({ aL: 145, eL: 10, aR: 100, eR: 15 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 21 转身搬拦捶：转身搬拳、拦掌，再进步冲拳（转身 + 一拳向前）
  'taiji-21': {
    dur: 6.4,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 95, eL: 10, aR: 70, eR: 90, head: -18 }) },
      { t: 2.45, phase: 'end', pose: P({ aL: 95, eL: 0, aR: 60, eR: 110, head: -35 }) },
      { t: 5.75, phase: 'end', pose: P({ aL: 95, eL: 0, aR: 60, eR: 110, head: -35 }) },
      { t: 6.4, phase: 'start', pose: P({}) },
    ],
  },

  // 22 如封似闭：两手自胸前回收，再翻掌向前缓缓按出
  'taiji-22': {
    dur: 5.8,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.05, phase: 'work', pose: P({ aL: 62, eL: 80, aR: 62, eR: 80 }) },
      { t: 2.2, phase: 'end', pose: P({ aL: 75, eL: 85, aR: 75, eR: 85 }) },
      { t: 5.25, phase: 'end', pose: P({ aL: 75, eL: 85, aR: 75, eR: 85 }) },
      { t: 5.8, phase: 'start', pose: P({}) },
    ],
  },

  // 23 十字手：两手交叉合抱上举于额前
  'taiji-23': {
    dur: 6.0,
    keys: [
      { t: 0.0, phase: 'start', pose: P({}) },
      { t: 1.1, phase: 'work', pose: P({ aL: 110, eL: 60, aR: 110, eR: 60 }) },
      { t: 2.3, phase: 'end', pose: P({ aL: 165, eL: 10, aR: 165, eR: 10 }) },
      { t: 5.4, phase: 'end', pose: P({ aL: 165, eL: 10, aR: 165, eR: 10 }) },
      { t: 6.0, phase: 'start', pose: P({}) },
    ],
  },

  // 24 收势：两手分开再缓缓下落，还原站立（承十字手）
  'taiji-24': {
    dur: 5.6,
    keys: [
      { t: 0.0, phase: 'start', pose: P({ aL: 165, eL: 10, aR: 165, eR: 10 }) },
      { t: 1.0, phase: 'work', pose: P({ aL: 70, eL: 60, aR: 70, eR: 60 }) },
      { t: 2.15, phase: 'end', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
      { t: 5.05, phase: 'end', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
      { t: 5.6, phase: 'start', pose: P({ aL: 10, eL: 8, aR: 10, eR: 8 }) },
    ],
  },
}

/** 查询某式的动画数据；没有则返回 null（调用方降级为静态图示） */
export function getAnim(animKey) {
  if (!animKey) return null
  return DEMO_ANIMS[animKey] || null
}
