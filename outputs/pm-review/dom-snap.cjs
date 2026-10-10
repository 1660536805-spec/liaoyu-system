/* 把主壳每一屏的「渲染后 DOM」导出成 JSON。
 *
 * 为什么需要它：像素比对会被动效（loading 页的云/花瓣/转圈、practice 页的点阵）
 * 干扰，同版本连采也会差几百像素。而 DOM 字符串是确定的 ——
 * 未触碰的屏在改前/改后必须**逐字符相同**，这比像素更强的证明。
 *
 * 用法：node outputs/pm-review/dom-snap.cjs outputs/pm-review/dom-XX.json
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'dom-snap.json'))

const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  const out = { at: new Date().toISOString(), appJs: null, screens: {}, errs }
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 2600 : 700)
    const html = await page.evaluate(() => {
      const root = document.querySelector('.phone') || document.body
      // 抹掉只与「当前时刻」有关、与本次改动无关的东西（本例其实没有，留作保险）
      return root.outerHTML
    })
    out.screens[s] = html
    console.log('  ✓ ' + s + '  ' + html.length + ' 字符')
  }
  // 顺便记下 app.css 的体积/指纹，证明样式表没被动过
  const cssLen = await page.evaluate(async () => (await (await fetch('/app.css')).text()).length)
  out.appCssLen = cssLen
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8')
  console.log('→ ' + OUT + '   app.css ' + cssLen + ' 字符   报错 ' + errs.length + ' 条')
  await browser.close()
})()
