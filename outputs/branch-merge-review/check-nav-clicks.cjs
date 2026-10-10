/* 行为：4 项导航的点击是否都能切到对应屏（重点：首页按钮此前只在音疗页存在）。
 * 注意：主壳 go() 只改内部 state、不改 URL ⇒ 用「哪个导航项高亮(.on)」判定当前屏。
 * 用法：node outputs/branch-merge-review/check-nav-clicks.cjs
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:' + (Number(process.env.PM_PORT) || 5400)
const KEYS = ['nav-home', 'nav-audio', 'nav-profile']
const WANT = { 'nav-home': '首页', 'nav-audio': '音疗', 'nav-profile': '我的' }

async function activeTab(p) {
  return p.evaluate(() => {
    const on = document.querySelector('.nav .nitem.on')
    return on ? (on.textContent || '').replace(/\s+/g, '').replace(/开始练/, '').trim() : '(无高亮)'
  })
}

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  let fail = 0
  for (const from of ['?screen=home', '?screen=audio', '?screen=profile']) {
    for (const key of KEYS) {
      await p.goto(BASE + '/' + from, { waitUntil: 'load' }); await p.waitForTimeout(450)
      const btn = p.locator(`[data-a="${key}"]`)
      if (!(await btn.count())) { console.log(`  ✗ ${from} 上没有 ${key}`); fail++; continue }
      await btn.click(); await p.waitForTimeout(450)
      const tab = await activeTab(p)
      const ok = tab === WANT[key]
      console.log(`  ${ok ? '✓' : '✗'} ${from.padEnd(16)} 点 ${key.padEnd(12)} → 高亮「${tab}」（期望「${WANT[key]}」）`)
      if (!ok) fail++
    }
  }
  console.log(`\n报错 ${errs.length} 条` + (errs.length ? ' -> ' + errs.join(' | ') : '') + `；失败 ${fail}`)
  await b.close()
  process.exit(fail === 0 && errs.length === 0 ? 0 : 1)
})()
