/* 定位：practice 屏 y≈245-253（2x）这一条差异带到底是哪个元素。
 * 用法：node outputs/pm-review/probe-practice-band.cjs [port]
 */
const { chromium } = require('playwright-core')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(BASE + '/?screen=practice', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const out = await page.evaluate(() => {
    // 差异带在 2x 位图 y 245..253 / x 458..625 → CSS y 122.5..126.5 / x 229..312.5
    const box = { x0: 229, y0: 122, x1: 313, y1: 127 }
    const hits = []
    document.querySelectorAll('body *').forEach((e) => {
      const r = e.getBoundingClientRect()
      if (!r.width || !r.height) return
      const inter = !(r.right < box.x0 || r.left > box.x1 || r.bottom < box.y0 || r.top > box.y1)
      if (!inter) return
      hits.push({
        tag: e.tagName.toLowerCase(), cls: e.className && e.className.toString().slice(0, 40),
        text: (e.textContent || '').trim().slice(0, 24),
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        font: getComputedStyle(e).fontFamily.slice(0, 40),
        anim: getComputedStyle(e).animationName,
        op: getComputedStyle(e).opacity,
      })
    })
    // 页面里所有带动画的元素（动画就是「同版本两次截图会有差异」的常见来源）
    const animated = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).animationName !== 'none')
      .map((e) => e.tagName.toLowerCase() + '.' + (e.className || '').toString().split(' ')[0] + ':' + getComputedStyle(e).animationName)
    return { hits, animated, fontsReady: document.fonts.status }
  })
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
})()
