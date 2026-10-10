/* 音疗页「为你推荐」合并后的截图（整页 + 推荐区特写） */
const { chromium } = require('playwright-core')
const path = require('path')
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = __dirname

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(BASE + '/?screen=audio', { waitUntil: 'load' })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(DIR, 'song-audio-full.png'), fullPage: true })
  const sec = await page.$('.track')
  if (sec) {
    const parent = await page.evaluateHandle((el) => el.closest('section'), sec)
    const el = parent.asElement()
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await el.screenshot({ path: path.join(DIR, 'song-audio-list.png') })
  }
  console.log('→ song-audio-full.png / song-audio-list.png')
  await browser.close()
})()
