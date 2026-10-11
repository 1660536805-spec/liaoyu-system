/* 端到端：主壳首页模式条点「五禽戏 / 太极拳」→ 开始练 → 练习准备页 → 开始动作预览 → s4 真跟练页。
   断言这条链路真的走通、且 s4 侧认到了同一个拳种（读 s4 的 .hud-name，即当前式名）。
   只读（除浏览器截图外不写仓库）。 */
const { chromium } = require('playwright-core')
const fs = require('fs'); const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5400'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, '..', 'outputs', 'style-shell')
fs.mkdirSync(OUT, { recursive: true })

const CASES = [
  { style: 'baduanjin', idx: 0, name: '八段锦', full: 8, first: '双手托天理三焦' },
  { style: 'wuqinxi', idx: 1, name: '五禽戏', full: 10, first: '虎举' },
  { style: 'taiji', idx: 2, name: '太极拳', full: 24, first: '起势' },
]
let fails = 0
function chk(n, ok, d) { if (!ok) { fails++; console.log('  ✗', n, d === undefined ? '' : JSON.stringify(d)) } else console.log('  ✓', n, d === undefined ? '' : JSON.stringify(d)) }

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  for (const c of CASES) {
    console.log('\n=== ' + c.style + ' ===')
    const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
    const errs = []
    ctx.on('page', (pg) => pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) }))
    const p = await ctx.newPage()

    await p.goto(BASE + '/?screen=home', { waitUntil: 'networkidle' })
    /* ① 首页模式条点选拳种 */
    await p.click('.mseg[data-i="' + c.idx + '"]')
    await p.waitForTimeout(120)
    const sel = await p.evaluate(() => ({
      on: Array.from(document.querySelectorAll('.modebar .mseg')).findIndex((s) => s.classList.contains('on')),
      canvas: document.querySelector('[data-screen]').dataset.screen,
    }))
    chk('首页点选 → 高亮第 ' + c.idx + ' 段', sel.on === c.idx, sel)

    /* ② 开始练 → 练习准备页 */
    await p.click('[data-a="go-intro"]')
    await p.waitForSelector('.mode-grid')
    const intro = await p.evaluate(() => ({
      screen: document.querySelector('[data-screen]').dataset.screen,
      tt: document.querySelector('.modecard .tt').textContent.replace(/\s+/g, ' ').trim(),
      cards: document.querySelectorAll('.modecard').length,
      mode: window.__xy.state.mode,
    }))
    chk('进入练习准备页', intro.screen === 'intro', intro.screen)
    chk('准备页全套=' + c.full, intro.tt.includes('全套 ' + c.full + ' 式'), intro.tt)
    chk('准备页拳种 mode=' + c.idx, intro.mode === c.idx, intro.mode)
    const si = path.join(OUT, 'e2e-intro-' + c.style + '.png')
    await p.screenshot({ path: si, fullPage: true })

    /* ③ 开始动作预览 → 真的跳到 s4 真跟练页 */
    await Promise.all([
      p.waitForURL(/\/s4\/#\/train/, { timeout: 15000 }),
      p.click('[data-a="start-practice"]'),
    ])
    const navUrl = p.url()
    chk('跳转 URL 带 style=' + c.style, navUrl.includes('style=' + c.style), navUrl.replace(BASE, ''))
    chk('跳转 URL 带 mode=full', navUrl.includes('mode=full'), navUrl.replace(BASE, ''))
    await p.waitForSelector('.hud-name', { timeout: 20000 })
    await p.waitForTimeout(1200)
    const s4 = await p.evaluate(() => ({
      hud: (document.querySelector('.hud-name') || {}).textContent,
      hasFb: !!document.querySelector('video'),
    }))
    chk('s4 当前式 = ' + c.first, (s4.hud || '').trim() === c.first, s4.hud)
    const sp = path.join(OUT, 'e2e-s4-' + c.style + '.png')
    await p.screenshot({ path: sp })
    console.log('   console errors:', errs.length, errs.slice(0, 3))
    await ctx.close()
  }
  await b.close()
  console.log('\n==> fails=' + fails)
  process.exit(fails ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
