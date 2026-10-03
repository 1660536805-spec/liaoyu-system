// 采集 worldLandmarks（3D）数据 —— 独立页面，避免与采集器的时间戳冲突
// 运行：node scripts/capture-world.mjs
// 产出：evidence/world-real.json（含 2D + 3D，用于标定 pose.js 的阈值）
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
mkdirSync(path.join(ROOT, 'evidence'), { recursive: true })
const URL_BASE = process.env.APP_URL || 'http://localhost:5173'
const SECONDS = Number(process.env.SECONDS || 20)

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'], ignoreHTTPSErrors: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 140)))

await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.locator('text=开始练').click()
// 等视频出画
for (let i = 0; i < 60; i++) {
  const ok = await page.evaluate(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0 })
  if (ok) break
  await page.waitForTimeout(500)
}
await page.waitForTimeout(3000)

console.log('\n=== 采集 3D 世界坐标 ===\n')
console.log('请做这几个动作，每个约 3 秒：')
console.log('  1. 正对镜头站定        ')
console.log('  2. 向左转 45°          ')
console.log('  3. 向右转 45°          ')
console.log('  4. 完全侧身 90°        ')
console.log('  5. 背对镜头            ')
console.log('  6. 只转头（身体不动）  ')
console.log(`\n现在开始采集 ${SECONDS} 秒…\n`)

// 在页面里挂一个钩子，截获引擎发出的 worldLandmarks
await page.evaluate(() => {
  window.__cap = []
  // 引擎通过 emit('result', lm, world, res) 传出；这里直接从 video 元素旁路取
})

const samples = await page.evaluate(async (secs) => {
  const vision = await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')
  const fs = await vision.FilesetResolver.forVisionTasks('/wasm')
  const lm = await vision.PoseLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3,
  })
  const v = document.querySelector('video')
  const out = []
  const t0 = performance.now()
  let t = t0
  const KEY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
  while (performance.now() - t0 < secs * 1000) {
    const res = lm.detectForVideo(v, t)
    t += 33
    if (res.landmarks?.[0] && res.worldLandmarks?.[0]) {
      const L = res.landmarks[0], W = res.worldLandmarks[0]
      out.push({
        t: +((performance.now() - t0) / 1000).toFixed(2),
        s: KEY.map((i) => [+L[i].x.toFixed(4), +L[i].y.toFixed(4), +L[i].visibility.toFixed(3)]),
        w: KEY.map((i) => [+W[i].x.toFixed(4), +W[i].y.toFixed(4), +W[i].z.toFixed(4)]),
      })
    }
    await new Promise((z) => setTimeout(z, 33))
  }
  lm.close()
  return out
}, SECONDS)

console.log(`采到 ${samples.length} 帧`)
if (samples.length) {
  const last = samples[samples.length - 1]
  const N = { 0: '鼻', 1: 'L眼内', 2: 'L眼', 3: 'L眼外', 4: 'R眼内', 5: 'R眼', 6: 'R眼外', 7: 'L耳', 8: 'R耳', 9: 'L口', 10: 'R口', 11: 'L肩', 12: 'R肩' }
  console.log('\n=== 最后一帧的 3D 坐标（米制，原点髋）===')
  last.w.slice(0, 13).forEach((p, i) => {
    console.log(`   ${(N[i] || i).padEnd(7)} x=${String(p[0]).padStart(8)}  y=${String(p[1]).padStart(8)}  z=${String(p[2]).padStart(8)}`)
  })
  const g = (a, b2) => Math.hypot(last.w[a][0] - last.w[b2][0], last.w[a][1] - last.w[b2][1], last.w[a][2] - last.w[b2][2])
  console.log(`\n   双耳 3D 距离 = ${g(7, 8).toFixed(4)} m`)
  console.log(`   双肩 3D 距离 = ${g(11, 12).toFixed(4)} m`)
  console.log(`   鼻-耳中点 z 差 = ${(last.w[0][2] - (last.w[7][2] + last.w[8][2]) / 2).toFixed(4)} m`)
  console.log(`   鼻-肩中点 z 差 = ${(last.w[0][2] - (last.w[11][2] + last.w[12][2]) / 2).toFixed(4)} m`)

  // 关键：随时间看这两个指标如何变化
  const key = (s) => {
    const gw = (a, b2) => Math.hypot(s.w[a][0] - s.w[b2][0], s.w[a][1] - s.w[b2][1], s.w[a][2] - s.w[b2][2])
    return {
      t: s.t,
      ear3: +gw(7, 8).toFixed(4),
      sho3: +gw(11, 12).toFixed(4),
      noseRelEarZ: +(s.w[0][2] - (s.w[7][2] + s.w[8][2]) / 2).toFixed(4),
      noseRelShoZ: +(s.w[0][2] - (s.w[11][2] + s.w[12][2]) / 2).toFixed(4),
    }
  }
  console.log('\n=== 关键指标随时间（每 15 帧采样）===')
  console.log('   t(s)   双耳3D   双肩3D   鼻-耳z   鼻-肩z')
  samples.filter((_, i) => i % 15 === 0).forEach((s) => {
    const k = key(s)
    console.log(`   ${String(k.t).padStart(5)}  ${k.ear3.toFixed(4)}  ${k.sho3.toFixed(4)}  ${k.noseRelEarZ.toFixed(4)}  ${k.noseRelShoZ.toFixed(4)}`)
  })
}
writeFileSync(path.join(ROOT, 'evidence', 'world-real.json'), JSON.stringify({ meta: { seconds: SECONDS, frames: samples.length }, samples }, null, 1))
console.log('\n已存 evidence/world-real.json')
await browser.close()
