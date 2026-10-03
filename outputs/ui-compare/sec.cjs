const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:5173'
const PROBE = () => {
  const card = document.querySelector('.card')
  const secH = card.querySelector('.sec-h')
  const knot = card.querySelector('.knot')
  const note = card.querySelector('.sec-note')
  const row = card.querySelector('.organ-row')
  const r = (e) => e ? { w: +e.getBoundingClientRect().width.toFixed(2), h: +e.getBoundingClientRect().height.toFixed(2), top: +e.getBoundingClientRect().top.toFixed(2) } : null
  const cs = (e) => e ? getComputedStyle(e) : null
  return {
    card: r(card), cardPad: cs(card).padding,
    secH: r(secH), secHLine: cs(secH).lineHeight, secHFont: cs(secH).fontSize,
    knot: r(knot), knotDisp: knot ? cs(knot).display : null,
    note: r(note), noteFont: cs(note).fontSize, noteLine: cs(note).lineHeight,
    row: r(row), rowMT: cs(row).marginTop,
  }
}
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true })
  for (const [t, u] of [['MAIN', `${BASE}/?screen=audio`], ['S4', `${BASE}/s4/#/sound`]]) {
    const p = await ctx.newPage(); await p.goto(u, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
    console.log('===== ' + t + ' ====='); console.log(JSON.stringify(await p.evaluate(PROBE), null, 1)); await p.close()
  }
  await b.close()
})()
