/**
 * 深挖「开始练」项 4px 差异：逐子节点测量盒 + 计算样式。
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const probe = (sel) => {
  const nav = document.querySelector(sel)
  if (!nav) return { found: false }
  const btns = [...nav.querySelectorAll('.nitem')]
  const target = btns[btns.length - 2] // 「开始练」= 倒数第二个
  const node = (n) => {
    if (n.nodeType === 3) {
      const r = document.createRange(); r.selectNodeContents(n)
      const b = r.getBoundingClientRect()
      return { type: 'text', text: JSON.stringify(n.textContent), y: +b.y.toFixed(2), h: +b.height.toFixed(2), w: +b.width.toFixed(2) }
    }
    const b = n.getBoundingClientRect()
    const s = getComputedStyle(n)
    return {
      type: 'el', cls: n.className || n.tagName, y: +b.y.toFixed(2), h: +b.height.toFixed(2), w: +b.width.toFixed(2),
      display: s.display, mt: s.marginTop, mb: s.marginBottom, lh: s.lineHeight, fs: s.fontSize, ff: s.fontFamily.split(',')[0], vAlign: s.verticalAlign,
    }
  }
  const cs = getComputedStyle(target)
  return {
    found: true,
    btn: { y: +target.getBoundingClientRect().y.toFixed(2), h: +target.getBoundingClientRect().height.toFixed(2), lh: cs.lineHeight, fs: cs.fontSize, ff: cs.fontFamily.split(',')[0], align: cs.alignItems, gap: cs.gap, display: cs.display, lineHeightNormal: cs.lineHeight },
    btnBox: { pad: cs.padding, border: cs.borderWidth, minH: cs.minHeight, height: cs.height, box: cs.boxSizing, alignContent: cs.alignContent, margin: cs.margin, flex: cs.flex, justifyContent: cs.justifyContent, lineHeight: cs.lineHeight },
    children: [...target.childNodes].map(node),
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  for (const [tag, url, sel] of [['MAIN', BASE + '/?screen=audio', 'nav.nav'], ['S4', BASE + '/s4/#/sound', 'nav.nav-ref']]) {
    const p = await ctx.newPage()
    await p.goto(url, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    const r = await p.evaluate(probe, sel)
    console.log(`\n===== ${tag} =====`)
    console.log('  btn:', JSON.stringify(r.btn))
    console.log('  btnBox:', JSON.stringify(r.btnBox))
    r.children.forEach((c, i) => console.log(`   child[${i}]`, JSON.stringify(c)))
    await p.close()
  }
  await browser.close()
})()
