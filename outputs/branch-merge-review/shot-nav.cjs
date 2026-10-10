/* 截「导航栏」相关的三屏：home / audio / profile（各屏底部导航区单独再截一张）。
 * 用法：node outputs/branch-merge-review/shot-nav.cjs
 */
const { chromium } = require('playwright-core')
const path = require('path')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:' + (Number(process.env.PM_PORT) || 5400)
const OUT = __dirname

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  await p.goto(BASE + '/', { waitUntil: 'load' })
  await p.waitForTimeout(600)
  await p.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  for (const s of ['home', 'audio', 'profile']) {
    await p.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await p.waitForTimeout(700)
    await p.screenshot({ path: path.join(OUT, `导航4项-${s}-全屏.png`), fullPage: true })
    const nav = p.locator('.nav')
    if (await nav.count()) {
      await nav.screenshot({ path: path.join(OUT, `导航4项-${s}-导航条.png`) })
    }
    console.log('  ✓ ' + s)
  }
  await b.close()
})()
