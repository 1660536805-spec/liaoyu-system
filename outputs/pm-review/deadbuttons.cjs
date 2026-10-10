/* 统计主壳每屏的「死按钮」（运行时被自动标 data-a="unavailable" 的元素）
 * 用法：node outputs/pm-review/deadbuttons.cjs [port]
 */
const { chromium } = require('playwright-core')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 } })
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  const rows = []
  let totA = 0, totDead = 0
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 2400 : 700)
    const r = await page.evaluate(() => {
      const all = [...document.querySelectorAll('[data-a]')]
      const dead = all.filter((e) => e.getAttribute('data-a') === 'unavailable')
      const uniq = (arr) => [...new Set(arr)]
      return {
        total: all.length,
        dead: dead.length,
        labels: uniq(dead.map((e) => e.dataset.label || e.textContent.trim())).slice(0, 14),
        actions: uniq(all.map((e) => e.getAttribute('data-a'))).filter((a) => a !== 'unavailable'),
      }
    })
    totA += r.total; totDead += r.dead
    rows.push({ s, ...r })
    console.log(`\n[${s}] 可点元素 ${r.total} · 死按钮 ${r.dead}`)
    if (r.dead) console.log('   死按钮文案：' + r.labels.join(' / '))
    console.log('   真动作：' + r.actions.join(', '))
  }
  console.log(`\n==== 合计：可点元素 ${totA}，其中死按钮 ${totDead} (${Math.round(totDead / totA * 100)}%) ====`)
  await browser.close()
})()
