import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['camera'] })
  const p = await ctx.newPage()
  await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
  await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(3400)
  const d = await p.evaluate(() => {
    const wrap = document.querySelector('.wrap.train')
    const vh = innerHeight
    const bad = []
    wrap.querySelectorAll('*').forEach(e => {
      const r = e.getBoundingClientRect()
      if (r.bottom > vh + 1 && r.height > 0) {
        bad.push({ tag: e.tagName, cls: (typeof e.className === 'string' ? e.className : '').slice(0, 46),
          top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) })
      }
    })
    return { vh, wrapScrollH: wrap.scrollHeight, bad: bad.slice(-14) }
  })
  console.log(JSON.stringify(d, null, 1))
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
