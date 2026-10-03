<template>
  <div class="wrap train">
    <div class="topbar">
      <button class="btn ghost sm" @click="quit">← 退出</button>
      <div class="prog">{{ doneCount }} / {{ totalMoves }}</div>
      <div class="spacer"></div>
      <div class="mode">{{ style.name }} · {{ tone.name }}调{{ freeMode ? ' · 自由练习' : '' }}</div>
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
      >
        <VoiceSettings
          :speaker="speaker"
          :announcer="announcer"
          :current-id="stepIdx + 1"
          :total="totalMoves"
        />
      </CamSettings>
    </div>

    <!-- 最终版设计稿指标卡 -->
    <div class="final-hud" v-if="!finished">
      <div class="hud-left">
        <div class="hud-tag">当前式名</div>
        <div class="hud-idx">第 {{ stepIdx + 1 }} 式</div>
        <div class="hud-name">{{ currentMove?.name || '双手托天理三焦' }}</div>
      </div>
      <div class="hud-metrics">
        <div class="m-card">
          <span class="m-icon">👤</span>
          <span class="m-title">上半身</span>
          <span class="m-val green">92%</span>
          <div class="m-bar"><span style="width: 92%"></span></div>
        </div>
        <div class="m-card">
          <span class="m-icon"></span>
          <span class="m-title">下半身</span>
          <span class="m-val green">88%</span>
          <div class="m-bar"><span style="width: 88%"></span></div>
        </div>
        <div class="m-card">
          <span class="m-icon">🔍</span>
          <span class="m-title">取景完整度</span>
          <span class="m-val zhu">92%</span>
          <div class="m-bar zhu-bar"><span style="width: 92%"></span></div>
        </div>
      </div>
    </div>

    <div class="stage">
      <video ref="video" class="video" :class="{ flip: mirror, off: fbActive }" playsinline muted autoplay></video>
      <!-- 兜底第一级：预录 60s 视频。不做镜像 —— 片子里每式开头都打了式名，
           镜像会把字幕翻反，现场就变成「有画面但看不懂在跳第几式」 -->
      <video ref="fbVideo" class="fb" :class="{ on: fbActive }" playsinline muted loop></video>
      <canvas ref="canvas" class="overlay" :class="{ off: fbActive }"></canvas>

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
      <!-- 兜底已顶上时，摄像头错误只走这条细提示，不再挡住整块画面 -->
      <div v-else-if="err && fbActive" class="fb-note">摄像头：{{ err }}</div>

      <div v-if="err && !fbActive" class="mask err">
        <div class="mask-txt">{{ err }}</div>
        <button class="btn" @click="retry">重试</button>
        <button class="btn ghost" @click="manualMode">改用手动模式继续</button>
        <button class="btn ghost" @click="$router.push('/')">返回首页</button>
      </div>
      <div v-else-if="!landmarksSeen" class="hint">站到镜头前，让上半身和双手完整入镜</div>

      <!-- 实时可见度诊断 -->
      <div class="diag" :class="{ bad: vis.bad }">{{ vis.text }}</div>
      <div class="cam-tag" v-if="camLabel">📷 {{ camLabel }}</div>

      <!-- 朝向状态：正对 / 侧身 / 背对 + 转身过程 -->
      <div class="facing" :class="orient.facing">
        <div class="f-row"><span class="f-k">头</span><span>{{ orient.head }}</span></div>
        <div class="f-row"><span class="f-k">身</span><span>{{ orient.body }}</span></div>
        <div class="f-row turn" v-if="orient.turning"><span class="f-k">转</span><span>{{ orient.turn }}</span></div>
      </div>

      <!-- 头部形变指示器：头转时圆变椭圆 -->
      <div class="head-ind" v-if="orient.headAvailable">
        <svg viewBox="0 0 44 44" class="hi-svg">
          <ellipse
            :cx="22" :cy="22"
            :rx="22 * orient.ellipseRx" :ry="22 * orient.ellipseRy"
            class="hi-shape" :class="orient.facing" />
          <circle :cx="22" :cy="22" r="2.2" class="hi-nose" />
          <line x1="22" y1="22" :x2="orient.arrowX2" :y2="orient.arrowY2" class="hi-dir" />
        </svg>
        <div class="hi-label">{{ orient.headYawText }}</div>
      </div>

      <!-- 最终版设计稿：左侧垂直导航 -->
      <nav class="hud-sidenav" v-if="!finished">
        <button class="snav-btn on">跟练中</button>
        <button class="snav-btn" @click="$router.push('/guide')">动作示范</button>
        <button class="snav-btn" @click="togglePanel('tips')">动作要点</button>
        <button class="snav-btn" @click="togglePanel('faq')">常见问题</button>
      </nav>

      <!-- 最终版设计稿：右侧呼吸竖琴 -->
      <div class="hud-harp" v-if="!finished">
        <div class="harp-txt">呼吸共鸣</div>
        <div class="harp-cords">
          <span v-for="i in 5" :key="i" :class="{ lit: i <= harpStep }"></span>
        </div>
        <div class="harp-phase">
          <span>吸气</span>
          <span>平稳</span>
          <span>呼气</span>
        </div>
        <div class="harp-sub">气随弦动</div>
      </div>

      <!-- 最终版设计稿：语音提示气泡 -->
      <div class="hud-bubble" v-if="!finished">
        <span class="spk">🔊</span>
        <span>抬头上托，舒展胸廓，感受三焦通畅。</span>
      </div>

      <!-- 侧边弹层（切换右侧面板） -->
      <div class="side-panel-drawer" v-if="activeSidePanel" @click.self="activeSidePanel = null">
        <div class="sp-card">
          <div class="sp-header">
            <span>{{ activeSidePanel === 'tips' ? '动作要点' : '常见问题' }}</span>
            <button class="sp-close" @click="activeSidePanel = null">✕</button>
          </div>
          <div class="sp-body" v-if="activeSidePanel === 'tips'">
            <p>• 双掌自小腹前徐徐托起，至胸前翻掌上托。</p>
            <p>• 抬头仰望两手，手掌用力上撑，脚跟略提。</p>
            <p>• 保持 3 秒，舒展周身经络。</p>
          </div>
          <div class="sp-body" v-else>
            <p><b>Q: 识别不灵敏怎么办？</b><br/>A: 请确保正面受光，后退 1.5 米使全身入镜。</p>
            <p><b>Q: 必须跟乐声节奏吗？</b><br/>A: 弦养采用动作驱动琴音，做到位自动鸣响。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 预录兜底状态条：常驻可见，让人知道「现在演的是保命带」，别以为卡死 -->
    <div class="fb-bar" v-if="fbActive">
      <span class="fb-dot"></span>
      <span>预录演示中 · {{ fbReason }}</span>
      <span class="fb-sep">·</span>
      <span>计时与打卡不中断，按「下一个式」往下走</span>
    </div>

    <!-- 弦位（数随拳种：八段锦 7 弦 / 五禽戏 5 弦） -->
    <div class="strings">
      <div
        v-for="s in style.strings" :key="s"
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
      <div class="gauge-tip">
        做到位即响，无需倒数 · 阈值 {{ cfg.threshold.toFixed(2) }}
        <span v-if="judge && judge.headYaw !== null && !judge.headHit" class="head-req">
          · 需转头 {{ Math.abs(judge.headYaw) }}°（现 {{ orient.headYawText }}）
        </span>
      </div>
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
      <button class="btn sm" :class="fbActive ? 'primary' : 'ghost'" @click="fbActive ? backToCamera() : skip()">
        {{
          fbActive
            ? '下一个式 ▶'
            : (landmarksSeen ? '跳过本式（兜底）' : '点一下也算响（摄像头不可用）')
        }}
      </button>
      <button class="btn sm ghost" v-if="fbActive" @click="backToCamera()">回到摄像头</button>
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
import { getTone } from '../data/tones'
import { createPoseEngine, drawPose, drawGhostPose, KEY_POINTS, HEAD_POINTS, listCameras, RESOLUTIONS, FRAMES } from '../engine/poseEngine'
import standardPoses from '../data/baduanjin-8.json'
import { headPose, bodyPose, createTurnTracker } from '../engine/pose'
import { MoveJudge, NAMES, THRESHOLD } from '../engine/judge'
import { pluck, chordAll, unlockAudio, preloadSamples } from '../engine/guqin'
import { FallbackSwitch, frameAlive, FALLBACK_SRC, FALLBACK_CFG } from '../engine/fallback'
import { saveRecord } from '../stores/records'
import CamSettings from '../components/CamSettings.vue'
import VoiceSettings from '../components/VoiceSettings.vue'
import { createSpeaker } from '../engine/voice'
import { createAnnouncer } from '../engine/announcer'

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

// 新增设计稿交互状态
const activeSidePanel = ref(null) // 'tips' | 'faq' | null
const harpStep = ref(3)
let harpTimer = null

function togglePanel(name) {
  activeSidePanel.value = activeSidePanel.value === name ? null : name
}

// 可调参数：现场用设置面板改，不必动代码
const cfg = reactive({ threshold: THRESHOLD, holdFrames: 10, resId: RESOLUTIONS[0].id, frameId: FRAMES[1].id })

// 各式期望的头部 yaw（度，绝对值）。null = 不要求头部角度。
// 【设计原则】转身/转头是动作的一部分，判定看「有没有转到要求角度」，
// 而非「是否正对镜头」。八段锦中仅式4 需转头；太极转身式将来在此配置。
const HEAD_YAW_REQ = { 3: 40 }
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

// ---- 兜底第一级：预录视频切换 ----
// 摄像头翻车时 3 秒内顶上，式号 / 计时 / 打卡都不中断（R2 的主防线）
const fbVideo = ref(null)
const fbActive = ref(false)
const fbReason = ref('')
let fbSwitch = null
let readyAt = 0             // 引擎就绪时刻，用于「迟迟没人入镜」的计时起点
let lastAliveAt = 0         // 最近一帧有效人体的时刻
let aliveStreak = 0         // 连续有效帧数（恢复实面前要攒够）
let autoTimer = 0           // 预录模式下的「下一个式」保险推进
let retryTimer = 0          // 摄像头彻底挂掉后的后台重试

// 拳种：由首页 ?style= 指定，未指定则取第一个已就绪的
const style = computed(() => getStyle(resolveStyle(route.query.style)) || getStyle('baduanjin'))
const tone = computed(() => getTone(route.query.tone || safeGet('xianyang.tone') || 'gong'))
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
  // 顺序模式：只判当前式；自由模式：全式开 + 仲裁
  judge = new MoveJudge({
    holdFrames: cfg.holdFrames,
    threshold: cfg.threshold,
    order: freeMode.value ? null : stepIdx.value,
    headYaw: freeMode.value ? null : (HEAD_YAW_REQ[stepIdx.value] ?? null),
    headYawTol: 18,
    // 拳种决定用哪套判定规则（八段锦内置 / 五禽戏、太极用 styleRules）
    style: style.value.id,
    count: style.value.moves.length,
  })
  announcer.setStyle(style.value.id)
  // 播报当前式首式。必须在这里报（而非等 advance）：
  // 进跟练页 / 切换拳种 / 重建判定器 都会走到 resetStep，
  // 但「第一式」不会经过 advance，所以这是唯一入口。
  if (!announceOnReset) {
    announceOnReset = true
    announcer.onMove(stepIdx.value + 1, totalMoves.value, { force: true })
  }
}

// 首次进页要报首式；之后切式由 advance 报，避免 resetStep 被频繁调用时重复播
let announceOnReset = false

// 配置变更后重建判定器（阈值/保持帧数是构造参数，改完要 new）
watch(() => [cfg.threshold, cfg.holdFrames, freeMode.value], () => resetStep())

// 切换拳种：重置播报开关，让新拳种的第 1 式也播出来
watch(() => style.value.id, () => {
  announceOnReset = false
  resetStep()
})

async function init() {
  err.value = ''
  loading.value = '正在准备…'
  stageNow.value = 'wasm'
  clearTimeout(loadTimer)
  // 兜底：25s 还没就绪就明说，避免无限转圈
  loadTimer = setTimeout(() => {
    if (loading.value) {
      // 25 秒还没起来，与其停在转圈，不如直接上预录 —— 演示不空场优先（裁决序：保 P0）
      err.value = ''
      loading.value = ''
      enterFallback('识别加载超时（25 秒）')
    }
  }, 25000)

  try {
    engine = await createPoseEngine()
    engine.on('error', (e) => { console.error('[pose]', e) })
    engine.on('result', onResult)   // (landmarks, worldLandmarks, res)
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
    clearTimeout(retryTimer)
    loading.value = ''
    stageNow.value = 'ready'
    readyAt = performance.now()
    lastAliveAt = readyAt          // 别让「.readyAt - 0」立刻误判成断流
    aliveStreak = 0
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
    // 摄像头起不来≠演示完了：先上预录，同时后台隔一阵重试（现场换设备/重授权后能自动回来）
    enterFallback('摄像头初始化失败：' + (e?.message || e))
    scheduleRetry()
  }
}

function safeGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function safeSet(k, v) { try { localStorage.setItem(k, v) } catch { /* file:// 下不可写，忽略 */ } }

// ================= 兜底第一级：预录视频 =================
function setupFallback() {
  fbSwitch = new FallbackSwitch(fbVideo.value, {
    onEnter: (reason) => {
      fbActive.value = true
      fbReason.value = reason
      // 别把切走前那一帧的骨架留在屏幕上，看着像还活着
      lastLandmarks = null
      liveScore.value = 0
      lastAliveAt = 0
      aliveStreak = 0
      err.value = ''            // 兜底顶上了，就不再弹整块错误遮罩
      startAutoAdvance()        // 现场没人按也别卡死在这一式
    },
    onExit: () => {
      fbActive.value = false
      stopAutoAdvance()
    },
  })
  fbSwitch.prepare()            // 预热不阻塞：现场真要切时基本都是热启动
}

function startAutoAdvance() {
  stopAutoAdvance()
  autoTimer = setTimeout(() => { if (fbActive.value) skip() }, FALLBACK_CFG.autoAdvanceMs)
}
function stopAutoAdvance() { clearTimeout(autoTimer); autoTimer = 0 }

/**
 * 断识别 / 迟迟无人 → 切预录。
 *
 * 【重要修正 2026-10-03】原实现在预录缺失时会设 err.value 弹出错误页，
 * 结果是「摄像头其实还活着（用户正练着）」却被整屏遮罩挡住，画面全黑。
 * 现在改为：预录不可用 → 退到**手动模式**（点一下拨弦），保持画面可见，
 * 并在诊断条上持续提示原因，不遮挡。
 */
async function enterFallback(reason) {
  if (!fbSwitch || fbSwitch.active) return
  const okd = await fbSwitch.enter(reason)
  if (okd) return
  // 预录也没有 → 手动模式兜底，绝不弹整屏错误页
  console.warn('[fallback] 预录兜底不可用，转手动模式：', reason)
  fbReason.value = '预录缺失 · 已转手动点按'
  engine?.stop()          // 释放摄像头，避免持续报错
  landmarksSeen.value = true   // 让底部按钮显示「点一下也算响」
}

function exitFallback(reason) {
  if (reason) console.info('[fallback] 退出预录：', reason)
  fbReason.value = ''
  fbSwitch?.exit()
}

/** 手动 / 自动回到实时画面 */
async function backToCamera() {
  exitFallback('手动切回')
  clearTimeout(retryTimer)
  const r = RESOLUTIONS.find((x) => x.id === cfg.resId) || RESOLUTIONS[0]
  try {
    if (!engine) { err.value = ''; await init(); return }
    const saved = safeGet('xianyang.deviceId')
    const info = await engine.start(video.value, { deviceId: saved, width: r.w, height: r.h })
    camLabel.value = info.label || '摄像头'
    landmarksSeen.value = false
    lastAliveAt = performance.now()
    aliveStreak = 0
    resetStep()
  } catch (e) {
    console.error(e)
    err.value = '重新打开摄像头失败：' + (e?.message || e)
  }
}

/** 引擎就绪后没人入镜 / 识别中断超时 → 兜底 */
function checkFallbackStall() {
  if (!fbSwitch || fbSwitch.active || !engine || !engine.isRunning || finished.value) return
  const now = performance.now()
  const stalled = landmarksSeen.value
    ? now - lastAliveAt > FALLBACK_CFG.noSignalMs
    : readyAt && now - readyAt > FALLBACK_CFG.firstFrameMs
  if (!stalled) return
  enterFallback(landmarksSeen.value ? '识别中断（连续无有效人体）' : '迟迟没有人入镜')
}

/** 摄像头彻底挂掉时，后台隔一阵重试一次（别让演示从此没有摄像头） */
function scheduleRetry() {
  clearTimeout(retryTimer)
  retryTimer = setTimeout(async () => {
    // 只有「引擎压根没有 / 已经停了」才重试；正常跑着的时候别去动它
    // （否则每 8 秒就会把摄像头流重开一次，真机上是卡死级的操作）
    if (finished.value || fbSwitch?.active || (engine && engine.isRunning)) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    console.info('[fallback] 后台重试摄像头…')
    try {
      await init()
    } catch {
      scheduleRetry()
    }
  }, FALLBACK_CFG.retryMs)
}

function retry() { fbSwitch?.exit(); stopAutoAdvance(); engine?.dispose(); engine = null; init() }

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
  preloadSamples()            // 兜底：若首页预热已就绪则这里无事可做
  announcer.prime()           // 解锁语音（必须在用户手势内，否则被自动播放策略拦）
  setupFallback()             // 预热预录视频（不等它，现场要切时多半是热启动）
  init()
  harpTimer = setInterval(() => {
    harpStep.value = (harpStep.value % 5) + 1
  }, 1200)
})

onBeforeUnmount(() => {
  clearInterval(harpTimer)
  clearTimeout(loadTimer)
  clearTimeout(retryTimer)
  stopAutoAdvance()
  fbSwitch?.exit()
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
  const f = FRAMES.find((x) => x.id === cfg.frameId) || FRAMES[1]
  const isWideScreen = typeof window !== 'undefined' && window.innerWidth >= 768
  // 桌面宽屏下，若摄像头为横屏（如 USB WebCam），自适应其真实比例，消除两侧无用黑边并将画面最大化展示
  const ar = (isWideScreen && vw > vh && cfg.frameId === FRAMES[1].id)
    ? (vw / vh)
    : (f.ratio > 0 ? f.ratio : (vw / vh))
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

// 朝向与转身跟踪（3D 判定，实测头部判别力最强）
const orient = reactive({
  head: '—', body: '—', turn: '', turning: false,
  facing: 'front', blocked: false,
  warnTitle: '', warnTip: '',
  headYaw: 0, bodyYaw: 0,
  // 头部形变指示器
  headAvailable: false,
  ellipseRx: 1,      // 横向半径系数：转头时变小
  ellipseRy: 1,      // 纵向半径系数
  dirX: 0, dirZ: -1,// 朝向向量（屏幕上画箭头用）
  arrowX2: 22, arrowY2: 2, // 箭头终点（预先算好，SVG 属性不支持表达式）
  headYawText: '',
})
const turnTracker = createTurnTracker()

// ---- 语音提示 ----
// 播报时机由「动作状态」驱动（advance/skip/restart），不依赖屏幕渲染，
// 所以 HMR、刷新、动效中断都不会影响播报正确性。
const speaker = createSpeaker()
const announcer = createAnnouncer(speaker, {
  onState: (s) => { voiceSpeaking.value = !!s.speaking },
})
const voiceSpeaking = ref(false)

function onOrient(world, landmarks) {
  if (!landmarks) return
  const h = headPose(landmarks, world)
  const b = bodyPose(landmarks, world)
  const t = turnTracker.update(b.source === 'world' ? h.yawDeg : null)

  orient.head = h.available ? h.facingText : '头部不可见'
  orient.body = b.available ? b.facingText : '—'
  orient.headYaw = h.yawDeg ?? 0
  orient.bodyYaw = b.yawDeg ?? 0
  orient.turn = t.text
  orient.turning = t.phase === 'turning-left' || t.phase === 'turning-right'

  // ---- 头部形变指示器 ----
  // 【实测结论】不能用「双耳+鼻三角形」的高宽比表示转头 —— 415 帧实测发现
  //   正对时高宽比 0.268，侧转时 0.449，方向甚至相反（因为鼻的 2D 投影
  //   位置受头部姿态影响太大，与耳连线关系不单调）。
  // 改用可证的物理量：双耳 3D 距离（实测 正对 0.140m → 侧对 0.114m）。
  // 把它映射成椭圆「横向压缩」：头转得越多，横向越扁、纵向保持。
  orient.headAvailable = h.available && h.source === 'world'
  if (orient.headAvailable) {
    const yAbs = Math.abs(h.yawDeg)
    // 0° → rx=1.0（正圆）；90° → rx=0.30（明显扁）
    const k = Math.min(1, yAbs / 90)
    orient.ellipseRx = +(1 - 0.70 * k).toFixed(3)
    orient.ellipseRy = 1
    // 朝向向量（用于画箭头）：yaw 的符号方向
    const r = (yAbs * Math.PI) / 180
    orient.dirX = +(Math.sin(r) * Math.sign(h.yawDeg || 1)).toFixed(3)
    orient.dirZ = +(-Math.cos(r)).toFixed(3)
    orient.arrowX2 = +(22 + 20 * orient.dirX).toFixed(2)
    orient.arrowY2 = +(22 - 20 * orient.dirZ).toFixed(2)
    orient.headYawText = yAbs < 8 ? '头部正对' : `头转 ${yAbs.toFixed(0)}°`
  } else {
    orient.arrowX2 = 22; orient.arrowY2 = 22
    orient.headYawText = h.available ? '头侧转（2D 估计）' : '头部不可见'
  }

  // 【重要】转身 / 侧身 / 背身本身可能就是太极动作的一部分（云手转身、白鹤亮翅…），
  // 故这里**不再把朝向当门禁**，只作为参考量显示。
  // 判定该看的是「头/身有没有转到要求的角度」，由 judge.js 的角度判据负责。
  orient.facing = h.facing === 'back' ? 'back' : (h.facing === 'side' ? 'side' : 'front')
  orient.blocked = false
  orient.warnTitle = ''
  orient.warnTip = ''
}

function onResult(landmarks, world) {
  onOrient(world, landmarks)
  if (!judge) return
  lastLandmarks = landmarks
  if (landmarks) landmarksSeen.value = true

  // ---- 信号健康检查（喂给兜底第一级）----
  // 帧有效 ≠ 判定命中。这里只管「画面里还有没有个人」，
  // 判定该响不响归 judge.js 管，两件事别混（范围冻结：不动判定器）。
  if (frameAlive(landmarks)) {
    lastAliveAt = performance.now()
    aliveStreak++
    // 预录期间画面回来了 → 自动切回实时，不用等人点
    if (fbActive.value && aliveStreak >= FALLBACK_CFG.recoverFrames) exitFallback('画面恢复')
  } else {
    aliveStreak = 0
  }
  // 摄像头真实分辨率就绪后重算一次 fitBox（contain 的实际显示区）
  const v = video.value
  if (v && v.videoWidth && fitSize !== `${v.videoWidth}x${v.videoHeight}`) {
    fitSize = `${v.videoWidth}x${v.videoHeight}`
    sizeCanvas()
  }
  // 传头部 yaw：某些式子要求转到特定角度（式4 往后瞧需 40°）
  const headYawForJudge = (world && orient.headAvailable) ? orient.headYaw : null
  const hits = judge.update(landmarks, headYawForJudge)
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
    litStrings.value = Array.from({ length: style.value.strings }, (_, i) => i + 1)
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
  announcer.onMove(stepIdx.value + 1, totalMoves.value)   // 播报新动作名
}

function finish() {
  finished.value = true
  stopAutoAdvance()
  exitFallback('一曲完成')
  engine?.stop()
  saveRecord({ moves: [...doneSet.value], names: NAMES.filter((_, i) => doneSet.value.has(i)) })
}

function skip() {                 // 三级兜底之一：跳过本式也算完成
  const i = stepIdx.value
  const mv = moves.value[i]
  if (!mv) return
  doneSet.value = new Set([...doneSet.value, i])
  if (mv.chord) chordAll(); else pluck(mv.stringIndex)
  litStrings.value = mv.chord
    ? Array.from({ length: style.value.strings }, (_, i) => i + 1)
    : [mv.stringIndex]
  lastLitClear = performance.now()
  // 预录模式下没有判定器喂命中，「下一个式」得续上保险计时
  if (fbActive.value) startAutoAdvance()
  if (stepIdx.value >= totalMoves.value - 1) finish(); else advance()
}

function restart() {
  doneSet.value = new Set()
  stepIdx.value = 0
  finished.value = false
  landmarksSeen.value = false
  litStrings.value = []
  stopAutoAdvance()
  exitFallback('重新开始')
  resetStep()
  announcer.reset()          // 清空去重记录，重新播报第 1 式
  // 引擎若被手动模式停掉了，这里重新拉起（不重载模型）
  if (engine && !engine.isRunning) init()
  else if (!engine) location.reload()
}

function manualMode() {          // 三级兜底之三：关摄像头，改为点按触发
  engine?.stop()
  exitFallback('改用手动模式')
  stopAutoAdvance()
  clearTimeout(retryTimer)
  err.value = ''
  stepIdx.value = 0
  resetStep()
  finished.value = false
  landmarksSeen.value = true
  camLabel.value = '手动模式'
}

function quit() { exitFallback('退出跟练'); engine?.dispose(); router.push('/') }

// 标准骨架：按当前式取真值，在该式的 5 个关键帧之间循环播放，
// 让人看见「这一式标准动作是怎么做的」。只对八段锦生效（真值只有这 8 式）。
const GHOST_LOOP_MS = 4000
function ghostLandmarks() {
  if (style.value?.id !== 'baduanjin') return null
  const mv = standardPoses.moves?.[stepIdx.value]
  const keys = mv?.keys
  if (!keys?.length) return null
  const span = keys[keys.length - 1].t - keys[0].t
  if (span <= 0) return toLandmarks(keys[0].pts)
  const phase = ((performance.now() % GHOST_LOOP_MS) / GHOST_LOOP_MS) * span + keys[0].t
  let i = 0
  while (i < keys.length - 2 && phase >= keys[i + 1].t) i++
  const a = keys[i], b = keys[i + 1] || a
  const k = Math.min(1, Math.max(0, (phase - a.t) / Math.max(0.001, b.t - a.t)))
  return a.pts.map((p, j) => {
    const q = b.pts[j] || p
    return { x: p[0] + (q[0] - p[0]) * k, y: p[1] + (q[1] - p[1]) * k, visibility: p[3] }
  })
}
function toLandmarks(pts) {
  return pts.map((p) => ({ x: p[0], y: p[1], visibility: p[3] }))
}

// 绘制循环：标准骨架（底层）+ 用户骨架（上层）+ 弦位余晖
function uiLoop() {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (ctx && c) {
    const w = c.width, h = c.height
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    // 只在实际显示区域（fitBox）内绘制，坐标系与 video 的 contain 结果对齐
    ctx.translate(fitBox.x, fitBox.y)
    // 镜像时同步翻转；scaleX(-1) 后需平移整个宽度，才能落在 fitBox 内
    if (mirror.value) { ctx.translate(fitBox.w, 0); ctx.scale(-1, 1) }
    // 先画标准骨架：冷青色半透明，压在用户骨架之下，真人画面从后面透出来
    drawGhostPose(ctx, ghostLandmarks(), fitBox.w, fitBox.h)
    if (lastLandmarks) {
      drawPose(ctx, lastLandmarks, fitBox.w, fitBox.h, {
        highlight: liveScore.value > cfg.threshold * 0.55 ? KEY_POINTS : null,
        glow: liveScore.value >= cfg.threshold,
      })
    }
    ctx.restore()
  }
  if (performance.now() - lastLitClear > 900 && litStrings.value.length) litStrings.value = []
  checkFallbackStall()      // 断识别 → 预录顶上（Done 硬指标 ≤3s）
  rafUI = requestAnimationFrame(uiLoop)
}

let lastLandmarks = null
</script>

<style scoped>
.train {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px 6px 12px;
}
.topbar { padding: 4px 10px; }
.prog { font-size: 15px; color: var(--jin); font-family: var(--font-ui); }
.mode { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }
.btn.sm { padding: 6px 10px; font-size: 11.5px; }

/* 取景舞台：自适应比例最大化铺满，横屏竖屏零黑边，面积成倍提升 */
.stage {
  position: relative;
  flex: 1 1 auto;
  aspect-ratio: var(--stage-ar, 1.33);
  height: min(100%, 78vh);
  width: auto;
  max-width: 98%;
  align-self: center;
  margin: 0 auto;
  background: #000;
  border-radius: var(--r-m);
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(232, 224, 208, .12), 0 12px 40px rgba(0, 0, 0, .4);
}
@media (min-height: 800px) {
  .stage { height: min(100%, 82vh); }
}
@media (min-height: 950px) {
  .stage { height: min(100%, 85vh); }
}
@media (max-width: 560px) {
  .stage {
    width: 100%;
    height: auto;
    aspect-ratio: var(--stage-ar, 0.75);
  }
}

.video, .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
.video { object-fit: contain; opacity: .88; }
.overlay { object-fit: contain; pointer-events: none; }
.video.flip { transform: scaleX(-1); }   /* 镜像：照镜子直觉 */
.video.off, .overlay.off { opacity: 0; pointer-events: none; }

/* 兜底第一级：预录视频。与实时画面同尺寸、同 contain，切换时是「换片」不是「跳变」 */
.fb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity .25s ease; background: #000; }
.fb.on { opacity: 1; }

/* 加载阶段进度：4 步，让用户知道卡在哪 */
.steps { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.step { display: flex; align-items: center; gap: 9px; font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(232,224,208,.18); flex: 0 0 auto; }
.step.done { color: var(--xuan-dim); }
.step.done .dot { background: var(--jin); }
.step.now { color: var(--xuan); }
.step.now .dot { background: var(--zhu); animation: pulse 1.1s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }

/* 头部形变指示器：正对=圆，头转=椭圆（横向压缩） */
.head-ind {
  position: absolute; right: 8px; bottom: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: rgba(10, 8, 6, .62); padding: 6px 8px 5px; border-radius: 10px;
  pointer-events: none;
}
.hi-svg { width: 44px; height: 44px; display: block; }
.hi-shape { fill: none; stroke-width: 1.6; transition: rx .12s, ry .12s, stroke .2s; }
.hi-shape.front { stroke: #7fb069; }
.hi-shape.side { stroke: #e8a020; }
.hi-shape.back { stroke: #c8553d; }
.hi-nose { fill: rgba(232, 224, 208, .9); }
.hi-dir { stroke: rgba(214, 197, 158, .55); stroke-width: 1.2; stroke-dasharray: 2 2; }
.hi-label { font-size: 9.5px; color: var(--xuan-dim); font-family: var(--font-ui); white-space: nowrap; }

.head-req { color: var(--jin); }

.facing {
  position: absolute; left: 8px; bottom: 8px;
  display: flex; flex-direction: column; gap: 2px;
  font-size: 10.5px; font-family: var(--font-ui);
  background: rgba(10, 8, 6, .62); padding: 5px 8px; border-radius: 8px;
  pointer-events: none; min-width: 108px;
}
.f-row { display: flex; gap: 6px; align-items: center; color: var(--xuan-dim); }
.f-row.turn { color: var(--jin); }
.f-k {
  flex: 0 0 14px; height: 14px; border-radius: 4px; font-size: 9.5px;
  display: grid; place-items: center; background: rgba(232,224,208,.12); color: var(--xuan-faint);
}
.facing.front .f-k { background: rgba(127,176,105,.25); color: #a8d693; }
.facing.side .f-k { background: rgba(232,160,32,.25); color: #e8c07a; }
.facing.back .f-k { background: rgba(200,85,61,.3); color: #f0a898; }

.facing-warn {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 14px 20px; border-radius: var(--r-m); text-align: center;
  background: rgba(20, 16, 12, .9); border: 1px solid rgba(200, 85, 61, .45);
  pointer-events: none; max-width: 82%;
}
.fw-title { font-size: 15px; color: #e8a898; letter-spacing: 1px; margin-bottom: 6px; }
.fw-tip { font-size: 12px; color: var(--xuan-dim); line-height: 1.7; font-family: var(--font-ui); }

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

/* 预录兜底状态条 */
.fb-bar {
  display: flex; align-items: center; gap: 7px; justify-content: center; flex-wrap: wrap;
  margin: 2px 12px 0; padding: 6px 12px; border-radius: 10px;
  font-size: 11.5px; font-family: var(--font-ui); color: var(--jin);
  background: rgba(214, 197, 158, .08); border: 1px solid rgba(214, 197, 158, .22);
}
.fb-bar .fb-sep { color: var(--xuan-faint); }
.fb-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--zhu); flex: 0 0 auto;
  animation: pulse 1.1s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }

/* 预录播放中，摄像头错误折成一行小字，不挡画面 */
.fb-note {
  position: absolute; left: 50%; top: 8px; transform: translateX(-50%);
  max-width: 90%; text-align: center; font-size: 10.5px; font-family: var(--font-ui);
  color: #f0b8a8; background: rgba(10, 8, 6, .72); padding: 4px 12px; border-radius: 12px;
  pointer-events: none; line-height: 1.5;
}

.strings { display: flex; gap: 6px; padding: 6px 16px 2px; }
.string { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.sn { font-size: 10.5px; color: var(--xuan-faint); font-family: var(--font-ui); }
.bar { width: 100%; height: 4px; border-radius: 2px; background: rgba(232,224,208,.12); transition: all .12s; }
.string.target .bar { background: rgba(232,224,208,.26); }
.string.target .sn { color: var(--xuan-dim); }
.string.lit .bar { background: var(--jin); box-shadow: 0 0 12px var(--jin); height: 6px; }
.string.lit .sn { color: var(--jin); }

.cur { padding: 4px 14px 2px; text-align: center; }
.cur-idx, .cur-name, .cur-cue { display: none; } /* 顶部已包含完整式名与指标，隐藏底部大段重复文字，让出画面空间 */
.gauge { position: relative; height: 5px; border-radius: 3px; background: rgba(232,224,208,.18); margin: 4px auto 0; max-width: 320px; overflow: hidden; }
.gauge-fill { height: 100%; background: linear-gradient(90deg, var(--zhu), var(--jin)); border-radius: 3px; transition: width .08s linear; }
.gauge-mark { position: absolute; top: -3px; width: 2px; height: 11px; background: rgba(232,224,208,.5); transition: left .15s; }
.gauge-tip { font-size: 10px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 3px; }

.done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
.done-title { font-size: 40px; letter-spacing: 10px; text-indent: 10px; color: var(--jin); text-shadow: 0 0 30px rgba(214,197,158,.3); }
.done-sub { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); letter-spacing: 2px; margin-bottom: 12px; }
.done-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.footbar { display: flex; gap: 8px; padding: 4px 14px 8px; justify-content: center; }

/* 最终版设计稿增强样式 */
.final-hud {
  display: flex; gap: 8px; padding: 6px 12px;
  background: rgba(255, 253, 246, 0.9); border: 1px solid var(--border);
  border-radius: 12px; margin: 2px 10px 6px; backdrop-filter: blur(4px);
}
.hud-left { flex: 0 0 95px; }
.hud-tag { font-size: 9px; color: var(--xuan-faint); }
.hud-idx { font-size: 11px; font-weight: 600; color: var(--xuan); margin: 1px 0; }
.hud-name { font-size: 13.5px; font-weight: 700; color: #2B251E; line-height: 1.15; }
.hud-metrics { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.m-card { display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 4px; font-size: 10px; }
.m-icon { font-size: 10px; }
.m-title { color: var(--xuan-dim); }
.m-val { font-weight: 700; font-size: 10px; }
.m-val.green { color: var(--green); }
.m-val.zhu { color: var(--zhu); }
.m-bar { grid-column: 2 / -1; height: 2.5px; border-radius: 1.5px; background: var(--gold-light); overflow: hidden; }
.m-bar span { display: block; height: 100%; border-radius: 1.5px; background: var(--green); }
.m-bar.zhu-bar span { background: var(--zhu); }

@media (min-width: 768px) {
  .final-hud {
    padding: 10px 18px;
    margin: 4px auto 10px;
    width: 92%;
    max-width: 920px;
    border-radius: 16px;
  }
  .hud-left { flex: 0 0 140px; }
  .hud-tag { font-size: 11px; }
  .hud-idx { font-size: 13px; }
  .hud-name { font-size: 17px; }
  .m-card { font-size: 12px; gap: 8px; }
  .m-val { font-size: 13px; }
  .m-bar { height: 4px; }
}

.hud-sidenav {
  position: absolute; left: 6px; top: 46%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 5px; z-index: 10;
}
.snav-btn {
  writing-mode: vertical-rl; padding: 7px 3px; border-radius: 6px;
  border: 1px solid rgba(58, 51, 42, 0.15); background: rgba(255, 253, 246, 0.9);
  font-size: 10px; color: var(--xuan); letter-spacing: 1px; cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.snav-btn.on { background: var(--green); color: #fff; border-color: var(--green); }

.hud-harp {
  position: absolute; right: 6px; top: 46%; transform: translateY(-50%);
  width: 32px; background: rgba(70, 52, 38, 0.88); border-radius: 8px;
  padding: 6px 2px; display: flex; flex-direction: column; align-items: center; gap: 3px;
  color: #fff; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
.harp-txt { writing-mode: vertical-rl; font-size: 9.5px; letter-spacing: 1.5px; color: var(--gold-tone); }
.harp-cords { display: flex; flex-direction: column; gap: 2px; }
.harp-cords span { width: 3px; height: 16px; border-radius: 1.5px; background: rgba(255,255,255,.2); transition: .3s; }
.harp-cords span.lit { background: var(--gold-tone); box-shadow: 0 0 6px var(--gold-tone); }
.harp-phase { display: flex; flex-direction: column; gap: 3px; font-size: 7.5px; opacity: .85; text-align: center; }
.harp-sub { writing-mode: vertical-rl; font-size: 7.5px; opacity: .65; letter-spacing: 1px; }

.hud-bubble {
  position: absolute; right: 44px; top: 16%; max-width: 140px;
  background: rgba(255, 253, 246, 0.96); border: 1px solid rgba(200, 93, 77, 0.25);
  border-radius: 8px; padding: 6px 8px; font-size: 10.5px; color: var(--xuan);
  line-height: 1.45; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.hud-bubble .spk { margin-right: 4px; }

.side-panel-drawer {
  position: absolute; inset: 0; background: rgba(0,0,0,.45); z-index: 20;
  display: flex; justify-content: flex-end;
}
.sp-card {
  width: 70%; max-width: 280px; height: 100%; background: var(--bg-card);
  padding: 18px 14px; display: flex; flex-direction: column;
}
.sp-header { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.sp-close { font-size: 16px; border: 0; background: transparent; cursor: pointer; color: var(--xuan-dim); }
.sp-body { font-size: 12px; color: var(--xuan-dim); line-height: 1.8; }
</style>
