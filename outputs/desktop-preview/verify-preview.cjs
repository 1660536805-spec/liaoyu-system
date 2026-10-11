/* 桌面端预览台 · 验收脚本
 *
 * 验三件事：
 *   A. 产品侧真值：站点在 1280×900 下桌面档必须「on + 侧栏注入 + 分列」；
 *                  在 940×900 下必须「off + 无侧栏 + 单列」（<960 零介入）。
 *   B. 预览台读数：把预览台放进 1600 宽的页面，它回报的状态必须与 A 一致
 *                  （即预览台的「已生效/已注入/两列」不是装饰，是真读出来的）。
 *   C. 预览台切换宽度：在预览台里把画框切到 960 仍应在效、切到 940 不可选
 *                  （最小预设 960），验证缩放适配不改变画框内的 innerWidth。
 *
 * 用法：PM_PORT=5400 node outputs/desktop-preview/verify-preview.cjs
 */
const pw = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const HARNESS = `${BASE}/outputs/desktop-preview/desktop-preview.html`

const env = { ...process.env }
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete env[k]
env.NO_PROXY = 'localhost,127.0.0.1,::1'
env.no_proxy = 'localhost,127.0.0.1,::1'

let bad = 0
const ok = (c, m) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + m); if (!c) bad++ }

async function stateOf(page) {
  return page.evaluate(() => {
    const f = window.__xyDesktop
    const d = f && f.dbg ? f.dbg() : null
    const main = document.querySelector('#app main')
    return {
      vw: window.innerWidth,
      hasFlag: !!f,
      on: d ? !!d.on : null,
      side: d ? !!d.side : !!document.querySelector('.dt-side'),
      groups: main ? main.querySelectorAll(':scope > .dt-col').length : -1,
      kids: main ? main.children.length : -1,
    }
  })
}

;(async () => {
  const browser = await pw.chromium.launch({ executablePath: CHROME, env })
  const errs = []

  /* ---------- A. 产品侧真值 ---------- */
  console.log('\nA. 站点本身（主壳 + 桌面层）')
  for (const [w, shouldOn] of [[1280, true], [940, false]]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`[${w}] ${m.text()}`) })
    page.on('pageerror', (e) => errs.push(`[${w}] ${e.message}`))
    await page.goto(`${BASE}/?screen=home`, { waitUntil: 'load' })
    await page.waitForTimeout(700)
    const s = await stateOf(page)
    ok(s.vw === w, `${w}px：innerWidth = ${s.vw}`)
    ok(s.on === shouldOn, `${w}px：桌面档 on = ${s.on}（期望 ${shouldOn}）`)
    ok(s.side === shouldOn, `${w}px：侧栏 .dt-side 注入 = ${s.side}（期望 ${shouldOn}）`)
    if (shouldOn) ok(s.groups === 2, `${w}px：首页分列 = ${s.groups} 列（期望 2）`)
    else ok(s.groups === 0, `${w}px：无分列 = ${s.groups} 列（期望 0）`)
    await page.close()
  }

  /* ---------- B. 预览台读数 ---------- */
  console.log('\nB. 预览台在 1600 宽页面里的回报')
  const hp = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  hp.on('console', (m) => { if (m.type() === 'error') errs.push(`[harness] ${m.text()}`) })
  hp.on('pageerror', (e) => errs.push(`[harness] ${e.message}`))
  await hp.goto(HARNESS, { waitUntil: 'load' })
  await hp.waitForTimeout(2200)
  const read = async () => hp.evaluate(() => ({
    vw: document.getElementById('vw').textContent,
    dt: document.getElementById('dtTxt').textContent,
    side: document.getElementById('sideTxt').textContent,
    col: document.getElementById('colTxt').textContent,
    scale: document.getElementById('scale').textContent,
    frame: document.getElementById('frame').getBoundingClientRect().width,
  }))
  const r0 = await read()
  ok(r0.vw === '1280', `默认画框内宽 = ${r0.vw}（期望 1280）`)
  ok(r0.dt === '已生效', `桌面档读数 = ${r0.dt}`)
  ok(r0.side === '已注入', `侧栏读数 = ${r0.side}`)
  ok(r0.col.includes('2'), `两列读数 = ${r0.col}`)
  ok(parseFloat(r0.scale) <= 100, `显示缩放 = ${r0.scale}（≤100%）`)

  /* ---------- C. 预览台切换宽度 ---------- */
  console.log('\nC. 预览台切换宽度（960 应在效）')
  await hp.click('#wset button[data-w="960"]')
  await hp.waitForTimeout(900)
  const r1 = await read()
  ok(r1.vw === '960', `切到 960 后画框内宽 = ${r1.vw}`)
  ok(r1.dt === '已生效', `960 桌面档 = ${r1.dt}（断点边界应仍在效）`)
  const minW = await hp.evaluate(() => Math.min(...Array.from(document.querySelectorAll('#wset button')).map((b) => Number(b.dataset.w))))
  ok(minW === 960, `宽度预设最小值 = ${minW}（不提供 <960，避免误判）`)

  /* ---------- 逐屏在 1280 下都不报错 ---------- */
  console.log('\nD. 逐屏（1280）控制台零报错 + 桌面档')
  for (const sc of ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body', 'inquiry']) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const local = []
    p.on('console', (m) => { if (m.type() === 'error') local.push(m.text()) })
    p.on('pageerror', (e) => local.push(e.message))
    await p.goto(`${BASE}/?screen=${sc}`, { waitUntil: 'load' })
    await p.waitForTimeout(600)
    const s = await stateOf(p)
    ok(s.on === true && local.length === 0, `${sc.padEnd(9)} 桌面档=${s.on} 报错=${local.length}${local.length ? ' :: ' + local[0] : ''}`)
    if (local.length) errs.push(`[${sc}] ${local[0]}`)
    await p.close()
  }

  await hp.close()
  await browser.close()
  console.log('\n控制台错误合计：' + errs.length)
  errs.forEach((e, i) => console.log('   [' + (i + 1) + '] ' + e))
  console.log(bad === 0 ? '\n全部通过 ✅' : `\n失败 ${bad} 项 ❌`)
  process.exit(bad === 0 ? 0 : 1)
})().catch((e) => { console.error('脚本异常：', e); process.exit(2) })
