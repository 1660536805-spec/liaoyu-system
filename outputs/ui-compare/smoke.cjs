/**
 * s4 冒烟：确认音疗页用 4-Tab(.nav-ref)，其余页面仍用 s4 原生 3-Tab(.app-tab)，且无报错。
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const routes = ['#/', '#/sound', '#/sound/library', '#/me', '#/prepare', '#/guide']

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  for (const r of routes) {
    const p = await ctx.newPage()
    const errors = []
    const bad = []
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) })
    p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 120)))
    p.on('response', (res) => { if (res.status() >= 400) bad.push(res.status() + ' ' + res.url().replace(BASE, '')) })
    await p.goto(BASE + '/s4/' + r, { waitUntil: 'networkidle' })
    await p.waitForTimeout(700)
    const info = await p.evaluate(() => ({
      ref: !!document.querySelector('nav.nav-ref'),
      refItems: [...document.querySelectorAll('nav.nav-ref .nitem')].map((n) => n.textContent.trim()),
      old: !!document.querySelector('nav.app-tab'),
      oldItems: [...document.querySelectorAll('nav.app-tab .tab')].map((n) => n.textContent.trim()),
      path: location.hash,
    }))
    console.log(`${r.padEnd(18)} ref=${info.ref ? info.refItems.join('/') : '-'}  old=${info.old ? info.oldItems.join('/') : '-'}  err=${errors.length} bad=${bad.length}`)
    if (errors.length) console.log('   ERR:', errors)
    if (bad.length) console.log('   4xx:', bad)
    await p.close()
  }
  await browser.close()
})()
