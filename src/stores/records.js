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

export function saveRecord({ moves = [], names = [] }) {
  const d = new Date()
  const rec = {
    ts: d.getTime(),
    date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    doneCount: moves.length,
    complete: moves.length >= 8,
    moves,
    names,
  }
  const list = read()
  list.push(rec)
  write(list.slice(-60))     // 只留最近 60 条
  return rec
}

export function clearRecords() {
  write([])
}
