/* A/B 实拍：教练小窗形象 · 臂长82(现) vs 臂长98(原件)，桌面尺寸。
 * 用法：node outputs/coach-judge/diag-arm-ab.cjs
 */
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = __dirname
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SPECS = [['A-82', 'http://127.0.0.1:5511'], ['B-98', 'http://127.0.0.1:5512']]
const Q = '/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong'
const FRAMES = 8, GAP = 900

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  for (const [tag, base] of SPECS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
    await page.goto(base + Q, { waitUntil: 'load' })
    await page.waitForFunction(() => !!document.querySelector('.coach-bar .cf svg'), { timeout: 60000 })
    await page.waitForTimeout(2500)
    const fig = page.locator('.coach-bar .cb-fig').first()
    const box = await fig.boundingBox()
    console.log(tag, 'cb-fig box=', JSON.stringify(box && { w: Math.round(box.width), h: Math.round(box.height) }))
    for (let i = 1; i <= FRAMES; i++) {
      await fig.screenshot({ path: path.join(OUT, `AB-${tag}-f${i}.png`) })
      await page.waitForTimeout(GAP)
    }
    console.log('  ✓', tag, FRAMES, 'frames')
    await page.close()
  }
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
