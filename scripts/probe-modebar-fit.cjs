/* 只读探针：量首页 .modebar 现有 3 段尺寸，并模拟加第 4 段（太极拳）看是否溢出。
   不写任何产物到 dist，只输出 JSON 到 stdout。 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5400'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const out = {}
  for (const vp of [{ w: 470, h: 900, tag: 'mobile' }, { w: 1280, h: 900, tag: 'desktop' }]) {
    const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } })
    await p.goto(BASE + '/?screen=home', { waitUntil: 'networkidle' })
    await p.waitForSelector('.modebar .mseg')
    out[vp.tag] = await p.evaluate(() => {
      const bar = document.querySelector('.modebar')
      const segs = Array.from(bar.querySelectorAll('.mseg'))
      const barBox = bar.getBoundingClientRect()
      const cs = getComputedStyle(bar)
      const info = segs.map((s) => {
        const r = s.getBoundingClientRect()
        const tx = s.querySelector('.tx')
        const sp = s.querySelector('.tx span')
        return {
          text: s.textContent.trim().replace(/\s+/g, ' '),
          w: +r.width.toFixed(1),
          scrollW: s.scrollWidth,
          overflow: s.scrollWidth > Math.ceil(r.width) + 1,
          txW: tx ? +tx.getBoundingClientRect().width.toFixed(1) : null,
          spanScrollW: sp ? sp.scrollWidth : null,
          spanW: sp ? +sp.getBoundingClientRect().width.toFixed(1) : null,
          txt: sp ? sp.textContent : null,
        }
      })
      // 模拟 4 段
      const clone = segs[1].cloneNode(true)
      clone.querySelector('b').textContent = '太极拳'
      clone.querySelector('.tx span').textContent = '连绵·内外兼修'
      clone.dataset.i = '3'
      clone.dataset.a = 'mode'
      segs[2].parentNode.insertBefore(clone, segs[2])
      const segs4 = Array.from(bar.querySelectorAll('.mseg'))
      const info4 = segs4.map((s) => {
        const r = s.getBoundingClientRect()
        const sp = s.querySelector('.tx span')
        return { w: +r.width.toFixed(1), scrollW: s.scrollWidth, overflow: s.scrollWidth > Math.ceil(r.width) + 1, spanScrollW: sp ? sp.scrollWidth : null, spanW: sp ? +sp.getBoundingClientRect().width.toFixed(1) : null }
      })
      clone.parentNode.removeChild(clone)
      return {
        barW: +barBox.width.toFixed(1),
        barScrollW: bar.scrollWidth,
        barPad: cs.padding,
        contentAvail: +(barBox.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)).toFixed(1),
        segCount: segs.length,
        segs: info,
        sumWidth3: +info.reduce((a, x) => a + x.w, 0).toFixed(1),
        sim4: info4,
        sumWidth4: +info4.reduce((a, x) => a + x.w, 0).toFixed(1),
      }
    })
    await p.close()
  }
  await b.close()
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })
