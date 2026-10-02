// MediaPipe Pose 引擎封装 —— 全部资源走本地 public/，不依赖 CDN（断网可用，对应 D5）
// 用法：
//   const engine = await createPoseEngine()
//   engine.on('result', (landmarks, image) => {...})
//   await engine.start(videoEl)
//   engine.stop()

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_PATH = '/wasm'
const MODEL_PATH = '/models/pose_landmarker_lite.task'

// 33 点骨架的连接关系（用于画骨架）
export const BONES = [
  [11, 12], // 肩
  [11, 13], [13, 15], // 左臂
  [12, 14], [14, 16], // 右臂
  [11, 23], [12, 24], // 躯干
  [23, 24], // 髋
  [23, 25], [25, 27], // 左腿
  [24, 26], [26, 28], // 右腿
  [27, 31], [28, 32], // 脚
  [0, 11], [0, 12], // 颈
]
export const KEY_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

export async function createPoseEngine({ numPoses = 1, delegate = 'GPU' } = {}) {
  let landmarker = null
  let running = false
  let rafId = 0
  let video = null
  const listeners = { result: [], error: [] }
  let lastVideoTime = -1

  const emit = (evt, ...a) => listeners[evt].forEach((fn) => fn(...a))

  // 加载 wasm + 模型（本地路径）
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const opts = {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numPoses,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  }
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts)
  } catch (e) {
    // GPU 不可用时退回 CPU（部分机器/驱动不支持 WebGL）
    console.warn('[pose] GPU 初始化失败，退回 CPU：', e?.message || e)
    landmarker = await PoseLandmarker.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } })
  }

  function loop() {
    if (!running) return
    const v = video
    if (v && v.readyState >= 2) {
      const t = performance.now()
      if (v.currentTime !== lastVideoTime) {
        lastVideoTime = v.currentTime
        try {
          const res = landmarker.detectForVideo(v, t)
          const lm = res.landmarks && res.landmarks[0] ? res.landmarks[0] : null
          emit('result', lm, res)
        } catch (e) {
          emit('error', e)
        }
      }
    }
    rafId = requestAnimationFrame(loop)
  }

  return {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return this },
    async start(videoEl) {
      video = videoEl
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      video.srcObject = stream
      await video.play()
      running = true
      lastVideoTime = -1
      loop()
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
      const s = video?.srcObject
      if (s) s.getTracks().forEach((t) => t.stop())
      if (video) video.srcObject = null
    },
    get isRunning() { return running },
    dispose() { this.stop(); landmarker?.close?.() },
  }
}

/** 把 33 点画到 canvas 上（白骨架，命中时高亮关键点） */
export function drawPose(ctx, landmarks, w, h, { highlight = null, glow = false } = {}) {
  ctx.clearRect(0, 0, w, h)
  if (!landmarks) return
  const X = (i) => landmarks[i].x * w
  const Y = (i) => landmarks[i].y * h

  ctx.lineWidth = Math.max(2, w / 260)
  ctx.strokeStyle = glow ? 'rgba(214,197,158,0.95)' : 'rgba(255,255,255,0.78)'
  ctx.shadowColor = glow ? 'rgba(214,197,158,0.8)' : 'transparent'
  ctx.shadowBlur = glow ? 12 : 0
  ctx.beginPath()
  for (const [a, b] of BONES) {
    ctx.moveTo(X(a), Y(a))
    ctx.lineTo(X(b), Y(b))
  }
  ctx.stroke()

  ctx.shadowBlur = 0
  for (const i of KEY_POINTS) {
    const p = landmarks[i]
    if (!p) continue
    const on = highlight && highlight.includes(i)
    ctx.beginPath()
    ctx.arc(X(i), Y(i), on ? w / 90 : w / 150, 0, Math.PI * 2)
    ctx.fillStyle = on ? 'rgba(226,178,106,0.98)' : 'rgba(255,255,255,0.9)'
    ctx.fill()
  }
}
