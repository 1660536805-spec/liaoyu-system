/* 定位横向溢出：找出 scrollWidth 超过视口的元素。
 * 用法：node outputs/pm-review/probe-overflow.cjs <screen> [宽] [高]
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const SCREEN = process.argv[2] || 'home'
const W = Number(process.argv[3] || 1024)
const H = Number(process.argv[4] || 768)

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.goto(BASE + '/?screen=' + SCREEN, { waitUntil: 'load' })
  await page.waitForTimeout(600)
  const out = await page.evaluate(() => {
    const de = document.documentElement
    const vw = de.clientWidth
    const rows = []
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const right = r.right
      const over = Math.round(right - vw)
      const overL = Math.round(-r.left)
      if (over > 1 || overL > 1) {
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : ''
        rows.push({
          sel: el.tagName.toLowerCase() + cls,
          left: Math.round(r.left), right: Math.round(right), w: Math.round(r.width),
          overR: over, overL: overL,
          sw: el.scrollWidth, cw: el.clientWidth,
        })
      }
    })
    // 只保留最深的（去掉包含同样溢出的祖先，除非祖先自身 scrollWidth 也超）
    return { vw, docSW: de.scrollWidth, rows }
  })
  console.log(`viewport ${W}x${H}  视口宽 ${out.vw}  文档 scrollWidth ${out.docSW}`)
  out.rows.slice(0, 40).forEach((r) => {
    console.log(`  ${r.sel}`)
    console.log(`     rect [${r.left}..${r.right}] w=${r.w}  越界R=${r.overR} 越界L=${r.overL}  scrollW=${r.sw}/clientW=${r.cw}`)
  })
  await browser.close()
})()
