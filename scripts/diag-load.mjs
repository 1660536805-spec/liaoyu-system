// 诊断跟练页加载卡死：每 2 秒打印一次加载态，定位卡在哪一步
// 运行：APP_URL=http://localhost:5173 node scripts/diag-load.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
mkdirSync(path.join(ROOT, 'evidence'), { recursive: true })
const URL_BASE = process.env.APP_URL || 'http://localhost:5173'
const SECONDS = Number(process.env.SECONDS || 24)

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
const t0 = Date.now()
const el = () => ((Date.now() - t0) / 1000).toFixed(1) + 's'

page.on('console', (m) => console.log(`[${el()}][${m.type()}] ${m.text().slice(0, 130)}`))
page.on('pageerror', (e) => console.log(`[${el()}][pageerror] ${e.message.slice(0, 130)}`))
page.on('response', (r) => {
  if (r.url().includes('/wasm/') || r.url().includes('/models/')) {
    console.log(`[${el()}][http] ${r.status()} ${r.url().split('/').pop()}`)
  }
})

await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.locator('text=开始练').click()
console.log(`[${el()}] 已点击「开始练」`)

let done = false
for (let i = 0; i < SECONDS / 2; i++) {
  await page.waitForTimeout(2000)
  const s = await page.evaluate(() => {
    const masks = [...document.querySelectorAll('.mask')]
    const loadMask = masks.find((m) => !m.classList.contains('err'))
    const errMask = document.querySelector('.mask.err')
    const v = document.querySelector('video')
    return {
      loading: loadMask ? loadMask.querySelector('.mask-txt')?.textContent.trim() : null,
      err: errMask ? errMask.querySelector('.mask-txt')?.textContent.trim() : null,
      vw: v ? v.videoWidth : -1,
      vrs: v ? v.readyState : -1,
    }
  })
  console.log(`[${el()}] 加载="${s.loading}" 错误="${s.err}" video=${s.vw}px rs=${s.vrs}`)
  if (s.err) { console.log('→ 报错结束'); break }
  if (s.vw > 0 && !s.loading) { console.log('→ 已出画，加载完成'); done = true; break }
}

await page.screenshot({ path: path.join(ROOT, 'evidence', 'diag-stuck.png') })
console.log(fail => 0)
console.log(done ? '结论：正常' : '结论：卡住（见上方最后一行状态）')
await browser.close()
