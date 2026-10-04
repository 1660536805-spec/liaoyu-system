import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'] })
  const p = await ctx.newPage()
  await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
  await p.waitForSelector('.coach-bar', { timeout: 20000 })
  await p.waitForTimeout(3400)
  const d = await p.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s); if (!e) return null
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), ov: cs.overflow, pos: cs.position, disp: cs.display }
    }
    return {
      fig: R('.cb-fig'), demo: R('.cb-fig .demo.coach.docked'), body: R('.cb-fig .demo-body'),
      cvbox: R('.cb-fig .cv-box'), cap: R('.cb-fig .coach-cap'),
      capText: (document.querySelector('.cb-fig .coach-cap') || {}).textContent,
    }
  })
  console.log(JSON.stringify(d, null, 1))
  await b.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
