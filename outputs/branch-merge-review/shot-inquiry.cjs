/* 问询页与 5 项导航的截图 */
const { chromium } = require('playwright-core')
const path = require('path')
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = __dirname

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })

  // 1) 问询页（含一次真实发送，展示两种气泡）
  await page.goto(BASE + '/?screen=inquiry', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(DIR, 'inquiry-page.png'), fullPage: true })
  await page.fill('#ask-input', '八段锦第一式要注意什么？')
  await page.click('[data-a="ask-send"]')
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(DIR, 'inquiry-page-chat.png'), fullPage: true })

  // 2) 5 项导航特写（问询页上）
  const nav = await page.$('.nav')
  await nav.screenshot({ path: path.join(DIR, 'inquiry-nav5.png') })

  // 3) 首页底部（确认既有页面只是多一项，其余不动）
  await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(DIR, 'home-nav5.png') })

  console.log('→ inquiry-page.png / inquiry-page-chat.png / inquiry-nav5.png / home-nav5.png')
  await browser.close()
})()
