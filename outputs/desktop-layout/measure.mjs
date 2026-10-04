import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
  for (const [w,h] of [[1440,900],[1920,1080],[1366,768]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, permissions: ['camera'] })
    const p = await ctx.newPage()
    await p.goto(`http://127.0.0.1:${PORT}/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong`, { waitUntil: 'load' })
    await p.waitForSelector('.coach-bar', { timeout: 20000 }); await p.waitForTimeout(3600)
    const d = await p.evaluate(() => {
      const g = s => { const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)] }
      const wrap = document.querySelector('.wrap.train')
      return { inner: innerHeight, wrapH: Math.round(wrap.getBoundingClientRect().height), scroll: document.documentElement.scrollHeight,
        stageAR: getComputedStyle(document.querySelector('.stage-row')).getPropertyValue('--stage-ar').trim(),
        topbar: g('.topbar'), hud: g('.final-hud'), row: g('.stage-row'), stage: g('.stage'),
        cbar: g('.coach-bar .cb-main'), fb: g('.fb-bar'), strings: g('.strings'), cur: g('.cur'), foot: g('.footbar') }
    })
    console.log(`【${w}×${h}】inner=${d.inner} scroll=${d.scroll} wrap=${d.wrapH} AR=${d.stageAR} ${d.scroll>d.inner?'⚠ 需滚动 '+(d.scroll-d.inner)+'px':'✓ 一屏放下'}`)
    console.log('   topbar', d.topbar, 'hud', d.hud, 'row', d.row, 'stage', d.stage)
    console.log('   cbar', d.cbar, 'strings', d.strings, 'cur', d.cur, 'foot', d.foot)
    await ctx.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
