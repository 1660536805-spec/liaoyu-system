/**
 * 图二 / 图一 三方比对：
 *   - main  → 主壳音疗页（图二基准）  /?screen=audio
 *   - s4    → 改写后的 s4 音疗页      /s4/#/sound
 * 同一视口、同一设备像素比，输出整页截图 + 关键尺寸诊断。
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const OUT = path.join(__dirname, 'out')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const W = Number(process.env.W || 470)
const H = Number(process.env.H || 900)

fs.mkdirSync(OUT, { recursive: true })

// 把内部滚动容器解开，让整页能一次性截全
const UNCLAMP = () => {
  const nodes = [document.documentElement, document.body, ...document.querySelectorAll('.app, .ls, .ls-phone, .wrap, .body, .phone')]
  for (const n of nodes) {
    if (!n) continue
    n.style.height = 'auto'
    n.style.maxHeight = 'none'
    n.style.overflow = 'visible'
    n.style.minHeight = '0'
  }
}

async function shot(page, url, tag) {
  const errors = []
  const bad = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUT, `${tag}-fold.png`) })

  await page.evaluate(UNCLAMP)
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${tag}-full.png`), fullPage: true })

  // 按钮换行诊断
  const diag = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.btn')].slice(0, 4).map((b) => ({
      text: b.textContent.trim().slice(0, 14),
      w: Math.round(b.getBoundingClientRect().width),
      lines: Math.round(b.getBoundingClientRect().height / parseFloat(getComputedStyle(b).fontSize) / 1.6),
      h: Math.round(b.getBoundingClientRect().height),
    }))
    const title = document.querySelector('.player .tt, .a-hero .t-callig')
    return { btns, htmlFont: getComputedStyle(document.documentElement).fontSize }
  })
  return { diag, errors: errors.slice(0, 6), bad: bad.slice(0, 6) }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  const main = await shot(await ctx.newPage(), `${BASE}/?screen=audio`, 'main-audio')
  const s4 = await shot(await ctx.newPage(), `${BASE}/s4/#/sound`, 's4-audio')

  console.log('视口', W + 'x' + H)
  console.log('MAIN(图二基准):', JSON.stringify(main, null, 2))
  console.log('S4(改写后):', JSON.stringify(s4, null, 2))

  await browser.close()
})()
