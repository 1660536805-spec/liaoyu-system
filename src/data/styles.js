// 拳种（套路）注册表 —— 数据层预留太极/五禽戏
//
// 为什么单独建层：
//   八段锦已实现并验证；太极/五禽戏的动作清单项目文档里尚未确定
//   （见《双线方案》§六 待确认第 1 条）。
//   故此处先建结构 + 明确的「待配置」状态，动作清单确定后填 moves 即可接入，
//   判定引擎（judge.js）与音频层（五声定弦）无需改动。
//
// 接入方式：
//   1. 在下方 STYLE_LIST 的对应项填 moves（字段与 moves.json 完全一致）
//   2. 状态自动从 'pending' 变为 'ready'
//   3. 首页与跟练页无需任何改动即可显示

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

/** 太极拳（待配置） */
const TAIJI = {
  id: 'taiji',
  name: '太极拳',
  subtitle: '套路 · 待定式数',
  status: 'pending',
  badge: '筹备中',
  strings: 7,
  desc: '以连绵不断的圆弧运动为主，适合养生气息与平衡。动作清单待定。',
  // TODO: 式名确定后按 moves.json 结构填写，status 自动变 ready
  moves: [],
  pendingReason: '动作清单待确认（需 PM 输出「式名 + 可见性需求」）',
}

/** 五禽戏（待配置） */
const WUQINXI = {
  id: 'wuqinxi',
  name: '五禽戏',
  subtitle: '五式 · 待定',
  status: 'pending',
  badge: '筹备中',
  strings: 5,
  desc: '模仿虎、鹿、熊、猿、鸟五种动物的动作，重在开筋展体。动作清单待定。',
  moves: [],
  pendingReason: '动作清单待确认（需 PM 输出「式名 + 可见性需求」）',
}

export const STYLE_LIST = [BADUANJIN, TAIJI, WUQINXI]

/** 默认拳种：当前唯一已实现「ready」的 */
export const DEFAULT_STYLE = 'baduanjin'

export function getStyle(id) {
  return STYLE_LIST.find((s) => s.id === id) || null
}

export function readyStyles() {
  return STYLE_LIST.filter((s) => s.status === 'ready')
}

/** 取某拳种的式数（未配置时返回 0） */
export function countMoves(id) {
  return getStyle(id)?.moves.length ?? 0
}

/** 默认选择：优先已就绪的第一个 */
export function resolveStyle(preferred) {
  if (preferred) {
    const s = getStyle(preferred)
    if (s && s.status === 'ready') return s.id
  }
  return readyStyles()[0]?.id ?? DEFAULT_STYLE
}
