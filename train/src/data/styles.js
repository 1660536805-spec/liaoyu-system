// 拳种注册表 —— 八段锦 / 太极拳 / 五禽戏
//
// 【为什么太极只落地「起势」】
//   太极 24 式，动作清单需要 PM 提供（式名 + 要领 + 可见性需求）。
//   当前只落地第 1 式「起势」，让语音与判定链路有内容可播、可验。
//   后续往 TAIJI_MOVES 里加即可，无需改引擎。
//
// 【status 说明】
//   ready   —— 有完整 moves，可练
//   partial —— 有内容但未完成（当前只有 1 式），仍可练
//   pending —— 清单未定，无 moves，UI 上禁用

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
const TAIJI_MOVES = [
  {
    id: 1,
    name: '起势',
    tip: '两脚开立与肩同宽，两臂自然下垂，浑身松沉。',
    cue: '两脚与肩同宽站直，双手自然下垂，肩松、肘沉、气沉丹田。',
    stringIndex: 1,
    sec: 40,
    photo: '/photos/tj01.jpg',
  },
]

const TAIJI = {
  id: 'taiji',
  name: '太极拳',
  subtitle: '二十四式 · 已落地起势',
  status: 'partial',
  badge: '起势可用',
  strings: 7,
  desc: '以连绵不断的圆弧运动为主，调息养神。当前只落地第 1 式「起势」，其余式待补。',
  moves: TAIJI_MOVES,
  pendingReason: '其余 23 式待 PM 输出「式名 + 要领 + 可见性需求」',
}

// ---------------------------------------------------------------- 五禽戏
const WUQINXI_MOVES = [
  {
    id: 1,
    name: '虎举',
    tip: '双手上举如虎爪开合，开筋展肩。',
    cue: '双手缓慢上举过头，十指张开如虎爪，掌心向内，停一拍再缓缓落下。',
    stringIndex: 1,
    sec: 30,
    photo: '/photos/wq01.jpg',
  },
  {
    id: 2,
    name: '鹿抵',
    tip: '腰部后弓，一腿后抬成鹿角，伸展腰背。',
    cue: '腰部后弓，双臂向前上方伸出，一腿后抬，脚跟朝后，下颌微收。',
    stringIndex: 2,
    sec: 30,
    photo: '/photos/wq02.jpg',
  },
  {
    id: 3,
    name: '熊运',
    tip: '躯干画圆绕环，重在腰腹带动、左右移重心。',
    cue: '腰腹带动，躯干缓缓画圆，臀部随重心左右起伏，双膝微屈含胸。',
    stringIndex: 3,
    sec: 30,
    photo: '/photos/wq03.jpg',
  },
  {
    id: 4,
    name: '猿提',
    tip: '两手成猿钩上提至胸，耸肩缩项、提踵收腹。',
    cue: '两手成猿钩收在体前，缓缓上提至胸前；同时耸肩缩项、收腹提肛，脚跟提起，再慢慢放下。',
    stringIndex: 4,
    sec: 30,
    photo: '/photos/wq04.jpg',
  },
  {
    id: 5,
    name: '鸟飞',
    tip: '双手开合如翅，配合提踵展翅。',
    cue: '双手缓缓上提后向两侧展开如鸟翅，掌心向下，同时脚跟提起、缓缓下落。',
    stringIndex: 5,
    sec: 30,
    photo: '/photos/wq05.jpg',
  },
]

const WUQINXI = {
  id: 'wuqinxi',
  name: '五禽戏',
  subtitle: '五式 · 虎鹿熊猿鸟',
  status: 'ready',
  badge: '已上线',
  strings: 5,
  desc: '模仿虎、鹿、熊、猿、鸟五种动物的动作，重在开筋展体。五式正好对应五根弦。',
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
