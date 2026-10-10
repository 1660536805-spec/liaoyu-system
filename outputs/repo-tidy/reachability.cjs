/* 记录「产品应用」真实运行时请求的资源 —— 用来判断 dist/ 下哪些大目录是必需的。
 * 覆盖两条链路：(1) 主壳 /；(2) 从主壳点进 s4 跟练页（假摄像头，让 MediaPipe 真的加载）。
 * 用法：NODE_PATH=<ws>/node_modules node outputs/repo-tidy/reachability.cjs [port]
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5477
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(__dirname, 'requests.json')

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const ctx = await browser.newContext({ viewport: { width: 470, height: 900 } })
  const page = await ctx.newPage()
  const reqs = []
  const errs = []
  page.on('request', (r) => reqs.push(new URL(r.url()).pathname))
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const mark = (label) => reqs.push('__MARK__:' + label)

  // 1) 主壳：直接落到 intro 屏（有「开始动作预览」按钮）
  try {
    await page.goto(`${BASE}/?screen=intro`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(2500)
    mark('主壳 intro 屏')
  } catch (e) { errs.push('intro: ' + e.message) }

  // 2) 点「开始动作预览」→ 进 s4 跟练页
  let wentS4 = false
  try {
    const btn = page.locator('button[data-a="start-practice"]').first()
    if (await btn.count()) {
      await btn.click({ timeout: 8000 })
      await page.waitForURL(/\/s4\//, { timeout: 20000 })
      wentS4 = true
      await page.waitForTimeout(8000)   // 等 wasm + 模型 + 摄像头
      mark('s4 跟练页')
    } else { errs.push('未找到 start-practice 按钮') }
  } catch (e) { errs.push('进 s4: ' + e.message) }

  const state = await page.evaluate(() => {
    const v = document.querySelector('video')
    return { url: location.href, coach: !!document.querySelector('.coach-bar'),
             video: v ? { w: v.videoWidth, paused: v.paused, rs: v.readyState } : null }
  })

  await browser.close()

  const uniq = [...new Set(reqs)]
  const top = uniq.filter((p) => p.startsWith('/') && !p.startsWith('/s4/'))
  const byRoot = {}
  for (const p of uniq) {
    if (p.startsWith('__MARK__')) continue
    const seg = p.split('/')[1] || '(root)'
    byRoot[seg] = (byRoot[seg] || 0) + 1
  }
  const result = { state, wentS4, byRoot, topLevelRequests: top, all: uniq, errors: errs }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))

  console.log('进到 s4 =', wentS4)
  console.log('页面状态 =', JSON.stringify(state))
  console.log('\n=== 顶层路径命中统计（第一段目录 -> 请求数）===')
  Object.entries(byRoot).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${v}`))
  console.log('\n=== 非 /s4/ 的请求（即 dist 根下的）===')
  top.forEach((p) => console.log('  ' + p))
  if (errs.length) console.log('\nERRORS:\n' + errs.join('\n'))
  console.log('\n详情 ->', OUT)
})()
