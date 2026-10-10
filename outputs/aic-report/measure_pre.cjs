// 通用横向溢出检测：找出实际渲染中内容宽度超出自身盒宽的元素
// 用法: node outputs/aic-report/measure_pre.cjs <html>
const path = require('path')
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright-core'))
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function main() {
  const inHtml = process.argv[2]
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  // 与打印一致的排版宽度：A4 21cm - 左右各 3cm = 15cm ≈ 566.9px @96dpi
  const page = await browser.newPage({ viewport: { width: 567, height: 900 } })
  await page.emulateMedia({ media: 'print' })
  await page.goto('file://' + path.resolve(inHtml), { waitUntil: 'networkidle' })

  const out = await page.evaluate(() => {
    const over = []
    // ① 元素级横向溢出（长串不可断行 token）
    document.querySelectorAll('body *').forEach((el) => {
      if (['SCRIPT', 'STYLE', 'HTML', 'BODY'].includes(el.tagName)) return
      const d = el.scrollWidth - el.clientWidth
      if (el.clientWidth > 0 && d > 1) {
        over.push({ kind: 'box', tag: el.tagName, cls: el.className || '',
                    d, txt: (el.textContent || '').trim().slice(0, 70) })
      }
    })
    // ② pre.flow 逐行宽度
    const pre = []
    document.querySelectorAll('pre.flow').forEach((p, bi) => {
      const cs = getComputedStyle(p)
      const avail = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const cv = document.createElement('canvas').getContext('2d')
      cv.font = cs.fontSize + ' ' + cs.fontFamily
      p.textContent.split('\n').forEach((ln, li) => {
        const w = cv.measureText(ln).width
        if (w > avail) pre.push({ bi, li: li + 1, w: Math.round(w), avail: Math.round(avail), ln })
      })
    })
    // ③ 需要避免断行的行内代码 / 等宽段落：逐字符测宽
    const mono = []
    document.querySelectorAll('p.mono, .mono').forEach((p) => {
      const cs = getComputedStyle(p)
      const avail = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      if (avail <= 0) return
      const cv = document.createElement('canvas').getContext('2d')
      cv.font = cs.fontSize + ' ' + cs.fontFamily
      const t = p.textContent
      const w = cv.measureText(t).width
      if (w > avail) mono.push({ w: Math.round(w), avail: Math.round(avail), t: t.slice(0, 80) })
    })
    return { over, pre, mono }
  })

  console.log('=== ① 元素横向溢出 ===', out.over.length)
  out.over.forEach(o => console.log(`  <${o.tag} class="${o.cls}"> 超 ${o.d}px | ${o.txt}`))
  console.log('=== ② pre.flow 折行 ===', out.pre.length)
  out.pre.forEach(o => console.log(`  pre#${o.bi} L${o.li} w=${o.w}/${o.avail} | ${o.ln}`))
  console.log('=== ③ .mono 单行过长 ===', out.mono.length)
  out.mono.forEach(o => console.log(`  w=${o.w}/${o.avail} | ${o.t}`))
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
