/* 24 节气天文计算（低精度太阳视黄经法，Meeus《Astronomical Algorithms》第25章）
 * 目的：让主壳首页显示「今日真实节气」，不再写死霜降。
 * 精度：视黄经误差 < 0.01°，对应时刻误差约 ±10 分钟；
 *       节气交节时刻若恰好落在当地午夜前后 10 分钟内，日期可能差一天（概率约 1%）。
 *
 * 用法：node outputs/pm-review/solar-term.cjs 2025 2026
 *       → 打印这些年份 24 节气的北京日期，用于与公开历书核对。
 */
function deg(x) { return x * 180 / Math.PI }
const RAD = Math.PI / 180

function jdFromDate(y, m, d, h) {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + (h || 0) / 24
}
function jdToDate(jd) {
  const z = jd + 0.5, Z = Math.floor(z), F = z - Z
  let A = Z
  if (Z >= 2299161) { const a = Math.floor((Z - 1867216.25) / 36524.25); A = Z + 1 + a - Math.floor(a / 4) }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001)
  const day = B - D - Math.floor(30.6001 * E) + F
  const month = E < 14 ? E - 1 : E - 13
  const year = month > 2 ? C - 4716 : C - 4715
  const di = Math.floor(day), frac = day - di
  const hh = frac * 24
  return { y: year, m: month, d: di, h: Math.floor(hh), mi: Math.floor((hh - Math.floor(hh)) * 60) }
}
/* 太阳视黄经（度，0–360） */
function sunLong(jd) {
  const T = (jd - 2451545.0) / 36525
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T
  const Mr = M * RAD
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr)
  const trueLon = L0 + C
  const Om = (125.04 - 1934.136 * T) * RAD
  const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(Om)
  return ((lambda % 360) + 360) % 360
}
/* 节气表：按公历年内先后排列（小寒起），target = 太阳视黄经 */
const TERMS = [
  ['小寒', 285], ['大寒', 300], ['立春', 315], ['雨水', 330], ['惊蛰', 345], ['春分', 0],
  ['清明', 15], ['谷雨', 30], ['立夏', 45], ['小满', 60], ['芒种', 75], ['夏至', 90],
  ['小暑', 105], ['大暑', 120], ['立秋', 135], ['处暑', 150], ['白露', 165], ['秋分', 180],
  ['寒露', 195], ['霜降', 210], ['立冬', 225], ['小雪', 240], ['大雪', 255], ['冬至', 270],
]
/* 求某年第 i 个节气（0=小寒）交节时刻，返回北京时间的日期对象 */
function termInstant(year, i) {
  const target = TERMS[i][1]
  // 初值：小寒约 1 月 6 日，之后每节气约 15.22 天
  let jd = jdFromDate(year, 1, 6, 0) + i * 15.22
  for (let k = 0; k < 12; k++) {
    let diff = sunLong(jd) - target
    diff = ((diff + 180) % 360 + 360) % 360 - 180   // 归一化到 (-180,180]
    if (Math.abs(diff) < 1e-7) break
    jd -= diff / 0.9856                                   // 日行约 0.9856°
  }
  return jdToDate(jd + 8 / 24)                             // UT → 北京时
}
/* 给定日期，返回它落在哪个节气区间 → { name, day（交节当天）, next } */
function solarTermOf(date) {
  const y = date.getFullYear()
  const cands = []
  for (const yy of [y - 1, y, y + 1]) for (let i = 0; i < 24; i++) cands.push({ year: yy, i, t: termInstant(yy, i) })
  const key = (t) => t.y * 10000 + t.m * 100 + t.d
  const now = key({ y: y, m: date.getMonth() + 1, d: date.getDate() })
  let cur = null
  for (const c of cands) { const k = key(c.t); if (k <= now) { if (!cur || k > key(cur.t)) cur = c } }
  return { name: TERMS[cur.i][0], at: cur.t, index: cur.i }
}
module.exports = { sunLong, jdFromDate, jdToDate, TERMS, termInstant, solarTermOf }

if (require.main === module) {
  const years = process.argv.slice(2).map(Number)
  const list = years.length ? years : [new Date().getFullYear()]
  for (const y of list) {
    const out = TERMS.map((t, i) => { const d = termInstant(y, i); return t[0] + ' ' + d.m + '/' + d.d })
    console.log(y + ': ' + out.join('  '))
  }
  // 今天落在哪个节气
  const s = solarTermOf(new Date())
  console.log('今天 → 处于节气「' + s.name + '」(交节 ' + s.at.m + '月' + s.at.d + '日)')
}
