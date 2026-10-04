/* 桌面端「教练画面 ∥ 摄像头画面」并排校验：
   - 两盒等宽、等高、顶边对齐
   - 移动端回归：布局与改造前一致（舞台在上、教练条在下，小窗 96px）
   用法：node outputs/desktop-layout/verify.mjs [port]
*/
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const URL_TRAIN = `http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`
const OUT = 'outputs/desktop-layout/'

const rect = (p, sel) => p.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), display: cs.display }
}, sel)

;(async () => {
  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })

  /* ---------- 桌面端 ---------- */
  const dctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, permissions: ['camera'] })
  const dp = await dctx.newPage()
  const derr = []
  dp.on('pageerror', (e) => derr.push(e.message))
  await dp.goto(URL_TRAIN, { waitUntil: 'load' })
  await dp.waitForSelector('.coach-bar', { timeout: 20000 })
  await dp.waitForTimeout(4200)

  const cam = await rect(dp, '.stage')
  const coach = await rect(dp, '.cb-fig')
  const bar = await rect(dp, '.coach-bar .cb-main')
  const row = await rect(dp, '.stage-row')
  const cfg = await dp.evaluate(() => ({
    screenW: innerWidth, screenH: innerHeight,
    stageRowDisplay: getComputedStyle(document.querySelector('.stage-row')).display,
    coachBarDisplay: getComputedStyle(document.querySelector('.coach-bar')).display,
  }))
  console.log('【桌面 1440×900】')
  console.log('  视口       ', cfg.screenW + '×' + cfg.screenH, '| .stage-row display =', cfg.stageRowDisplay, '| .coach-bar display =', cfg.coachBarDisplay)
  console.log('  摄像头画面 ', JSON.stringify(cam))
  console.log('  教练画面   ', JSON.stringify(coach))
  console.log('  文案条     ', JSON.stringify(bar))
  console.log('  row        ', JSON.stringify(row))
  const dw = Math.abs(cam.w - coach.w), dh = Math.abs(cam.h - coach.h), dt = Math.abs(cam.y - coach.y)
  console.log(`  ⇒ 宽度差 ${dw.toFixed(1)}px | 高度差 ${dh.toFixed(1)}px | 顶边差 ${dt.toFixed(1)}px`)
  const ok = dw < 1.5 && dh < 1.5 && dt < 1.5
  console.log(ok ? '  ✓ 等宽、等高、顶边对齐' : '  ✗ 未对齐')

  for (const w of [1024, 1920]) {
    await dp.setViewportSize({ width: w, height: 860 })
    await dp.waitForTimeout(500)
    const c2 = await rect(dp, '.stage'); const f2 = await rect(dp, '.cb-fig')
    console.log(`  [${w}px] 宽差 ${Math.abs(c2.w - f2.w).toFixed(1)} 高差 ${Math.abs(c2.h - f2.h).toFixed(1)} 顶差 ${Math.abs(c2.y - f2.y).toFixed(1)}  (cam ${c2.w}×${c2.h})`)
  }
  await dp.setViewportSize({ width: 1440, height: 900 })
  await dp.waitForTimeout(500)
  await dp.screenshot({ path: OUT + 'D-01-桌面-并排.png' })

  /* ---------- 移动端回归 ---------- */
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'], isMobile: true, hasTouch: true })
  const mp = await mctx.newPage()
  await mp.goto(URL_TRAIN, { waitUntil: 'load' })
  await mp.waitForSelector('.coach-bar', { timeout: 20000 })
  await mp.waitForTimeout(4200)
  const mStage = await rect(mp, '.stage'), mFig = await rect(mp, '.cb-fig'), mBar = await rect(mp, '.coach-bar')
  const mcfg = await mp.evaluate(() => getComputedStyle(document.querySelector('.stage-row')).display)
  console.log('\n【移动 390×844】')
  console.log('  .stage-row display =', mcfg, '(应为 contents)')
  console.log('  舞台   ', JSON.stringify(mStage))
  console.log('  教练小窗', JSON.stringify(mFig), '(应 ~96×108)')
  console.log('  教练条 ', JSON.stringify(mBar))
  console.log('  顺序：舞台在上 →', mStage.y + mStage.h <= mBar.y + 2 ? '✓' : '✗', ' 教练条在下')
  await mp.screenshot({ path: OUT + 'D-02-移动-回归.png' })

  await b.close()
  console.log('\n桌面 console errors:', derr.length, derr.slice(0, 4))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
