/* 只读探针 v2：模拟「modebar 4 段」的几种微缩方案，量是否横向溢出（470px 手机档）。
   不写 dist，只输出 JSON。 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5400'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const VARIANTS = {
  '现样(4段·不改CSS)': '',
  'A1: 仅缩图标2.6rem+gap.45': '.modebar .mseg{gap:.45rem}.modebar .mseg .ic{width:2.6rem;height:2.6rem}',
  'A2: A1+缩字(b1.3/span.84)+收内边距': '.modebar .mseg{gap:.4rem;padding:1rem .3rem}.modebar .mseg .ic{width:2.6rem;height:2.6rem}.modebar .mseg b{font-size:1.3rem}.modebar .mseg span{font-size:.84rem}',
  'A3: A2+去副标题': '.modebar .mseg{gap:.4rem;padding:1rem .3rem}.modebar .mseg .ic{width:2.6rem;height:2.6rem}.modebar .mseg b{font-size:1.34rem}.modebar .mseg .tx span{display:none}',
  'B: 2x2 两行': '.modebar{flex-wrap:wrap;gap:.6rem}.modebar .mseg{flex:1 1 calc(50% - .6rem);min-width:0}',
}

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const res = {}
  for (const vp of [{ w: 470, h: 900 }, { w: 941, h: 1672 }]) {
    const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } })
    await p.goto(BASE + '/?screen=home', { waitUntil: 'networkidle' })
    await p.waitForSelector('.modebar .mseg')
    res['vp' + vp.w] = {}
    for (const [name, css] of Object.entries(VARIANTS)) {
      const r = await p.evaluate((css) => {
        const bar = document.querySelector('.modebar')
        // 干净重置：移除上次注入的 style 与克隆
        document.querySelectorAll('style[data-probe]').forEach((s) => s.remove())
        bar.querySelectorAll('.mseg[data-i="9"]').forEach((c) => c.remove())
        const segs = Array.from(bar.querySelectorAll('.mseg'))
        // 克隆出第 4 段：太极拳
        const clone = segs[1].cloneNode(true)
        clone.querySelector('b').textContent = '太极拳'
        clone.querySelector('.tx span').textContent = '圆活·调息养神'
        clone.classList.remove('on')
        const ck = clone.querySelector('.ckc'); if (ck) ck.remove()
        clone.dataset.i = '9'; clone.dataset.a = 'mode'
        segs[2].parentNode.insertBefore(clone, segs[2])
        if (css) { const st = document.createElement('style'); st.setAttribute('data-probe', '1'); st.textContent = css; document.head.appendChild(st) }
        const barBox = bar.getBoundingClientRect()
        const cs = getComputedStyle(bar)
        const avail = barBox.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        const four = Array.from(bar.querySelectorAll('.mseg'))
        const ws = four.map((s) => +s.getBoundingClientRect().width.toFixed(1))
        const rows = new Set(four.map((s) => Math.round(s.getBoundingClientRect().top))).size
        const out = {
          avail: +avail.toFixed(1),
          widths: ws,
          sum: +ws.reduce((a, x) => a + x, 0).toFixed(1),
          barScrollW: bar.scrollWidth,
          barClientW: bar.clientWidth,
          overflowX: bar.scrollWidth > bar.clientWidth + 1,
          rows,
          height: +barBox.height.toFixed(1),
        }
        document.querySelectorAll('style[data-probe]').forEach((s) => s.remove())
        bar.querySelectorAll('.mseg[data-i="9"]').forEach((c) => c.remove())
        return out
      }, css)
      res['vp' + vp.w][name] = r
    }
    await p.close()
  }
  await b.close()
  console.log(JSON.stringify(res, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })
