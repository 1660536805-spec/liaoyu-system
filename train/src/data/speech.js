// 动作播报文案 —— 把动作名转成「能听懂」的口语
//
// 为什么需要这一层：
//   八段锦式名出自中医典籍（"双手托天理三焦"、"五劳七伤往后瞧"），
//   直接朗读有两个问题：
//   ① 生僻字读错（"掷"vs"撒"、"髎"）——TTS 引擎的多音字判断常出错
//   ② 名字是「症状」不是「动作」（"理三焦"是功效），用户听不出要做什么
//   ③ 太长（7 个字）拖慢节奏
// 故播报用「简称 + 动作提示」两段式：先报第几式 + 简称，再补一句做什么。
//
// 三档冗余（降级用）：full（简称+提示）→ short（仅简称）→ name（原名兜底）

/** 各式的播报文案。voice 为口语化简称，say 为动作提示 */
const BADUANJIN_SPEECH = {
  1: { voice: '双手托天', say: '双臂向上举过头顶' },
  2: { voice: '左右开弓', say: '一手臂平举，另一手屈肘' },
  3: { voice: '单举', say: '一手高举，一手向下按' },
  4: { voice: '转头后望', say: '身体不动，只把头转向一侧' },
  5: { voice: '摇头摆尾', say: '俯身深屈，左右摆动' },
  6: { voice: '攀足', say: '俯身向下，双手够向脚' },
  7: { voice: '攒拳', say: '马步站稳，一拳缓缓推出' },
  8: { voice: '背后七颠', say: '两脚并拢，脚跟起落七次' },
}

/** 五禽戏五式（华佗五禽戏标准） */
const WUQINXI_SPEECH = {
  1: { voice: '虎举', say: '双手上举，十指张开如虎爪' },
  2: { voice: '鹿抵', say: '腰部后弓，双臂前伸' },
  3: { voice: '熊运', say: '腰腹带动，躯干缓缓画圆' },
  4: { voice: '猿提', say: '两手成钩上提，耸肩缩项、提踵' },
  5: { voice: '鸟飞', say: '双手展开如鸟翅，脚跟提起' },
}

/** 太极（当前仅起势，其余待补） */
const TAIJI_SPEECH = {
  1: { voice: '起势', say: '两脚与肩同宽，双手下垂，肩松气沉' },
}

/** 按拳种取文案表 */
const BY_STYLE = {
  baduanjin: BADUANJIN_SPEECH,
  wuqinxi: WUQINXI_SPEECH,
  taiji: TAIJI_SPEECH,
}

export const COMPLETE_SPEECH = {
  voice: '全套练毕',
  say: '缓缓收势，调息',
}

/** 完成语按拳种定制（八段锦有专门的收势语） */
const COMPLETE_BY_STYLE = {
  baduanjin: { voice: '八式练毕', say: '一套完成，缓缓收势' },
  wuqinxi: { voice: '五式练毕', say: '虎鹿熊猿鸟，一套完成' },
  taiji: { voice: '起势完成', say: '气沉丹田' },
}

/**
 * 按拳种取文案表。
 * 【重要】未知拳种必须返回 null 而非 fallback 到八段锦 ——
 * 否则新增拳种忘了配文案时，会错播别的拳种的动作名。
 */
function table(styleId) {
  return BY_STYLE[styleId] || null
}

/** 取某式播报文案（无则返回 null） */
export function getMoveSpeech(styleId, id) {
  const t = table(styleId)
  if (!t) return null
  return t[id] || null
}

/** 取完成语。未知拳种返回 null（不套用别的拳种的完成语） */
export function getCompleteSpeech(styleId) {
  return COMPLETE_BY_STYLE[styleId] || null
}

/**
 * 生成播报文本
 * @param {string} styleId 拳种
 * @param {number} id 动作 id
 * @param {'full'|'short'|'name'} level 冗余档位
 */
export function buildSpeech(styleId, id, level = 'full') {
  const m = getMoveSpeech(styleId, id)
  if (!m) return ''
  if (level === 'name') return ''
  if (level === 'short') return m.voice
  return `第${id}式，${m.voice}。${m.say}。`
}

/** 完整语 */
export function buildCompleteSpeech(styleId, level = 'full') {
  const c = getCompleteSpeech(styleId)
  if (!c) return ''
  if (level === 'name') return ''
  if (level === 'short') return c.voice
  return `${c.voice}。${c.say}。`
}

/** 供 UI 显示（让用户知道会读什么） */
export function previewText(styleId, id) {
  const m = getMoveSpeech(styleId, id)
  return m ? `第${id}式，${m.voice}。${m.say}。` : ''
}
