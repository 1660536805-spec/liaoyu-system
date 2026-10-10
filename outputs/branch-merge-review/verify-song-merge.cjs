/* 曲库合并（+第三首「七弦散音」）的验收：
 *
 * 证据一（静态 DOM 逐字符）：「音疗」页应恰好 +1 条 .track 行（2→3），其余 8 屏逐字符相同。
 *                          文本改动只出现在「通知 / 版本信息」两个弹层里，不进静态快照。
 * 证据二（弹层文本）：notices() / about() 里两处计数已由「两首/2 首」改为「三首/3 首」。
 * 证据三（真能播）：点第 3 条播放键后，<audio> 真的加载了 qixian-sanyin.mp3 且 duration≈7.16s、在播。
 * 证据四：app.css 未被改动。
 *
 * 用法：node outputs/branch-merge-review/verify-song-merge.cjs [改前快照.json]
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = __dirname
const PRE = path.resolve(process.argv[2] || path.join(DIR, 'dom-navfix.json')) // 改前（导航已修、曲库未并）
const POST = path.join(DIR, 'dom-song.json')
const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']

/* 把 outerHTML 切成标签块，用于数「增/删」而不是整串比对 */
function blocks(html) {
  return html.split(/(?=<)/).filter((x) => x.length)
}
function diff(oldH, newH) {
  const A = blocks(oldH), B = blocks(newH)
  const ca = new Map(), cb = new Map()
  for (const x of A) ca.set(x, (ca.get(x) || 0) + 1)
  for (const x of B) cb.set(x, (cb.get(x) || 0) + 1)
  const add = [], del = []
  for (const [k, n] of cb) if (n > (ca.get(k) || 0)) add.push({ s: k, n: n - (ca.get(k) || 0) })
  for (const [k, n] of ca) if (n > (cb.get(k) || 0)) del.push({ s: k, n: n - (cb.get(k) || 0) })
  return { add, del }
}
const clip = (s, n) => (s.replace(/\s+/g, ' ').slice(0, n || 120))

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  /* ---- 采集新快照 ---- */
  const out = { at: new Date().toISOString(), screens: {} }
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 2600 : 700)
    out.screens[s] = await page.evaluate(() => (document.querySelector('.phone') || document.body).outerHTML)
  }
  const cssLen = await page.evaluate(async () => (await (await fetch('/app.css')).text()).length)
  out.appCssLen = cssLen
  fs.writeFileSync(POST, JSON.stringify(out, null, 1), 'utf8')

  /* ---- 证据一：逐屏 DOM 比对 ---- */
  const pre = JSON.parse(fs.readFileSync(PRE, 'utf8'))
  console.log('== 证据一 · 渲染后 DOM 逐字符比对（改前 ' + path.basename(PRE) + ' → 改后）==')
  let bad = 0
  for (const s of SCREENS) {
    const a = pre.screens[s] || '', b = out.screens[s] || ''
    if (a === b) { console.log('  ✓ ' + s.padEnd(9) + ' 逐字符相同'); continue }
    const d = diff(a, b)
    const addN = d.add.reduce((t, x) => t + x.n, 0), delN = d.del.reduce((t, x) => t + x.n, 0)
    console.log('  Δ ' + s.padEnd(9) + ' +' + addN + ' / -' + delN + ' 块')
    d.add.slice(0, 8).forEach((x) => console.log('        + [' + x.n + '] ' + clip(x.s, 150)))
    d.del.slice(0, 8).forEach((x) => console.log('        - [' + x.n + '] ' + clip(x.s, 150)))
    if (s !== 'audio' || delN > 0) bad++
  }
  console.log('  app.css 改前 ' + pre.appCssLen + ' / 改后 ' + cssLen + ' 字符  ' + (pre.appCssLen === cssLen ? '✓ 未改动' : '✗ 被改动'))
  if (pre.appCssLen !== cssLen) bad++

  /* ---- 证据一(补)：音疗页曲目行数 2 → 3 ---- */
  await page.goto(BASE + '/?screen=audio', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  const rows = await page.$$eval('.track', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
  console.log('\n== 音疗页「为你推荐」曲目行（' + rows.length + ' 条）==')
  rows.forEach((t, i) => console.log('  ' + (i + 1) + '. ' + clip(t, 90)))
  if (rows.length !== 3) { console.log('  ✗ 期望 3 条'); bad++ } else console.log('  ✓ 2 → 3 条')

  /* ---- 证据二：两个弹层的文本 ---- */
  const sheets = await page.evaluate(() => ({
    notices: (window.__xy.sheets.notices() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
    about: (window.__xy.sheets.about() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
  }))
  console.log('\n== 证据二 · 弹层文本 ==')
  const nOK = sheets.notices.includes('三首') && sheets.notices.includes('七弦散音')
  const aOK = sheets.about.includes('3 首')
  console.log('  ' + (nOK ? '✓' : '✗') + ' 通知：' + clip(sheets.notices, 150))
  console.log('  ' + (aOK ? '✓' : '✗') + ' 版本信息：' + clip(sheets.about, 200))
  if (!nOK || !aOK) bad++

  /* ---- 证据三：第 3 首真能播 ---- */
  await page.click('.track:nth-child(3) [data-a="play"]').catch(() => {})
  await page.waitForTimeout(1400)
  const st = await page.evaluate(() => {
    const a = window.__xy.AUDIO.mus
    return {
      n: window.__xy.TRACKS.length,
      src: a ? a.src : null,
      duration: a ? a.duration : null,
      paused: a ? a.paused : null,
      key: a ? a.dataset.key : null,
      left: a ? a.currentTime : null,
    }
  })
  console.log('\n== 证据三 · 第 3 首实际播放 ==')
  console.log('  TRACKS.length = ' + st.n)
  console.log('  audio.src      = ' + st.src)
  console.log('  dataset.key    = ' + st.key)
  console.log('  duration       = ' + (st.duration != null ? st.duration.toFixed(2) + 's' : st.duration))
  console.log('  paused         = ' + st.paused + '   currentTime=' + (st.left != null ? st.left.toFixed(2) : st.left))
  const playOK = st.n === 3 && /qixian-sanyin\.mp3$/.test(st.src || '') && st.key === 'sanyin' &&
                 st.duration > 6 && st.duration < 9 && st.paused === false
  console.log('  ' + (playOK ? '✓' : '✗') + ' 第 3 首 = 七弦散音 / qixian-sanyin.mp3（≈7.16s）且正在播')
  if (!playOK) bad++

  console.log('\n控制台报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''))
  console.log('\n' + (bad === 0 ? '===== 全部通过 =====' : '===== 有 ' + bad + ' 项不符 ====='))
  await browser.close()
  process.exit(bad === 0 ? 0 : 1)
})()
