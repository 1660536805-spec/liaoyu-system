/* 渲染自检：给报告拍一张整页截图，确认没有白屏 / 错版 */
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = __dirname
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e.message)))
  page.on('requestfailed', (r) => errs.push('missing: ' + r.url().split('/').pop()))
  await page.goto('file://' + path.join(OUT, 'report.html'), { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const info = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    sections: document.querySelectorAll('section').length,
    cards: document.querySelectorAll('.card').length,
    imgs: [...document.images].map((i) => (i.naturalWidth ? 'ok' : 'BROKEN') + ':' + i.currentSrc.split('/').pop()),
    text: document.body.innerText.slice(0, 60).replace(/\n/g, ' '),
  }))
  console.log(JSON.stringify(info, null, 1))
  if (errs.length) console.log('ERRORS:', errs)
  await page.screenshot({ path: path.join(OUT, 'report-preview.png'), fullPage: false })
  await browser.close()
})()
