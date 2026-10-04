/* 近距离看建模：正面/侧面/背面 + 云手各相位，确认朝向、光照、关节是否正常 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'file://' + path.join(__dirname, 'preview.html')
const OUT = path.join(__dirname, 'shots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT)

/* 人物在 (0, ~0.9, -6.2)。机位绕它一圈。 */
const VIEWS = [
  ['front', [0, 1.35, -4.15], [0, 1.02, -6.2], 32],
  ['back', [0, 1.35, -8.25], [0, 1.02, -6.2], 32],
  ['side', [1.95, 1.35, -6.2], [0, 1.02, -6.2], 32],
  ['quarter', [1.35, 1.6, -4.6], [0, 1.02, -6.2], 34],
]

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message)))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(2000)
  await p.evaluate(() => window.__room.pause())

  for (const [name, pos, tgt, fov] of VIEWS) {
    for (const t of [2.2, 7, 12, 18]) {
      await p.evaluate(a => {
        window.__room.setTime(a[0])
        window.__room.debugView(a[1][0], a[1][1], a[1][2], a[2][0], a[2][1], a[2][2], a[3])
      }, [t, pos, tgt, fov])
      await p.waitForTimeout(90)
      await p.screenshot({ path: path.join(OUT, 'fig-' + name + '-t' + t + '.png') })
    }
  }
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none')
  await b.close()
})()
