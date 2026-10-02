<template>
  <div class="wrap train">
    <div class="topbar">
      <button class="btn ghost sm" @click="quit">← 退出</button>
      <div class="prog">{{ doneCount }} / 8</div>
      <div class="spacer"></div>
      <div class="mode">{{ freeMode ? '自由练习' : '跟练' }}</div>
    </div>

    <div class="stage">
      <video ref="video" class="video" playsinline muted autoplay></video>
      <canvas ref="canvas" class="overlay"></canvas>

      <!-- 取景引导框：告诉用户手该放在哪 -->
      <div class="guide" v-if="showGuide">
        <div class="guide-frame"></div>
        <div class="guide-tip">{{ guideText }}</div>
      </div>

      <div v-if="loading" class="mask"><div class="spinner"></div><div class="mask-txt">{{ loading }}</div></div>
      <div v-if="err" class="mask err">
        <div class="mask-txt">{{ err }}</div>
        <button class="btn" @click="$router.push('/')">返回首页</button>
        <button class="btn ghost" @click="manualMode">改用手动模式继续</button>
      </div>
      <div v-else-if="!landmarksSeen" class="hint">站到镜头前，让上半身和双手完整入镜</div>

      <!-- 实时可见度诊断（长按可展开，平时半透明小字） -->
      <div class="diag" :class="{ bad: vis.bad }">{{ vis.text }}</div>
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
        <div class="gauge-mark"></div>
      </div>
      <div class="gauge-tip">做到位即响，无需倒数</div>
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
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import moves from '../data/moves.json'
import { createPoseEngine, drawPose, KEY_POINTS } from '../engine/poseEngine'
import { MoveJudge, NAMES } from '../engine/judge'
import { pluck, chordAll, unlockAudio } from '../engine/guqin'
import { saveRecord } from '../stores/records'

const router = useRouter()
const video = ref(null)
const canvas = ref(null)

const loading = ref('正在加载本地模型…')
const err = ref('')
const landmarksSeen = ref(false)
const finished = ref(false)
const freeMode = ref(false)

const stepIdx = ref(0)          // 当前第几式（0~7）
const doneSet = ref(new Set())  // 已完成的式
const litStrings = ref([])      // 当前亮起的弦
const liveScore = ref(0)        // 当前式实时分 0~1

let engine = null
let judge = null
let rafUI = 0
let lastLitClear = 0

const currentMove = computed(() => moves[stepIdx.value])
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
  judge = new MoveJudge({ holdFrames: 10, order: freeMode.value ? null : stepIdx.value })
}

onMounted(async () => {
  unlockAudio()               // 由用户手势触发，解锁音频
  try {
    engine = await createPoseEngine()
    engine.on('error', (e) => { console.error('[pose]', e) })
    engine.on('result', onResult)
    await nextTick()
    await engine.start(video.value)
    loading.value = ''
    resetStep()
    // 等一帧让 stage 完成布局再定 canvas 尺寸，否则拿到 0
    requestAnimationFrame(sizeCanvas)
    setTimeout(sizeCanvas, 120)
    window.addEventListener('resize', sizeCanvas)
    uiLoop()
  } catch (e) {
    console.error(e)
    err.value = /Permission|NotAllowed/i.test(e?.name + e?.message)
      ? '摄像头未授权。请在浏览器地址栏允许摄像头后重试。'
      : '摄像头或模型加载失败：' + (e?.message || e)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafUI)
  window.removeEventListener('resize', sizeCanvas)
  engine?.dispose()
})

function sizeCanvas() {
  const c = canvas.value
  if (!c) return
  const stage = c.parentElement
  const w = stage?.clientWidth || 640, h = stage?.clientHeight || 480
  c.width = w; c.height = h
}

function onResult(landmarks) {
  if (!judge) return
  lastLandmarks = landmarks
  if (landmarks) landmarksSeen.value = true
  const hits = judge.update(landmarks)
  liveScore.value = judge.lastScores[stepIdx.value] ?? 0
  // 每 10 帧更新一次诊断，避免每帧重算文字
  if (++diagTick % 10 === 0) updateDiag(landmarks)
  for (const h of hits) onHit(h.index)
}
let diagTick = 0

function onHit(i) {
  const mv = moves[i]
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
    if (i === 7 || doneSet.value.size >= 8) finish()
    else if (i === stepIdx.value) advance()
  }
}

function advance() {
  stepIdx.value = Math.min(7, stepIdx.value + 1)
  resetStep()
}

function finish() {
  finished.value = true
  engine?.stop()
  saveRecord({ moves: [...doneSet.value], names: NAMES.filter((_, i) => doneSet.value.has(i)) })
}

function skip() {                 // 三级兜底之一：跳过本式也算完成
  const i = stepIdx.value
  doneSet.value = new Set([...doneSet.value, i])
  if (moves[i].chord) chordAll(); else pluck(moves[i].stringIndex)
  litStrings.value = moves[i].chord ? [1, 2, 3, 4, 5, 6, 7] : [moves[i].stringIndex]
  lastLitClear = performance.now()
  if (stepIdx.value >= 7) finish(); else advance()
}

function restart() {
  doneSet.value = new Set()
  stepIdx.value = 0
  finished.value = false
  landmarksSeen.value = false
  resetStep()
  if (!engine?.isRunning && video.value?.srcObject) engine?.start(video.value)
  else if (!engine?.isRunning) location.reload()
}

function manualMode() {          // 三级兜底之三：关摄像头，改为点按触发
  engine?.stop()
  err.value = ''
  stepIdx.value = 0
  resetStep()
  finished.value = false
  landmarksSeen.value = true
}

function quit() { engine?.dispose(); router.push('/') }

// 绘制循环：骨架 + 弦位余晖
function uiLoop() {
  const c = canvas.value, v = video.value
  const ctx = c?.getContext('2d')
  if (ctx && v) {
    const w = c.width, h = c.height
    ctx.save()
    // 镜像画面，符合照镜子的直觉
    ctx.translate(w, 0); ctx.scale(-1, 1)
    drawPose(ctx, lastLandmarks, w, h, {
      highlight: liveScore.value > 0.3 ? KEY_POINTS : null,
      glow: liveScore.value >= 0.55,
    })
    ctx.restore()
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

/* 竖版取景：9:16 让上半身尽量占满画面，减少头部/腿部空区 */
.stage {
  position: relative; flex: 1 1 auto; min-height: 0;
  aspect-ratio: 3 / 4; max-height: 52vh;
  align-self: center; width: 100%;
  background: #000; border-radius: var(--r-m); overflow: hidden;
}
.video, .overlay { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.video { transform: scaleX(-1); opacity: .85; }
.overlay { pointer-events: none; }

/* 取景引导框：虚线框提示「双手放这里面」 */
.guide { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 12px; }
.guide-frame {
  position: absolute; left: 12%; right: 12%; top: 14%; bottom: 22%;
  border: 1px dashed rgba(214, 197, 158, .3); border-radius: var(--r-m);
}
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
.gauge-mark { position: absolute; left: 55%; top: -3px; width: 2px; height: 12px; background: rgba(232,224,208,.5); }
.gauge-tip { font-size: 10.5px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 7px; }

.done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
.done-title { font-size: 40px; letter-spacing: 10px; text-indent: 10px; color: var(--jin); text-shadow: 0 0 30px rgba(214,197,158,.3); }
.done-sub { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); letter-spacing: 2px; margin-bottom: 12px; }
.done-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.footbar { display: flex; gap: 10px; padding: 8px 16px 16px; justify-content: center; }
</style>
