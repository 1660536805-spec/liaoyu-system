import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'] })
  const p = await ctx.newPage()
  await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
  await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(3600)
  const d = await p.evaluate(() => {
    const out = []
    let e = document.querySelector('.footbar')
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e)
      out.push({ sel: e.className || e.tagName, h: e.clientHeight, sh: e.scrollHeight,
        oy: cs.overflowY, disp: cs.display, pos: cs.position,
        grow: cs.flexGrow, shrink: cs.flexShrink, basis: cs.flexBasis })
      e = e.parentElement
    }
    return out
  })
  console.log(JSON.stringify(d, null, 1))
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
