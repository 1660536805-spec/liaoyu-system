/**
 * 底部导航专项比对：主壳 .nav（图二基准） vs s4 .nav-ref（本次还原）
 * 提取文本、几何、计算样式，并单独截取导航区域放大对比。
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const OUT = path.join(__dirname, 'out')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const W = 470
const H = 900
fs.mkdirSync(OUT, { recursive: true })

const probeNav = (sel) => {
  const nav = document.querySelector(sel)
  if (!nav) return { found: false }
  const r = (el) => {
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }
  const cs = getComputedStyle(nav)
  const items = [...nav.querySelectorAll('.nitem, .tab')].map((it) => {
    const s = getComputedStyle(it)
    const svg = it.querySelector('svg')
    const big = it.querySelector('.big')
    return {
      text: it.textContent.trim(),
      box: r(it),
      color: s.color,
      fontSize: s.fontSize,
      gap: s.gap,
      lineHeight: s.lineHeight,
      fontFamily: s.fontFamily.split(',')[0],
      svgW: svg ? Math.round(svg.getBoundingClientRect().width) : null,
      svgH: svg ? Math.round(svg.getBoundingClientRect().height) : null,
      big: big ? r(big) : null,
      bigBg: big ? getComputedStyle(big).backgroundImage.slice(0, 40) : null,
      bigColor: big ? getComputedStyle(big).color : null,
    }
  })
  return {
    found: true,
    box: r(nav),
    bg: cs.backgroundColor,
    borderTop: cs.borderTopColor + ' ' + cs.borderTopWidth,
    pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
    align: cs.alignItems,
    justify: cs.justifyContent,
    count: items.length,
    items,
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })

  async function run(url, sel, tag) {
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const info = await page.evaluate(probeNav, sel)
    // 截取底部导航区域
    const navBox = info.found ? info.box : null
    if (navBox) {
      await page.screenshot({
        path: path.join(OUT, `${tag}-nav.png`),
        clip: { x: 0, y: Math.max(0, navBox.y - 30), width: W, height: Math.min(H - Math.max(0, navBox.y - 30), navBox.h + 30) },
      })
    }
    await page.close()
    return { info, errors }
  }

  const m = await run(BASE + '/?screen=audio', 'nav.nav', 'main')
  const s = await run(BASE + '/s4/#/sound', 'nav.nav-ref', 's4')

  const show = (t, o) => {
    console.log(`\n===== ${t} =====`)
    if (!o.found) { console.log('  NOT FOUND'); return }
    console.log(`  box ${JSON.stringify(o.box)} pad="${o.pad}" align=${o.align} justify=${o.justify}`)
    console.log(`  bg=${o.bg} borderTop=${o.borderTop} tabs=${o.count}`)
    o.items.forEach((it, i) => {
      console.log(`  [${i}] "${it.text}" ${JSON.stringify(it.box)} color=${it.color} fs=${it.fontSize} gap=${it.gap} lh=${it.lineHeight} ff=${it.fontFamily} svg=${it.svgW}x${it.svgH}`)
      if (it.big) console.log(`       big ${JSON.stringify(it.big)} bg="${it.bigBg}" color=${it.bigColor}`)
    })
  }
  show('MAIN .nav', m.info)
  show('S4 .nav-ref', s.info)
  console.log('\nMAIN errors:', m.errors)
  console.log('S4 errors:', s.errors)

  await browser.close()
})()
