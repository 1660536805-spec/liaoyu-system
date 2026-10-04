/**
 * 改前 / 改后 整页对照抓图（同一视口、同一状态起点）。
 *
 * 改前 = 仓库 HEAD 的 dist/app.js + dist/app.css（服务在 5412）
 * 改后 = 当前工作树（服务在 5411）
 *
 * 用法：NODE_PATH=<repo>/node_modules node outputs/activate-all/beforeafter.cjs [afterUrl] [beforeUrl]
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const AFTER = (process.argv[2] || 'http://127.0.0.1:5411').replace(/\/$/, '')
const BEFORE = (process.argv[3] || 'http://127.0.0.1:5412').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out', 'ba')
fs.mkdirSync(OUT, { recursive: true })

const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']
/** 改后预期会有视觉变化的屏（其余屏必须逐像素不变） */
const EXPECTED_CHANGE = { audio: 1, practice: 1, done: 1 }

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] })
  const report = []
  for (const [tag, base] of [['before', BEFORE], ['after', AFTER]]) {
    const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    // 归零：无打卡记录、无音频偏好、无头像，保证两版状态一致
    await page.goto(base + '/?screen=loading', { waitUntil: 'load' })
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    for (const s of SCREENS) {
      await page.setViewportSize({ width: 470, height: 900 })   // 先复位，避免「量高 → 放大视口 → 下次量到放大后的高度」的自反馈
      await page.goto(base + '/?screen=' + s, { waitUntil: 'load' })
      await page.waitForTimeout(600)
      const h = await page.evaluate(() => Math.max((document.querySelector('#app') || {}).scrollHeight || 0, document.body.scrollHeight, 900))
      await page.setViewportSize({ width: 470, height: Math.min(h, 4000) })
      await page.waitForTimeout(350)
      const f = path.join(OUT, `${tag}-${s}.png`)
      await page.screenshot({ path: f })
      const size = await page.evaluate(() => ({ h: innerHeight, sh: (document.querySelector('#app') || {}).scrollHeight || 0 }))
      report.push({ tag, s, file: f, contentH: h, errors: errors.length })
      console.log(`${tag.padEnd(6)} ${s.padEnd(9)} 内容高 ${h}`)
    }
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
})().catch((e) => { console.error(e); process.exit(2) })
