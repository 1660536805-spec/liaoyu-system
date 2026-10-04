import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  const ctx = await b.newContext({ viewport: { width: 1920, height: 860 }, permissions: ['camera'] })
  const p = await ctx.newPage()
  await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
  await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(4000)
  const d = await p.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); if(!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { h:+r.height.toFixed(1), w:+r.width.toFixed(1), height:c.height, maxHeight:c.maxHeight, aspectRatio:c.aspectRatio, minHeight:c.minHeight, position:c.position } }
    return { viewportH: innerHeight, vh62: innerHeight*0.62,
      stage: g('.stage'), fig: g('.cb-fig'), demo: g('.demo.coach.docked'), body: g('.demo-body'), cvbox: g('.cv-box'), cf: g('.cf'), cap: g('.coach-cap') }
  })
  console.log(JSON.stringify(d, null, 1))
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
