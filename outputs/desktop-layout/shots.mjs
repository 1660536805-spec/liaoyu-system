import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const URL = `http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  const shots = [
    { vp: [1920, 1080], out: 'outputs/desktop-layout/D-03-桌面1920-并排.png' },
    { vp: [1440, 1400], out: 'outputs/desktop-layout/D-04-桌面-全高（含被裁部分）.png' },
  ]
  for (const s of shots) {
    const ctx = await b.newContext({ viewport: { width: s.vp[0], height: s.vp[1] }, permissions: ['camera'] })
    const p = await ctx.newPage()
    await p.goto(URL, { waitUntil: 'load' })
    await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(3600)
    await p.screenshot({ path: s.out })
    console.log('saved', s.out, s.vp.join('×'))
    await ctx.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
