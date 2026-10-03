/**
 * 抓取「当前线上形态」证据：主壳 9 页 + s4 应用关键页
 * 用法：NODE_PATH=<ws>/node_modules node current-state.cjs <baseUrl>
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = (process.argv[2] || 'http://127.0.0.1:5320').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out', 'current')

const MAIN = [
  ['main-00-loading', '/?screen=loading'],
  ['main-01-question', '/?screen=question'],
  ['main-1-audio', '/?screen=audio'],
  ['main-2-1-home', '/?screen=home'],
  ['main-2-2-intro', '/?screen=intro'],
  ['main-2-3-practice', '/?screen=practice'],
  ['main-2-4-done', '/?screen=done'],
  ['main-3-1-profile', '/?screen=profile'],
  ['main-3-2-body', '/?screen=body'],
]
const S4 = [
  ['s4-root', '/s4/#/'],
  ['s4-train', '/s4/#/train'],
  ['s4-sound', '/s4/#/sound'],
  ['s4-prepare', '/s4/#/prepare'],
  ['s4-me', '/s4/#/me'],
]

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 470, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const report = []
  for (const [name, url] of [...MAIN, ...S4]) {
    const page = await ctx.newPage()
    const errors = []
    const notFound = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    page.on('response', (r) => { if (r.status() >= 400) notFound.push(r.status() + ' ' + r.url()) })
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(1200)
      // 定高容器：先量 scrollHeight 再放大视口才能整页截到
      const h = await page.evaluate(() => {
        const el = document.querySelector('.sc') || document.documentElement
        return Math.max(el.scrollHeight, document.body.scrollHeight, 900)
      })
      await page.setViewportSize({ width: 470, height: Math.min(h + 8, 4000) })
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(OUT, name + '.png') })
      const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 120))
      report.push({ name, url, pageH: h, head: txt, errors: errors.slice(0, 3), notFound: notFound.slice(0, 4) })
    } catch (e) {
      report.push({ name, url, fail: String(e).slice(0, 160) })
    }
    await page.close()
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
})()
