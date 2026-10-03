/**
 * A 方案验收：点「开始动作预览」应留在主壳、进入最终版风格的跟练页
 * 用法：NODE_PATH=<ws>/node_modules node verify-revert-a.cjs <baseUrl>
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = (process.argv[2] || 'http://127.0.0.1:5320').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out', 'current')

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  const errors = []
  const notFound = []
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  p.on('response', (r) => { if (r.status() >= 400) notFound.push(r.status() + ' ' + r.url()) })

  const results = {}

  // 1) 进入页 → 点「开始动作预览」
  await p.goto(BASE + '/?screen=intro', { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.click('[data-a="start-practice"]')
  await p.waitForTimeout(1200)
  results.afterStartPractice = {
    url: p.url(),
    stayedInShell: await p.evaluate(() => !!document.querySelector('.sc')),
    screen: await p.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, ' ')
      return { hasSkeleton: !!document.querySelector('svg') && /呼吸共鸣/.test(t), head: t.trim().slice(0, 90) }
    }),
  }
  // 整页截图（定高容器：先量 scrollHeight 再放大视口）
  const h = await p.evaluate(() => Math.max(document.querySelector('.sc')?.scrollHeight || 0, 900))
  await p.setViewportSize({ width: 470, height: Math.min(h + 8, 4000) })
  await p.waitForTimeout(300)
  await p.screenshot({ path: path.join(OUT, 'revertA-practice.png') })

  // 2) 进入页 → 点「示例」
  await p.setViewportSize({ width: 470, height: 900 })
  await p.goto(BASE + '/?screen=intro', { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  await p.click('[data-a="demo"]')
  await p.waitForTimeout(800)
  results.afterDemo = { url: p.url(), stayedInShell: await p.evaluate(() => !!document.querySelector('.sc')) }

  // 3) 走一遍完整体验：首页 → 进入页 → 跟练(下一式 x8) → 结束页
  await p.goto(BASE + '/?screen=home', { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.click('[data-a="go-intro"]'); await p.waitForTimeout(400)
  await p.click('[data-a="start-practice"]'); await p.waitForTimeout(600)
  let steps = 0
  for (let i = 0; i < 9; i++) {
    const has = await p.$('[data-a="next-step"]')
    if (!has) break
    await p.click('[data-a="next-step"]'); steps++; await p.waitForTimeout(350)
  }
  results.flow = { advancedSteps: steps, url: p.url(), done: await p.evaluate(() => /动作预览完成/.test(document.body.innerText)), doneHead: await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 80)) }

  results.errors = errors.slice(0, 5)
  results.notFound = notFound.slice(0, 6)
  fs.writeFileSync(path.join(OUT, 'revertA-report.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  await b.close()
})()
