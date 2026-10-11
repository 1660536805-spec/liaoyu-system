// 拳种注册表 —— 八段锦 / 太极拳 / 五禽戏
//
// 【三个拳种都已完成】
//   八段锦 8 式（moves.json，内置判定）
//   太极拳 24 式（TAIJI_MOVES，标准「简化二十四式」；判定走 styleRules.js 的 TAIJI_RULES）
//   五禽戏 10 式（WUQINXI_MOVES，国家标准《健身气功·五禽戏》全十式；
//                —— 注意不是安徽亳州的「华佗五禽戏」，是两套；判定走 WUQINXI_RULES）
//
// 【status 说明】
//   ready   —— 有完整 moves，可练
//   partial —— 有内容但未完成，仍可练
//   pending —— 清单未定，无 moves，UI 上禁用
//
// 【弦位口径】
//   太极：七弦、二十四式，式数多于弦数 ⇒ 按 (id-1)%7+1 循环落弦（同八段锦「一式弹一弦」
//   的心意，只是走两圈半）。
//   五禽戏：十式 = 五禽 × 两式（虎/鹿/熊/猿/鸟 各两式）⇒ 保留五弦，一禽占一弦、
//   同禽两式弹同弦（stringIndex = ⌈id/2⌉）。

import baduanjin from './moves.json'

/** 八段锦八式（已实现） */
const BADUANJIN = {
  id: 'baduanjin',
  name: '八段锦',
  subtitle: '八式 · 古琴七弦',
  status: 'ready',
  badge: '已上线',
  strings: 7,
  desc: '双手托天理三焦起于双手托天理三焦，末式背后七颠百病消收势。做完一套，弹完一曲古琴。',
  moves: baduanjin,
}

// ---------------------------------------------------------------- 太极
// 标准「简化二十四式太极拳」二十四式。式名、次序按国家体委编定套路；
// tip/cue 为按要领自撰的短句（tip 供列表/卡片，cue 供语音与提示条）。
// 「单鞭」「揽雀尾」「蹬脚」「下势独立」在套路里各出现两次（左右式），这里按套路
// 如实保留两条，判定规则按各自的手臂构型区分（详见 styleRules.js 的 TAIJI_RULES）。
const TAIJI_MOVES = [
  {
    id: 1, name: '起势',
    tip: '两脚开立与肩同宽，两臂自然下垂，浑身松沉。',
    cue: '两脚与肩同宽站直，双手自然下垂，肩松、肘沉，气沉丹田。',
    stringIndex: 1, sec: 30, photo: '/photos/tj01.jpg',
  },
  {
    id: 2, name: '左右野马分鬃',
    tip: '一手向前上掤出、一手下按，如野马分鬃，左右交替。',
    cue: '一手向前上方掤出，另一手按于胯旁，两臂分开如分鬃，弓步左右交替。',
    stringIndex: 2, sec: 38, photo: '/photos/tj02.jpg',
  },
  {
    id: 3, name: '白鹤亮翅',
    tip: '一手举于额前、一手按于胯旁，如白鹤展翅。',
    cue: '一手缓缓举至额前、掌心向内，另一手按于胯旁，虚步亮翅。',
    stringIndex: 3, sec: 28, photo: '/photos/tj03.jpg',
  },
  {
    id: 4, name: '左右搂膝拗步',
    tip: '一手搂膝、一手前推，弓步拗身，左右交替。',
    cue: '一手经膝前搂过，另一手成立掌向前推出，弓步拗身，左右交替。',
    stringIndex: 4, sec: 40, photo: '/photos/tj04.jpg',
  },
  {
    id: 5, name: '手挥琵琶',
    tip: '两手一前一后合抱于胸前，如抱琵琶。',
    cue: '两手一前一后合抱于胸前，左手在前如扶琵琶，虚步站定。',
    stringIndex: 5, sec: 28, photo: '/photos/tj05.jpg',
  },
  {
    id: 6, name: '左右倒卷肱',
    tip: '两手交替向后卷收、再向前推，退步连环。',
    cue: '一手向后卷收过耳，再向前推出，另一手回收；退步左右交替。',
    stringIndex: 6, sec: 40, photo: '/photos/tj06.jpg',
  },
  {
    id: 7, name: '左揽雀尾',
    tip: '掤、捋、挤、按四法，左式一遍。',
    cue: '左手掤起，向右后捋，再向前挤、双掌下按，左式一遍。',
    stringIndex: 7, sec: 40, photo: '/photos/tj07.jpg',
  },
  {
    id: 8, name: '右揽雀尾',
    tip: '掤、捋、挤、按四法，右式一遍。',
    cue: '右手掤起，向左后捋，再向前挤、双掌下按，右式一遍。',
    stringIndex: 1, sec: 38, photo: '/photos/tj08.jpg',
  },
  {
    id: 9, name: '单鞭',
    tip: '一手成勾手侧伸、一手立掌前推，如挥鞭。',
    cue: '右手五指撮拢成勾手向侧伸出，左手立掌向前推出，弓步。',
    stringIndex: 2, sec: 26, photo: '/photos/tj09.jpg',
  },
  {
    id: 10, name: '云手',
    tip: '两手在体前上下交替划圆，腰随手动。',
    cue: '两手在体前上下交替划圆，如拨云见日，腰随手转，侧行。',
    stringIndex: 3, sec: 40, photo: '/photos/tj10.jpg',
  },
  {
    id: 11, name: '单鞭',
    tip: '一手成勾手侧伸、一手立掌前推，如挥鞭。',
    cue: '右手成勾手向侧伸出，左手立掌向前推出，弓步，定式如前。',
    stringIndex: 4, sec: 26, photo: '/photos/tj11.jpg',
  },
  {
    id: 12, name: '高探马',
    tip: '一手向前探出如探马，虚步轻灵。',
    cue: '左手回收于腰侧，右手成立掌向前探出，虚步轻灵。',
    stringIndex: 5, sec: 26, photo: '/photos/tj12.jpg',
  },
  {
    id: 13, name: '右蹬脚',
    tip: '两手分开、右腿蹬出，劲贯脚跟。',
    cue: '两手交叉后向两侧分开，右腿屈膝提起再缓缓蹬出，劲贯脚跟。',
    stringIndex: 6, sec: 36, photo: '/photos/tj13.jpg',
  },
  {
    id: 14, name: '双峰贯耳',
    tip: '两拳从两侧向前上方合击，如双峰贯耳。',
    cue: '两拳自两侧向前上方弧形合击，拳眼相对，落于耳前。',
    stringIndex: 7, sec: 30, photo: '/photos/tj14.jpg',
  },
  {
    id: 15, name: '转身左蹬脚',
    tip: '转身后两手分开、左腿蹬出。',
    cue: '身体左转，两手交叉后向两侧分开，左腿屈膝提起再缓缓蹬出。',
    stringIndex: 1, sec: 38, photo: '/photos/tj15.jpg',
  },
  {
    id: 16, name: '左下势独立',
    tip: '先下势穿掌，再一腿独立、一手上举。',
    cue: '先屈膝下蹲穿掌，再起身一腿独立，一手上举、一手下按。',
    stringIndex: 2, sec: 40, photo: '/photos/tj16.jpg',
  },
  {
    id: 17, name: '右下势独立',
    tip: '先下势穿掌，再右腿独立、一手上举。',
    cue: '先屈膝下蹲穿掌，再起身右腿独立，一手上举、一手下按。',
    stringIndex: 3, sec: 38, photo: '/photos/tj17.jpg',
  },
  {
    id: 18, name: '左右穿梭',
    tip: '一手架于额前、一手前推，左右穿梭。',
    cue: '一手架于额前，另一手立掌向前推出，弓步穿行，左右交替。',
    stringIndex: 4, sec: 40, photo: '/photos/tj18.jpg',
  },
  {
    id: 19, name: '海底针',
    tip: '俯身向前，一手向下插如探海底。',
    cue: '上体前俯，右手向下插出如探海，左手护于右腕内侧，虚步。',
    stringIndex: 5, sec: 30, photo: '/photos/tj19.jpg',
  },
  {
    id: 20, name: '闪通臂',
    tip: '一手架额、一手前推，如闪身通臂。',
    cue: '一手架于额前，一手立掌前推，弓步，两臂前后撑开。',
    stringIndex: 6, sec: 28, photo: '/photos/tj20.jpg',
  },
  {
    id: 21, name: '转身搬拦捶',
    tip: '转身搬拳、拦掌、冲拳，三式连贯。',
    cue: '转身搬拳、拦掌，再进步冲拳，三式连贯一气。',
    stringIndex: 7, sec: 40, photo: '/photos/tj21.jpg',
  },
  {
    id: 22, name: '如封似闭',
    tip: '两手回收再向前按出，如封似闭。',
    cue: '两手交叉回收于胸前，翻掌向前缓缓按出，重心后移再前移。',
    stringIndex: 1, sec: 32, photo: '/photos/tj22.jpg',
  },
  {
    id: 23, name: '十字手',
    tip: '两手交叉合抱于胸前，如十字。',
    cue: '两手交叉合抱于胸前，再上举于额前，两腿开立，十字手。',
    stringIndex: 2, sec: 32, photo: '/photos/tj23.jpg',
  },
  {
    id: 24, name: '收势',
    tip: '翻掌分手、垂臂落手、并步还原，气归丹田。',
    cue: '两掌翻转向下、左右分开与肩同宽；两臂徐徐下垂，两手落于大腿外侧；左脚轻轻收回并步还原，气归丹田。',
    stringIndex: 3, sec: 28, photo: '/photos/tj24.jpg',
  },
]

const TAIJI = {
  id: 'taiji',
  name: '太极拳',
  subtitle: '二十四式 · 古琴七弦',
  status: 'ready',
  badge: '已上线',
  strings: 7,
  desc: '以连绵不断的圆弧运动为主，式式相衔、如行云流水，调息养神。二十四式随七弦循环，一式一音。',
  moves: TAIJI_MOVES,
}

// ---------------------------------------------------------------- 五禽戏
// 国家标准《健身气功 · 五禽戏》全十式：虎戏（虎举/虎扑）、鹿戏（鹿抵/鹿奔）、
// 熊戏（熊运/熊晃）、猿戏（猿提/猿摘）、鸟戏（鸟伸/鸟飞）。式名、次序按国家体育总局编定套路；
// tip/cue 为按要领自撰的短句（tip 供列表/卡片，cue 供语音与提示条）。
// 十式 = 五禽 × 两式 ⇒ 五弦一一对应到「五禽」，同禽两式弹同弦（见文首「弦位口径」）。
const WUQINXI_MOVES = [
  {
    id: 1,
    name: '虎举',
    tip: '两手十指撑开成虎爪、再握拳，沿体前中线上提，开筋展肩。',
    cue: '两手十指撑开、屈指成虎爪，再外旋握拳，沿体前中线上提；至肩前松拳成虎爪举过头顶、再下拉还原。',
    stringIndex: 1,
    sec: 30,
    photo: '/photos/wq01.jpg',
  },
  {
    id: 2,
    name: '虎扑',
    tip: '两手成虎爪上举，再前俯下扑、起身后仰，一起一伏如虎扑食。',
    cue: '两手成虎爪沿体前上举过头；再以腰胯带动上体向前下方扑落，两爪随之下按；然后起身、伸膝、送髋挺腹，上体顺劲向后一仰，回到体前抱球。',
    stringIndex: 1,
    sec: 30,
    photo: '/photos/wq02.jpg',
  },
  {
    id: 3,
    name: '鹿抵',
    tip: '迈步成弓步、以腰为轴侧屈拧转，左肘抵腰，目视后腿脚跟。',
    cue: '迈步成弓步，以腰为轴左转、躯干侧屈拧转；左臂屈肘抵靠左腰侧，右臂举至头前向左后方伸抵，转头目视后腿脚跟。',
    stringIndex: 2,
    sec: 30,
    photo: '/photos/wq03.jpg',
  },
  {
    id: 4,
    name: '鹿奔',
    tip: '两臂前伸，含胸收腹、弓背如环，如鹿疾奔前冲。',
    cue: '两臂向前伸出、双手齐肩，随后含胸收腹、弓背如环，如鹿疾奔前冲；停一拍再缓缓展开还原。',
    stringIndex: 2,
    sec: 30,
    photo: '/photos/wq04.jpg',
  },
  {
    id: 5,
    name: '熊运',
    tip: '躯干画圆绕环，重在腰腹带动、左右移重心。',
    cue: '腰腹带动，躯干缓缓画圆，臀部随重心左右起伏，双膝微屈含胸。',
    stringIndex: 3,
    sec: 30,
    photo: '/photos/wq05.jpg',
  },
  {
    id: 6,
    name: '熊晃',
    tip: '提髋提腿、落步踏实，身体左右晃动，两臂自然摆动如熊走路。',
    cue: '一侧髋先提起、同侧腿外摆再踏下，重心随落步左右晃动；两臂放松、只被身体带着自然摆动，如熊迈步走路；左右交替。',
    stringIndex: 3,
    sec: 30,
    photo: '/photos/wq06.jpg',
  },
  {
    id: 7,
    name: '猿提',
    tip: '两手成猿钩上提至胸，耸肩缩项、提踵收腹，头左右各看一眼。',
    cue: '两手成猿钩收在体前，缓缓上提至胸前；同时耸肩缩项、收腹提肛，脚跟提起，头先向左再向右各看一眼（左右观），再慢慢放下。',
    stringIndex: 4,
    sec: 30,
    photo: '/photos/wq07.jpg',
  },
  {
    id: 8,
    name: '猿摘',
    tip: '一手猿钩收于腰侧，另一手斜向上摘取，眼随手动。',
    cue: '一手成猿钩收于腰侧不动，另一手向斜上方缓缓摘取，眼神随摘的那只手走；一腿虚步点地，摘到手略停，再还原。',
    stringIndex: 4,
    sec: 30,
    photo: '/photos/wq08.jpg',
  },
  {
    id: 9,
    name: '鸟伸',
    tip: '两手腹前相叠、上举过头再向前下按落，同时一腿后伸。',
    cue: '两手在腹前相叠、缓缓上举过头；同时一腿向后伸出，如鸟伸颈展翅；两臂再沿体前一路向前下方按落，腿收回还原。',
    stringIndex: 5,
    sec: 30,
    photo: '/photos/wq09.jpg',
  },
  {
    id: 10,
    name: '鸟飞',
    tip: '一腿独立、另一腿屈膝上提，两掌成鸟翅沿体侧上摆至头顶。',
    cue: '一腿独立站稳，另一腿屈膝上提；两掌成鸟翅沿体侧上摆至头顶上方，再收翅、落腿还原。',
    stringIndex: 5,
    sec: 30,
    photo: '/photos/wq10.jpg',
  },
]

const WUQINXI = {
  id: 'wuqinxi',
  name: '五禽戏',
  subtitle: '十式 · 虎鹿熊猿鸟',
  status: 'ready',
  badge: '已上线',
  strings: 5,
  desc: '模仿虎、鹿、熊、猿、鸟五种动物的动作，重在开筋展体。虎鹿熊猿鸟各两式，一禽一弦，十式弹完一曲。',
  moves: WUQINXI_MOVES,
}

export const STYLE_LIST = [BADUANJIN, WUQINXI, TAIJI]

/** 默认拳种：第一个已就绪的 */
export const DEFAULT_STYLE = 'baduanjin'

export function getStyle(id) {
  return STYLE_LIST.find((s) => s.id === id) || null
}

/** 可练的拳种（ready + partial） */
export function readyStyles() {
  return STYLE_LIST.filter((s) => s.status === 'ready' || s.status === 'partial')
}

export function countMoves(id) {
  return getStyle(id)?.moves.length ?? 0
}

export function resolveStyle(preferred) {
  if (preferred) {
    const s = getStyle(preferred)
    if (s && (s.status === 'ready' || s.status === 'partial')) return s.id
  }
  return readyStyles()[0]?.id ?? DEFAULT_STYLE
}
