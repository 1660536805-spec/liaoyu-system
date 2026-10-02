// MediaPipe Pose 引擎封装 —— 全部资源走本地 public/，不依赖 CDN（断网可用，对应 D5）
//
// 用法：
//   const engine = await createPoseEngine()
//   engine.on('status', (s) => {})     // 加载阶段：wasm / model / camera / ready / error
//   engine.on('result', (landmarks) => {})
//   await engine.start(videoEl, { deviceId })
//   await engine.switchDevice(videoEl, deviceId)   // 切换摄像头，不重载模型
//   engine.stop()
//
// 设计要点（都来自真机踩坑）：
//  1. 模型只加载一次，切换摄像头不重载 —— 否则每次切设备都卡 5 秒
//  2. 加载分阶段上报，用户能看到「在做什么」而不是一个孤零零的转圈
//  3. GPU delegate 失败自动退 CPU，并对部分驱动挂起做超时兜底
//  4. 设备 label 在授权前是空的（浏览器隐私策略），要用 deviceId 兜底展示

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

// 常用分辨率档位（现场按设备性能选）
export const RESOLUTIONS = [
  { id: '640x480', label: '640 × 480（最稳）', w: 640, h: 480 },
  { id: '1280x720', label: '1280 × 720（更清楚）', w: 1280, h: 720 },
  { id: '1920x1080', label: '1920 × 1080（最清楚，吃性能）', w: 1920, h: 1080 },
]

/**
 * 列出摄像头。
 * 注意：授权前 label 为空（浏览器隐私策略），故先取一次权限再枚举。
 * 但**不要重复调用** —— 每次调用都会重开一次流，若页面已持有流会触发
 * video.play() 的 AbortError（真机实测踩过）。已授权过的页面应缓存结果。
 */
let camCache = null
export async function listCameras({ force = false } = {}) {
  if (camCache && !force) return camCache
  if (!navigator.mediaDevices?.enumerateDevices) return []
  // 拿一次权限，否则 device.label 全是空字符串
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    s.getTracks().forEach((t) => t.stop())
  } catch { /* 用户拒绝也照样枚举，只是 label 为空 */ }
  const devs = await navigator.mediaDevices.enumerateDevices()
  camCache = devs
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      // label 空的用序号兜底，避免下拉框出现空白项
      label: d.label || `摄像头 ${i + 1}`,
      groupLabel: d.groupLabel || '',
      hasLabel: !!d.label,
    }))
  return camCache
}

/** 切换设备/权限变化后调用，下次 listCameras 会重新枚举 */
export function invalidateCameraCache() { camCache = null }

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} 超时 ${ms}ms`)), ms)),
  ])
}

export async function createPoseEngine({ numPoses = 1, delegate = 'GPU', timeoutMs = 20000 } = {}) {
  let landmarker = null
  let running = false
  let rafId = 0
  let video = null
  let currentStream = null
  let currentDeviceId = null
  const listeners = { result: [], error: [], status: [] }
  let lastVideoTime = -1

  const emit = (evt, ...a) => (listeners[evt] || []).forEach((fn) => { try { fn(...a) } catch (e) { console.error(e) } })
  const status = (stage, detail) => {
    console.log(`[pose] ${stage}${detail ? ' · ' + detail : ''}`)
    emit('status', { stage, detail })
  }

  // ---------- 阶段 1：加载 wasm ----------
  status('wasm', '读取本地推理运行时')
  const fileset = await withTimeout(FilesetResolver.forVisionTasks(WASM_PATH), timeoutMs, 'wasm 加载')

  // ---------- 阶段 2：加载模型 ----------
  const mkOpts = (d) => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: d },
    runningMode: 'VIDEO',
    numPoses,
    // 阈值比默认值略低：真机上远处/暗光时关键点 visibility 偏低（实测腕 0.47）
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  })

  status('model', '加载姿态模型（约 5.5MB，本地文件）')
  try {
    landmarker = await withTimeout(
      PoseLandmarker.createFromOptions(fileset, mkOpts(delegate)), timeoutMs, '模型加载')
    status('model', `就绪（${delegate}）`)
  } catch (e) {
    // GPU 不可用/驱动挂起时退回 CPU
    console.warn('[pose] GPU 初始化失败，退回 CPU：', e?.message || e)
    status('model', 'GPU 不可用，改用 CPU')
    landmarker = await withTimeout(
      PoseLandmarker.createFromOptions(fileset, mkOpts('CPU')), timeoutMs * 1.5, '模型加载(CPU)')
    status('model', '就绪（CPU）')
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

  /** 打开摄像头并挂到 video 上 */
  async function openCamera(videoEl, { deviceId = null, width = 640, height = 480, facingMode = null } = {}) {
    status('camera', deviceId ? '打开所选摄像头' : '打开默认摄像头')
    const constraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } }
        : { facingMode: facingMode || 'user', width: { ideal: width }, height: { ideal: height } },
    }
    // 换设备时先把旧的停掉，否则有些设备抢不到
    if (currentStream) { currentStream.getTracks().forEach((t) => t.stop()); currentStream = null }
    currentStream = await withTimeout(navigator.mediaDevices.getUserMedia(constraints), 15000, '摄像头打开')
    const track = currentStream.getVideoTracks()[0]
    currentDeviceId = track?.getSettings?.().deviceId ?? deviceId
    videoEl.srcObject = currentStream
    await videoEl.play()
    // 等真正有画面（readyState>=2 且有尺寸），否则 videoWidth 会是 0
    if (videoEl.readyState < 2 || !videoEl.videoWidth) {
      await new Promise((res) => {
        const t = setTimeout(res, 4000)
        videoEl.addEventListener('loadeddata', () => { clearTimeout(t); res() }, { once: true })
      })
    }
    status('ready', `${videoEl.videoWidth}×${videoEl.videoHeight}`)
    return {
      deviceId: currentDeviceId,
      label: track?.label || '',
      width: videoEl.videoWidth,
      height: videoEl.videoHeight,
    }
  }

  return {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return this },

    async start(videoEl, opts = {}) {
      video = videoEl
      const info = await openCamera(videoEl, opts)
      running = true
      lastVideoTime = -1
      loop()
      return info
    },

    /** 切换摄像头：只换流，不重载模型（重载要 5 秒，现场不能接受） */
    async switchDevice(videoEl, deviceId, opts = {}) {
      const wasRunning = running
      running = false
      cancelAnimationFrame(rafId)
      const info = await openCamera(videoEl, { ...opts, deviceId })
      if (wasRunning) { running = true; lastVideoTime = -1; loop() }
      return info
    },

    /** 只改分辨率（同一设备，不重开流） */
    async setResolution(videoEl, w, h) {
      const track = currentStream?.getVideoTracks()[0]
      if (!track) return null
      try {
        await track.applyConstraints({ width: { ideal: w }, height: { ideal: h } })
      } catch (e) {
        console.warn('[pose] 应用分辨率约束失败：', e?.message || e)
        return null
      }
      return {
        width: track.getSettings().width ?? videoEl.videoWidth,
        height: track.getSettings().height ?? videoEl.videoHeight,
      }
    },

    stop() {
      running = false
      cancelAnimationFrame(rafId)
      if (currentStream) { currentStream.getTracks().forEach((t) => t.stop()); currentStream = null }
      if (video) video.srcObject = null
    },

    get isRunning() { return running },
    get deviceId() { return currentDeviceId },
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
