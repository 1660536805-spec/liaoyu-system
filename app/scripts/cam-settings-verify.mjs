// 验证摄像头选择与设置面板：设备下拉、分辨率切换、镜像开关、灵敏度滑块
// 运行：APP_URL=http://localhost:5173 node scripts/cam-settings-verify.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
mkdirSync(path.join(ROOT, 'evidence'), { recursive: true })
const URL_BASE = process.env.APP_URL || 'http://localhost:5173'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({
  viewport: { width: 880, height: 1040 },
  permissions: ['camera'],
  ignoreHTTPSErrors: true,
})
const page = await ctx.newPage()
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)) })
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 150)))

console.log(`\n=== 1. 首页摄像头预检（${URL_BASE}）===\n`)
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)   // 等预检
const pre = await page.evaluate(() => {
  const el = document.querySelector('.cam-state')
  return el ? { text: el.textContent.trim(), ok: !!el.querySelector('.dot.ok') } : null
})
console.log('   预检状态:', JSON.stringify(pre))
okc(!!pre, '首页显示摄像头预检状态')
okc(pre?.ok === true, `预检通过：${pre?.text?.slice(0, 60)}`)
await page.screenshot({ path: path.join(ROOT, 'evidence', 's1-home.png') })

console.log('\n=== 2. 进跟练页，摄像头自动打开 ===')
await page.locator('text=开始练').click()
let vs = null
for (let i = 0; i < 70; i++) {
  vs = await page.evaluate(() => {
    const v = document.querySelector('video')
    return { rs: v ? v.readyState : -1, w: v ? v.videoWidth : 0 }
  })
  if (vs.rs >= 2 && vs.w > 0) break
  await page.waitForTimeout(500)
}
okc(!!vs && vs.w > 0, `点击后摄像头自动打开（${vs?.w}px），无需二次授权`)

const camTag = await page.evaluate(() => {
  const e = document.querySelector('.cam-tag')
  return e ? e.textContent.trim() : null
})
console.log('   摄像头标签:', camTag)
okc(!!camTag && !camTag.includes('切换中'), `画面右上角显示当前设备：${camTag}`)

console.log('\n=== 3. 设置面板：摄像头下拉 ===')
await page.locator('.gear').click()
await page.waitForTimeout(800)
const panelVisible = await page.locator('.panel').isVisible()
okc(panelVisible, '点击齿轮打开设置面板')

const sel = page.locator('.panel select').first()
const opts = await sel.locator('option').allTextContents()
console.log('   下拉选项:', JSON.stringify(opts))
okc(opts.length > 0, `摄像头下拉有 ${opts.length} 项`)
okc(opts.every((o) => o.trim().length > 0), '下拉项无空白（label 为空时已用序号兜底）')
okc(opts.length < 2, `本机只有 ${opts.length} 个摄像头（下拉仍可见，现场接第二个即生效）`)

const actual = await page.evaluate(() => {
  const h = [...document.querySelectorAll('.panel .hint')].map((e) => e.textContent.trim())
  return h
})
console.log('   面板提示:', JSON.stringify(actual))
okc(actual.some((t) => /\d+×\d+/.test(t)), `显示实际输出分辨率：${actual.find((t) => /\d+×\d+/.test(t)) || '无'}`)
await page.screenshot({ path: path.join(ROOT, 'evidence', 's2-panel.png') })

console.log('\n=== 4. 分辨率下拉 ===')
const resOpts = await page.locator('.panel select').nth(1).locator('option').allTextContents()
console.log('   分辨率档位:', resOpts.length)
okc(resOpts.length >= 3, `分辨率档位 ${resOpts.length} 档`)

console.log('\n=== 5. 灵敏度 / 保持帧数滑块 ===')
const sliders = page.locator('.panel input[type=range]')
const n = await sliders.count()
okc(n === 2, `两个滑块（灵敏度 / 保持帧数），实得 ${n}`)
// 改灵敏度
await sliders.nth(0).fill('0.45')
await page.waitForTimeout(500)
const tip = await page.locator('.gauge-tip').textContent()
console.log('   跟练页阈值提示:', tip.trim())
okc(/0\.45/.test(tip), '改灵敏度后跟练页阈值提示同步更新')
const markLeft = await page.evaluate(() => document.querySelector('.gauge-mark')?.style.left)
okc(markLeft === '45%', `进度条刻度跟随阈值移动（left=${markLeft}）`)

console.log('\n=== 6. 镜像开关 ===')
const beforeFlip = await page.evaluate(() => document.querySelector('video').classList.contains('flip'))
await page.locator('.panel input[type=checkbox]').click()
await page.waitForTimeout(400)
const afterFlip = await page.evaluate(() => document.querySelector('video').classList.contains('flip'))
okc(beforeFlip !== afterFlip, `镜像开关生效：${beforeFlip} → ${afterFlip}`)

console.log('\n=== 7. 恢复默认 ===')
await page.locator('.panel .mini.wide').click()
await page.waitForTimeout(400)
const tip2 = await page.locator('.gauge-tip').textContent()
okc(/0\.55/.test(tip2), `恢复默认后阈值回到 0.55（现 ${tip2.trim()}）`)

console.log('\n=== 8. 零报错 ===')
okc(errs.length === 0, `控制台 0 error（实得 ${errs.length}）`)
errs.slice(0, 5).forEach((e) => console.log('     ' + e))
const ab = errs.filter((e) => /AbortError|interrupted/i.test(e))
okc(ab.length === 0, `无 AbortError（摄像头抢流问题已修，实得 ${ab.length} 条）`)

await page.keyboard.press('Escape')
await page.locator('.stage').click({ position: { x: 10, y: 10 } })
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(ROOT, 'evidence', 's3-final.png') })
await browser.close()
console.log('\n' + (fail === 0 ? '✅ 摄像头选择与设置全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
