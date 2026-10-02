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
import { createLandmarkCleaner } from './cleaner.js'

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

/**
 * 头部 11 点（MediaPipe Pose 全部头部关键点）
 * 【为什么要多几个点】原先只用「鼻 + 双眼」三点判转头，实测两个问题：
 *   ① 鼻子只有一个，转头时若鼻子投影不明显（正侧面转 90°）就完全测不出
 *   ② 无法区分「头在转」与「整个身体在转」
 * 补上双耳（7/8）与双口（9/10）后：
 *   · 耳间距变化 → 侧面程度（头转 90° 时两耳前后重叠，耳距投影最小）
 *   · 鼻相对双耳中点的偏移 → 头部朝向角
 *   · 眼/口连线与双耳连线的夹角 → 头部 yaw（左右转）
 */
export const HEAD_POINTS = {
  NOSE: 0,
  L_EYE_IN: 1, L_EYE: 2, L_EYE_OUT: 3,
  R_EYE_IN: 4, R_EYE: 5, R_EYE_OUT: 6,
  L_EAR: 7, R_EAR: 8,
  L_MOUTH: 9, R_MOUTH: 10,
}
// 头部可见性门槛：头部点普遍比躯干不稳定（易被手/头发遮挡），单独设阈值
export const HEAD_VIS_MIN = 0.35

// 取景比例档位。视频用 object-fit: contain 完整显示（绝不裁人体），
// 容器比例只决定「画面在屏幕里占多高」，比例越接近视频源比例黑边越少。
//   - 9:16 最竖，像手机竖屏，但 4:3 源会留较多上下黑边
//   - 3:4 折中（默认），兼顾竖向感与画面大小
//   - 1:1 方幅，黑边最少但偏方
//   - 1.33 跟随 4:3 源，零黑边但横向
export const FRAMES = [
  { id: '9:16', label: '9 : 16（最竖屏，黑边较多）', ratio: 9 / 16 },
  { id: '3:4', label: '3 : 4（竖屏折中，推荐）', ratio: 3 / 4 },
  { id: '1:1', label: '1 : 1（方幅，画面较大）', ratio: 1 },
  { id: 'source', label: '跟随摄像头原始比例（无黑边）', ratio: 0 },  // 0 = 按视频源
]

export const FRAME_HINT = {
  '9:16': '画面最贴近手机竖屏，人看起来最「高」，但摄像头是 4:3 时上下会有黑边。',
  '3:4': '竖向取景且画面够大，建议现场用这个。要看全身时人在镜头前站远一点。',
  '1:1': '画面占比最大，黑边少，但视角偏方。',
  source: '完全贴合摄像头原始比例，不会浪费画面，但 4:3 摄像头下会变横向。',
}

// 常用分辨率档位（现场按设备性能选）
// 优先用传感器原生比例（4:3），再靠 CSS contain 整幅显示。
// 强推 16:9 会让部分驱动做信箱式降采样，损失有效像素。
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
  const cleaner = createLandmarkCleaner()   // 出画/低置信点保护（真机实测驱动）

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
          const raw = res.landmarks && res.landmarks[0] ? res.landmarks[0] : null
          // 净化：剔除越界/低置信点，冻结其坐标；整帧不可用时返回 null
          const lm = raw ? cleaner.clean(raw) : null
          // worldLandmarks：3D 米制坐标，原点在髋中心。
          // 这是判断「正对 / 侧身 / 背对」的关键 —— 2D 投影无法区分前后，
          // 因为背对时左右也会镜像、投影看起来几乎一样。
          const world = res.worldLandmarks && res.worldLandmarks[0] ? res.worldLandmarks[0] : null
          emit('result', lm, world, res)
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
    get cleanStats() { return cleaner.stats },
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
