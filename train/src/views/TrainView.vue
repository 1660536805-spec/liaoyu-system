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

    <!-- 桌面端：教练画面 与 摄像头画面 并排（等宽 · 等高 · 外框一致）；教练文案条横跨其下。
         移动端 .stage-row 为 display:contents —— 两个盒子仍是 .train 的直接弹性子项，
         布局与改动前**完全一致**。 -->
    <div class="stage-row" ref="stageRow">
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
        <button class="btn ghost" @click="toShell('/?screen=home')">返回首页</button>
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
        <button class="snav-btn" @click="showDemoNow">动作示范</button>
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

    <!-- 陪练教练 · 动作指引条：说清「现在在做什么 / 下一步是什么 / 还要等多久」
         左侧是教练示范小人（嵌在文档流里，不遮挡摄像头与设计稿 HUD）
         · 判定闸门（默认）：教练小窗与摄像头**同时开**，示范一直循环当活参照；
           动作没通关就一直停在这一式，通关才进下一式。 -->
    <div class="coach-bar" v-if="coachOn && !finished" :class="['cp-' + coachPhase, judgeGate ? 'gate-judge' : 'gate-time']">
      <!-- 教练「画面」：桌面端与摄像头画面等宽等高并排；移动端仍是横条里的小窗 -->
      <div class="cb-fig">
      <DemoAnimation
        variant="coach"
        docked
        :move="currentMove"
        :anim-key="coachAnimKey"
        :voice-speaking="false"
        :voice-sync="false"
        :once="true"
        :frozen="coachFrozen"
        :keep-looping="judgeGate"
        :replay-token="coachDemoToken"
        :collapsed-override="false"
        :figure-idx="roomFigureIdx"
        @done="onCoachDemoDone"
      />
      </div>
      <div class="cb-main">
        <div class="cb-row">
          <span class="cb-chip">{{ coachChip }}</span>
          <span class="cb-name">第 {{ stepIdx + 1 }} 式 · {{ currentMove?.name }}</span>
          <span class="cb-next" v-if="nextMove">下一式：{{ nextMove.name }}</span>
        </div>
        <div class="cb-cue">{{ coachCue }}</div>
        <div class="cb-actions">
          <span class="cb-count" v-if="coachCountdown">{{ coachCountdown }}</span>
          <span class="cb-score" v-if="judgeGate && coachPhase === 'follow'">
            完成度 {{ (liveScore * 100).toFixed(0) }}%
          </span>
          <button class="cb-btn" @click="coachReplay">重看示范</button>
          <button class="cb-btn on" v-if="coachPhase === 'grace'" @click="coachExtend">再练一会儿</button>
          <!-- 判定闸门没有「超时放行」，这是唯一的主动出口：真的卡住/身体不适时手动过 -->
          <button class="cb-btn skip" v-if="judgeGate" @click="skip">跳过本式</button>
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
        <button class="btn primary" @click="toShell('/?screen=profile')">查看记录</button>
        <button class="btn" @click="restart">再来一遍</button>
        <button class="btn ghost" @click="toShell('/?screen=home')">返回首页</button>
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
      <button class="btn sm ghost" @click="toggleFreeMode">
        {{ freeMode ? '切回跟练' : '自由练习' }}
      </button>
      <button class="btn sm" :class="coachOn ? 'primary' : 'ghost'" @click="toggleCoach">
        教练指引{{ coachOn ? ' 开' : ' 关' }}
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
import { createCoach, PHASE } from '../engine/coach'
// 房间版动作库：教练小窗的形象换成「房间版拆动作」里那个白练功服小人（见 CoachFigure.vue）
import { roomIndexForAppStep } from '../data/roomMoves.js'
import { saveRecord } from '../stores/records'
import CamSettings from '../components/CamSettings.vue'
import VoiceSettings from '../components/VoiceSettings.vue'
import DemoAnimation from '../components/DemoAnimation.vue'
import { createSpeaker } from '../engine/voice'
import { createAnnouncer } from '../engine/announcer'

const route = useRoute()
const router = useRouter()

// —— 出口一律回主壳 ——
// 本应用只保留这一页（跟练识别页），已没有 s4 自己的首页/我的/记录/要领页。
// 退出、完成、出错后的返回，全部整页跳回主壳（dist/app.js 那套 9 页设计稿页面）。
function toShell(url) { window.location.assign(url) }
const video = ref(null)
const canvas = ref(null)
// 教练画面 + 摄像头画面的共同容器：--stage-ar 写在这里，两个盒子都能继承到同一个取景比例
const stageRow = ref(null)
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

// 陪练教练的计时与骨架「播一遍」时钟
let coachTimer = 0
let lastCoachTick = 0
let ghostCycleAt = 0

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

// ================= 陪练教练（动作指引 + 陪练教练）=================
// 【触发方式】
//   · 默认开启 —— 进跟练页即自动开启「逐式教练引导」，**与摄像头同时运行**：
//                 左边教练小窗一直循环示范，右边摄像头照常判定，用户边看边做。
//   · ?mode=off —— 显式关闭（保持原有「纯判定跟练」）
//   · ?mode=full / ?mode=short —— 完整 / 精简两档节奏，均自动开启
//   · 底部「教练指引」开关 —— 随时手动开 / 关（选择记在 localStorage）
//   · 左侧导航「动作示范」—— 随时重看当前式的教练示范（不再整页跳走）
// 【闸门 gate —— 谁决定「什么时候进下一式」】
//   · gate='judge'（默认）**判定闸门**：动作没通关就一直停在这一式、示范循环陪练，
//                          只有判定命中才进下一式。轮次计数让用户看得见系统是活的。
//   · gate='time'         计时闸门：到点自动放行（旧行为，保留用于对照 / 回归验证）
// 【现场可调】
//   ?coachGate=time  切到计时闸门（对照）
//   ?coachAttempt=秒 判定闸门下每隔多久重播一遍示范
//   ?coachSoft= ?coachHard= ?coachGrace= ?coachDemo= ?coachRedemo=  仅计时闸门生效
//   ?coachSim=秒     跟练停留 N 秒后模拟一次通关（只用于演示 / 端到端验证）
const modeParam = String(route.query.mode || '').toLowerCase()
const coachLevel = ref(modeParam === 'short' ? 'short' : 'full')

/** 是否开启教练：显式 mode=off 关 / 显式 mode=full|short 开 / 否则读上次选择（默认开） */
function wantCoach(m) {
  if (m === 'off') return false
  if (m === 'full' || m === 'short') return true
  return safeGet('xianyang.coach') !== '0'
}
const coachOn = ref(wantCoach(modeParam))
/** 闸门：默认判定闸门（没通关不换式）；?coachGate=time 可切回「计时放行」做对照实验 */
const coachGate = ref(route.query.coachGate === 'time' ? 'time' : 'judge')
const judgeGate = computed(() => coachGate.value === 'judge')
/** 演示 / 端到端验证用：?coachSim=秒 —— 跟练停留 N 秒后模拟一次通关（0 或未给 = 关闭） */
const coachSimMs = (() => {
  const v = Number(route.query.coachSim)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : 0
})()

/** URL 上的现场调参（秒 → 毫秒），验证与演示都靠它把等待压短 */
function coachOverrides() {
  const sec = (k) => {
    const v = Number(route.query[k])
    return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : undefined
  }
  const o = { gate: coachGate.value }
  const soft = sec('coachSoft'); if (soft) o.softWaitMs = soft
  const hard = sec('coachHard'); if (hard) o.hardWaitMs = hard
  const grace = sec('coachGrace'); if (grace) o.graceMs = grace
  const demo = sec('coachDemo'); if (demo) o.demoMaxMs = demo
  const at = sec('coachAttempt'); if (at) o.attemptMs = at
  const rd = Number(route.query.coachRedemo)
  if (Number.isFinite(rd) && rd >= 0) o.maxRedemo = rd
  return o
}

let coach = createCoach({ level: coachLevel.value, overrides: coachOverrides() })
const coachPhase = ref(PHASE.IDLE)
const coachRedemo = ref(0)
const coachAttempt = ref(0)     // 判定闸门：本式已重播几轮（0 = 第一轮陪练）
const coachSecs = ref(0)
const coachDemoToken = ref(0)   // 递增 → 教练示范动画从 0 重播一遍

const coachAnimKey = computed(() => (coachOn.value ? `${style.value.id}-${stepIdx.value + 1}` : ''))

/** 教练小窗用的「房间版式号」：房间版是「起势 + 应用的 8 式 + 收势」，
    名称逐条对齐，所以应用第 i 式(0-based) → 房间版 i+1。
    （见 train/src/data/roomMoves.js 的 roomIndexForAppStep）*/
const roomFigureIdx = computed(() => roomIndexForAppStep(stepIdx.value))

const nextMove = computed(() => moves.value[stepIdx.value + 1] || null)

/** 示范阶段已结束（跟练/宽限/完成）→ 让教练小窗定在结束姿态，文案随之变「示范完毕 · 请跟我做」。
    这样即使示范保底时长早于动画自然结束，小窗也不会仍写着「示范中…」。
    ⚠️ 判定闸门下**不允许定格**：示范要一直循环，作为用户跟练时的活参照。 */
const coachFrozen = computed(() =>
  coachOn.value && !judgeGate.value &&
  coachPhase.value !== PHASE.IDLE && coachPhase.value !== PHASE.DEMO)

const coachChip = computed(() => {
  if (judgeGate.value) {
    switch (coachPhase.value) {
      case PHASE.DEMO: return coachRedemo.value > 0 ? '再看一次示范' : '教练示范中'
      case PHASE.FOLLOW: return '请跟我做'
      case PHASE.DONE: return '通关！'
      default: return '教练待命'
    }
  }
  switch (coachPhase.value) {
    case PHASE.DEMO: return coachRedemo.value > 0 ? '再看一次示范' : '教练示范中'
    case PHASE.FOLLOW: return '请跟我做'
    case PHASE.GRACE: return '准备进入下一式'
    case PHASE.DONE: return '很好！'
    default: return '教练待命'
  }
})
const coachCountdown = computed(() => {
  if (judgeGate.value) {
    // 判定闸门没有倒计时放行，只有「还有几秒重播一遍示范」+ 当前第几轮
    if (coachPhase.value !== PHASE.FOLLOW) return ''
    const round = coachAttempt.value > 0 ? `第 ${coachAttempt.value + 1} 轮陪练` : ''
    const soon = coachSecs.value > 0 && coachSecs.value <= 5 ? `${coachSecs.value}s 后重播示范` : ''
    return [round, soon].filter(Boolean).join(' · ')
  }
  if (coachPhase.value === PHASE.GRACE) return `${coachSecs.value}s 后进入下一式`
  if (coachPhase.value === PHASE.FOLLOW && coachSecs.value > 0 && coachSecs.value <= 5) return `${coachSecs.value}s`
  return ''
})
const coachCue = computed(() => {
  const mv = currentMove.value
  if (!mv) return ''
  if (judgeGate.value) {
    switch (coachPhase.value) {
      case PHASE.DEMO: return coachRedemo.value > 0 ? `再看一遍：${mv.cue}` : `先看教练示范：${mv.cue}`
      case PHASE.FOLLOW: return `跟着做：${mv.cue} —— 做到位才进下一式，没通关就一直练这一式`
      case PHASE.DONE: return `很好！准备进入「${nextMove.value?.name || '收势'}」`
      default: return mv.cue
    }
  }
  switch (coachPhase.value) {
    case PHASE.DEMO: return coachRedemo.value > 0 ? `再看一遍：${mv.cue}` : `先看教练示范：${mv.cue}`
    case PHASE.FOLLOW: return `跟着做：${mv.cue}`
    case PHASE.GRACE: return `这式先放过，${coachSecs.value}s 后自动进入「${nextMove.value?.name || '收势'}」`
    case PHASE.DONE: return '很好！保持呼吸，准备下一式'
    default: return mv.cue
  }
})

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
  coachEnter(stepIdx.value, 'style')
})

// 切换模式（?mode=full / ?mode=short / ?mode=off / 去掉 mode）：就地生效。
// 【为什么要监听】hash 路由下「同一页换查询参数」不会重建组件，
//   只在 setup 里读一次 route.query.mode 会导致「改了参数但教练不跟着变」。
watch(() => String(route.query.mode || '').toLowerCase(), (m) => {
  const lv = m === 'short' ? 'short' : 'full'
  if (lv !== coachLevel.value) {
    coachLevel.value = lv
    coach = createCoach({ level: lv, overrides: coachOverrides() })   // 档位变了要换参数集
  }
  const next = wantCoach(m)
  if (next === coachOn.value) { if (coachOn.value) coachEnter(stepIdx.value, 'mode'); return }
  coachOn.value = next
  if (coachOn.value) coachEnter(stepIdx.value, 'mode')
  else coachStop()
})

// 切换闸门（?coachGate=time / judge）：就地重建状态机，用于对照实验。
// 【为什么重建】gate 是构造参数（决定整条状态图走哪条分支），改完必须 new。
watch(() => String(route.query.coachGate || ''), (g) => {
  const want = g === 'time' ? 'time' : 'judge'
  if (want === coachGate.value) return
  coachGate.value = want
  coach = createCoach({ level: coachLevel.value, overrides: coachOverrides() })
  if (coachOn.value && !freeMode.value) coachEnter(stepIdx.value, 'gate')
  else syncCoachMeta()
})

// ================= 陪练教练：状态机接线 =================
/** 把状态机的内部状态同步到界面（phase / 重放次数 / 轮次 / 倒计时秒数） */
function syncCoachMeta() {
  if (coachPhase.value !== coach.phase) coachPhase.value = coach.phase
  if (coachRedemo.value !== coach.redemo) coachRedemo.value = coach.redemo
  if (coachAttempt.value !== coach.attempt) coachAttempt.value = coach.attempt
  const p = coach.phase
  let s = 0
  if (coachGate.value === 'judge') {
    // 判定闸门：FOLLOW 的秒数是「还有几秒重播一遍示范」，与放行无关
    if (p === PHASE.FOLLOW) s = Math.max(0, Math.ceil((coach.cfg.attemptMs - coach.elapsed) / 1000))
  } else if (p === PHASE.FOLLOW) s = Math.max(0, Math.ceil((coach.cfg.hardWaitMs - coach.elapsed) / 1000))
  else if (p === PHASE.GRACE) s = Math.max(0, Math.ceil((coach.cfg.graceMs - coach.elapsed) / 1000))
  if (s !== coachSecs.value) coachSecs.value = s
}

/** 进入某一式的教练引导：先示范 */
function coachEnter(idx, reason = 'begin') {
  if (!coachOn.value || freeMode.value) { coach.reset(); syncCoachMeta(); return }
  coach.begin(idx, { reason })
  ghostCycleAt = performance.now()   // 标准骨架也从头播一遍
  coachDemoToken.value++             // 教练示范动画从头播一遍
  judge?.reset()                     // 示范阶段不接受命中：清掉锁存，避免用户先做到位把这一式锁死
  lastCoachTick = performance.now()
  syncCoachMeta()
}

function coachStop() {
  if (!coach.active && coachPhase.value === PHASE.IDLE) return
  coach.reset()
  syncCoachMeta()
}

/** 「重看示范」：任何阶段都能按 */
function coachReplay() {
  if (!coachOn.value || freeMode.value) return
  if (coach.phase === PHASE.IDLE) { coachEnter(stepIdx.value, 'nav'); return }
  coach.replay()
  ghostCycleAt = performance.now()
  coachDemoToken.value++
  judge?.reset()
  lastCoachTick = performance.now()
  syncCoachMeta()
}

/** 宽限期「再练一会儿」：回到跟练，重新给一轮等待 */
function coachExtend() {
  coach.extend()
  lastCoachTick = performance.now()
  syncCoachMeta()
}

/** 教练示范播完 → 进入跟练，此时才接受「用户做到位」 */
function onCoachDemoDone() {
  if (!coachOn.value) return
  if (!coach.demoDone()) return
  judge?.reset()                     // 跟练开始：清锁存，保证用户真能做到位、能被判定命中
  lastCoachTick = performance.now()
  syncCoachMeta()
}

/** 教练推进：命中收尾 → 正常进入下一式；超时放行 → 与「跳过本式」同语义（计入完成）
    ⚠️ 判定闸门下永远不会收到 reason:'timeout'（状态机压根不进宽限），
    这里保留该分支只为 gate:'time' 的对照档，不影响默认行为。 */
function coachAdvance(step, reason) {
  if (reason === 'timeout') { skip(); return }
  if (step >= totalMoves.value - 1) { finish(); return }
  advance()
}

/**
 * 时间推进（定时器驱动）。
 * 【为什么在预录兜底 / 切到后台时暂停】
 *   预录兜底有自己的「下一个式」保险计时，两边同时推进会打架；
 *   切到后台时用户并不在练，让它继续计时会「没人也自动跳式」。
 */
function coachTick(now) {
  if (!coachOn.value || finished.value || freeMode.value) {
    coachStop()
    lastCoachTick = now
    return
  }
  if (fbActive.value || (typeof document !== 'undefined' && document.hidden)) {
    lastCoachTick = now
    return
  }
  const dt = lastCoachTick ? now - lastCoachTick : 0
  lastCoachTick = now
  if (dt <= 0 || dt > 2000) return   // 空档过久（休眠回来）不计入，避免一帧直接跳到跟练/宽限
  const evs = coach.tick(dt)
  for (const ev of evs) {
    if (ev.type === 'follow') {
      judge?.reset()
    } else if (ev.type === 'demo') {
      ghostCycleAt = now             // 自动重放：骨架也跟着再播一遍
      coachDemoToken.value++
      judge?.reset()
    } else if (ev.type === 'nudge') {
      // 【判定闸门】又过了一轮还没通关 → 教练从头再示范一遍，当活参照继续陪练。
      // ⚠️ 绝不 reset 判定器：用户可能已经攒了几帧保持，清掉等于前功尽弃。
      // 也绝不 advance：没通关就永远停在这一式。
      ghostCycleAt = now
      coachDemoToken.value++
    } else if (ev.type === 'advance') {
      syncCoachMeta()
      coachAdvance(ev.step, ev.reason)
      return
    }
  }
  syncCoachMeta()

  // 【演示 / 验证开关】?coachSim=秒 —— 跟练阶段停留 N 秒后模拟一次「用户做到位」。
  // 为什么需要：判定闸门下「通关才进下一式」这条正向路径，没有真人做对动作时没法演示，
  // 也没法做端到端回归。它只在 URL 显式给出时生效，默认完全不参与。
  if (coachSimMs > 0 && coach.phase === PHASE.FOLLOW && coach.elapsed >= coachSimMs) {
    onHit(stepIdx.value)
  }
}

/** 底部「教练指引」开关：与「自由练习」互斥 */
function toggleCoach() {
  coachOn.value = !coachOn.value
  safeSet('xianyang.coach', coachOn.value ? '1' : '0')
  if (coachOn.value) {
    if (freeMode.value) { freeMode.value = false; resetStep() }
    coachEnter(stepIdx.value, 'manual-on')
  } else {
    coachStop()
  }
}

/** 「自由练习」与教练引导互斥：自由练习时全式开放、不做逐式引导 */
function toggleFreeMode() {
  freeMode.value = !freeMode.value
  resetStep()
  if (freeMode.value) coachStop()
  else coachEnter(stepIdx.value, 'freedom-off')
}

/** 左侧导航「动作示范」：就地重看当前式的教练示范 */
function showDemoNow() {
  if (!coachOn.value) { coachOn.value = true; safeSet('xianyang.coach', '1') }
  if (freeMode.value) { freeMode.value = false; resetStep() }
  coachReplay()
}

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
    coachEnter(stepIdx.value, 'init')   // 就绪即开始教练引导（教练关着时此调用为空操作）
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
    coachEnter(stepIdx.value, 'camera')   // 回到实时画面：从当前式重新示范一次
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
  // 陪练教练计时：120ms 一跳，由 coachTick 自己判断该不该推进
  coachTimer = setInterval(() => coachTick(performance.now()), 120)
})

onBeforeUnmount(() => {
  clearInterval(harpTimer)
  clearInterval(coachTimer)
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
  // 写在共同容器上（而非 .stage 自身），桌面端「教练画面」与「摄像头画面」
  // 才能继承到同一个比例，从而保证两盒等宽等高。
  ;(stageRow.value || stage).style.setProperty('--stage-ar', String(ar))
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
    // 陪练教练开启时：只有「跟练阶段命中当前式」才算完成，
    // 完成后先停在 done 做一次反馈，再由状态机进入下一式（保证「示范 → 跟练」逐式连贯）
    if (coachOn.value) {
      if (coach.hit(i)) syncCoachMeta()
      return
    }
    if (i === totalMoves.value - 1 || doneSet.value.size >= totalMoves.value) finish()
    else if (i === stepIdx.value) advance()
  }
}

function advance() {
  stepIdx.value = Math.min(totalMoves.value - 1, stepIdx.value + 1)
  resetStep()
  announcer.onMove(stepIdx.value + 1, totalMoves.value)   // 播报新动作名
  coachEnter(stepIdx.value, 'advance')                    // 新式重新从「教练示范」开始
}

function finish() {
  finished.value = true
  coachStop()
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
  coachEnter(0, 'restart')
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
  coachEnter(0, 'manual')
  finished.value = false
  landmarksSeen.value = true
  camLabel.value = '手动模式'
}

function quit() { exitFallback('退出跟练'); engine?.dispose(); toShell('/?screen=home') }

// 标准骨架：按当前式取真值，让人看见「这一式标准动作是怎么做的」。
// 只对八段锦生效（真值只有这 8 式）。
//   · 教练关闭（原行为）：无限循环播放，作为一个持续的标准参照
//   · 教练开启 + 判定闸门（默认）：**一直循环**（示范期 / 跟练期都一样）——
//     「教练与摄像头同时开」，用户边看边做、随时可能通关，骨架必须一直在动
//   · 教练开启 + 计时闸门：示范阶段播一遍后**定在结束姿态**作静参照（旧行为）
const GHOST_LOOP_MS = 4000
function ghostLandmarks() {
  if (style.value?.id !== 'baduanjin') return null
  const mv = standardPoses.moves?.[stepIdx.value]
  const keys = mv?.keys
  if (!keys?.length) return null
  const span = keys[keys.length - 1].t - keys[0].t
  if (span <= 0) return toLandmarks(keys[0].pts)
  let phase
  if (coachOn.value && judgeGate.value) {
    // 判定闸门：ignore 阶段，骨架一直循环当活参照（nudge 时 ghostCycleAt 归零 → 从头再示范）
    const ms = performance.now() - ghostCycleAt
    const k = (((ms % GHOST_LOOP_MS) + GHOST_LOOP_MS) % GHOST_LOOP_MS) / GHOST_LOOP_MS
    phase = keys[0].t + k * span
  } else if (coachOn.value && coach.phase === PHASE.DEMO) {
    // 示范：从第一帧播到最后一帧（结束姿态），播完就停住
    const k = Math.min(1, Math.max(0, (performance.now() - ghostCycleAt) / GHOST_LOOP_MS))
    phase = keys[0].t + k * span
  } else if (coachOn.value) {
    // 跟练 / 宽限 / 收尾：定格在结束姿态，作为「你要做成什么样」的静参照
    phase = keys[keys.length - 1].t
  } else {
    phase = ((performance.now() % GHOST_LOOP_MS) / GHOST_LOOP_MS) * span + keys[0].t
  }
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

/* 教练画面 + 摄像头画面 的共同容器。
   移动端 display:contents —— 不产生盒子，.stage / .coach-bar 仍是 .train 的直接弹性子项，
   与「并排改造」前的布局逐像素一致；桌面端（见文件底部 @media min-width:768px）才变 2 列网格。 */
.stage-row { display: contents; }
/* 教练「画面」的包装盒：移动端＝横条里的小窗，尺寸完全交给内部的 .demo.coach.docked */
.cb-fig { display: flex; flex: 0 0 auto; }

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

/* 陪练教练 · 动作指引条（示范 / 跟练 / 宽限 三态由 cp-* 类区分）
   横向布局：左侧停靠的教练示范小窗 + 右侧文字区；嵌入文档流，不遮挡摄像头与 HUD
   gate-judge（默认判定闸门）：教练小窗一直循环示范，与摄像头同时开
   gate-time （计时闸门）：旧行为，到点自动放行（仅对照实验用） */
.coach-bar {
  display: flex; align-items: center; gap: 10px;
  margin: 3px 10px 0; padding: 6px 10px; border-radius: 10px;
  background: rgba(214, 197, 158, .08); border: 1px solid rgba(214, 197, 158, .22);
  font-family: var(--font-ui);
}
.coach-bar.cp-follow { border-color: rgba(90, 140, 100, .34); background: rgba(90, 140, 100, .07); }
.coach-bar.cp-grace { border-color: rgba(200, 93, 77, .32); background: rgba(200, 93, 77, .07); }
/* 判定闸门：跟练期是「常驻陪练」而不是「倒计时放行」，用玉色左描边把状态说清楚 */
.coach-bar.gate-judge.cp-follow { border-left: 3px solid var(--green); }
.coach-bar .cb-main { flex: 1 1 auto; min-width: 0; }
.coach-bar .cb-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.coach-bar .cb-chip {
  flex: 0 0 auto; font-size: 10.5px; padding: 1px 8px; border-radius: 9px;
  background: var(--jin); color: #2B251E; letter-spacing: .5px;
}
.coach-bar.cp-demo .cb-chip { background: var(--jin); color: #2B251E; }
.coach-bar.cp-follow .cb-chip { background: var(--green); color: #fff; }
.coach-bar.cp-grace .cb-chip { background: var(--zhu); color: #fff; }
.coach-bar.cp-done .cb-chip { background: var(--green); color: #fff; }
.coach-bar .cb-name { font-size: 11.5px; color: var(--xuan); }
.coach-bar .cb-next { font-size: 10.5px; color: var(--xuan-faint); }
.coach-bar .cb-cue { margin-top: 3px; font-size: 11px; color: var(--xuan-dim); line-height: 1.6; }
.coach-bar .cb-actions { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
.coach-bar .cb-count { font-size: 10.5px; color: var(--zhu); font-variant-numeric: tabular-nums; }
/* 判定闸门下的实时完成度：让用户看得见「离通关还有多远」，否则卡着会以为没反应 */
.coach-bar .cb-score {
  font-size: 10.5px; color: var(--green);
  font-variant-numeric: tabular-nums; letter-spacing: .3px;
}
.coach-bar .cb-btn {
  font-size: 10.5px; padding: 3px 10px; border-radius: 7px; cursor: pointer;
  border: 1px solid rgba(232, 224, 208, .2); background: rgba(232, 224, 208, .08);
  color: var(--xuan-dim); font-family: var(--font-ui);
}
.coach-bar .cb-btn.on { background: var(--zhu); color: #fff; border-color: var(--zhu); }
/* 「跳过本式」是判定闸门下唯一的主动出口：弱化但要点得着，别让人卡死 */
.coach-bar .cb-btn.skip { border-style: dashed; border-color: rgba(232, 224, 208, .26); }

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

  /* ===== 桌面端：教练画面 与 摄像头画面 并排（等宽 · 等高 · 外框一致） ===== */
  .stage-row {
    display: grid;                       /* 覆盖移动端的 display:contents */
    grid-template-columns: 1fr 1fr;      /* 两列等宽 */
    grid-template-areas:
      "coach cam"
      "bar   bar";
    grid-template-rows: auto auto;
    column-gap: 18px;
    row-gap: 10px;
    align-content: start;
    align-items: stretch;                /* 同行两块同高 */
    flex: 1 1 auto;
    min-height: 0;
    margin: 6px auto 0;
    width: 100%;
    /* 【一屏放下的关键】画面高度 = 列宽 / --stage-ar；两列 + 间距 = 行宽。
       所以只要收住「行宽上限」，两个画面的高度就自动不会顶穿一屏。
       除画面外的固定区块（顶栏 49 + 指标卡 116 + 文案条 113 + 弦位 30 + 当前式 32 + 底栏 46
       + 各处间距/内边距）实测约 440px，这里按 448 留余量。
       宽屏时被 1200px 收住（不起作用），只有矮屏（如 1366×768）才真正生效。 */
    max-width: clamp(360px, calc(2 * var(--stage-ar, 1.4) * (100dvh - 448px) + 18px), 1200px);
  }
  /* 摄像头画面 / 教练画面：同列宽 + 同比例(--stage-ar) + 同上限 ⇒ 用量互为镜像，
     宽度与高度由 CSS 算术直接保证相等，不依赖 stretch / 内容撑高。
     --stage-ar 由 sizeCanvas() 写在 .stage-row 上，两盒都能继承到。 */
  .stage,
  .cb-fig {
    grid-row: 1;
    width: 100%;
    height: auto;
    aspect-ratio: var(--stage-ar, 1.4);
    /* 兜底：万一剩余高度不足（矮屏），先夹住高度避免压到下方文案条；
       正常情况下行宽上限已经保证按比例算出的高度就在这个范围内。 */
    max-height: min(62vh, calc(100dvh - 448px));
    margin: 0;
    align-self: start;
  }
  .stage { grid-column: 2; max-width: none; }
  /* 教练画面：外框与摄像头画面同形（圆角 / 描边 / 阴影一致） */
  .cb-fig {
    grid-column: 1;
    position: relative;                  /* 内部小人绝对定位铺满，绝不反向撑高本盒 */
    overflow: hidden;
    border-radius: var(--r-m);
    background: rgba(10, 8, 6, .38);
    border: 1px solid rgba(232, 224, 208, .14);
    box-shadow: 0 0 0 1px rgba(232, 224, 208, .10), 0 12px 40px rgba(0, 0, 0, .4);
  }
  /* 让房间版小人铺满整个教练画面框（移动端的小窗尺寸不再适用） */
  .cb-fig :deep(.demo.coach.docked) { position: absolute; inset: 0; width: auto; height: auto; }
  .cb-fig :deep(.demo.coach.docked .demo-body) { flex: 1 1 auto; min-height: 0; padding: 0; gap: 3px; }
  .cb-fig :deep(.demo.coach.docked .cv-box) {
    flex: 1 1 auto; height: auto; min-height: 0;
    border: 0; border-radius: 0; background: transparent;
  }
  /* 桌面端 .coach-bar 不产生盒子（display:contents），状态色改描在教练画面上 */
  .coach-bar { display: contents; }
  .coach-bar.cp-follow .cb-fig,
  .coach-bar.cp-done   .cb-fig { border-color: rgba(90, 140, 100, .42); }
  .coach-bar.cp-grace  .cb-fig { border-color: rgba(200, 93, 77, .42); }

  /* 教练文案条：横跨两画面下方，字号随桌面放大，操作按钮更好点 */
  .coach-bar .cb-main {
    grid-area: bar;
    padding: 9px 14px;
    border-radius: 10px;
    background: rgba(214, 197, 158, .08);
    border: 1px solid rgba(214, 197, 158, .22);
  }
  .coach-bar.cp-follow .cb-main { border-color: rgba(90, 140, 100, .34); background: rgba(90, 140, 100, .07); }
  .coach-bar.cp-grace  .cb-main { border-color: rgba(200, 93, 77, .32);  background: rgba(200, 93, 77, .07); }
  .coach-bar .cb-row { gap: 10px; }
  .coach-bar .cb-chip { font-size: 12px; padding: 2px 10px; }
  .coach-bar .cb-name { font-size: 13px; }
  .coach-bar .cb-next { font-size: 11.5px; }
  .coach-bar .cb-cue { font-size: 12.5px; margin-top: 5px; }
  .coach-bar .cb-actions { gap: 8px; margin-top: 7px; }
  .coach-bar .cb-count,
  .coach-bar .cb-score { font-size: 12px; }
  .coach-bar .cb-btn { font-size: 12px; padding: 5px 14px; border-radius: 8px; }
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
