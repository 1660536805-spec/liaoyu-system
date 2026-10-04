/* 实开 3D 房间页并逐时刻截图（用 setTime 精确定位循环内的某一秒，方便查关节是否翻折）。
   用法：node shot.cjs            → 默认取几个关键时刻
        node shot.cjs 3 9 15 21 27 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'file://' + path.join(__dirname, 'preview.html')
const OUT = path.join(__dirname, 'shots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT)

const args = process.argv.slice(2)
const marks = args.map(Number).filter(n => !isNaN(n))
const TIMES = marks.length ? marks : [1, 5, 7, 11, 15, 19, 23, 27, 31, 33]

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message)))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(2000)

  const probe = await p.evaluate(() => {
    const r = window.__room
    const st = document.querySelector('.room-stage')
    const cv = document.querySelector('.room-canvas')
    if (r) r.pause()
    return {
      mounted: !!r,
      stage: st ? [Math.round(st.getBoundingClientRect().width), Math.round(st.getBoundingClientRect().height)] : null,
      canvas: cv ? [cv.width, cv.height] : null,
      sceneChildren: r ? r.scene.children.length : -1,
      roomChildren: r && r.room ? r.room.group.children.length : -1,
      hasMirror: !!(r && r.room && r.room.mirror),
    }
  })
  console.log('PROBE', JSON.stringify(probe))

  for (const t of TIMES) {
    await p.evaluate(v => window.__room.setTime(v), t)
    await p.waitForTimeout(120)
    await p.locator('.room-stage').screenshot({ path: path.join(OUT, 't' + String(t).padStart(4, '0') + '.png') })
  }
  await p.screenshot({ path: path.join(OUT, 'page.png') })
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none')
  await b.close()
})()
