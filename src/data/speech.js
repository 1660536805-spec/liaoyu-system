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

/** 各式的播报文案。voice 为口语化简称，say 为动作提示（一句话，可省略） */
export const MOVE_SPEECH = {
  1: { voice: '双手托天', say: '双臂向上举过头顶' },
  2: { voice: '左右开弓', say: '一手臂平举，另一手屈肘' },
  3: { voice: '单举', say: '一手高举，一手向下按' },
  4: { voice: '转头后望', say: '身体不动，只把头转向一侧' },
  5: { voice: '摇头摆尾', say: '俯身深屈，左右摆动' },
  6: { voice: '攀足', say: '俯身向下，双手够向脚' },
  7: { voice: '攒拳', say: '马步站稳，一拳缓缓推出' },
  8: { voice: '背后七颠', say: '两脚并拢，脚跟起落七次' },
}

/** 完成语（第八式之后播报） */
export const COMPLETE_SPEECH = {
  voice: '八式练毕',
  say: '一套完成，缓缓收势',
}

/**
 * 生成播报文本
 * @param {number} id 动作 id（1~8）
 * @param {number} total 总数
 * @param {'full'|'short'|'name'} level 冗余档位，由引擎可用性决定
 */
export function buildSpeech(id, total, level = 'full') {
  const m = MOVE_SPEECH[id]
  if (!m) return ''
  if (level === 'name') return ''
  if (level === 'short') return m.voice
  return `第${id}式，${m.voice}。${m.say}。`
}

/** 完整语（第八式触发） */
export function buildCompleteSpeech(level = 'full') {
  if (level === 'name') return ''
  if (level === 'short') return COMPLETE_SPEECH.voice
  return `${COMPLETE_SPEECH.voice}。${COMPLETE_SPEECH.say}。`
}

/** 供 UI 显示（让用户知道会读什么） */
export function previewText(id) {
  const m = MOVE_SPEECH[id]
  return m ? `第${id}式，${m.voice}。${m.say}。` : ''
}
