/**
 * A/B 对比：同视口分别截取「改版前」与「改版后」的音疗页。
 * 该应用是 100vh 定高容器 + 内部滚动，fullPage 只能拿到首屏，
 * 因此先量出内容真实高度，把视口放大到能容纳整页，再截图。
 * 用法：NODE_PATH=<workspace>/node_modules node ab-shot.cjs
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

const W = 470
const NAV_H = 90 // 让底部固定导航也能进画面

const targets = [
  { name: 'before', url: process.env.BEFORE_URL || 'http://127.0.0.1:5311/#/sound' },
  { name: 'after', url: process.env.AFTER_URL || 'http://127.0.0.1:5312/s4/#/sound' },
]

const measure = () => {
  let maxScroll = 0
  let tallest = null
  document.querySelectorAll('*').forEach((el) => {
    const sh = el.scrollHeight
    if (sh > maxScroll) { maxScroll = sh; tallest = el }
  })
  return {
    docScrollH: document.documentElement.scrollHeight,
    docClientH: document.documentElement.clientHeight,
    bodyScrollH: document.body.scrollHeight,
    maxScrollH: maxScroll,
    tallestTag: tallest ? (tallest.tagName + '.' + (tallest.className || '')).slice(0, 60) : null,
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({
    viewport: { width: W, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  const results = {}
  for (const t of targets) {
    const page = await ctx.newPage()
    const errors = []
    const notFound = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    page.on('response', (r) => { if (r.status() >= 400) notFound.push(r.status() + ' ' + r.url()) })

    await page.goto(t.url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    // 首屏（视口）图
    await page.screenshot({ path: path.join(OUT, `${t.name}-top.png`) })

    // 量高度 → 放大视口 → 整页
    const m1 = await page.evaluate(measure)
    const fullH = Math.min(Math.max(m1.maxScrollH, m1.docScrollH, m1.bodyScrollH) + NAV_H, 5000)
    await page.setViewportSize({ width: W, height: fullH })
    await page.waitForTimeout(900)

    const m2 = await page.evaluate(measure)
    await page.screenshot({ path: path.join(OUT, `${t.name}-full.png`), fullPage: true })

    const navTexts = await page.evaluate(() =>
      [...document.querySelectorAll('.nav button, nav button, [class*="tab"] button')]
        .map((e) => e.textContent.replace(/\s+/g, '').trim())
        .filter(Boolean)
        .slice(0, 8)
    )

    results[t.name] = {
      url: t.url,
      measured: m1,
      afterResize: m2,
      viewportH: fullH,
      hasLs: await page.evaluate(() => !!document.querySelector('.ls')),
      navTexts,
      errors: errors.slice(0, 5),
      notFound: notFound.slice(0, 8),
    }
    await page.close()
  }

  fs.writeFileSync(path.join(OUT, 'ab-report.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  await browser.close()
})()
