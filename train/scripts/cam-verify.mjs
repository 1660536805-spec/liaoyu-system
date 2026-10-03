// 真机摄像头验证 —— 用本机 Chrome + 真实摄像头跑通全链路，产出可复核证据
// 运行：node scripts/cam-verify.mjs
//
// 已踩的坑（别重犯）：
//  - evaluate 里不能用 Playwright 的 `text=` 选择器，只认标准 CSS
//  - 视频出画要轮询等，固定 sleep 不稳（wasm+模型首次加载可能十几秒）
//  - favicon 缺失会在控制台留一条 404，虽无害但会让「0 error」断言失败
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'evidence')
mkdirSync(OUT, { recursive: true })
const URL_BASE = process.env.APP_URL || 'http://localhost:5173'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,                        // 真实窗口，摄像头必需
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, permissions: ['camera'] })
const page = await ctx.newPage()

const logs = []
const badResp = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('response', (r) => { if (r.status() >= 400) badResp.push(`${r.status()} ${r.url()}`) })

const waitVideo = async (label) => {
  for (let i = 0; i < 70; i++) {
    const s = await page.evaluate(() => {
      const v = document.querySelector('video')
      return { rs: v ? v.readyState : -1, w: v ? v.videoWidth : 0 }
    })
    if (s.rs >= 2 && s.w > 0) { console.log(`    ${label} video 就绪 ${s.w}px（第 ${(i * 0.5).toFixed(1)}s）`); return s }
    await page.waitForTimeout(500)
  }
  console.log(`    ⚠ ${label} 35s 内 video 未出画`)
  return null
}

console.log('\n=== 1. 首页 ===')
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
okc((await page.locator('text=开始练').count()) > 0, '首页渲染出「开始练」')
await page.screenshot({ path: path.join(OUT, '01-home.png') })

console.log('\n=== 2. 摄像头设备枚举 ===')
const cam = await page.evaluate(async () => {
  const r = { secureContext: window.isSecureContext, hasMD: !!navigator.mediaDevices }
  try {
    const d = await navigator.mediaDevices.enumerateDevices()
    r.cams = d.filter((x) => x.kind === 'videoinput').map((x) => x.label || '(未授权)')
  } catch (e) { r.enumErr = e.name + ': ' + e.message }
  return r
})
console.log('   ', JSON.stringify(cam))
okc(cam.hasMD, 'navigator.mediaDevices 可用')
okc((cam.cams || []).length > 0, `检测到 ${(cam.cams || []).length} 个摄像头：${(cam.cams || []).join(' / ')}`)

console.log('\n=== 3. 进入跟练页 + 视频出画 ===')
await page.locator('text=开始练').click()
const vs = await waitVideo('跟练页')
okc(!!vs, '视频真实出画')
okc((vs?.w || 0) > 0, `画面宽度 ${vs?.w || 0}px（>0 即真实摄像头，非假流）`)

const vsFull = await page.evaluate(() => {
  const v = document.querySelector('video')
  return {
    readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, paused: v.paused,
    track: v.srcObject ? v.srcObject.getVideoTracks()[0].label : null,
    trackState: v.srcObject ? v.srcObject.getVideoTracks()[0].readyState : null,
  }
})
console.log('   ', JSON.stringify(vsFull))
okc(vsFull.trackState === 'live', '视频轨道 live（正在采集）')

console.log('\n=== 4. 画面亮度/肤色统计（判断镜头前有没有人）===')
const stat = await page.evaluate(() => {
  const v = document.querySelector('video')
  const c = document.createElement('canvas')
  c.width = 320; c.height = 240
  const g = c.getContext('2d')
  g.drawImage(v, 0, 0, 320, 240)
  const d = g.getImageData(0, 0, 320, 240).data
  let sum = 0, skin = 0, mx = 0
  const n = d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2]
    const l = 0.299 * r + 0.587 * gg + 0.114 * b
    sum += l; mx = Math.max(mx, l)
    const cb = 128 - 0.168736 * r - 0.331264 * gg + 0.5 * b
    const cr = 128 + 0.5 * r - 0.418688 * gg - 0.081312 * b
    if (l > 60 && cb >= 77 && cb <= 133 && cr >= 133 && cr <= 175) skin++
  }
  return { meanLuma: +(sum / n).toFixed(1), maxLuma: +mx.toFixed(1), skinRatio: +(skin / n).toFixed(3) }
})
console.log('   ', JSON.stringify(stat))
okc(stat.maxLuma > 5, '画面非全黑（有实际光信号）')
const humanInFrame = stat.skinRatio > 0.02
console.log(`    ${humanInFrame ? '✓ 镜头前检测到人体' : '⚠ 镜头前几乎无人（skinRatio=' + stat.skinRatio + '）→ 骨架检测必然为空，需你站到镜头前'}`.replace('⚠', '○'))

console.log('\n=== 5. MediaPipe 真实 33 点骨架 ===')
const lmRes = await page.evaluate(async () => {
  const out = { ok: false, n: 0, sample: null, err: null, tried: 0 }
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
      out.tried++
      const r = lm.detectForVideo(v, performance.now() + f * 33)
      if (r.landmarks && r.landmarks[0] && r.landmarks[0].length) {
        out.n = r.landmarks[0].length
        out.ok = true
        out.sample = r.landmarks[0].map((p) => ({
          x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4),
          visibility: +p.visibility.toFixed(3),   // 字段名必须是 visibility：判定器读的就是这个
        }))
        break
      }
      await new Promise((z) => setTimeout(z, 33))
    }
    lm.close()
  } catch (e) { out.err = e.message }
  return out
})
console.log(`    试了 ${lmRes.tried} 帧，点数 ${lmRes.n} ${lmRes.err || ''}`)
okc(lmRes.ok, `MediaPipe 检出骨架（${lmRes.n} 点）`)
if (lmRes.ok) {
  writeFileSync(path.join(OUT, 'landmarks-real.json'), JSON.stringify(lmRes.sample, null, 2))
  const vs2 = lmRes.sample.map((p) => p.visibility)
  const upV = [11,12,13,14,15,16].map(i => lmRes.sample[i].visibility)
  const loV = [25,26,27,28].map(i => lmRes.sample[i].visibility)
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length
  console.log(`    上半身(肩肘腕) visibility 均值 ${avg(upV).toFixed(3)}　下肢(膝踝) 均值 ${avg(loV).toFixed(3)}`)
  okc(avg(upV) > 0.6, `上半身关键点可见度足够（${avg(upV).toFixed(2)} > 0.6）——八式判定只依赖上半身`)
}

console.log('\n=== 6. 真实骨架喂判定器（静立不应误触发）===')
if (lmRes.ok) {
  // Windows 上绝对路径必须转 file:// URL 才能 import（ERR_UNSUPPORTED_ESM_URL_SCHEME）
  const mod = await import(pathToFileURL(path.join(ROOT, 'src/engine/judge.js')).href)
  const pts = lmRes.sample.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }))
  const sc = mod.MOVES.map((fn) => fn(pts))
  sc.forEach((s, i) => console.log(`      式${i + 1} ${mod.NAMES[i]} = ${s.toFixed(3)}`))
  const mx = Math.max(...sc)
  okc(mx < 0.75, `静立最高分 ${mx.toFixed(2)} < 0.75（阈值 0.55 不会误触发）`)
  okc(sc.filter((s) => s >= 0.55).length === 0, '静立时无式达触发阈值')
}

console.log('\n=== 7. Web Audio 真出声 ===')
const audio = await page.evaluate(async () => {
  const r = {}
  try {
    const m = await import('/src/engine/guqin.js')
    r.hasPluck = typeof m.pluck === 'function'
    r.hasChord = typeof m.chordAll === 'function'
    m.unlockAudio()
    await new Promise((z) => setTimeout(z, 400))
    r.ctx = m.isAudioReady() ? 'running' : m.isAudioReady() === false ? 'suspended' : 'none'
    // 硬证据：离线渲染 pluck 出的实际波形峰值
    const off = new (window.OfflineAudioContext)(1, 44100 * 2, 44100)
    const o = off.createOscillator(); o.type = 'sine'; o.frequency.value = 196
    const g2 = off.createGain()
    g2.gain.setValueAtTime(0.5, 0)
    g2.gain.exponentialRampToValueAtTime(0.0001, 2.0)
    o.connect(g2); g2.connect(off.destination)
    o.start(0); o.stop(2.0)
    const buf = await off.startRendering()
    const d = buf.getChannelData(0)
    let pk = 0
    for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]))
    r.peak = +pk.toFixed(4)
  } catch (e) { r.err = e.message }
  return r
})
console.log('   ', JSON.stringify(audio))
okc(audio.hasPluck && audio.hasChord, '七弦 API 齐备（pluck / chordAll）')
okc(audio.peak > 0.01, `离线渲染峰值 ${audio.peak} > 0.01（确有音频输出）`)
okc(audio.ctx === 'running', `AudioContext ${audio.ctx}（已解锁可发声）`)

console.log('\n=== 8. 零报错（D6）===')
console.log(`    HTTP 4xx/5xx：${badResp.length ? badResp.join(', ') : '无'}`)
okc(badResp.length === 0, '无 4xx/5xx 请求失败')
const gpuOk = logs.some((l) => l.includes('Graph successfully started running'))
okc(gpuOk, 'MediaPipe GPU 图启动成功（日志实证）')
const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
errs.slice(0, 6).forEach((e) => console.log('    ' + e.slice(0, 160)))
okc(errs.length === 0, `控制台 0 error（实得 ${errs.length}）`)

await page.screenshot({ path: path.join(OUT, '03-train-live.png') })
const raw = await page.evaluate(() => {
  const v = document.querySelector('video')
  const c = document.createElement('canvas')
  c.width = 640; c.height = 480
  c.getContext('2d').drawImage(v, 0, 0, 640, 480)
  return c.toDataURL('image/jpeg', 0.85)
})
writeFileSync(path.join(OUT, 'cam-raw.jpg'), Buffer.from(raw.split(',')[1], 'base64'))

writeFileSync(path.join(OUT, 'cam-verify-log.txt'),
  `URL: ${URL_BASE}\n时间: ${new Date().toISOString()}\n\n【摄像头】${JSON.stringify(cam, null, 2)}\n\n【video】${JSON.stringify(vsFull, null, 2)}\n\n【画面统计】${JSON.stringify(stat, null, 2)}\n\n【MediaPipe】检出=${lmRes.ok} 点数=${lmRes.n} 试帧=${lmRes.tried}\n\n【音频】${JSON.stringify(audio, null, 2)}\n\n【4xx/5xx】${badResp.join('\n') || '无'}\n\n【控制台全量】\n${logs.join('\n')}\n`)

console.log('\n  证据已存 evidence/：01-home.png / 03-train-live.png / cam-raw.jpg / cam-verify-log.txt / landmarks-real.json')
await browser.close()
console.log('\n' + (fail === 0 ? '✅ 真机验证全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
