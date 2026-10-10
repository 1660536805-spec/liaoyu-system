/* 纯新增层的正确回归口径。
 *
 * desktop.css / desktop.js 是**新增文件**，所以「改前」＝当前 app.js/app.css 本身。
 * 于是要证明的是：把桌面层挂上以后，手机档那一棵 #app 子树**一个字符都没变**。
 *
 * 四面证据（全部要求逐字符相同）：
 *   A  470×900  屏蔽桌面层      → #app.outerHTML
 *   B  470×900  带桌面层（惰性） → #app.outerHTML        A ≡ B
 *   C  1440×900 屏蔽桌面层      → #app.outerHTML
 *   D  1440×900 带桌面层后 revert()（拆掉 .dt-col、摘掉侧栏）→ #app.outerHTML   C ≡ D
 *
 * C/D 是关键的一条：它同时证明「分列是可逆的、没有破坏节点顺序」。
 *
 * 用法：node outputs/pm-review/probe-additive.cjs
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body', 'inquiry']
const OUT = path.join(__dirname, 'additive-report.json')

async function snap(browser, { block, w, h, revert }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  if (block) await page.route('**/desktop.*', (r) => r.abort())
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = {}
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 1400 : 500)
    out[s] = await page.evaluate((doRevert) => {
      if (doRevert && window.__xyDesktop) window.__xyDesktop.revert()
      const app = document.getElementById('app')
      return {
        html: app.outerHTML,
        body: document.body.outerHTML,
        side: !!document.querySelector('.dt-side'),
        cols: app.querySelectorAll(':scope main > .dt-col').length,
        cls: document.body.className,
      }
    }, !!revert)
  }
  await ctx.close()
  return { out, errs }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const A = await snap(browser, { block: true, w: 470, h: 900 })
  const B = await snap(browser, { block: false, w: 470, h: 900 })
  const C = await snap(browser, { block: true, w: 1440, h: 900 })
  const D = await snap(browser, { block: false, w: 1440, h: 900, revert: true })
  await browser.close()

  let fail = 0
  const cmp = (name, x, y) => {
    let okAll = true
    const rows = []
    for (const s of SCREENS) {
      const sameHtml = x.out[s].html === y.out[s].html
      const sameBody = x.out[s].body === y.out[s].body
      if (!sameHtml || !sameBody) okAll = false
      rows.push(`  ${sameHtml && sameBody ? '✓' : '✗'} ${s.padEnd(9)} #app ${x.out[s].html.length} vs ${y.out[s].html.length}` +
        `   body ${x.out[s].body.length} vs ${y.out[s].body.length} 字符`)
    }
    console.log(`\n${name}`)
    console.log(rows.join('\n'))
    console.log(`  ${okAll ? '✅ #app 与 body 均逐字符相同' : '❌ 有差异'}`)
    if (!okAll) fail++
    return okAll
  }

  console.log('A 470×900 屏蔽桌面层（=改前）  B 470×900 带桌面层（手机档应完全惰性）')
  console.log('   B 里 .dt-side 注入数：' + SCREENS.filter((s) => B.out[s].side).length + '（应为 0）')
  cmp('【A ≡ B】手机档：挂上桌面层后 #app 逐字符不变', A, B)

  console.log('\nC 1440×900 屏蔽桌面层（=改前）  D 1440×900 带桌面层后 revert()（拆列 + 摘侧栏）')
  console.log('   C 里 .dt-col 数：' + SCREENS.reduce((n, s) => n + C.out[s].cols, 0) + '（应为 0）')
  console.log('   D 里 .dt-side 注入数：' + SCREENS.filter((s) => D.out[s].side).length + '（应为 0）')
  console.log('   D 里 .dt-col 数：' + SCREENS.reduce((n, s) => n + D.out[s].cols, 0) + '（应为 0）')
  cmp('【C ≡ D】桌面档：分列后可逆，拆列/摘栏后 #app 逐字符回到改前', C, D)

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), A, B, C, D }, null, 1), 'utf8')
  console.log('\n→ ' + OUT)
  console.log(fail === 0 ? '\n✅ 纯新增层成立：桌面层挂上/取下，均不改动主壳一条 DOM' : '\n❌ 有 ' + fail + ' 项不通过')
  process.exit(fail ? 1 : 0)
})()
