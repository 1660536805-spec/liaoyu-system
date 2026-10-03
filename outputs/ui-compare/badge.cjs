/**
 * 「已选预览」角标专项：主壳 vs s4 —— 计算样式 + 放大并排截图。
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const OUT = path.join(__dirname, 'out')

const probe = (sel) => {
  const el = document.querySelector(sel)
  if (!el) return { found: false }
  const s = getComputedStyle(el)
  const b = el.getBoundingClientRect()
  // 用 Range 量纯文本盒，排除 margin
  const r = document.createRange(); r.selectNodeContents(el)
  const rb = r.getBoundingClientRect()
  const tt = el.parentElement
  const ts = getComputedStyle(tt)
  const tb = tt.getBoundingClientRect()
  return {
    found: true,
    note: { x: +b.x.toFixed(3), y: +b.y.toFixed(3), w: +b.width.toFixed(3), h: +b.height.toFixed(3) },
    text: { x: +rb.x.toFixed(3), y: +rb.y.toFixed(3), w: +rb.width.toFixed(3), h: +rb.height.toFixed(3) },
    cs: {
      fontSize: s.fontSize, fontWeight: s.fontWeight, fontFamily: s.fontFamily, letterSpacing: s.letterSpacing,
      color: s.color, marginLeft: s.marginLeft, smooth: s.webkitFontSmoothing, textRendering: s.textRendering,
      wordSpacing: s.wordSpacing, fontVariant: s.fontVariantLigatures, lineHeight: s.lineHeight,
    },
    tt: { x: +tb.x.toFixed(3), y: +tb.y.toFixed(3), w: +tb.width.toFixed(3), h: +tb.height.toFixed(3), fontSize: ts.fontSize, fontWeight: ts.fontWeight, ff: ts.fontFamily, smooth: ts.webkitFontSmoothing },
    ttHtml: tt.innerHTML,
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const shots = {}
  for (const [tag, url, sel] of [['main', BASE + '/?screen=audio', '.track .note'], ['s4', BASE + '/s4/#/sound', '.ls .track .note']]) {
    const p = await ctx.newPage()
    await p.goto(url, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    const r = await p.evaluate(probe, sel)
    console.log(`\n===== ${tag} =====`)
    console.log('  note box:', JSON.stringify(r.note), ' text box:', JSON.stringify(r.text))
    console.log('  cs:', JSON.stringify(r.cs))
    console.log('  tt:', JSON.stringify(r.tt))
    console.log('  ttHtml:', JSON.stringify(r.ttHtml))
    // 放大截取角标周边
    const clip = { x: 140, y: r.tt.y - 6, width: 110, height: 26 }
    const buf = await p.screenshot({ clip })
    shots[tag] = buf.toString('base64')
    await p.close()
  }
  // 并排合成（放大 3x）
  const html = `<body style="margin:0;background:#fff;display:flex;flex-direction:column;gap:6px">
    ${['main', 's4'].map((t) => `<div style="display:flex;align-items:center;gap:8px"><b style="font:11px monospace;width:40px">${t}</b><img src="data:image/png;base64,${shots[t]}" style="width:330px;image-rendering:pixelated"></div>`).join('')}
  </body>`
  const p2 = await ctx.newPage()
  await p2.setContent(html)
  await p2.waitForTimeout(300)
  const el = await p2.$('body')
  fs.writeFileSync(path.join(OUT, 'badge-zoom.png'), await el.screenshot())
  console.log('\n放大对比图:', path.join(OUT, 'badge-zoom.png'))
  await browser.close()
})()
