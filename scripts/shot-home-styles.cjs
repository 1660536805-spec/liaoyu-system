/* 首页整屏截图（三拳种各一张，fullPage），用于目视核对模式条 4 段。 */
const { chromium } = require('playwright-core')
const fs = require('fs'); const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5400'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, '..', 'outputs', 'style-shell')
fs.mkdirSync(OUT, { recursive: true })
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  for (const st of ['baduanjin', 'wuqinxi', 'taiji']) {
    const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
    await p.goto(BASE + '/?screen=home&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('.modebar .mseg')
    const box = await p.locator('.modebar').boundingBox()
    await p.screenshot({ path: path.join(OUT, 'homepage-' + st + '.png'), fullPage: true })
    console.log(st, 'modebar box', box)
    await p.close()
  }
  await b.close()
})()
