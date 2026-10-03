/**
 * 截取 s4 音疗页（/#/sound），与图二比对
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const OUT = process.env.OUT || path.join(__dirname, 'out')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const W = Number(process.env.W || 470)
const H = Number(process.env.H || 900)

fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
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

  await page.goto(`${BASE}/s4/#/sound`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // 整页
  await page.screenshot({ path: path.join(OUT, 'sound-full.png'), fullPage: true })

  // 视口（对齐图二的取景：从「选择调养方向」往下）
  await page.screenshot({ path: path.join(OUT, 'sound-viewport-top.png') })

  const info = await page.evaluate(() => {
    const de = document.documentElement
    const ls = document.querySelector('.ls')
    const phone = document.querySelector('.ls-phone')
    const h = document.querySelector('.ls-h')
    const org = document.querySelectorAll('.organ')
    const player = document.querySelector('.player')
    const track = document.querySelectorAll('.track')
    return {
      htmlFont: getComputedStyle(de).fontSize,
      hasLsScale: de.classList.contains('ls-scale'),
      lsScrollH: ls ? ls.scrollHeight : 0,
      lsClientH: ls ? ls.clientHeight : 0,
      phoneW: phone ? Math.round(phone.getBoundingClientRect().width) : 0,
      headingText: h ? h.textContent.trim() : null,
      headingSize: h ? getComputedStyle(h).fontSize : null,
      organCount: org.length,
      organSel: document.querySelectorAll('.organ.sel').length,
      playerTitle: document.querySelector('.player .tt') ? document.querySelector('.player .tt').textContent.trim() : null,
      liveText: document.querySelector('.player .live') ? document.querySelector('.player .live').textContent.trim() : null,
      trackCount: track.length,
      tagFont: document.querySelector('.ls .tag') ? getComputedStyle(document.querySelector('.ls .tag')).fontSize : null,
      bodyH: document.body.scrollHeight,
    }
  })

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ info, errors, notFound }, null, 2))
  console.log(JSON.stringify({ info, errors: errors.slice(0, 8), notFound: notFound.slice(0, 8) }, null, 2))

  await browser.close()
})()
