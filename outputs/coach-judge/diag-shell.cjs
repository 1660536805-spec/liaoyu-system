/* 截主壳跟练页 / 引导页，看用户实际看到的「教练」是什么。 */
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = __dirname
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  for (const s of ['practice', 'intro', 'home']) {
    await p.goto(`http://127.0.0.1:${PORT}/?screen=${s}`, { waitUntil: 'load' })
    await p.waitForTimeout(2500)
    await p.screenshot({ path: path.join(OUT, `SHELL-${s}.png`) })
    console.log('✓', s)
  }
  await b.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
