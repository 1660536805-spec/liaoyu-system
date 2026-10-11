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

/** 五禽戏十式（健身气功 · 五禽戏，国家体育总局） */
const WUQINXI_SPEECH = {
  1: { voice: '虎举', say: '两手沿体前上举，十指张开如虎爪' },
  2: { voice: '虎扑', say: '两手成虎爪上举，再前俯下扑，一起一伏' },
  3: { voice: '鹿抵', say: '迈步拧腰侧屈，一肘抵腰，一臂伸抵' },
  4: { voice: '鹿奔', say: '两臂前伸，含胸收腹、弓背如鹿疾奔' },
  5: { voice: '熊运', say: '腰腹带动，躯干缓缓画圆' },
  6: { voice: '熊晃', say: '提髋提腿、落步踏实，身体左右晃动' },
  7: { voice: '猿提', say: '两手成钩上提，耸肩缩项、提踵' },
  8: { voice: '猿摘', say: '一手收于腰侧，一手向斜上方摘取' },
  9: { voice: '鸟伸', say: '两手相叠上举过头，再沿体前下按' },
  10: { voice: '鸟飞', say: '两手展开如鸟翅，脚跟提起' },
}

/** 太极二十四式（标准简化二十四式）。
 *  voice = 口语化简称（生僻式名如「倒卷肱」「揽雀尾」保留原名并附一句「做什么」），
 *  say  = 动作提示。式名较长的用简称，避免 TTS 拖长节奏。 */
const TAIJI_SPEECH = {
  1: { voice: '起势', say: '两脚与肩同宽，双手下垂，肩松气沉' },
  2: { voice: '野马分鬃', say: '一手前上掤出，一手下按，左右交替' },
  3: { voice: '白鹤亮翅', say: '一手举于额前，一手按于胯旁' },
  4: { voice: '搂膝拗步', say: '一手搂膝，一手前推，弓步拗身' },
  5: { voice: '手挥琵琶', say: '两手一前一后合抱于胸前' },
  6: { voice: '倒卷肱', say: '一手向后卷收，再向前推出，退步' },
  7: { voice: '左揽雀尾', say: '左手掤起，捋、挤、按，左式' },
  8: { voice: '右揽雀尾', say: '右手掤起，捋、挤、按，右式' },
  9: { voice: '单鞭', say: '一手成勾手侧伸，一手立掌前推' },
  10: { voice: '云手', say: '两手在体前上下交替划圆，腰随手转' },
  11: { voice: '单鞭', say: '勾手侧伸，立掌前推，定式如前' },
  12: { voice: '高探马', say: '一手回收，一手立掌向前探出' },
  13: { voice: '右蹬脚', say: '两手分开，右腿缓缓蹬出' },
  14: { voice: '双峰贯耳', say: '两拳自两侧向前上方合击' },
  15: { voice: '转身左蹬脚', say: '身体左转，两手分开，左腿蹬出' },
  16: { voice: '左下势独立', say: '先下势穿掌，再一腿独立，一手上举' },
  17: { voice: '右下势独立', say: '先下势穿掌，再右腿独立，一手上举' },
  18: { voice: '左右穿梭', say: '一手架于额前，一手前推，左右穿行' },
  19: { voice: '海底针', say: '上体前俯，一手向下插出' },
  20: { voice: '闪通臂', say: '一手架额，一手前推，弓步撑开' },
  21: { voice: '转身搬拦捶', say: '转身搬拳、拦掌，再进步冲拳' },
  22: { voice: '如封似闭', say: '两手回收于胸前，再向前按出' },
  23: { voice: '十字手', say: '两手交叉合抱于胸前' },
  24: { voice: '收势', say: '两手分开缓缓下落，还原站立' },
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
  wuqinxi: { voice: '十式练毕', say: '虎鹿熊猿鸟，一套完成' },
  taiji: { voice: '廿四式练毕', say: '一套太极完成，缓缓收势，气归丹田' },
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
