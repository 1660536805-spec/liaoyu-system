/**
 * 验收：s4 只保留跟练页 + 所有出口回主壳
 * 用法：NODE_PATH=<ws>/node_modules node verify-one-page.cjs <baseUrl>
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = (process.argv[2] || 'http://127.0.0.1:5320').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out', 'current')

;(async () => {
  const b = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  })
  const ctx = await b.newContext({
    viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['camera'],
  })
  const R = {}

  const isShell = (p) => p.evaluate(() => !!document.querySelector('.sc'))
  const head = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 70))

  // 1) 直接访问 s4 的非跟练路径 → 应弹回主壳
  for (const [key, url] of [['s4Root', '/s4/'], ['s4Hash', '/s4/#/'], ['s4Sound', '/s4/#/sound'], ['s4Me', '/s4/#/me']]) {
    const p = await ctx.newPage()
    await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
    await p.waitForTimeout(1200)
    R[key] = { finalUrl: p.url(), shell: await isShell(p), head: await head(p) }
    await p.close()
  }

  // 2) 直接访问跟练页 → 应留在 s4 且渲染识别页
  {
    const p = await ctx.newPage()
    await p.goto(BASE + '/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong', { waitUntil: 'domcontentloaded', timeout: 25000 })
    await p.waitForTimeout(9000)
    R.s4TrainDirect = { finalUrl: p.url(), shell: await isShell(p), head: await head(p), hasVideo: await p.evaluate(() => !!document.querySelector('video')) }
    await p.screenshot({ path: path.join(OUT, 'onepage-train.png') })
    // 2a) 点「退出」→ 应回主壳
    const quitBtn = p.locator('button', { hasText: '退出' }).first()
    if (await quitBtn.count()) { await quitBtn.click(); await p.waitForTimeout(1800) }
    R.afterQuit = { finalUrl: p.url(), shell: await isShell(p) }
    await p.close()
  }

  // 3) 进入页 →「开始动作预览」→ 应到 /s4/#/train
  {
    const p = await ctx.newPage()
    await p.goto(BASE + '/?screen=intro', { waitUntil: 'networkidle' })
    await p.waitForTimeout(600)
    await p.click('[data-a="start-practice"]')
    await p.waitForTimeout(2500)
    R.shellStartPractice = { finalUrl: p.url() }
    await p.close()
  }

  // 4) 进入页 →「示例」→ 应留在主壳的静态跟练页
  {
    const p = await ctx.newPage()
    await p.goto(BASE + '/?screen=intro', { waitUntil: 'networkidle' })
    await p.waitForTimeout(600)
    await p.click('[data-a="demo"]')
    await p.waitForTimeout(1200)
    R.shellDemo = { finalUrl: p.url(), shell: await isShell(p), head: await head(p) }
    await p.close()
  }

  // 5) 跟练页 →「动作示范」→ 应回主壳
  {
    const p = await ctx.newPage()
    await p.goto(BASE + '/s4/#/train?style=baduanjin&tone=gong', { waitUntil: 'domcontentloaded', timeout: 25000 })
    await p.waitForTimeout(6000)
    const btn = p.locator('button', { hasText: '动作示范' }).first()
    if (await btn.count()) { await btn.click(); await p.waitForTimeout(1800) }
    R.afterGuide = { finalUrl: p.url(), shell: await isShell(p) }
    await p.close()
  }

  fs.writeFileSync(path.join(OUT, 'onepage-report.json'), JSON.stringify(R, null, 2))
  console.log(JSON.stringify(R, null, 2))
  await b.close()
})()
