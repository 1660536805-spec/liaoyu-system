import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  for (const [w,h] of [[1440,900],[1920,1080],[1366,768]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, permissions: ['camera'] })
    const p = await ctx.newPage()
    await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
    await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(3200)
    const read = () => p.evaluate(() => {
      const app = document.querySelector('.app')
      const foot = document.querySelector('.footbar').getBoundingClientRect()
      return { zoom: getComputedStyle(app).zoom, innerH: innerHeight,
        appH: Math.round(app.getBoundingClientRect().height),
        footBottom: Math.round(foot.bottom),
        footVisible: foot.bottom <= innerHeight + 1 }
    })
    const before = await read()
    await p.addStyleTag({ content: '.app { zoom: 1 !important; }' })
    await p.waitForTimeout(600)
    const after = await read()
    console.log(`【${w}×${h}】`)
    console.log('   现状 :', JSON.stringify(before))
    console.log('   zoom1:', JSON.stringify(after))
    await ctx.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
