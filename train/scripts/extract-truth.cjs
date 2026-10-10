/**
 * 弦养 S4 · 真值提取器 v2（离线、纯本机、不上传任何东西）
 * ============================================================================
 * 【为什么重写 poses/extract.js】
 *   旧版的三个硬伤：
 *   1) 时间戳是 `marks.length * 33.3` —— 由循环计数按「假定 30fps」推出来的，
 *      不是视频真实时间基。丢帧/重复帧都会让 t 漂移（交付版里出现过重复 t=214.746、
 *      甚至非单调 t）。
 *   2) 关键帧在「区间内均匀取」5 个 —— 不落在标志性姿态的峰值上（式1 的窗口里
 *      5 帧全在「手已举起」之后，起点 raise 就有 0.81）。
 *   3) 用人眼不可见的东西当分段依据（自带判定器的分数）——判定器标尺本身与
 *      真人实拍幅度不符时，分段会连着错。
 *
 * 【v2 的做法】
 *   · 时间基：`requestVideoFrameCallback` 的 `meta.mediaTime` —— 浏览器呈现每一帧
 *     时给的真实媒体时间，天然单调、天然与画面一一对应。
 *   · 采样：playbackRate 加速播放取出全片骨架（每帧一次推理）。
 *   · 输出**原始数据**（每帧 33 点 + 可见度 + 质量标记），不做任何「挑帧」判断。
 *     分析/挑峰值交给 pick-peaks.py —— 解耦，方便反复换策略而不用重跑推理。
 *
 * 【跑法】
 *   NODE_PATH=/Users/leo/WorkBuddy/疗愈/node_modules \
 *   node train/scripts/extract-truth.cjs <videoPath> <outJson> [playbackRate] [maxSec]
 * ============================================================================
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(__dirname, '..')                    // train/
const MP = path.join(ROOT, 'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')

const VIDEO = process.argv[2]
const OUT = process.argv[3]
const RATE = Number(process.argv[4] || 4)                     // 0 = 原速
const MAXSEC = Number(process.argv[5] || 0)                   // 0 = 不限
if (!VIDEO || !OUT) { console.error('用法: extract-truth.cjs <video> <outJson> [rate] [maxSec]'); process.exit(1) }

const PORT = 5433

// ---------------------------------------------------------------- 极小静态服务
// 提供：harness 页 / mediapipe ESM bundle / wasm / 模型 / 视频（带 Range）
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.mp4': 'video/mp4',
  '.json': 'application/json',
}

function serveFile(res, file, req) {
  const st = fs.statSync(file)
  const type = MIME[path.extname(file)] || 'application/octet-stream'
  const range = req.headers.range
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    const start = m[1] ? parseInt(m[1], 10) : 0
    const end = m[2] ? parseInt(m[2], 10) : st.size - 1
    res.writeHead(206, {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${st.size}`,
      'Content-Length': end - start + 1,
    })
    fs.createReadStream(file, { start, end }).pipe(res)
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size })
    fs.createReadStream(file).pipe(res)
  }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  try {
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(HARNESS)
    }
    if (u.pathname === '/mp.js') return serveFile(res, MP, req)
    if (u.pathname.startsWith('/wasm/')) {
      const name = path.basename(u.pathname)
      const a = path.join(ROOT, 'public/wasm', name)
      const b = path.join(ROOT, 'node_modules/@mediapipe/tasks-vision/wasm', name)
      return serveFile(res, fs.existsSync(a) ? a : b, req)
    }
    if (u.pathname === '/model.task') return serveFile(res, path.join(ROOT, 'public/models/pose_landmarker_lite.task'), req)
    if (u.pathname === '/video.mp4') return serveFile(res, VIDEO, req)
    res.writeHead(404); res.end('nope')
  } catch (e) { res.writeHead(500); res.end(String(e)) }
})

// ---------------------------------------------------------------- harness 页
const HARNESS = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>extract</title></head>
<body style="margin:0;background:#111;color:#eee;font:13px sans-serif">
<div id="hud" style="padding:6px 10px">booting…</div>
<video id="v" muted playsinline preload="auto" style="width:480px;display:block"></video>
<script type="module">
import { FilesetResolver, PoseLandmarker } from '/mp.js'
const hud = document.getElementById('hud')
const video = document.getElementById('v')
window.__err = null

async function main() {
  video.src = '/video.mp4'
  await new Promise((r, j) => { video.onloadeddata = r; video.onerror = () => j(new Error('video load fail')) })
  hud.textContent = 'loading runtime…'
  // 【坑】视频播到片尾往往是「停住」而不是触发 ended ⇒ 收尾逻辑不能等 __done。
  // 元数据一拿到就先挂到 window 上，避免最后读不到。
  window.__meta = { duration: video.duration, w: video.videoWidth, h: video.videoHeight }

  let landmarker
  const fileset = await FilesetResolver.forVisionTasks('/wasm')
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: '/model.task', delegate }, runningMode: 'VIDEO', numPoses: 1 })
  try { landmarker = await PoseLandmarker.createFromOptions(fileset, opts('GPU')) }
  catch { landmarker = await PoseLandmarker.createFromOptions(fileset, opts('CPU')) }

  hud.textContent = 'running…'
  const rows = []
  window.__rows = rows          // 实时暴露：外部轮询/中断也能拿到已完成的部分
  window.__done = false
  let lastMs = -1

  await new Promise((done) => {
    const onFrame = (now, meta) => {
      const t = meta.mediaTime
      const ms = Math.round(t * 1000)
      let lm = null
      if (ms > lastMs) {                       // 时间戳必须单调（MediaPipe 要求）
        lastMs = ms
        try { lm = landmarker.detectForVideo(video, ms)?.landmarks?.[0] || null } catch (e) { /* 丢一帧 */ }
      }
      rows.push(lm
        ? { t: +t.toFixed(4), pts: lm.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.z || 0).toFixed(3), +(p.visibility ?? 1).toFixed(3)]) }
        : { t: +t.toFixed(4), pts: null })
      if (rows.length % 30 === 0) hud.textContent = rows.length + ' frames · t=' + t.toFixed(1) + 's'
      if (video.ended) return done()
      video.requestVideoFrameCallback(onFrame)
    }
    video.requestVideoFrameCallback(onFrame)
    video.play()
  })

  hud.textContent = 'done ' + rows.length
  window.__meta = { duration: video.duration, w: video.videoWidth, h: video.videoHeight }
  window.__done = true
}

main().catch((e) => { window.__err = String(e && e.stack || e); hud.textContent = 'ERR ' + window.__err })
<\/script></body></html>`

// ---------------------------------------------------------------- 主流程
;(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r))
  console.log(`静态服务 http://127.0.0.1:${PORT}`)

  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu'],
  })
  const page = await browser.newPage({ viewport: { width: 900, height: 420 } })
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text().slice(0, 160)) })

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })

  if (RATE > 0) await page.evaluate((r) => { const v = document.getElementById('v'); v.playbackRate = r; v.preservesPitch = false }, RATE)

  const t0 = Date.now()

  // 轮询直到视频播完（或超时）
  const HARD_CAP = (MAXSEC > 0 ? MAXSEC * 1000 : 40 * 60 * 1000)
  let lastN = 0, stall = 0
  while (Date.now() - t0 < HARD_CAP) {
    const st = await page.evaluate(() => ({
      err: window.__err, n: window.__rows ? window.__rows.length : 0,
      done: !!window.__done,
      hud: document.getElementById('hud').textContent,
    }))
    if (st.err) { console.error('页面报错:', st.err); break }
    if (!st.done) stall = st.n === lastN ? stall + 1 : 0
    lastN = st.n
    process.stdout.write(`\r  ${st.hud}   [墙钟 ${((Date.now() - t0) / 1000).toFixed(0)}s]        `)
    if (st.done && st.n > 0) break
    if (stall > 30) { console.error('\n采样停住（30 次轮询无新增），提前收尾'); break }
    await new Promise((r) => setTimeout(r, 2000))
  }
  process.stdout.write('\n')

  const out = await page.evaluate(() => ({ rows: window.__rows, meta: window.__meta }))
  await browser.close()
  server.close()

  if (!out.rows || !out.rows.length) { console.error('没有采到任何帧'); process.exit(2) }
  const withPose = out.rows.filter((r) => r.pts).length
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true })
  fs.writeFileSync(path.resolve(OUT), JSON.stringify({
    schema: 'xianyang.raw-landmark-timeline/1',
    source: { video: path.basename(VIDEO), rate: RATE, extractor: 'extract-truth.cjs v2 (rVFC mediaTime)' },
    meta: out.meta,
    frames: out.rows,
  }))
  const ts = out.rows.map((r) => r.t)
  console.log(`帧数 ${out.rows.length}（有人体 ${withPose}）`)
  console.log(`时间范围 ${Math.min(...ts).toFixed(2)} ~ ${Math.max(...ts).toFixed(2)}s`)
  console.log(`中位采样间隔 ${(() => { const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]); d.sort((a, b) => a - b); return (d[d.length >> 1]).toFixed(4) })()}s`)
  console.log(`→ ${OUT}`)
})()
