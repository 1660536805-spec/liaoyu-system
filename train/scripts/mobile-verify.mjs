// 手机端验证 —— 模拟 iPhone UA + https，验证摄像头能否打开（对应 D4）
// 运行：APP_URL=https://localhost:5174 node scripts/mobile-verify.mjs
//
// 为什么必须用 https：浏览器只在「安全上下文」允许 getUserMedia，
// localhost 是例外，但手机通过局域网 IP 访问时不是例外 → 必须 https。
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'evidence')
mkdirSync(OUT, { recursive: true })
const URL_BASE = process.env.APP_URL || 'https://localhost:5174'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
  ignoreHTTPSErrors: true,                     // 自签名证书必须忽略
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  isMobile: true, hasTouch: true,
})
const page = await ctx.newPage()
const errs = [], bad = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)))
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 90)}`) })

console.log(`\n=== 手机端验证（${URL_BASE}）===\n`)
await page.goto(URL_BASE, { waitUntil: 'networkidle' })

console.log('=== 1. 首页 + 安全上下文 ===')
okc((await page.locator('text=开始练').count()) > 0, '首页渲染出「开始练」')
const sec = await page.evaluate(() => window.isSecureContext)
console.log('   isSecureContext =', sec)
okc(sec === true, 'isSecureContext = true（https 生效，摄像头前提满足）')
await page.screenshot({ path: path.join(OUT, 'm1-home.png') })

console.log('\n=== 2. 摄像头授权与出画 ===')
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
okc(!!vs && vs.w > 0, `视频出画 ${vs?.w || 0}px`)

await page.waitForTimeout(3500)
const st = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    paused: v.paused,
    track: v.srcObject ? v.srcObject.getVideoTracks()[0].label : null,
    trackState: v.srcObject ? v.srcObject.getVideoTracks()[0].readyState : null,
  }
})
console.log('   ', JSON.stringify(st))
okc(st.track !== null, `摄像头轨道已挂载：${st.track}`)
okc(st.paused === false, '视频在播放（未被自动播放策略拦住）')
okc(st.trackState === 'live', '轨道 live（正在采集）')

console.log('\n=== 3. 取景诊断与引导（竖版布局）===')
const diag = await page.evaluate(() => { const d = document.querySelector('.diag'); return d ? d.textContent.trim() : null })
const guide = await page.evaluate(() => { const g = document.querySelector('.guide-tip'); return g ? g.textContent.trim() : null })
const frame = await page.evaluate(() => {
  const f = document.querySelector('.guide-frame')
  if (!f) return null
  const r = f.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height) }
})
const stage = await page.evaluate(() => {
  const s = document.querySelector('.stage')
  if (!s) return null
  const r = s.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(2) }
})
console.log('   诊断条:', diag)
console.log('   引导语:', guide)
console.log('   取景框:', JSON.stringify(frame), ' 舞台:', JSON.stringify(stage))
okc(!!diag, '取景诊断条已显示')
okc(!!guide, '取景引导语已显示')
okc(!!frame && frame.w > 100 && frame.h > 100, '取景框已渲染且尺寸合理')
okc(!!stage && stage.ratio < 1.0, `舞台为竖版（宽高比 ${stage?.ratio} < 1）`)

console.log('\n=== 4. MediaPipe 在 https 下可用 ===')
const mp = await page.evaluate(async () => {
  const out = { ok: false, err: null, pts: 0 }
  try {
    const vision = await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')
    const fs = await vision.FilesetResolver.forVisionTasks('/wasm')
    const lm = await vision.PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'GPU' },
      runningMode: 'VIDEO', numPoses: 1,
      minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3,
    })
    const v = document.querySelector('video')
    for (let f = 0; f < 60; f++) {
      const r = lm.detectForVideo(v, performance.now() + f * 33)
      if (r.landmarks && r.landmarks[0]?.length) { out.ok = true; out.pts = r.landmarks[0].length; break }
      await new Promise((z) => setTimeout(z, 33))
    }
    lm.close()
  } catch (e) { out.err = e.message }
  return out
})
console.log('   ', JSON.stringify(mp))
okc(mp.ok, `MediaPipe 在 https 下检出骨架（${mp.pts} 点）——D4 核心验证`)

console.log('\n=== 5. 零报错 ===')
console.log('   4xx/5xx:', bad.length ? bad.join(' | ') : '无')
okc(bad.length === 0, '无 4xx/5xx（wasm + 模型在 https 下正常加载）')
okc(errs.length === 0, `控制台 0 error（实得 ${errs.length}）`)
errs.slice(0, 5).forEach((e) => console.log('     ' + e))

await page.screenshot({ path: path.join(OUT, 'm2-train.png') })
writeFileSync(path.join(OUT, 'mobile-verify-log.txt'),
  `URL: ${URL_BASE}\nisSecureContext: ${sec}\nvideo: ${JSON.stringify(st, null, 2)}\nstage: ${JSON.stringify(stage)}\ndiag: ${diag}\nguide: ${guide}\nmediapipe: ${JSON.stringify(mp)}\n4xx: ${bad.join('\n') || '无'}\nerrors:\n${errs.join('\n')}\n`)

console.log('\n  证据：evidence/m1-home.png、m2-train.png、mobile-verify-log.txt')
await browser.close()
console.log('\n' + (fail === 0 ? '✅ 手机端验证全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
