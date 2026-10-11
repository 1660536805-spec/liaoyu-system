// 五禽戏 · 十式判定规则（健身气功 · 五禽戏，国家体育总局）＋ 太极 · 二十四式判定规则
//
// 【与八段锦的关系】
//   八段锦判定逻辑在 judge.js 内部（MOVES 数组），与拳种耦合。
//   五禽戏/太极式数不同于八段锦（10 式、24 式），故独立成一个「规则集」，
//   由 judge.js 按当前拳种选用。式名/文案仍走 styles.js / speech.js。
//   ★ RULE_SETS[style] 的**数组长度必须等于该拳种的式数** —— judge.js 直接把它当
//     「每式的打分函数」用（scores() 逐元素调用、update() 按 order 取下标）。
//
// 【设计】
//   每式规则 = (p, ctx) => 0~1 分，与八段锦同样的接口。
//   ctx 提供：torso/shoMid/hipMid/leanDeg/hasLegs/角/距离 等归一化工具。
//   复用 judge.js 里的 4/8、leanDeg、hasLegs，保证两套拳种口径一致。
//
// 【十式核心特征】（来自国家体育总局《健身气功 · 五禽戏》十式要领）
//   1 虎举：两手十指撑开成虎爪，沿体前中线上举过头、再下拉 —— 「双腕过肩 + 两腕张开 + 肘伸」
//   2 虎扑：两手成虎爪上举后，上体前俯、两手向体前下方扑落 —— 「上体前俯 + 双腕沉到肩线下」
//   3 鹿抵：迈步弓步、以腰为轴侧屈拧转，一肘抵腰、一臂上举伸抵 —— 「单腕越肩 + 躯干前后偏移」
//   4 鹿奔：两臂前伸、含胸收腹弓背，如鹿疾奔 —— 「上体前俯 + 两腕齐肩 + 屈肘收臂」
//   5 熊运：以腰为轴、上体画圆，两手轻贴小腹 —— 「肩中点画圆 + 双手收在腹前 + 屈肘」
//   6 熊晃：提髋提腿、落步踏实，身体左右晃动、两臂随体摆 —— 「肩随身体横摆 + 侧倾 + 垂臂肘伸」
//   7 猿提：两手成猿钩上提至胸，耸肩缩项、提踵 —— 「腕在胸腹前的带状高度 + 屈肘 + 躯干上浮」
//   8 猿摘：一手猿钩收于腰侧、另一手向斜上方摘取，眼随手动 —— 「一高一低强不对称 + 头随手动」
//   9 鸟伸：两手腹前相叠、上举过头再向前下按落 —— 「双腕过顶 + 两腕近乎并拢」
//  10 鸟飞：一腿独立、两掌成鸟翅沿体侧上摆 —— 「双腕与肩同高 + 两腕大幅张开 + 躯干上下起伏」

/**
 * @param {Array} p  MediaPipe landmarks（33 点）
 * @param {object} ctx 由 judge.js 注入的归一化工具集
 * @returns {number} 0~1
 */
// 【标定口径（2026-10-11 十式重标定）】
//   ① 只依赖**上半身**（肩/肘/腕/躯干/头）—— 与八段锦同一哲学：近距离取景时膝/踝
//      visibility≈0.02，靠腿的判据在真机上不可用；且示范小人（demoAnim 的 11 个
//      标量角）本就画不出髋部平移与髋的高度差。
//   ② 「前俯」用**相对量** `__bendRel`（judge 注入，以本次会话最挺直躯干为基准）——
//      示范小人是短臂画风、真人臂长更长，「躯干高 / 肩宽」绝对值不可移植。
//      髋不可见时降级为 0（该分项归零，其余分项照常）。
//   ③ 十式里有三对「构型相近」的式，必须靠**有实体依据的鉴别项**分开：
//      虎举 / 鸟伸 —— 都在头顶，靠**两腕张开的幅度**（虎爪张开 ≥1.45T vs 两手相叠 ≈1.1T）
//      虎扑 / 鹿奔 —— 都上体前俯，靠**腕位高低 + 肘的屈伸**（虎爪下扑到肩线下且肘伸 vs 齐肩弓背收臂屈肘）
//      熊运 / 熊晃 —— 都靠肩的横摆，靠**肘的屈伸 + 手位 + 侧倾幅度**（手贴小腹屈肘 vs 垂臂肘伸侧倾大）
//   （辅助工具箱 clamp01/up01/down01/band01/wristUp/wristSpan/elbowMin/bendRel/headTurn
//     定义在本文件下半部 —— 规则在 judge 调用时才执行，那时模块已求值完，故可直接引用。）
export const WUQINXI_RULES = [
  // 1 虎举 —— 两手十指撑开成虎爪，沿体前中线上举过头、再下拉
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO)) return 0
    const r = wristUp(p, c)
    const both = up01(r.lo, 0.75, 1.40)              // 双腕都高过肩
    const apart = up01(wristSpan(p, c), 1.45, 2.10)  // 虎爪张开（与「鸟伸」两手相叠区分）
    const st = up01(elbowMin(p, c), 0.80, 0.95)      // 上撑，肘基本伸直
    return both * 0.46 + apart * 0.30 + st * 0.24
  },

  // 2 虎扑 —— 两手成虎爪上举后，上体前俯、两手向体前下方扑落
  //    【与虎举区分】虎扑的定式是「上体前俯 + 双腕沉到肩线以下」；虎举是「双腕过肩」。
  //    【与鹿奔区分】鹿奔的腕齐肩、且屈肘收臂；虎扑的手一路扑到肩线下、肘基本伸。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const bowed = up01(bendRel(p), 0.14, 0.34)               // 以腰胯送下上体（不是弯腰驼背）
    const low = up01(-r.lo, 0.60, 1.35)                      // 两只腕都沉到肩线以下
    const spread = band01(wristSpan(p, c), 1.30, 2.60, 0.60) // 双爪分开下扑，不是并拢
    return bowed * 0.40 + low * 0.34 + spread * 0.26
  },

  // 3 鹿抵 —— 迈步弓步、以腰为轴侧屈拧转，一肘抵腰、一臂上举伸抵，目视后腿脚跟
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
    // 躯干前后偏移（侧屈拧转 → 肩相对髋有水平位移）
    const back = c.okUp(Math.abs(s.x - h.x) / t, 0.20, 0.65)
    return reach * 0.42 + up * 0.34 + back * 0.24
  },

  // 4 鹿奔 —— 两臂前伸、含胸收腹弓背，如鹿疾奔前冲
  //    【与鹿抵区分】鹿抵是单侧拧转（躯干前后偏移大）；鹿奔左右对称、双手齐肩同高。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const bowed = up01(bendRel(p), 0.14, 0.34)          // 收腹弓背
    const mid = band01((r.hi + r.lo) / 2, -0.60, -0.05, 0.25) // 两腕齐肩（不前伸上举、不下垂）
    const bent = down01(elbowMin(p, c), 0.72, 0.90)     // 弓背时两臂回收，屈肘明显
    const sym = down01(r.d, 0.30, 0.85)                 // 左右对称（与「鹿抵」的拧转分开）
    return bowed * 0.34 + mid * 0.30 + bent * 0.20 + sym * 0.16
  },

  // 5 熊运 —— 以腰为轴、上体画圆，两手轻贴小腹，双膝微屈含胸
  //    【信号说明】横移取「肩中点」而非髋：髋是画圆的圆心、基本不动。
  //    ⚠️ 早先这里还 max 了一个 __sway 兜底，会把「熊晃」（提髋落步、髋横移）误认成熊运，
  //       故只取肩中点序列 __shoSway；熊晃改由「垂臂肘伸 + 侧倾」判别。
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO)) return 0
    const t = c.torso(p)
    const circle = up01(p.__shoSway ?? 0, 0.10, 0.32)   // 肩中点横向画圆幅度（时序极差）
    const lean = up01(c.leanDeg(p), 6, 26)              // 熊的圆背：躯干略弯
    const bent = down01(elbowMin(p, c), 0.50, 0.80)     // 两手贴小腹，肘是屈的
    const rel = (Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y) - c.shoMid(p).y) / t
    const handsLow = band01(rel, 0.10, 1.30, 0.30)      // 手收在腹前（太低＝垂臂，归熊晃）
    return circle * 0.34 + lean * 0.20 + bent * 0.24 + handsLow * 0.22
  },

  // 6 熊晃 —— 提髋提腿、落步踏实，身体随之左右晃动，两臂自然摆动，如熊走路
  //    【与熊运区分】熊晃是「走路」：两臂下垂摆动（肘伸、手在体侧很低）、身体侧倾大；
  //    熊运是「画圆」：两手收在腹前（屈肘），躯干只略弯。两者共用「肩随身体横摆」这一项。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const swing = up01(p.__shoSway ?? 0, 0.14, 0.40)          // 肩随落步左右摆
    const tilt = up01(Math.abs(c.leanDeg(p)), 8, 24)          // 身体左右晃（侧倾）
    const armsLow = up01(-r.lo, 0.85, 1.60)                   // 两臂自然下垂
    const straight = up01(elbowMin(p, c), 0.86, 0.96)         // 垂臂时肘是伸的
    return swing * 0.36 + tilt * 0.24 + armsLow * 0.24 + straight * 0.16
  },

  // 7 猿提 —— 两手成猿钩上提至腹前~肩前，耸肩缩项、收腹提肛、提踵
  //    【与虎举区分】虎举是「双腕高过肩 0.75T 以上」；猿提只提到胸腹前，
  //    故用「带状」评分：rel 落在 [−1.1, −0.5] 最像，高过 −0.1T 就归「举」。
  //    【与鹿奔区分】鹿奔是上体前俯弓背（躯干压低）；猿提是躯干上浮（__bob 提踵）。
  (p, c) => {
    if (!c.need(p, c.L_WRI, c.R_WRI, c.L_ELB, c.R_ELB, c.L_SHO, c.R_SHO)) return 0
    const t = c.torso(p)
    const rel = (c.shoMid(p).y - Math.min(v(p, c.L_WRI).y, v(p, c.R_WRI).y)) / t   // 正 = 高于肩
    const band = c.okUp(rel, -1.10, -0.50) * c.okDown(rel, -0.10, 0.50)
    // 双手收拢成钩（手间距小）
    // ⚠️ 早前写成 okDown(dist/t, 0.75, 0.30)（good > bad），按公式会「越张开越得 1」；
    //    改为正常的 good < bad：收拢得分，张开的架式归零。
    const near = c.okDown(dist(v(p, c.L_WRI), v(p, c.R_WRI)) / t, 1.60, 2.60)
    // 屈肘上提
    const bend = c.okUp(
      1 - (c.angle(v(p, c.L_SHO), v(p, c.L_ELB), v(p, c.L_WRI)) +
           c.angle(v(p, c.R_SHO), v(p, c.R_ELB), v(p, c.R_WRI))) / 360, 0.12, 0.40)
    // 提踵耸肩：整个人被「拎起来」（躯干垂直上浮）
    const rise = c.okUp(p.__bob ?? 0, 0.03, 0.12)
    return band * 0.32 + near * 0.22 + bend * 0.26 + rise * 0.20
  },

  // 8 猿摘 —— 一手猿钩收于腰侧、另一手向斜上方摘取，眼随手动，一腿虚步点地
  //    【与鹿抵区分】鹿抵双手都在肩上方、且靠「躯干前后偏移」得分；猿摘是**一手高一手低**
  //    的强不对称，头随摘的那只手转。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const asym = up01(r.d, 0.75, 1.90)               // 一高一低（摘手 vs 收在腰侧的手）
    const hiUp = up01(r.hi, 0.30, 1.20)              // 摘的那只在肩上方
    const loLow = up01(-r.lo, 0.55, 1.30)            // 收的那只在腰侧（肩线以下）
    const look = up01(headTurn(p, c), 0.10, 0.34)    // 眼随手动
    return asym * 0.34 + hiUp * 0.30 + loLow * 0.24 + look * 0.12
  },

  // 9 鸟伸 —— 两手在腹前相叠、上举过头，再向前下方按落；同时一腿后伸
  //    【与虎举区分】两式都在头顶，唯一实体差别是**手的开合**：
  //    虎举十指撑开成虎爪（两腕张得开），鸟伸两手相叠（两腕近乎并拢）。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const both = up01(r.lo, 0.85, 1.50)                   // 双腕都过顶
    const together = down01(wristSpan(p, c), 1.05, 1.70)  // 两手相叠、两腕并拢
    const upright = down01(Math.abs(c.leanDeg(p)), 10, 26) // 上举时躯干端正
    return both * 0.46 + together * 0.34 + upright * 0.20
  },

  // 10 鸟飞 —— 一腿独立、两掌成鸟翅沿体侧上摆；双臂平展如翅 + 躯干上下起伏
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

// ---------------------------------------------------------------- 太极（二十四式）
// 判定口径与五禽戏一致（只依赖上半身），每式给一条「手臂构型」签名：
//   hi  = 较高的那只手腕相对肩的**上举量 / 肩宽**（正 = 高于肩，1.4 = 举过头顶）
//   lo  = 较低的那只（同口径）
//   span= 双腕间距 / 肩宽（1.0 = 双手并拢，3.8 = 双臂完全平展）
// 再按需叠加：side（哪只手在上）、elbowMin（肘是否伸直）、headTurn（转身）、
// torsoH（前俯）、__shoSway（腰带动肩画圆）。
//
// 【重复式】二十四式里「单鞭」（9、11）、「起势/收势」（1、24）在正面构型上本就同式，
//   分数互相命中属套路重复、非规则串扰；产品默认「顺序模式」只判当前式，无影响。
//   「左/右揽雀尾」「左/右下势独立」「右蹬脚/转身左蹬脚」用 side / headTurn 区分。
//
// 【回放验收标定（2026-10-11）】把 taiji-1..24 示范动画逐帧喂进来，要求「自判 ≥0.55、
//   非重复式跨式 core <0.80」。为过闸补了这些**有实体依据**的鉴别项：
//     · 「起势/收势」的时序：签名（松沉站定）必须在 ≤0.40 时长就位 —— 否则手臂下落
//       途中会扫过「双手胸前张开」，把 左揽雀尾 / 右蹬脚 刷满（core 1.00/0.99）。
//     · 单鞭（9/11）：加「双腕大幅张开」span≥2.8 —— 单鞭是双臂尽展的式，
//       而 转身搬拦捶 是「冲拳 + 护手」相对收拢（span≈2.5），以此分开。
//     · 高探马（12）/ 搂膝拗步（4）：两者正面手臂构型**本质相同**（一手肩高、一手低位），
//       唯一实体差别是 搂膝 是弓步前俯、高探马 上体正直 → 用**相对前俯** bendRel 判别
//       （高探马要挺直、搂膝要弓步前俯、海底针要前俯更深）。
//     · 右蹬脚（13）/ 转身左蹬脚（15）：加「左右对称（r.d 小）」并收紧展幅下限 ——
//       分开 野马分鬃 / 白鹤亮翅 这类「一高一低」的宽架。
//     · 手挥琵琶（5）：加大「静止」权重、收紧「双手合抱之窄」—— 云手是**持续划圆**
//       （肩中点横移大 → still→0），如封似闭 收在胸口但两手不并拢（span≈2.2）。
//     · 左揽雀尾（7）：收紧「胸前同高」的上界（-0.46）与腕距上限 —— 避免 蹬脚 类
//       （腕在肩高、展幅更大）被误认。

// ---- 局部工具箱（只服务 TAIJI_RULES，不改动五禽戏/八段锦任何口径）----
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const up01 = (x, lo, hi) => clamp01((x - lo) / (hi - lo))               // 越大越好
const down01 = (x, good, bad) => 1 - clamp01((x - good) / (bad - good)) // 越小越好
/** 带：x ∈ [lo,hi] 得 1，两侧各 soft 内线性降到 0。 */
const band01 = (x, lo, hi, soft = 0.22) =>
  Math.min(up01(x, lo - soft, lo), down01(x, hi, hi + soft))

/** 双腕相对肩的上举量 / 肩宽。 */
function wristUp(p, c) {
  const t = c.torso(p), s = c.shoMid(p).y
  const l = (s - v(p, c.L_WRI).y) / t
  const r = (s - v(p, c.R_WRI).y) / t
  return { l, r, hi: Math.max(l, r), lo: Math.min(l, r), d: Math.abs(l - r) }
}
const wristSpan = (p, c) => dist(v(p, c.L_WRI), v(p, c.R_WRI)) / c.torso(p)

/** 肘内角 /180（1 = 完全伸直，越小越屈）。 */
function elbowRatio(p, c, side) {
  const S = side === 'L' ? c.L_SHO : c.R_SHO
  const E = side === 'L' ? c.L_ELB : c.R_ELB
  const W = side === 'L' ? c.L_WRI : c.R_WRI
  return c.angle(v(p, S), v(p, E), v(p, W)) / 180
}
const elbowMin = (p, c) => Math.min(elbowRatio(p, c, 'L'), elbowRatio(p, c, 'R'))

/** 躯干有效高度 / 肩宽：前俯（bend）时 spineLen 缩短 → 该值变小。 */
const torsoH = (p, c) => (c.hipMid(p).y - c.shoMid(p).y) / c.torso(p)

/** **相对**前俯量（0 = 本次会话见过的最挺直，越大越弯）；髋不可见时为 0。
 *  用于「弓步前俯」类（搂膝拗步 / 海底针）—— 绝对比值在示范小人（短臂画风）
 *  与真人（长臂）之间不可移植，相对量可移植。见 judge.js `__bendRel`。 */
const bendRel = (p) => p.__bendRel ?? 0

/** 哪只手更高：+1 左手高、-1 右手高、0 齐平。 */
function higherSide(p, c) {
  const l = v(p, c.L_WRI).y, r = v(p, c.R_WRI).y
  if (Math.abs(l - r) < 0.025) return 0
  return l < r ? 1 : -1
}
const sideIs = (s, want) => (s === want ? 1 : 0)

/** 头部侧偏量 / 肩宽：转身/转头式（`head` 关键帧）的信号。 */
const headTurn = (p, c) => Math.abs(v(p, c.NOSE).x - c.shoMid(p).x) / c.torso(p)

const armNeed = (p, c) => c.need(p, c.L_WRI, c.R_WRI, c.L_SHO, c.R_SHO, c.L_ELB, c.R_ELB)
const bodyNeed = (p, c) => c.need(p, c.L_HIP, c.R_HIP)

export const TAIJI_RULES = [
  // 1 起势 —— 双臂下垂松沉、站定（与 24 收势同型）
  (p, c) => {
    if (!armNeed(p, c) || !bodyNeed(p, c)) return 0
    const r = wristUp(p, c)
    const low = band01(r.hi, -1.80, -1.05, 0.35) * band01(r.lo, -1.80, -1.05, 0.35)
    const narrow = down01(wristSpan(p, c), 1.20, 1.95)
    const upright = down01(c.leanDeg(p), 8, 26)
    return low * 0.45 + narrow * 0.25 + upright * 0.30
  },

  // 2 左右野马分鬃 —— 一手前上掤（肩以上）、一手按于胯旁，左右分张
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upMid = band01(r.hi, 0.28, 0.82, 0.14)
    const otherLow = band01(r.lo, -1.85, -1.00, 0.32)
    const asym = up01(r.d, 1.30, 2.10) * sideIs(higherSide(p, c), 1)
    return upMid * 0.42 + otherLow * 0.32 + asym * 0.26
  },

  // 3 白鹤亮翅 —— 一手举于额前（过顶）、一手按于胯旁，右侧亮翅
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upHi = band01(r.hi, 1.00, 1.26, 0.18)
    const otherLow = band01(r.lo, -1.85, -1.02, 0.32)
    const asym = up01(r.d, 1.90, 2.70) * sideIs(higherSide(p, c), -1)
    return upHi * 0.42 + otherLow * 0.30 + asym * 0.28
  },

  // 4 左右搂膝拗步 —— 一手搂膝（垂于体侧）、一手前推（与肩平），弓步前俯
  //    【与高探马区分】正面手臂构型与高探马几乎同型（一手肩高、一手低位），
  //    唯一实体差别是**弓步前俯**：搂膝要弯腰、高探马上体正直 → 用相对前俯 bendRel。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upNear = band01(r.hi, -0.15, 0.13, 0.14)
    const otherLow = band01(r.lo, -1.85, -1.02, 0.32)
    const asym = up01(r.d, 1.10, 1.80)
    const bowed = up01(bendRel(p), 0.05, 0.15)
    return upNear * 0.28 + otherLow * 0.24 + asym * 0.20 + bowed * 0.28
  },

  // 5 手挥琵琶 —— 两手合抱于胸前（一前一后收于中线）、虚步站定不动
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const midBand = band01((r.hi + r.lo) / 2, -1.10, -0.70, 0.25)
    const narrow = down01(wristSpan(p, c), 1.30, 1.75)
    const sym = down01(r.d, 0.15, 0.60)
    const still = down01(p.__shoSway ?? 0, 0.04, 0.13)
    return midBand * 0.24 + narrow * 0.28 + sym * 0.16 + still * 0.32
  },

  // 6 左右倒卷肱 —— 两手一前（胸高）一后（腰侧）卷收、屈肘明显
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const midBand = band01(r.lo, -1.20, -0.80, 0.22)
    const hiBand = band01(r.hi, -0.75, -0.30, 0.20)
    const bent = down01(elbowMin(p, c), 0.28, 0.70)
    return midBand * 0.42 + hiBand * 0.30 + bent * 0.28
  },

  // 7 左揽雀尾 —— 掤捋挤按：双手收于胸前同一高度、张得较开
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const midBand = band01((r.hi + r.lo) / 2, -0.78, -0.46, 0.10)
    const wide = up01(wristSpan(p, c), 2.40, 3.00) * down01(wristSpan(p, c), 3.30, 3.70)
    const sym = down01(r.d, 0.15, 0.65)
    return midBand * 0.40 + wide * 0.32 + sym * 0.28
  },

  // 8 右揽雀尾 —— 右式：右手在前上、左手在后下
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const hiBand = band01(r.hi, -0.10, 0.30, 0.22)
    const midBand = band01(r.lo, -1.05, -0.60, 0.25)
    const asym = up01(r.d, 0.60, 1.20) * sideIs(higherSide(p, c), -1)
    return hiBand * 0.38 + midBand * 0.30 + asym * 0.32
  },

  // 9 单鞭 —— 一手成勾手侧伸（肩高）、一手立掌前推（胸高）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const hook = band01(r.hi, -0.10, 0.30, 0.25)
    const push = band01(r.lo, -0.90, -0.45, 0.22)
    const asym = up01(r.d, 0.50, 1.10) * sideIs(higherSide(p, c), 1)
    const wide = up01(wristSpan(p, c), 2.80, 3.40)
    return hook * 0.30 + push * 0.26 + asym * 0.22 + wide * 0.22
  },

  // 10 云手 —— 两手在体前同一高度上下交替划圆，腰随手转（肩中点持续横移）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const midBand = band01((r.hi + r.lo) / 2, -1.05, -0.75, 0.22)
    const narrow = down01(wristSpan(p, c), 1.40, 2.10)
    const bent = down01(elbowMin(p, c), 0.30, 0.72)
    const sway = up01(p.__shoSway ?? 0, 0.06, 0.22)
    return midBand * 0.32 + narrow * 0.24 + bent * 0.22 + sway * 0.22
  },

  // 11 单鞭（定式重复，构型与 9 相同）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const hook = band01(r.hi, -0.10, 0.30, 0.25)
    const push = band01(r.lo, -0.90, -0.45, 0.22)
    const asym = up01(r.d, 0.50, 1.10) * sideIs(higherSide(p, c), 1)
    const wide = up01(wristSpan(p, c), 2.80, 3.40)
    return hook * 0.30 + push * 0.26 + asym * 0.22 + wide * 0.22
  },

  // 12 高探马 —— 一手立掌向前探（与肩平）、一手收于腰侧；上体正直
  //    【与搂膝拗步区分】手臂构型同型，靠「上体正直」（bendRel 小）分开。
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const near = band01(r.hi, -0.18, 0.08, 0.09)
    const otherLow = band01(r.lo, -1.85, -1.05, 0.30)
    const asym = up01(r.d, 1.05, 1.70) * sideIs(higherSide(p, c), 1)
    const upright = 1 - up01(bendRel(p), 0.06, 0.16)
    return near * 0.30 + otherLow * 0.24 + asym * 0.22 + upright * 0.24
  },

  // 13 右蹬脚 —— 两手交叉后向两侧平展、肘较直、身体正对（不转身）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const pass = band01((r.hi + r.lo) / 2, -0.55, -0.12, 0.18)
    const straight = up01(elbowMin(p, c), 0.76, 0.92)
    const wide = up01(wristSpan(p, c), 3.45, 3.90)
    const noTurn = down01(headTurn(p, c), 0.05, 0.22)
    const sym = down01(r.d, 0.18, 0.60)
    return pass * 0.26 + straight * 0.22 + wide * 0.20 + noTurn * 0.16 + sym * 0.16
  },

  // 14 双峰贯耳 —— 两拳自两侧合于耳前：双手近乎并拢、肘深屈、与头同高
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const midBand = band01((r.hi + r.lo) / 2, 0.02, 0.30, 0.20)
    const deep = down01(elbowMin(p, c), 0.30, 0.58)
    const notWide = down01(wristSpan(p, c), 2.05, 2.90)
    const sym = down01(r.d, 0.18, 0.60)
    return midBand * 0.30 + deep * 0.28 + notWide * 0.22 + sym * 0.20
  },

  // 15 转身左蹬脚 —— 同 13 的分展，但转身（头部侧偏）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const pass = band01((r.hi + r.lo) / 2, -0.55, -0.12, 0.18)
    const straight = up01(elbowMin(p, c), 0.72, 0.90)
    const wide = up01(wristSpan(p, c), 3.45, 3.90)
    const turn = up01(headTurn(p, c), 0.14, 0.38)
    const sym = down01(r.d, 0.18, 0.60)
    return pass * 0.24 + straight * 0.20 + wide * 0.18 + turn * 0.22 + sym * 0.16
  },

  // 16 左下势独立 —— 一手向上撑举（过顶）、一手下按，左侧在高
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upVeryHigh = band01(r.hi, 1.26, 1.55, 0.20)
    const lowOther = band01(r.lo, -1.60, -0.95, 0.28)
    const asym = up01(r.d, 1.90, 2.80) * sideIs(higherSide(p, c), 1)
    return upVeryHigh * 0.40 + lowOther * 0.32 + asym * 0.28
  },

  // 17 右下势独立 —— 同 16，右侧在高
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upVeryHigh = band01(r.hi, 1.26, 1.55, 0.20)
    const lowOther = band01(r.lo, -1.60, -0.95, 0.28)
    const asym = up01(r.d, 1.90, 2.80) * sideIs(higherSide(p, c), -1)
    return upVeryHigh * 0.40 + lowOther * 0.32 + asym * 0.28
  },

  // 18 左右穿梭（玉女穿梭）—— 一手架于额前、一手前推（肩稍下）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upHigh = band01(r.hi, 0.95, 1.20, 0.20)
    const midOther = band01(r.lo, -0.50, -0.10, 0.22)
    const asym = up01(r.d, 1.05, 1.70) * sideIs(higherSide(p, c), 1)
    return upHigh * 0.40 + midOther * 0.32 + asym * 0.28
  },

  // 19 海底针 —— 上体前俯、一手向下插（胸以下）、一手垂于低位
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const fwdLow = band01(r.hi, -0.75, -0.20, 0.25)
    const veryLow = band01(r.lo, -1.60, -1.05, 0.25)
    const bent = up01(bendRel(p), 0.10, 0.28)
    return fwdLow * 0.38 + veryLow * 0.30 + bent * 0.32
  },

  // 20 闪通臂 —— 一手架额（高）、一手前推（与肩平）
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const upHigh = band01(r.hi, 0.95, 1.20, 0.20)
    const shoulderOther = band01(r.lo, -0.10, 0.25, 0.20)
    const asym = up01(r.d, 0.80, 1.40) * sideIs(higherSide(p, c), 1)
    return upHigh * 0.40 + shoulderOther * 0.32 + asym * 0.28
  },

  // 21 转身搬拦捶 —— 转身冲拳：一拳向前（肩高）、一手护于胸前（腰以上）＋转身
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const fist = band01(r.hi, -0.05, 0.30, 0.22)
    const guard = band01(r.lo, -1.10, -0.60, 0.25)
    const turn = up01(headTurn(p, c), 0.14, 0.38)
    return fist * 0.36 + guard * 0.30 + turn * 0.34
  },

  // 22 如封似闭 —— 双手自胸前回收再前按：同一高度（胸）、张开中等、左右对称
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const midBand = band01((r.hi + r.lo) / 2, -1.00, -0.68, 0.20)
    const midWide = up01(wristSpan(p, c), 1.90, 2.50) * down01(wristSpan(p, c), 2.50, 3.10)
    const sym = down01(r.d, 0.15, 0.55)
    return midBand * 0.40 + midWide * 0.32 + sym * 0.28
  },

  // 23 十字手 —— 两手交叉上举合抱于额前：双手过顶同高、并拢、对称
  (p, c) => {
    if (!armNeed(p, c)) return 0
    const r = wristUp(p, c)
    const bothUp = band01((r.hi + r.lo) / 2, 1.15, 1.45, 0.22)
    const sym = down01(r.d, 0.18, 0.55)
    const narrow = down01(wristSpan(p, c), 2.00, 2.90)
    return bothUp * 0.42 + sym * 0.32 + narrow * 0.26
  },

  // 24 收势 —— 两臂下落还原、站定（与 1 起势同型）
  (p, c) => {
    if (!armNeed(p, c) || !bodyNeed(p, c)) return 0
    const r = wristUp(p, c)
    const low = band01(r.hi, -1.80, -1.05, 0.35) * band01(r.lo, -1.80, -1.05, 0.35)
    const narrow = down01(wristSpan(p, c), 1.20, 1.95)
    const upright = down01(c.leanDeg(p), 8, 26)
    return low * 0.45 + narrow * 0.25 + upright * 0.30
  },
]
