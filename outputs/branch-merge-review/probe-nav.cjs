/* 数一数每一屏底部导航栏的项数与文案。
 * 用法：node outputs/branch-merge-review/probe-nav.cjs [dist/app.js 路径]
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = 'http://127.0.0.1:' + PORT
const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 } })
  await p.goto(BASE + '/', { waitUntil: 'load' })
  await p.waitForTimeout(600)
  await p.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  console.log('屏'.padEnd(10) + '项数  ' + '文案（· 高亮）')
  for (const s of SCREENS) {
    await p.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await p.waitForTimeout(s === 'loading' ? 2600 : 700)
    const info = await p.evaluate(() => {
      const nav = document.querySelector('.nav')
      if (!nav) return { n: 0, items: [] }
      const items = [...nav.querySelectorAll('.nitem')].map((e) => {
        const on = e.classList.contains('on') ? '·' : ' '
        return on + (e.textContent || '').replace(/\s+/g, '').trim()
      })
      return { n: items.length, items }
    })
    const tag = info.n === 4 ? '  ← 4 项' : (info.n === 3 ? '  ← 3 项' : (info.n === 0 ? '  (无导航)' : ''))
    console.log(s.padEnd(10) + String(info.n).padEnd(5) + info.items.join('  ') + tag)
  }
  await b.close()
})()
