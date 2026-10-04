/* 抓「教练小窗换形象」后的效果：跟练页全景 + 教练小窗特写（多帧，看动作是否连续）
 * 用法：node outputs/coach-judge/shot-figure.cjs [port]
 */
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = __dirname
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const URL_FULL = `${BASE}/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong&coachAttempt=6&coachDemo=6`

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  await page.goto(URL_FULL, { waitUntil: 'load' })
  await page.waitForFunction(() => !!document.querySelector('.coach-bar'), { timeout: 60000 })
  await page.waitForTimeout(3500)

  const info = await page.evaluate(() => {
    const bar = document.querySelector('.coach-bar')
    const cf = document.querySelector('.coach-bar .cf')
    const svg = document.querySelector('.coach-bar .cf svg')
    const box = document.querySelector('.coach-bar .cv-box')
    const r = (e) => (e ? { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null)
    return {
      bar: r(bar), cf: r(cf), cvbox: r(box),
      svgChildren: svg ? svg.children.length : -1,
      dataP: svg ? svg.querySelectorAll('[data-p]').length : -1,
      canvas: document.querySelectorAll('.coach-bar canvas').length,
      caption: (document.querySelector('.coach-bar .coach-cap') || {}).textContent || '',
    }
  })
  console.log('教练条：', JSON.stringify(info))

  await page.screenshot({ path: path.join(OUT, 'Y-01-跟练页全景.png') })
  console.log('  ✓ Y-01-跟练页全景.png')

  // 教练小窗特写：多帧
  const boxEl = page.locator('.coach-bar .cv-box').first()
  for (let i = 1; i <= 4; i++) {
    await boxEl.screenshot({ path: path.join(OUT, `Y-02-教练小窗-帧${i}.png`) })
    console.log(`  ✓ Y-02-教练小窗-帧${i}.png`)
    await page.waitForTimeout(1600)
  }

  console.log('errors=', errs.length ? errs : '0')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
