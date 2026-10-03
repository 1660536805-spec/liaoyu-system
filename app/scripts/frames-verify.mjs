// 验证取景比例四档切换：9:16 / 3:4 / 1:1 / source
// 运行：APP_URL=http://localhost:5173 FAKE_CAM=1 node scripts/frames-verify.mjs
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
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'], ignoreHTTPSErrors: true })
const page = await ctx.newPage()
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)) })
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 130)))

console.log('\n=== 取景比例四档切换验证 ===\n')
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.locator('text=开始练').click()
for (let i = 0; i < 60; i++) {
  const ok = await page.evaluate(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0 })
  if (ok) break
  await page.waitForTimeout(500)
}
await page.waitForTimeout(2000)

const geoOf = () => page.evaluate(() => {
  const st = document.querySelector('.stage')
  const v = document.querySelector('video')
  const g = document.querySelector('.guide')
  const r = st.getBoundingClientRect()
  const vw = v.videoWidth, vh = v.videoHeight
  const sc = Math.min(r.width / vw, r.height / vh)
  const dw = vw * sc, dh = vh * sc
  const gr = g ? g.getBoundingClientRect() : null
  return {
    stage: { w: Math.round(r.width), h: Math.round(r.height) },
    ar: +(r.width / r.height).toFixed(3),
    video: { w: vw, h: vh },
    disp: { w: Math.round(dw), h: Math.round(dh) },
    usage: +((dw * dh) / (r.width * r.height)).toFixed(3),
    guideOff: gr ? { x: Math.abs(gr.x - (r.x + (r.width - dw) / 2)), y: Math.abs(gr.y - (r.y + (r.height - dh) / 2)) } : null,
  }
})

await page.locator('.gear').click()
await page.waitForTimeout(500)

const expect = { '9:16': 0.5625, '3:4': 0.75, '1:1': 1.0 }
for (const [id, ar] of Object.entries(expect)) {
  const sel = page.locator('.panel select').nth(1)   // 下拉顺序：0=摄像头 1=取景比例 2=分辨率
  await sel.selectOption(id)
  await page.waitForTimeout(600)
  const g = await geoOf()
  const label = id.padEnd(7)
  console.log(`${label} 舞台 ${g.stage.w}×${g.stage.h}  比例 ${g.ar}  画面利用率 ${(g.usage * 100).toFixed(0)}%  引导偏差 ${g.guideOff ? g.guideOff.x.toFixed(1) + ',' + g.guideOff.y.toFixed(1) : 'n/a'}`)
  okc(Math.abs(g.ar - ar) < 0.02, `  ${label} 比例 ${g.ar} ≈ ${ar}`)
  okc(g.usage > 0.3, `  ${label} 画面利用率 ${(g.usage * 100).toFixed(0)}% > 30%`)
  okc(g.guideOff && g.guideOff.x < 6 && g.guideOff.y < 6, `  ${label} 引导框与显示区对齐`)
}

// source：跟随 4:3 源，应零黑边
{
  await page.locator('.panel select').nth(1).selectOption('source')
  await page.waitForTimeout(600)
  const g = await geoOf()
  console.log(`source 舞台 ${g.stage.w}×${g.stage.h}  比例 ${g.ar}  画面利用率 ${(g.usage * 100).toFixed(0)}%`)
  okc(Math.abs(g.ar - g.video.w / g.video.h) < 0.02, `  source 跟随源比例 ${g.ar} ≈ ${(g.video.w / g.video.h).toFixed(3)}`)
  okc(g.usage > 0.95, `  source 画面利用率 ${(g.usage * 100).toFixed(0)}%（无黑边）`)
}

console.log('\n=== 恢复默认应回到 3:4 ===')
await page.locator('.panel .mini.wide').click()
await page.waitForTimeout(600)
{
  const g = await geoOf()
  console.log('   恢复后比例:', g.ar)
  okc(Math.abs(g.ar - 0.75) < 0.02, '恢复默认回到 3:4')
}

console.log('\n=== 零报错 ===')
okc(errs.length === 0, `控制台 0 error（实得 ${errs.length}）`)
errs.slice(0, 4).forEach((e) => console.log('     ' + e))

await page.locator('.stage').click({ position: { x: 8, y: 8 } })
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(ROOT, 'evidence', 'frames-panel.png') })
await browser.close()
console.log('\n' + (fail === 0 ? '✅ 四档取景比例全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
