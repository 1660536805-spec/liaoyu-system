/**
 * 精确探测：主壳 vs s4 音疗页的关键盒模型差异
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const PROBE = () => {
  const out = {}
  const rect = (el) => (el ? { w: +el.getBoundingClientRect().width.toFixed(1), h: +el.getBoundingClientRect().height.toFixed(1) } : null)

  // 第一个快捷按钮
  const btns = [...document.querySelectorAll('.btn')]
  const b0 = btns[0]
  if (b0) {
    const cs = getComputedStyle(b0)
    const svg = b0.querySelector('svg')
    // 文本节点用 Range 取矩形
    let textRects = []
    const walker = document.createTreeWalker(b0, NodeFilter.SHOW_TEXT)
    const tn = walker.nextNode()
    if (tn && tn.textContent.trim()) {
      const r = document.createRange()
      r.selectNodeContents(tn)
      textRects = [...r.getClientRects()].map((x) => ({ w: +x.width.toFixed(1), h: +x.height.toFixed(1) }))
    }
    out.btn0 = {
      w: +b0.getBoundingClientRect().width.toFixed(1),
      h: +b0.getBoundingClientRect().height.toFixed(1),
      cssW: cs.width, minH: cs.minHeight, pad: cs.padding,
      fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, gap: cs.gap,
      fontFamily: cs.fontFamily.slice(0, 40),
      svgW: svg ? +svg.getBoundingClientRect().width.toFixed(1) : null,
      svgH: svg ? +svg.getBoundingClientRect().height.toFixed(1) : null,
      textRects,
      textLines: textRects.length,
      // 文本自然宽度（不换行时）
      scrollW: b0.scrollWidth,
    }
  }

  const organ = document.querySelector('.organ')
  const card = document.querySelector('.ls-sec-organ, .card')
  out.organ = rect(organ)
  out.organCss = organ ? { pad: getComputedStyle(organ).padding, fontSize: getComputedStyle(organ).fontSize } : null
  out.card = rect(card)

  const h = document.querySelector('.ls-h') || [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === '今天想照顾哪里？')
  out.heading = rect(h)
  out.headingCss = h ? { fs: getComputedStyle(h).fontSize, mt: getComputedStyle(h).marginTop, mb: getComputedStyle(h).marginBottom } : null

  const lead = document.querySelector('.ls-lead') || document.querySelector('.sc > p')
  out.lead = rect(lead)
  out.leadCss = lead ? { fs: getComputedStyle(lead).fontSize, mt: getComputedStyle(lead).marginTop, mb: getComputedStyle(lead).marginBottom } : null

  out.htmlFont = getComputedStyle(document.documentElement).fontSize
  out.rootPad = getComputedStyle(document.querySelector('.sc') || document.body).padding
  return out
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  for (const [tag, url] of [['MAIN', `${BASE}/?screen=audio`], ['S4', `${BASE}/s4/#/sound`]]) {
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const r = await page.evaluate(PROBE)
    console.log('===== ' + tag + ' =====')
    console.log(JSON.stringify(r, null, 2))
    await page.close()
  }
  await browser.close()
})()
