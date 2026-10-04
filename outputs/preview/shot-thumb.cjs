/* 抓预览启动台用的缩略图：主壳首屏 + 真跟练页（带新教练）
 * 用法：node outputs/preview/shot-thumb.cjs <port>
 */
const { chromium } = require('playwright-core')
const path = require('path')

const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(__dirname, 'thumbs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const W = 470, H = 900

async function shoot(page, url, file, waitMs = 1800, prep) {
  await page.goto(url, { waitUntil: 'load' })
  await page.setViewportSize({ width: W, height: H })
  if (prep) await prep(page)
  await page.waitForTimeout(waitMs)
  await page.screenshot({ path: path.join(OUT, file) })
  console.log('  ✓', file)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })

  // ① 主壳首屏
  await shoot(page, `${BASE}/`, 'shell-home.png', 2000)

  // ② 主壳 · 「开始动作预览」按钮所在页（这里就是要认的门）
  await shoot(page, `${BASE}/?screen=loading`, 'shell-loading.png', 1200, async (p) => {
    const b = p.locator('[data-a="load-enter"]')
    if (await b.count()) await b.first().click()
    await p.waitForTimeout(600)
  })

  // ③ 真跟练页 + 新教练（等教练条出现即可，不等重模型）
  await page.goto(`${BASE}/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!document.querySelector('.coach-bar'), { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(5000)
  await page.screenshot({ path: path.join(OUT, 's4-coach.png') })
  console.log('  ✓ s4-coach.png')

  await browser.close()
  console.log('done →', OUT)
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
