<template>
  <div class="wrap train">
    <div class="topbar">
      <button class="btn ghost sm" @click="quit">← 退出</button>
      <div class="prog">{{ doneCount }} / {{ totalMoves }}</div>
      <div class="spacer"></div>
      <div class="mode">{{ style.name }}{{ freeMode ? ' · 自由练习' : '' }}</div>
      <CamSettings
        ref="settings"
        :threshold="cfg.threshold"
        :hold-frames="cfg.holdFrames"
        :reset-tick="resetTick"
        @device="onSwitchDevice"
        @resolution="onSwitchRes"
        @frame="cfg.frameId = $event; sizeCanvas()"
        @threshold="cfg.threshold = $event"
        @hold-frames="cfg.holdFrames = $event"
        @mirror="mirror = $event"
        @reset-all="resetCfg"
      />
    </div>

    <div class="stage">
      <video ref="video" class="video" :class="{ flip: mirror }" playsinline muted autoplay></video>
      <canvas ref="canvas" class="overlay"></canvas>

      <!-- 取景引导框：定位到视频实际显示区（contain 的信箱区）内 -->
      <div class="guide" v-if="showGuide" :style="guideStyle">
        <div class="guide-tip">{{ guideText }}</div>
      </div>

      <div v-if="loading" class="mask">
        <div class="spinner"></div>
        <div class="mask-txt">{{ loading }}</div>
        <!-- 分阶段进度：让用户知道在做什么，而不是一个孤零零的转圈 -->
        <div class="steps">
          <div v-for="s in STEPS" :key="s.id" class="step" :class="s.cls">
            <span class="dot"></span><span class="step-txt">{{ s.label }}</span>
          </div>
        </div>
      </div>
      <div v-if="err" class="mask err">
        <div class="mask-txt">{{ err }}</div>
        <button class="btn" @click="retry">重试</button>
        <button class="btn ghost" @click="manualMode">改用手动模式继续</button>
        <button class="btn ghost" @click="$router.push('/')">返回首页</button>
      </div>
      <div v-else-if="!landmarksSeen" class="hint">站到镜头前，让上半身和双手完整入镜</div>

      <!-- 实时可见度诊断 -->
      <div class="diag" :class="{ bad: vis.bad }">{{ vis.text }}</div>
      <div class="cam-tag" v-if="camLabel">📷 {{ camLabel }}</div>
    </div>

    <!-- 七弦弦位 -->
    <div class="strings">
      <div
        v-for="s in 7" :key="s"
        class="string"
        :class="{ lit: litStrings.includes(s), target: currentMove?.stringIndex === s }"
      >
        <span class="sn">{{ s }}</span>
        <span class="bar"></span>
      </div>
    </div>

    <!-- 当前式 -->
    <div class="cur" v-if="!finished">
      <div class="cur-idx">第 {{ (stepIdx + 1) }} 式</div>
      <div class="cur-name">{{ currentMove?.name }}</div>
      <div class="cur-cue">{{ currentMove?.cue }}</div>
      <div class="gauge">
        <div class="gauge-fill" :style="{ width: (liveScore * 100).toFixed(0) + '%' }"></div>
        <div class="gauge-mark" :style="{ left: (cfg.threshold * 100).toFixed(0) + '%' }"></div>
      </div>
      <div class="gauge-tip">做到位即响，无需倒数 · 阈值 {{ cfg.threshold.toFixed(2) }}</div>
    </div>

    <!-- 完成 -->
    <div class="done" v-else>
      <div class="done-title">一曲完成</div>
      <div class="done-sub">八式俱毕 · 七弦和鸣</div>
      <div class="done-actions">
        <button class="btn primary" @click="$router.push('/record')">查看记录</button>
        <button class="btn" @click="restart">再来一遍</button>
        <button class="btn ghost" @click="$router.push('/')">返回首页</button>
      </div>
    </div>

    <div class="footbar">
      <button class="btn sm ghost" @click="skip">
        {{ landmarksSeen ? '跳过本式（兜底）' : '点一下也算响（摄像头不可用）' }}
      </button>
      <button class="btn sm ghost" @click="freeMode = !freeMode; resetStep()">
        {{ freeMode ? '切回跟练' : '自由练习' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getStyle, resolveStyle } from '../data/styles'
import { createPoseEngine, drawPose, KEY_POINTS, listCameras, RESOLUTIONS, FRAMES } from '../engine/poseEngine'
import { MoveJudge, NAMES, THRESHOLD } from '../engine/judge'
import { pluck, chordAll, unlockAudio } from '../engine/guqin'
import { saveRecord } from '../stores/records'
import CamSettings from '../components/CamSettings.vue'

const route = useRoute()
const router = useRouter()
const video = ref(null)
const canvas = ref(null)
const settings = ref(null)

const loading = ref('正在准备…')
const err = ref('')
const landmarksSeen = ref(false)
const finished = ref(false)
const freeMode = ref(false)
const mirror = ref(true)
const camLabel = ref('')

// 可调参数：现场用设置面板改，不必动代码
const cfg = reactive({ threshold: THRESHOLD, holdFrames: 10, resId: RESOLUTIONS[0].id, frameId: FRAMES[1].id })
const resetTick = ref(0)
function resetCfg() {
  cfg.threshold = THRESHOLD
  cfg.holdFrames = 10
  cfg.resId = RESOLUTIONS[0].id
  cfg.frameId = FRAMES[1].id
  mirror.value = true
  resetTick.value++
  sizeCanvas()
}

// ---- 加载阶段：让「正在加载」有进度可看 ----
const STAGE_ORDER = [
  { id: 'wasm', label: '读取推理运行时' },
  { id: 'model', label: '加载姿态模型' },
  { id: 'camera', label: '打开摄像头' },
  { id: 'ready', label: '就绪' },
]
const stageNow = ref('')
const STEPS = computed(() => {
  const idx = STAGE_ORDER.findIndex((s) => s.id === stageNow.value)
  return STAGE_ORDER.map((s, i) => ({
    ...s,
    cls: idx < 0 ? '' : i < idx ? 'done' : i === idx ? 'now' : 'todo',
  }))
})

const stepIdx = ref(0)          // 当前第几式（0~7）
const doneSet = ref(new Set())  // 已完成的式
const litStrings = ref([])      // 当前亮起的弦
const liveScore = ref(0)        // 当前式实时分 0~1

let engine = null
let judge = null
let rafUI = 0
let lastLitClear = 0
let loadTimer = 0

// 拳种：由首页 ?style= 指定，未指定则取第一个已就绪的
const style = computed(() => getStyle(resolveStyle(route.query.style)) || getStyle('baduanjin'))
const moves = computed(() => style.value.moves)
const totalMoves = computed(() => moves.value.length || 8)
const currentMove = computed(() => moves.value[stepIdx.value])
const doneCount = computed(() => doneSet.value.size)

// ---- 取景诊断：实时算关键点可见度，据此给引导 ----
// 真机实测（2026-10-02）：近距离时膝/踝 visibility≈0.02，肩/肘/腕≈1.0。
// 判定器已改为上半身可判，但站太近会让上半身占比过小、抖动变大，故仍要给距离提示。
const vis = reactive({ text: '', bad: false })
const showGuide = ref(true)
const guideText = ref('')

function updateDiag(landmarks) {
  if (!landmarks || landmarks.length < 29) {
    vis.text = '未检测到人体'
    vis.bad = true
    guideText.value = '站到镜头前，让上半身和双手完整入镜'
    return
  }
  const v = (i) => landmarks[i]?.visibility ?? 0
  const up = (v(11) + v(12) + v(13) + v(14) + v(15) + v(16)) / 6      // 上半身
  const low = (v(25) + v(26) + v(27) + v(28)) / 4                    // 下半身
  // 肩宽占画面比例：太小说明站太远，太大说明太近
  const shoW = Math.hypot(landmarks[11].x - landmarks[12].x, landmarks[11].y - landmarks[12].y)
  vis.text = `上半身 ${(up * 100).toFixed(0)}% · 下半身 ${(low * 100).toFixed(0)}% · 取景 ${(shoW * 100).toFixed(0)}%`

  if (up < 0.55) {
    vis.bad = true
    guideText.value = '光线不足或离得太远，请靠近一些并面向光源'
  } else if (shoW > 0.42) {
    vis.bad = true
    guideText.value = '离得太近了，请退后一步，让双手完整入镜'
  } else if (low < 0.25) {
    vis.bad = false
    guideText.value = '上半身已够用（八式判定不依赖腿脚），可退后一步让画面更稳'
  } else {
    vis.bad = false
    guideText.value = '取景良好，双手自然张开即可'
  }
}

function resetStep() {
  liveScore.value = 0
  if (judge) judge.reset()
  // 顺序模式：只判当前式；自由模式：8 式全开 + 仲裁
  judge = new MoveJudge({
    holdFrames: cfg.holdFrames,
    threshold: cfg.threshold,
    order: freeMode.value ? null : stepIdx.value,
  })
}

// 配置变更后重建判定器（阈值/保持帧数是构造参数，改完要 new）
watch(() => [cfg.threshold, cfg.holdFrames, freeMode.value], () => resetStep())

async function init() {
  err.value = ''
  loading.value = '正在准备…'
  stageNow.value = 'wasm'
  clearTimeout(loadTimer)
  // 兜底：25s 还没就绪就明说，避免无限转圈
  loadTimer = setTimeout(() => {
    if (loading.value) {
      err.value = '加载超时（25 秒）。可能是首次访问需要读取 16MB 本地模型，或显卡驱动卡住了 MediaPipe。请点「重试」，或换用 Edge 浏览器再试。'
      loading.value = ''
    }
  }, 25000)

  try {
    engine = await createPoseEngine()
    engine.on('error', (e) => { console.error('[pose]', e) })
    engine.on('result', onResult)
    engine.on('status', ({ stage, detail }) => {
      stageNow.value = stage
      if (stage === 'wasm') loading.value = '正在加载本地推理运行时…'
      else if (stage === 'model') loading.value = '正在加载姿态模型（本地 5.5MB）…'
      else if (stage === 'camera') loading.value = '正在打开摄像头…'
      else if (stage === 'ready') loading.value = '正在启动识别…'
      if (detail) console.log('[stage]', stage, detail)
      if (stage === 'ready' && detail) {
        const m = /(\d+)×(\d+)/.exec(detail)
        if (m) settings.value?.setActual(`${m[1]}×${m[2]}`)
      }
    })

    await nextTick()

    // 优先用上次选过的设备（localStorage），现场换设备后不用重新选
    const saved = safeGet('xianyang.deviceId')
    const cams = await listCameras()
    const useId = cams.find((c) => c.deviceId === saved)?.deviceId
      || cams.find((c) => c.hasLabel)?.deviceId
      || cams[0]?.deviceId
      || null
    const r = RESOLUTIONS.find((x) => x.id === cfg.resId) || RESOLUTIONS[0]
    const info = await engine.start(video.value, { deviceId: useId, width: r.w, height: r.h })
    camLabel.value = info.label || (cams.find((c) => c.deviceId === info.deviceId)?.label ?? '摄像头')
    if (info.deviceId) safeSet('xianyang.deviceId', info.deviceId)

    clearTimeout(loadTimer)
    loading.value = ''
    stageNow.value = 'ready'
    resetStep()
    // 摄像头就绪后再填下拉框（复用已授权的设备列表，不再请求权限）
    settings.value?.refresh()
    // 等一帧让 stage 完成布局再定 canvas 尺寸，否则拿到 0
    requestAnimationFrame(sizeCanvas)
    setTimeout(sizeCanvas, 120)
    window.addEventListener('resize', sizeCanvas)
    uiLoop()
  } catch (e) {
    clearTimeout(loadTimer)
    console.error(e)
    const s = e?.name + ' ' + e?.message
    err.value = /NotAllowed|Permission/i.test(s)
      ? '摄像头未授权。请在浏览器地址栏左侧的权限图标里允许摄像头，然后点「重试」。'
      : /NotFound|Requested device/i.test(s)
      ? '没有找到可用的摄像头。请检查设备连接，或在设置里换一个设备。'
      : '初始化失败：' + (e?.message || e)
    loading.value = ''
  }
}

function safeGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function safeSet(k, v) { try { localStorage.setItem(k, v) } catch { /* file:// 下不可写，忽略 */ } }

function retry() { engine?.dispose(); engine = null; init() }

// ---- 切换摄像头 / 分辨率（不重载模型）----
async function onSwitchDevice(deviceId) {
  if (!engine || !deviceId) return
  camLabel.value = '切换中…'
  const r = RESOLUTIONS.find((x) => x.id === cfg.resId) || RESOLUTIONS[0]
  try {
    const info = await engine.switchDevice(video.value, deviceId, { width: r.w, height: r.h })
    safeSet('xianyang.deviceId', deviceId)
    camLabel.value = info.label || deviceId.slice(0, 8)
    settings.value?.setActual(`${info.width}×${info.height}`)
    requestAnimationFrame(sizeCanvas)
  } catch (e) {
    camLabel.value = '切换失败'
    console.error('[pose] 切换摄像头失败', e)
  }
}

async function onSwitchRes(resId) {
  cfg.resId = resId
  if (!engine) return
  const r = RESOLUTIONS.find((x) => x.id === resId)
  if (!r) return
  const out = await engine.setResolution(video.value, r.w, r.h)
  if (out) { settings.value?.setActual(`${out.width}×${out.height}`); requestAnimationFrame(sizeCanvas) }
}

onMounted(() => {
  unlockAudio()               // 由用户手势触发，解锁音频
  init()
})

onBeforeUnmount(() => {
  clearTimeout(loadTimer)
  cancelAnimationFrame(rafUI)
  window.removeEventListener('resize', sizeCanvas)
  engine?.dispose()
})

function sizeCanvas() {
  const c = canvas.value
  if (!c) return
  const stage = c.parentElement
  const v = video.value
  const vw = v?.videoWidth || 4, vh = v?.videoHeight || 3
  // 取景比例：优先用户在设置面板选的档位；「跟随源」则用视频真实比例
  const f = FRAMES.find((x) => x.id === cfg.frameId) || FRAMES[1]
  const ar = f.ratio > 0 ? f.ratio : vw / vh
  stage.style.setProperty('--stage-ar', String(ar))
  const w = stage.clientWidth || 640, h = stage.clientHeight || 480
  c.width = w; c.height = h
  // video 是 object-fit: contain，实际显示区为信箱区；
  // 骨架与取景框按同一区域换算，否则与人体错位（真机踩过）。
  const scale = Math.min(w / vw, h / vh)
  const dispW = vw * scale, dispH = vh * scale
  fitBox = { x: (w - dispW) / 2, y: (h - dispH) / 2, w: dispW, h: dispH }
  guideStyle.value = {
    left: fitBox.x + 'px', top: fitBox.y + 'px',
    width: dispW + 'px', height: dispH + 'px',
  }
}
let fitBox = { x: 0, y: 0, w: 1, h: 1 }
const guideStyle = ref({ left: '0px', top: '0px', width: '100%', height: '100%' })

function onResult(landmarks) {
  if (!judge) return
  lastLandmarks = landmarks
  if (landmarks) landmarksSeen.value = true
  // 摄像头真实分辨率就绪后重算一次 fitBox（contain 的实际显示区）
  const v = video.value
  if (v && v.videoWidth && fitSize !== `${v.videoWidth}x${v.videoHeight}`) {
    fitSize = `${v.videoWidth}x${v.videoHeight}`
    sizeCanvas()
  }
  const hits = judge.update(landmarks)
  liveScore.value = judge.lastScores[stepIdx.value] ?? 0
  // 每 10 帧更新一次诊断，避免每帧重算文字
  if (++diagTick % 10 === 0) updateDiag(landmarks)
  for (const h of hits) onHit(h.index)
}
let diagTick = 0
let fitSize = ''

function onHit(i) {
  const mv = moves.value[i]
  doneSet.value = new Set([...doneSet.value, i])

  if (mv.chord) {
    chordAll()                                   // 收势：七弦齐鸣和声
    litStrings.value = [1, 2, 3, 4, 5, 6, 7]
  } else {
    pluck(mv.stringIndex)                        // 拨响对应琴弦
    litStrings.value = [mv.stringIndex]
  }
  lastLitClear = performance.now()

  if (!freeMode.value) {
    if (i === totalMoves.value - 1 || doneSet.value.size >= totalMoves.value) finish()
    else if (i === stepIdx.value) advance()
  }
}

function advance() {
  stepIdx.value = Math.min(totalMoves.value - 1, stepIdx.value + 1)
  resetStep()
}

function finish() {
  finished.value = true
  engine?.stop()
  saveRecord({ moves: [...doneSet.value], names: NAMES.filter((_, i) => doneSet.value.has(i)) })
}

function skip() {                 // 三级兜底之一：跳过本式也算完成
  const i = stepIdx.value
  const mv = moves.value[i]
  if (!mv) return
  doneSet.value = new Set([...doneSet.value, i])
  if (mv.chord) chordAll(); else pluck(mv.stringIndex)
  litStrings.value = mv.chord ? [1, 2, 3, 4, 5, 6, 7] : [mv.stringIndex]
  lastLitClear = performance.now()
  if (stepIdx.value >= totalMoves.value - 1) finish(); else advance()
}

function restart() {
  doneSet.value = new Set()
  stepIdx.value = 0
  finished.value = false
  landmarksSeen.value = false
  litStrings.value = []
  resetStep()
  // 引擎若被手动模式停掉了，这里重新拉起（不重载模型）
  if (engine && !engine.isRunning) init()
  else if (!engine) location.reload()
}

function manualMode() {          // 三级兜底之三：关摄像头，改为点按触发
  engine?.stop()
  err.value = ''
  stepIdx.value = 0
  resetStep()
  finished.value = false
  landmarksSeen.value = true
  camLabel.value = '手动模式'
}

function quit() { engine?.dispose(); router.push('/') }

// 绘制循环：骨架 + 弦位余晖
function uiLoop() {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (ctx && c) {
    const w = c.width, h = c.height
    ctx.clearRect(0, 0, w, h)
    if (lastLandmarks) {
      ctx.save()
      // 只在实际显示区域（fitBox）内绘制，坐标系与 video 的 contain 结果对齐
      ctx.translate(fitBox.x, fitBox.y)
      // 镜像时同步翻转；scaleX(-1) 后需平移整个宽度，才能落在 fitBox 内
      if (mirror.value) { ctx.translate(fitBox.w, 0); ctx.scale(-1, 1) }
      drawPose(ctx, lastLandmarks, fitBox.w, fitBox.h, {
        highlight: liveScore.value > cfg.threshold * 0.55 ? KEY_POINTS : null,
        glow: liveScore.value >= cfg.threshold,
      })
      ctx.restore()
    }
  }
  if (performance.now() - lastLitClear > 900 && litStrings.value.length) litStrings.value = []
  rafUI = requestAnimationFrame(uiLoop)
}

let lastLandmarks = null
</script>

<style scoped>
.train { height: 100%; }
.topbar { padding: 10px 14px; }
.prog { font-size: 15px; color: var(--jin); font-family: var(--font-ui); }
.mode { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }
.btn.sm { padding: 7px 12px; font-size: 12px; }

/* 竖版取景。
   原设计有两个 bug（真机截图暴露）：
   ① object-fit: cover —— 把画面左右裁掉，视觉上「只剩上半身」
   ② aspect-ratio 写死 3/4 —— 与 4:3 视频源不匹配，浪费 44% 画面高度
   现方案：
   · object-fit: contain —— 整幅画面完整显示，绝不裁人体
   · 容器比例由 JS 按视频真实比例设定（--stage-ar），只在「明显竖向」时锁定竖屏
   · 高宽都不撑满，居中留边，保证任何摄像头都能看到完整画面 */
.stage {
  position: relative; flex: 0 1 auto; min-height: 0;
  aspect-ratio: var(--stage-ar, 0.75);  /* 取景比例，由设置面板控制（竖屏诉求，默认 3:4） */
  height: min(100%, 66vh);
  width: auto; max-width: 100%;
  align-self: center;
  background: #000; border-radius: var(--r-m); overflow: hidden;
  box-shadow: 0 0 0 1px rgba(232, 224, 208, .06);
}
/* 窄屏（手机竖持）：宽度主导，撑满可用宽度 */
@media (max-width: 560px) {
  .stage { width: 100%; height: auto; }
}

.video, .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
.video { object-fit: contain; opacity: .88; }
.overlay { object-fit: contain; pointer-events: none; }
.video.flip { transform: scaleX(-1); }   /* 镜像：照镜子直觉 */

/* 加载阶段进度：4 步，让用户知道卡在哪 */
.steps { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.step { display: flex; align-items: center; gap: 9px; font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(232,224,208,.18); flex: 0 0 auto; }
.step.done { color: var(--xuan-dim); }
.step.done .dot { background: var(--jin); }
.step.now { color: var(--xuan); }
.step.now .dot { background: var(--zhu); animation: pulse 1.1s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }

.cam-tag {
  position: absolute; right: 8px; top: 8px;
  font-size: 10px; color: rgba(232,224,208,.5); font-family: var(--font-ui);
  background: rgba(10, 8, 6, .5); padding: 2px 7px; border-radius: 10px;
  pointer-events: none; max-width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* 取景引导框：虚线框提示「双手放这里面」 */
/* 引导框：位置由 JS 按视频实际显示区（contain 信箱区）算出，用 inline style 定位 */
.guide { position: absolute; pointer-events: none; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 10px; }
.guide-tip {
  position: relative; font-size: 11.5px; color: var(--jin);
  background: rgba(10, 8, 6, .72); padding: 5px 12px; border-radius: 20px;
  font-family: var(--font-ui); text-align: center; padding-inline: 12px;
}

.diag {
  position: absolute; left: 8px; top: 8px;
  font-size: 10px; color: rgba(232, 224, 208, .45); font-family: var(--font-ui);
  background: rgba(10, 8, 6, .5); padding: 2px 7px; border-radius: 10px;
  pointer-events: none; font-variant-numeric: tabular-nums;
}
.diag.bad { color: #e8a08a; }

.mask { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(10,8,6,.88); }
.mask-txt { font-size: 14px; color: var(--xuan-dim); font-family: var(--font-ui); text-align: center; padding: 0 24px; line-height: 1.7; }
.mask.err { gap: 12px; }
.spinner { width: 34px; height: 34px; border: 2px solid rgba(232,224,208,.15); border-top-color: var(--zhu); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.hint { position: absolute; left: 0; right: 0; bottom: 58px; text-align: center; font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); }

.strings { display: flex; gap: 6px; padding: 14px 16px 6px; }
.string { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.sn { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }
.bar { width: 100%; height: 4px; border-radius: 2px; background: rgba(232,224,208,.12); transition: all .12s; }
.string.target .bar { background: rgba(232,224,208,.26); }
.string.target .sn { color: var(--xuan-dim); }
.string.lit .bar { background: var(--jin); box-shadow: 0 0 12px var(--jin); height: 6px; }
.string.lit .sn { color: var(--jin); }

.cur { padding: 10px 18px 4px; text-align: center; }
.cur-idx { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); letter-spacing: 2px; }
.cur-name { font-size: 25px; letter-spacing: 3px; margin: 6px 0 8px; }
.cur-cue { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.8; font-family: var(--font-ui); padding: 0 10px; }
.gauge { position: relative; height: 6px; border-radius: 3px; background: rgba(232,224,208,.1); margin: 14px auto 0; max-width: 320px; overflow: hidden; }
.gauge-fill { height: 100%; background: linear-gradient(90deg, var(--zhu), var(--jin)); border-radius: 3px; transition: width .08s linear; }
.gauge-mark { position: absolute; top: -3px; width: 2px; height: 12px; background: rgba(232,224,208,.5); transition: left .15s; }
.gauge-tip { font-size: 10.5px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 7px; }

.done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
.done-title { font-size: 40px; letter-spacing: 10px; text-indent: 10px; color: var(--jin); text-shadow: 0 0 30px rgba(214,197,158,.3); }
.done-sub { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); letter-spacing: 2px; margin-bottom: 12px; }
.done-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.footbar { display: flex; gap: 10px; padding: 8px 16px 16px; justify-content: center; }
</style>
