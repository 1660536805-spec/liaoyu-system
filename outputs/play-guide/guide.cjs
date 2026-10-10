/* 「完整应用怎么玩」实测：走一遍主壳 → 引导 → s4 真跟练，逐步截图。
 * 用法：node outputs/play-guide/guide.cjs [port]
 */
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = __dirname
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const shots = []
;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name) })
    shots.push(name)
    console.log('  ✓', name)
  }
  const click = async (sel, wait = 700) => {
    await page.waitForSelector(sel, { timeout: 20000 })
    await page.click(sel)
    await page.waitForTimeout(wait)
  }

  // 1 加载页
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(2200)
  await shot('01-加载页.png')

  // 2 加载页 → 问诊（7 步，每步先选卡再下一题）
  await click('[data-a="load-enter"]', 1200)
  for (let i = 0; i < 8; i++) {
    const card = await page.$('button.qcard[data-a="qsel"]')
    if (!card) break
    await page.click('button.qcard[data-a="qsel"]')
    await page.waitForTimeout(260)
    const next = await page.$('[data-a="q-next"]')
    if (!next) break
    if (i === 0) await shot('02-问诊-第1题.png')
    await page.click('[data-a="q-next"]')
    await page.waitForTimeout(900)
  }
  await shot('03-问诊后落地页.png')

  // 3 首页 → 引导页
  if (await page.$('[data-a="go-intro"]')) {
    await click('[data-a="go-intro"]', 1400)
  } else {
    await page.goto(BASE + '/?screen=intro', { waitUntil: 'load' })
    await page.waitForTimeout(1400)
  }
  await shot('04-选模式与阶段.png')

  // 4 音疗页（顺带看音乐真能播）
  await page.goto(BASE + '/?screen=audio', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  await shot('05-音疗页.png')

  // 5 引导页 → s4 真跟练
  await page.goto(BASE + '/?screen=intro', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await click('[data-a="start-practice"]', 2500)
  const url = page.url()
  console.log('  跳转到:', url.replace(BASE, ''))
  await page.waitForFunction(() => !!document.querySelector('.coach-bar'), { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await shot('06-s4跟练页.png')
  const info = await page.evaluate(() => ({
    coach: !!document.querySelector('.coach-bar'),
    coachFig: !!document.querySelector('.coach-bar .cf svg'),
    dataP: document.querySelectorAll('.coach-bar [data-p]').length,
    video: (() => { const v = document.querySelector('video'); return v ? `${v.videoWidth}x${v.videoHeight}` : 'none' })(),
    text: (document.querySelector('.coach-bar .cb-name') || {}).textContent || '',
  }))
  console.log('  跟练页状态:', JSON.stringify(info))

  // 6 启动台 / 完整体验入口
  await page.goto(BASE + '/outputs/preview/', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await shot('07-启动台.png')

  // 7 桌面端跟练页（并排布局）
  const d = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 })
  await d.goto(BASE + '/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong', { waitUntil: 'load' })
  await d.waitForFunction(() => !!document.querySelector('.coach-bar'), { timeout: 60000 }).catch(() => {})
  await d.waitForTimeout(3500)
  await d.screenshot({ path: path.join(OUT, '08-桌面端并排.png') })
  shots.push('08-桌面端并排.png')
  console.log('  ✓ 08-桌面端并排.png')
  await d.close()

  console.log('errors=', errs.length ? errs.slice(0, 6) : '0')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
