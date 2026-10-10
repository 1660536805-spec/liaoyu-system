// 打卡记录 —— localStorage 持久化（离线可用，对应 D5）
// 注意：file:// 与部分浏览器下 localStorage 可能抛 SecurityError，统一走 safe 读写

const KEY = 'xianyang.records.v1'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* 隐私模式 / file:// 下不可写：仅内存态，不阻断流程 */
  }
}

export function getRecords() {
  return read().sort((a, b) => (a.ts < b.ts ? 1 : -1))
}

export function lastRecord() {
  return getRecords()[0] || null
}

const pad2 = (n) => String(n).padStart(2, '0')

export function saveRecord({ moves = [], names = [], tone = '', minutes = 0, seconds = 0 } = {}) {
  const d = new Date()
  const rec = {
    ts: d.getTime(),
    // day 用于「连续打卡」按自然日去重（YYYY-MM-DD），与展示用的 date 分开
    day: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    doneCount: moves.length,
    complete: moves.length >= 8,
    moves,
    names,
    tone,                     // 这一套用的五音基调（解释层，仅用于展示，不参与播放）
    minutes,                  // 实际练习时长（分钟），0 表示未记录
    seconds: Math.max(0, Math.round(seconds) || 0),   // 实际练习秒数（比 minutes 精细，回写主壳用）
  }
  const list = read()
  list.push(rec)
  write(list.slice(-60))     // 只留最近 60 条
  return rec
}

export function clearRecords() {
  write([])
}
