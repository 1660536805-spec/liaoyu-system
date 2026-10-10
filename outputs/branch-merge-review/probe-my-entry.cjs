/* 行为验收：主壳「我的」页的新入口是否真的能跳到 s4 新页面。
 *  1) 打开 /?screen=profile，截图存档
 *  2) 确认 [data-a="go-lab"] 存在、文案正确、位于「基础设置」之上
 *  3) 点击它 → 断言最终 URL 落到 s4 的 /preview
 *  4) 顺带探一遍 4 个 s4 新页面在真站(5400)是否 200 可达
 * 用法：node outputs/branch-merge-review/probe-my-entry.cjs
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, '我的页-新入口-截图.png')

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  // 1) 我的页
  await page.goto(BASE + '/?screen=profile', { waitUntil: 'load' })
  await page.waitForTimeout(800)
  const row = page.locator('[data-a="go-lab"]')
  const cnt = await row.count()
  console.log('① go-lab 元素数量：' + cnt)
  if (cnt !== 1) { console.log('❌ 期望恰好 1 个'); process.exit(1) }
  const label = await row.getAttribute('data-label')
  const text = (await row.innerText()).replace(/\s+/g, ' ').trim()
  console.log('   文案：' + text + '   data-label=' + label)

  // 2) 位置：应在「基础设置」之上
  const idxLab = await page.evaluate(() => [...document.querySelectorAll('.setrow')].findIndex((e) => e.dataset.a === 'go-lab'))
  const idxBasic = await page.evaluate(() => [...document.querySelectorAll('.setrow')].findIndex((e) => e.dataset.a === 'set-basic'))
  console.log('   顺序：go-lab 第 ' + idxLab + ' 条 / set-basic 第 ' + idxBasic + ' 条  → ' + (idxLab < idxBasic ? '✓ 在基础设置之上' : '✗ 顺序异常'))

  await page.screenshot({ path: OUT, fullPage: true })
  console.log('② 截图：' + OUT)

  // 3) 点击 → 是否进 s4 /preview
  await row.click()
  await page.waitForTimeout(1500)
  const url = page.url()
  const ok = /\/s4\/#\/preview/.test(url)
  console.log('③ 点击后 URL：' + url + '  → ' + (ok ? '✓ 落到 s4/#/preview' : '✗ 未落到预期'))
  if (!ok) errs.push('click did not land on s4/#/preview')

  // 4) 4 个 s4 新页面可达性
  console.log('④ s4 新页面可达性：')
  for (const p of ['/s4/#/preview', '/s4/#/culture', '/s4/#/prot', '/s4/#/onboarding-v2']) {
    await page.goto(BASE + p, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    const head = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 40)
    const stayed = page.url().indexOf('/s4/') >= 0
    console.log('   ' + p.padEnd(24) + (stayed ? '✓ 停留' : '✗ 被弹回') + '   首屏: ' + head)
  }

  console.log('\n控制台报错：' + errs.length + ' 条' + (errs.length ? '  → ' + errs.join(' | ') : ''))
  await browser.close()
  process.exit(errs.length === 0 && ok && idxLab === 0 ? 0 : 1)
})()
