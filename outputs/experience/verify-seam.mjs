/* 关键接缝实测：主壳「开始动作预览」→ 是否落到真 s4 跟练页（含教练 + 摄像头） */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const OUT = 'outputs/experience/'

;(async () => {
  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, permissions: ['camera'] })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })

  // 直达练习屏
  await p.goto(`http://127.0.0.1:${PORT}/?screen=intro`, { waitUntil: 'networkidle' })
  const before = await p.evaluate(() => ({
    url: location.href,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 180),
    hasBtn: !!document.querySelector('[data-a="start-practice"]'),
  }))
  console.log('【练习屏】', JSON.stringify(before))
  await p.screenshot({ path: OUT + 'P-05-主壳练习屏.png' })

  // 点「开始动作预览」
  await p.locator('[data-a="start-practice"]').first().click()
  await p.waitForTimeout(3500)

  const after = await p.evaluate(() => ({
    url: location.href,
    hash: location.hash,
    title: document.title,
    coachBar: !!document.querySelector('.coach-bar'),
    coachFig: !!document.querySelector('.coach-bar .cf svg'),
    dataP: document.querySelectorAll('.coach-bar [data-p]').length,
    canvasInCoachBar: document.querySelectorAll('.coach-bar canvas').length,
    videoN: document.querySelectorAll('video').length,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
  }))
  console.log('\n【跳转后】', JSON.stringify(after, null, 1))
  await p.screenshot({ path: OUT + 'P-06-真跟练页.png' })

  await b.close()
  console.log('\nconsole errors:', errs.length, errs.slice(0, 6))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
