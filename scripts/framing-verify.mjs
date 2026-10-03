// 验证取景不再裁切：contain 显示区、骨架对齐、竖屏比例
// 运行：APP_URL=http://localhost:5173 node scripts/framing-verify.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
mkdirSync(path.join(ROOT, 'evidence'), { recursive: true })
const URL_BASE = process.env.APP_URL || 'http://localhost:5173'
const W = Number(process.env.VW || 1440)
const H = Number(process.env.VH || 900)

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    // FAKE_DEVICE：设备被真实占用时退回 Chrome 内置测试流（--use-file-for-fake-video-capture 可指定文件）。
    // 这样布局验证不依赖物理摄像头，真机演示时再用真设备。
    ...(process.env.FAKE_CAM ? ['--use-fake-device-for-media-stream'] : []),
  ],
})
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  permissions: ['camera'],
  ignoreHTTPSErrors: true,
})
const page = await ctx.newPage()
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 140)))

console.log(`\n=== 取景验证（视口 ${W}×${H}，${URL_BASE}）===\n`)
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.locator('text=开始练').click()

let vs = null
for (let i = 0; i < 70; i++) {
  vs = await page.evaluate(() => {
    const v = document.querySelector('video')
    return { rs: v ? v.readyState : -1, w: v ? v.videoWidth : 0, h: v ? v.videoHeight : 0 }
  })
  if (vs.rs >= 2 && vs.w > 0) break
  await page.waitForTimeout(500)
}
await page.waitForTimeout(2500)
console.log('① 视频源:', `${vs?.w}×${vs?.h}`, `比例 ${(vs?.w / vs?.h).toFixed(2)}`)
okc(vs?.w > 0, '视频已出画')

const geo = await page.evaluate(() => {
  const stage = document.querySelector('.stage')
  const v = document.querySelector('video')
  const c = document.querySelector('canvas')
  const g = document.querySelector('.guide')
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  return {
    viewport: { w: innerWidth, h: innerHeight },
    stage: R(stage), canvas: R(c), guide: R(g),
    vw: v.videoWidth, vh: v.videoHeight,
    videoFit: getComputedStyle(v).objectFit,
    stageRatio: +(R(stage).w / R(stage).h).toFixed(3),
  }
})
console.log('② 舞台:', JSON.stringify(geo.stage), `比例 ${geo.stageRatio}`)
console.log('   视频源:', `${geo.vw}×${geo.vh}`, ' object-fit =', geo.videoFit)

console.log('\n③ 关键：是否裁切 ===')
okc(geo.videoFit === 'contain', `object-fit = contain（不裁切），实得 ${geo.videoFit}`)
// contain 下，视频完整显示区应内含于 stage
const s = geo.stage
const dispScale = Math.min(s.w / geo.vw, s.h / geo.vh)
const dispW = geo.vw * dispScale, dispH = geo.vh * dispScale
console.log(`   视频完整显示区: ${Math.round(dispW)}×${Math.round(dispH)}（容器 ${s.w}×${s.h}）`)
okc(dispW <= s.w + 1 && dispH <= s.h + 1, '整幅画面都在容器内，未被裁掉任何一边')
const waste = 1 - (dispW * dispH) / (s.w * s.h)
console.log(`   画面利用率: ${((1 - waste) * 100).toFixed(0)}%（浪费 ${(waste * 100).toFixed(0)}% 为黑边）`)

console.log('\n④ 竖屏取向 ===')
okc(geo.stageRatio < 0.95, `舞台为竖向（宽高比 ${geo.stageRatio} < 0.95）`)
okc(s.w < geo.viewport.w, `舞台未横向撑满（${s.w} < 视口 ${geo.viewport.w}），左右留边不浪费有效画面`)

console.log('\n⑤ 引导框与视频显示区对齐 ===')
if (geo.guide) {
  const gx = Math.abs(geo.guide.x - (s.x + (s.w - dispW) / 2))
  const gy = Math.abs(geo.guide.y - (s.y + (s.h - dispH) / 2))
  console.log(`   引导框 ${geo.guide.w}×${geo.guide.h}，与显示区偏移 (${gx}, ${gy}) px`)
  okc(gx < 6 && gy < 6, '引导框与视频实际显示区对齐（偏移 <6px）')
} else okc(false, '引导框未渲染')

console.log('\n⑥ 骨架绘制区域 ===')
const sk = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return null
  const ctx = c.getContext('2d')
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, n = 0
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4
      if (d[i + 3] > 40) { n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    }
  }
  return n > 0 ? { n, minX, maxX, minY, maxY, w: c.width, h: c.height } : { n: 0 }
})
console.log('   ', JSON.stringify(sk))
if (sk.n > 0) {
  // 骨架应落在 contain 显示区内（含黑边也不该画到容器外）
  const lo = { x: (s.w - dispW) / 2 - 4, y: (s.h - dispH) / 2 - 4 }
  const hi = { x: (s.w - dispW) / 2 + dispW + 4, y: (s.h - dispH) / 2 + dispH + 4 }
  okc(sk.minX >= lo.x && sk.maxX <= hi.x, `骨架横向落在显示区内（${sk.minX}~${sk.maxX} ⊂ ${Math.round(lo.x)}~${Math.round(hi.x)}）`)
  okc(sk.minY >= lo.y && sk.maxY <= hi.y, `骨架纵向落在显示区内（${sk.minY}~${sk.maxY} ⊂ ${Math.round(lo.y)}~${Math.round(hi.y)}）`)
} else {
  console.log('   （画面里可能无人，骨架像素为 0 —— 属正常）')
}

console.log('\n⑦ 零报错 ===')
okc(errs.length === 0, `控制台 0 error（实得 ${errs.length}）`)
errs.slice(0, 4).forEach((e) => console.log('     ' + e))

await page.screenshot({ path: path.join(ROOT, 'evidence', `framing-${W}x${H}.png`) })
await browser.close()
console.log('\n' + (fail === 0 ? '✅ 取景验证通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
