const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const PROBE = () => {
  const rows = []
  const sc = document.querySelector('.sc')
  const kids = sc ? [...sc.children] : []
  rows.push({ sel: '.sc', top: Math.round(sc.getBoundingClientRect().top), h: Math.round(sc.getBoundingClientRect().height) })
  for (const k of kids) {
    const r = k.getBoundingClientRect()
    rows.push({ sel: k.tagName.toLowerCase() + '.' + (k.className || '').toString().split(' ').filter(Boolean).join('.'), top: Math.round(r.top), h: Math.round(r.height) })
  }
  // 底部导航
  const nav = document.querySelector('.nav, .app-tab')
  const navR = nav ? { h: Math.round(nav.getBoundingClientRect().height), cls: nav.className } : null
  const phone = document.querySelector('.ls-phone, .phone')
  return {
    rows,
    nav: navR,
    phoneH: phone ? Math.round(phone.getBoundingClientRect().height) : 0,
    bodyH: document.body.scrollHeight,
    lsH: document.querySelector('.ls') ? document.querySelector('.ls').scrollHeight : 0,
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  for (const [tag, url] of [['MAIN', `${BASE}/?screen=audio`], ['S4', `${BASE}/s4/#/sound`]]) {
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    const r = await page.evaluate(PROBE)
    console.log('===== ' + tag + ' =====')
    for (const row of r.rows) console.log(String(row.top).padStart(5), String(row.h).padStart(5), row.sel)
    console.log('nav:', JSON.stringify(r.nav), 'phoneH:', r.phoneH, 'bodyH:', r.bodyH, 'lsH:', r.lsH)
    await page.close()
  }
  await browser.close()
})()
