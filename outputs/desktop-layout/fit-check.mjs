import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  for (const [w,h] of [[1440,900],[1366,768]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, permissions: ['camera'] })
    const p = await ctx.newPage()
    await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
    await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(3600)
    const d = await p.evaluate(() => {
      const R = s => { const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return { top:Math.round(r.top), bottom:Math.round(r.bottom), h:Math.round(r.height) } }
      const app = document.querySelector('.app')
      const wrap = document.querySelector('.wrap.train')
      return {
        innerH: innerHeight, vvH: Math.round((window.visualViewport||{}).height||0),
        docScrollH: document.documentElement.scrollHeight, bodyScrollH: document.body.scrollHeight,
        appScrollH: app.scrollHeight, wrapScrollH: wrap.scrollHeight, wrapH: Math.round(wrap.getBoundingClientRect().height),
        foot: R('.footbar'), strings: R('.strings'), cbar: R('.coach-bar .cb-main'),
        visible: (() => { const r = document.querySelector('.footbar').getBoundingClientRect(); return r.bottom <= innerHeight + 1 })()
      }
    })
    console.log(`【${w}×${h}】`, JSON.stringify(d))
    await p.screenshot({ path: `outputs/desktop-layout/L-${w}x${h}-视口.png` })
    await ctx.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
