// 取景 / 可见度指标：从 MediaPipe Pose 的 33 个关键点算三个真值
//
//   up    上半身可见度（肩 11/12 · 肘 13/14 · 腕 15/16 的 visibility 均值）
//   low   下半身可见度（膝 25/26 · 踝 27/28 的 visibility 均值）
//   shoW  肩宽占画面比例（11–12 两点的归一化距离；站太远→小，太近→大）
//   frame 取景完整度 = 「既被可信识别（visibility>0.5）又确实落在画面内」的关键点占比
//
// 抽成纯函数的原因：这三个数字原先在顶部指标卡里是**写死的 92%/88%/92%**，
// 改成真值后必须有可重复的断言（见 scripts/framing.test.mjs），否则等于换了个地方糊数字。

export const UPPER_IDX = [11, 12, 13, 14, 15, 16]
export const LOWER_IDX = [25, 26, 27, 28]
export const VIS_MIN = 0.5          // 单个关键点「算被看见」的 visibility 门槛
export const MIN_LANDMARKS = 29     // 少于这个数视为没拿到人体（MediaPipe Pose 正常给 33 个）

export function framingMetrics(landmarks) {
  if (!landmarks || landmarks.length < MIN_LANDMARKS) return null
  const v = (i) => landmarks[i]?.visibility ?? 0
  const avg = (idx) => idx.reduce((s, i) => s + v(i), 0) / idx.length

  const up = avg(UPPER_IDX)
  const low = avg(LOWER_IDX)

  const a = landmarks[11], b = landmarks[12]
  const shoW = (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : 0

  let inFrame = 0
  for (const p of landmarks) {
    const s = p?.visibility ?? 0
    if (s > VIS_MIN && p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) inFrame++
  }

  return { up, low, shoW, frame: inFrame / landmarks.length }
}

// 指标卡文案：没检测到人体时给「—」，绝不拿 0 或旧值充数
export function pctText(x, seen) {
  return seen ? Math.round((+x || 0) * 100) + '%' : '—'
}

// 进度条宽度：同上，未见人体时为 0
export function barWidth(x, seen) {
  if (!seen) return '0%'
  const p = Math.min(100, Math.max(0, (+x || 0) * 100))
  return p.toFixed(1) + '%'
}

// 取景诊断那一行文字（与指标卡同源，避免两处各算一套）
export function diagText(m) {
  if (!m) return '未检测到人体'
  return `上半身 ${Math.round(m.up * 100)}% · 下半身 ${Math.round(m.low * 100)}% · 取景 ${Math.round(m.frame * 100)}%`
}
