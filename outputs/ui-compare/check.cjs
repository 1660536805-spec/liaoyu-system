/**
 * 核对：主壳音疗页与 s4 音疗页，是否显示「已选预览」角标。
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  for (const [tag, url] of [['main', BASE + '/?screen=audio'], ['s4', BASE + '/s4/#/sound']]) {
    const p = await ctx.newPage()
    await p.goto(url, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    const r = await p.evaluate(() => {
      const q = (s) => [...document.querySelectorAll(s)]
      const tracks = q('.track')
      return {
        tracks: tracks.length,
        ttTexts: q('.track .tt').map((e) => e.textContent.trim()),
        notes: q('.track .note').map((e) => ({ text: e.textContent.trim(), x: Math.round(e.getBoundingClientRect().x) })),
        playerTitle: (document.querySelector('.player .tt') || {}).textContent,
        playCOn: q('.play-c.on').length,
      }
    })
    console.log(`\n===== ${tag} =====`)
    console.log(JSON.stringify(r, null, 1))
    await p.close()
  }
  await browser.close()
})()
