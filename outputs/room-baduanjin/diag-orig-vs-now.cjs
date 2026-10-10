/* 对比「原件房间版(臂长98)」vs「现版房间版(臂长82)」的视觉差异。
 * 用法：node outputs/room-baduanjin/diag-orig-vs-now.cjs [port]
 */
const { chromium } = require('playwright-core')
const path = require('path')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = __dirname

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 })

  for (const [tag, rel] of [['ORIG', '/outputs/room-baduanjin/original-backup.html'], ['NOW', '/outputs/room-baduanjin/preview.html']]) {
    await page.goto(BASE + rel, { waitUntil: 'load' })
    await page.waitForTimeout(4000)
    const meta = await page.evaluate(() => ({
      title: document.title,
      hasTj: !!window.__tj,
      svgs: document.querySelectorAll('svg').length,
    }))
    console.log(tag, JSON.stringify(meta))
    await page.screenshot({ path: path.join(OUT, `DIAG-${tag}-full.png`) })
    console.log('  ✓', `DIAG-${tag}-full.png`)
  }
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
