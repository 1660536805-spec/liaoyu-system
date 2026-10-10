/* 校验：主壳首页「今日节气 / 日期」是否来自真实计算，且页面无报错。
 * 用法：node outputs/pm-review/probe-today.cjs [port]
 */
const { chromium } = require('playwright-core')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const out = await page.evaluate(() => {
    const t = (s) => { const e = document.querySelector(s); return e ? e.innerText : null }
    return {
      jq: t('.hero .jq'), date: t('.hero .date'), desc: t('.hero .desc'),
      quote: t('.quotebar p'), recWhy: t('.rec-cols .r p'),
    }
  })
  console.log(JSON.stringify(out, null, 2))
  // 结束页食养文案
  await page.goto(BASE + '/?screen=done', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  const done = await page.evaluate(() => {
    document.querySelector('[data-a="recipe"]')?.click()
    return document.querySelector('.xs-b')?.innerText || null
  })
  await page.waitForTimeout(300)
  console.log('--- 结束页食养浮层 ---\n' + done)
  console.log('--- 控制台报错 ---\n' + (errs.length ? errs.join('\n') : '（无）'))
  await browser.close()
})()
