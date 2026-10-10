// 主壳 ↔ s4 的真实结果桥（单向：s4 写，主壳读）
//
// 背景：主壳（dist/app.js）与 s4 各自用一套本地存储 ——
//   主壳：xy-records（{d, at, poses, sec}）/ xy-last-session
//   s4  ：xianyang.records.v1（{ts, day, moves, names, minutes, ...}）
// 两套互不相通时，主壳只能显示设计稿里那张写死的假成绩单（89 分 / 12 分钟 / 146·162）。
// 这里在 s4「真实跟练」过程中，把**真实发生的事**（完成几式、用了多少秒、每式完成度）
// 按主壳自己的数据结构写过去，主壳的「我的」与结束页才有真数据可显示。
//
// 只写事实：没有识别结果（预录兜底 / 手动模式）时 scores 为空数组，
// 主壳据此显示「—」而不是编一个分数。
//
// 幂等：一场练习会多次上报（每完成一式 / 退出 / 结束），同一 sid 只累加**时长增量**，
// 所以中途退出再继续也不会把时长算成两倍。

const REC_KEY = 'xy-records'
const SESSION_KEY = 'xy-last-session'
const LIVE_KEY = 'xy-session-live'

const pad2 = (n) => String(n).padStart(2, '0')

function safeRead(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
function safeWrite(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
    return true
  } catch {
    return false   // 隐私模式 / file:// 下不可写：只影响演示，不阻断流程
  }
}

export function pushToShell({ sid = '', moves = [], names = [], tone = '', seconds = 0, scores = [] } = {}) {
  const d = new Date()
  const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const sec = Math.max(0, Math.round(seconds) || 0)

  // 1) 主壳打卡记录：与 app.js 的 checkin() 同构，按自然日累加；
  //    同一场练习（sid 相同）只加增量，避免多次上报导致时长翻倍。
  const live = safeRead(LIVE_KEY)
  const prevSec = live && live.sid === sid ? (+live.sec || 0) : 0
  const delta = Math.max(0, sec - prevSec)

  const raw = safeRead(REC_KEY)
  const list = Array.isArray(raw) ? raw.filter((r) => r && typeof r.d === 'string') : []
  const rec = { d: day, at: d.toISOString(), poses: moves.length, sec: delta }
  const i = list.findIndex((r) => r.d === day)
  if (i >= 0) {
    rec.sec += +list[i].sec || 0
    rec.poses = Math.max(rec.poses, +list[i].poses || 0)
    list[i] = rec
  } else {
    list.push(rec)
  }
  safeWrite(REC_KEY, list.slice(-400))
  safeWrite(LIVE_KEY, { sid, sec, day })

  // 2) 本次会话详情：给主壳结束页用（scores 百分数，无识别时为空数组）
  safeWrite(SESSION_KEY, {
    at: d.toISOString(),
    day,
    moves: moves.length,
    total: 8,
    names,
    tone,
    seconds: sec,
    scores: scores.map((s) => Math.max(0, Math.min(100, Math.round((+s || 0) * 100)))),
    source: 's4',
  })
}
