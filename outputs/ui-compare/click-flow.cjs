const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.argv[2] || 'http://127.0.0.1:5320'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  // 从「八段锦进入页」点「开始动作预览」
  await p.goto(BASE + '/?screen=intro', { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  const before = p.url()
  await p.click('[data-a="start-practice"]')
  await p.waitForTimeout(2500)
  const after = p.url()
  const info = await p.evaluate(() => ({
    title: document.title,
    head: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 160),
    hasShell: !!document.querySelector('.sc'),
    bgColor: getComputedStyle(document.body).backgroundColor,
  }))
  console.log(JSON.stringify({ before, after, info }, null, 2))
  await b.close()
})()
