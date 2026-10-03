/**
 * 回退验证：确认音疗页已恢复为改版前的形态
 * 用法：NODE_PATH=<workspace>/node_modules node verify-sound.cjs <url>
 */
const { chromium } = require('playwright-core')
const path = require('path')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.argv[2] || 'http://127.0.0.1:5312/s4/#/sound'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 470, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  const errors = []
  const notFound = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('response', (r) => { if (r.status() >= 400) notFound.push(r.status() + ' ' + r.url()) })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const info = await page.evaluate(() => ({
    hasLs: !!document.querySelector('.ls'),
    navTexts: [...document.querySelectorAll('.nav button, nav button, [class*="tab"] button')]
      .map((e) => e.textContent.replace(/\s+/g, '').trim()).filter(Boolean),
    heading: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6),
    hasPlayerCard: !!document.querySelector('.player'),
    hasBanner: !!document.querySelector('.a-hero'),
    toneCardCount: document.querySelectorAll('.tone-card, .organ').length,
  }))

  await page.screenshot({ path: path.join(__dirname, 'out', 'revert-check.png'), fullPage: true })
  console.log(JSON.stringify({ url: URL, info, errors: errors.slice(0, 5), notFound: notFound.slice(0, 8) }, null, 2))
  await browser.close()
})()
