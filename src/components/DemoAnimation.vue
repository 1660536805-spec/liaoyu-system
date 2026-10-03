<template>
  <aside class="demo" :class="{ collapsed }">
    <!-- 收起态：右侧小浮钮 -->
    <button v-if="collapsed" class="float-btn" @click="toggleCollapse" title="展开试教动画">
      <span class="fb-ico">☯</span>
      <span class="fb-txt">示范</span>
    </button>

    <!-- 展开态：悬浮卡片 -->
    <template v-else>
      <div class="demo-head">
        <span class="dh-dot" :class="{ live: state === 'ready' && playing }"></span>
        <span class="dh-title">示范动画</span>
        <span class="dh-phase" v-if="state === 'ready'">{{ phaseText }}</span>
        <span class="dh-speed" v-if="state === 'ready' && speed !== 1">{{ speed }}×</span>
        <button class="dh-btn" @click="toggleCollapse" title="收起（不关闭演示模式）">—</button>
      </div>

      <div class="demo-body">
        <!-- 舞台：连续柔和小人 / 加载占位 / 降级 -->
        <div class="cv-box" ref="box">
          <canvas ref="cv" v-show="state === 'ready'"></canvas>

          <div v-if="state === 'loading'" class="ph">
            <div class="ph-spin"></div>
            <p>正在准备「{{ move?.name || '动作' }}」示范…</p>
          </div>

          <div v-else-if="state === 'missing'" class="ph miss">
            <img v-if="photoOk && move?.photo" :src="move.photo" alt="" @error="photoOk = false" />
            <div v-else class="ph-blank">示意</div>
            <p class="ph-note">
              该式暂无示范动画，已降级为静态图示<span v-if="!photoOk">（图片也未找到，请参考语音要领）</span>。
              跟练时以语音要领 + 镜像骨架为准。
            </p>
          </div>
        </div>

        <template v-if="state === 'ready'">
          <div class="prog" ref="progEl" @click="seek">
            <div class="prog-fill" :style="{ width: pct * 100 + '%' }"></div>
            <div class="prog-cap" :style="{ left: pct * 100 + '%' }"></div>
          </div>

          <div class="phases">
            <span v-for="p in phaseMarks" :key="p.label" :class="{ on: p.on }">{{ p.label }}</span>
          </div>

          <div class="ctrls">
            <button class="c-btn" @click="togglePlay">{{ playing ? '⏸' : '▶' }}</button>
            <button class="c-btn" @click="replay">↺</button>
            <button class="c-btn" :class="{ on: loop }" @click="setLoop(!loop)">循环</button>
            <span class="c-sep"></span>
            <button v-for="s in SPEEDS" :key="s" class="c-btn sm" :class="{ on: speed === s }" @click="setSpeed(s)">{{ s }}×</button>
          </div>

          <label class="sync-row">
            <input type="checkbox" v-model="syncVoice" @change="persist" />
            跟随语音
            <select class="c-sel" v-model="endMode" @change="persist" title="语音结束后动画的行为">
              <option value="hold">停在结束姿态</option>
              <option value="return">回到起始姿态</option>
            </select>
          </label>
        </template>
      </div>
    </template>
  </aside>
</template>

<script setup>
// 示范动画（悬浮抽屉）—— 连续插值的柔和小人，与语音同步
//
// 【定位】演示模式的附加层：默认关闭（顶栏「☯ 示范动画」开关），开启后悬浮在
//   右侧空白处，绝不挤压/遮挡中间的摄像头 + 骨架主画面。
//
// 【连续性】rAF 时间轴 + 关键帧缓入缓出插值，60fps 连贯渲染，非跳帧。
//   风格：圆润疗养系小人（胶囊躯干、丸子头、暖米色、呼吸微起伏）。
//
// 【同步】与播报同源：announcer onState → voiceSpeaking。
//   语音开始 → 动画从头播；语音暂停/结束 → 停在结束姿态或回到起始（可设）。
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getAnim, DEFAULT_POSE, POSE_KEYS, PHASE_TEXT } from '../data/demoAnim'

const props = defineProps({
  move: { type: Object, default: null },
  animKey: { type: String, default: '' },
  voiceSpeaking: { type: Boolean, default: false },
})

const SPEEDS = [0.5, 0.75, 1]
const PLACEHOLDER_MS = 300

const box = ref(null)
const cv = ref(null)
const progEl = ref(null)

const state = ref('loading')
const playing = ref(true)
const loop = ref(true)
const speed = ref(1)
const endMode = ref('return')   // 默认回到起始继续循环：进页即自动循环播放，无需手动点
const syncVoice = ref(true)
const collapsed = ref(false)      // 悬浮抽屉默认展开（演示模式开启即见动画）
const photoOk = ref(true)

const t = ref(0)
const anim = ref(null)
let loadTimer = 0
let raf = 0
let lastTs = 0
let cssW = 0, cssH = 0
let ro = null
let firstLoad = true

// ---- 用户设置 ----
try {
  const saved = JSON.parse(localStorage.getItem('xianyang.demo') || '{}')
  if (SPEEDS.includes(saved.speed)) speed.value = saved.speed
  if (typeof saved.loop === 'boolean') loop.value = saved.loop
  if (saved.endMode === 'return' || saved.endMode === 'hold') endMode.value = saved.endMode
  if (typeof saved.syncVoice === 'boolean') syncVoice.value = saved.syncVoice
} catch { /* file:// 下不可写，忽略 */ }

function persist() {
  try {
    localStorage.setItem('xianyang.demo', JSON.stringify({
      speed: speed.value, loop: loop.value, endMode: endMode.value, syncVoice: syncVoice.value,
    }))
  } catch { /* ignore */ }
}

const dur = computed(() => anim.value?.dur || 1)
const pct = computed(() => Math.min(1, t.value))

const seg = computed(() => {
  const ks = anim.value?.keys
  if (!ks) return null
  let i = 0
  while (i < ks.length - 2 && t.value * dur.value >= ks[i + 1].t) i++
  return ks[i + 1] || ks[ks.length - 1]
})
const phaseText = computed(() => PHASE_TEXT[seg.value?.phase] || '')
const phaseMarks = computed(() => [
  { label: '起始', on: seg.value?.phase === 'start' },
  { label: '发力', on: seg.value?.phase === 'work' },
  { label: '结束', on: seg.value?.phase === 'end' },
])

const endKeyT = computed(() => {
  const k = (anim.value?.keys || []).find((x) => x.phase === 'end')
  return k ? k.t : dur.value * 0.5
})

// ---- 切式：立即换动画 ----
watch(() => props.animKey, () => loadAnim())

function loadAnim() {
  photoOk.value = true
  state.value = 'loading'
  t.value = 0
  playing.value = true
  clearTimeout(loadTimer)
  loadTimer = setTimeout(() => {
    anim.value = getAnim(props.animKey)
    state.value = anim.value ? 'ready' : 'missing'
    firstLoad = false
    measure()
  }, firstLoad ? 0 : PLACEHOLDER_MS)
}

// ---- 语音同步 ----
watch(() => props.voiceSpeaking, (sp, prev) => {
  if (!syncVoice.value || state.value !== 'ready') return
  if (sp && !prev) {
    t.value = 0
    playing.value = true
  } else if (!sp && prev) {
    if (endMode.value === 'hold') { t.value = endKeyT.value / dur.value; playing.value = false }
    else { t.value = 0; playing.value = true }
  }
})

// ---- 播放控制 ----
function togglePlay() {
  if (state.value !== 'ready') return
  playing.value = !playing.value
  if (playing.value && !loop.value && t.value >= 0.999) t.value = 0
}
function replay() { if (state.value === 'ready') { t.value = 0; playing.value = true } }
function setSpeed(s) { speed.value = s; persist() }
function setLoop(v) { loop.value = v; persist() }

function seek(e) {
  if (state.value !== 'ready' || !progEl.value) return
  const r = progEl.value.getBoundingClientRect()
  t.value = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
  if (!collapsed.value) requestAnimationFrame(measure)
}

// ---- 播放循环（连续插值）----
function tick(ts) {
  if (!lastTs) lastTs = ts
  const dt = Math.min(0.1, (ts - lastTs) / 1000)
  lastTs = ts
  if (playing.value && state.value === 'ready' && anim.value) {
    t.value += (dt * speed.value) / dur.value
    if (t.value >= 1) {
      if (loop.value) t.value -= 1
      else { t.value = 1; playing.value = false }
    }
  }
  draw()
  raf = requestAnimationFrame(tick)
}

// ---- 姿态插值（缓入缓出，连续）----
function ease(k) { return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k))) }

function lerpPose(a, b, k) {
  const out = {}
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * k
  return out
}

function currentPose() {
  const a = anim.value
  if (!a) return DEFAULT_POSE
  const ks = a.keys
  const tt = t.value * a.dur
  let i = 0
  while (i < ks.length - 2 && tt >= ks[i + 1].t) i++
  const k0 = ks[i], k1 = ks[i + 1] || ks[i]
  const span = Math.max(0.001, k1.t - k0.t)
  const k = ease((tt - k0.t) / span)
  return lerpPose(k0.pose, k1.pose, k)
}

// ---- 柔和疗养风小人绘制 ----
function draw() {
  const c = cv.value
  if (!c || state.value !== 'ready') return
  const ctx = c.getContext('2d')
  const w = cssW, h = cssH
  if (!w || !h) return
  ctx.clearRect(0, 0, w, h)

  const p = currentPose()
  const u = Math.min(w, h)
  const rad = Math.PI / 180
  const working = seg.value?.phase === 'work'

  // 疗养配色：暖米金主体，发力时淡橙点缀
  const colBody = working ? '#e8c9a0' : '#d9c9a3'
  const colLimb = working ? '#e0b184' : '#cbb98f'
  const colHead = '#e6d2ac'
  const colAccent = working ? '#e8a85c' : 'rgba(214,197,158,.55)'

  // 地面柔影
  const groundY = h * 0.88
  ctx.fillStyle = 'rgba(0,0,0,.22)'
  ctx.beginPath()
  ctx.ellipse(w / 2, groundY + u * 0.015, u * 0.16, u * 0.028, 0, 0, Math.PI * 2)
  ctx.fill()

  const legLen = u * 0.15
  const pelvisY = groundY - legLen * 2 * (1 - p.crouch * 0.32) - p.lift * u * 0.025
  const spineLen = u * 0.23 * (1 - p.bend * 0.42)
  const leanR = p.lean * rad

  const pelvis = { x: w / 2, y: pelvisY }
  const neck = { x: w / 2 + Math.sin(leanR) * spineLen, y: pelvisY - Math.cos(leanR) * spineLen + p.bend * u * 0.05 }
  const headR = u * 0.052
  const head = {
    x: neck.x + Math.sin(leanR) * headR * 1.1 + (p.head / 60) * headR * 1.6,
    y: neck.y - headR * 1.45,
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 腿（圆头粗线）
  const hipW = u * 0.045
  const kb = p.crouch * 58
  ctx.strokeStyle = colLimb
  ctx.lineWidth = u * 0.042
  for (const leg of [{ dir: -1, ang: p.legL }, { dir: 1, ang: p.legR }]) {
    const hip = { x: pelvis.x + leg.dir * hipW, y: pelvis.y }
    const a = leg.ang * rad
    const knee = { x: hip.x + Math.sin(a) * legLen * leg.dir, y: hip.y + Math.cos(a) * legLen }
    const shinAng = (leg.dir === 1 ? leg.ang - kb : leg.ang + kb) * rad
    const foot = { x: knee.x + Math.sin(shinAng) * legLen * leg.dir, y: knee.y + Math.cos(shinAng) * legLen }
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke()
    // 脚（小圆头）
    ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(foot.x + leg.dir * u * 0.04, foot.y); ctx.stroke()
  }

  // 躯干：胶囊形（粗线圆头），带呼吸微起伏
  const breath = 1 + 0.05 * Math.sin(performance.now() / 1000 * Math.PI * 2 / 4)
  ctx.strokeStyle = colBody
  ctx.lineWidth = u * 0.085 * breath
  ctx.beginPath(); ctx.moveTo(pelvis.x, pelvis.y); ctx.lineTo(neck.x, neck.y); ctx.stroke()

  // 手臂
  const shW = u * 0.075
  const upper = u * 0.11, fore = u * 0.10
  ctx.strokeStyle = colLimb
  ctx.lineWidth = u * 0.038
  for (const arm of [{ dir: -1, a: p.aL, e: p.eL }, { dir: 1, a: p.aR, e: p.eR }]) {
    const sh = { x: neck.x + arm.dir * shW, y: neck.y }
    const a1 = arm.a * rad
    const el = { x: sh.x + Math.sin(a1) * upper * arm.dir, y: sh.y + Math.cos(a1) * upper }
    const a2 = (arm.a - arm.e) * rad
    const hand = { x: el.x + Math.sin(a2) * fore * arm.dir, y: el.y + Math.cos(a2) * fore }
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(el.x, el.y); ctx.lineTo(hand.x, hand.y); ctx.stroke()
    // 手（小圆）
    ctx.fillStyle = colHead
    ctx.beginPath(); ctx.arc(hand.x, hand.y, u * 0.016, 0, Math.PI * 2); ctx.fill()
  }

  // 头（实心圆）+ 丸子头（疗养国风细节）+ 面向提示
  ctx.fillStyle = colHead
  ctx.beginPath(); ctx.arc(head.x, head.y, headR, 0, Math.PI * 2); ctx.fill()
  const bun = { x: head.x - (p.head / 60) * headR * 0.6, y: head.y - headR * 0.95 }
  ctx.fillStyle = colAccent
  ctx.beginPath(); ctx.arc(bun.x, bun.y, headR * 0.34, 0, Math.PI * 2); ctx.fill()
  // 头转方向的小弧线（往后瞧时可见）
  if (Math.abs(p.head) > 12) {
    ctx.strokeStyle = colAccent
    ctx.lineWidth = u * 0.008
    ctx.beginPath()
    ctx.arc(head.x + Math.sign(p.head) * headR * 0.5, head.y, headR * 1.25,
      Math.sign(p.head) > 0 ? -0.5 : Math.PI - 0.5, Math.sign(p.head) > 0 ? 0.6 : Math.PI + 0.6)
    ctx.stroke()
  }
}

// ---- 尺寸自适应 ----
function measure() {
  if (!box.value || !cv.value) return
  const r = box.value.getBoundingClientRect()
  if (!r.width || !r.height) return
  cssW = r.width; cssH = r.height
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  cv.value.width = Math.round(r.width * dpr)
  cv.value.height = Math.round(r.height * dpr)
  cv.value.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
}

onMounted(() => {
  ro = new ResizeObserver(measure)
  ro.observe(box.value)
  measure()
  loadAnim()
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  clearTimeout(loadTimer)
  cancelAnimationFrame(raf)
  ro?.disconnect()
})
</script>

<style scoped>
/* 悬浮抽屉：绝对定位在跟练页右侧空白，不参与布局流，绝不挤压摄像头画面。
   尺寸按「给观众参考动作」的定位放大：宽 ~360px、舞台 ~340px 高 */
.demo {
  position: absolute; right: 14px; top: 58px; z-index: 40;
  width: min(360px, calc(100vw - 28px));
  display: flex; flex-direction: column;
  background: rgba(22, 18, 14, .93);
  border: 1px solid rgba(232, 224, 208, .14);
  border-radius: var(--r-m);
  box-shadow: 0 8px 32px rgba(0, 0, 0, .5);
  overflow: hidden;
  backdrop-filter: blur(6px);
}

/* 收起态浮钮 */
.float-btn {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(22, 18, 14, .92); border: 1px solid rgba(214,197,158,.3);
  color: var(--jin); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  box-shadow: 0 4px 16px rgba(0,0,0,.4); margin-left: auto;
}
.fb-ico { font-size: 16px; line-height: 1; }
.fb-txt { font-size: 9px; font-family: var(--font-ui); letter-spacing: 1px; }

.demo-head {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 10px; user-select: none;
  border-bottom: 1px solid rgba(232, 224, 208, .08);
}
.dh-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(232,224,208,.2); flex: 0 0 auto; }
.dh-dot.live { background: var(--zhu); animation: demo-pulse 1.1s ease-in-out infinite; }
@keyframes demo-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
.dh-title { font-size: 12px; color: var(--xuan); letter-spacing: 1.5px; flex: 0 0 auto; }
.dh-phase { font-size: 10px; color: var(--jin); font-family: var(--font-ui); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dh-speed { font-size: 10px; color: var(--zhu); font-family: var(--font-ui); flex: 0 0 auto; }
.dh-btn {
  margin-left: auto; padding: 2px 9px; font-size: 12px; border-radius: 6px;
  background: rgba(232,224,208,.08); color: var(--xuan-dim); border: none;
  font-family: var(--font-ui); cursor: pointer; flex: 0 0 auto; line-height: 1.4;
}

.demo-body { display: flex; flex-direction: column; padding: 8px; gap: 8px; overflow-y: auto; }

.cv-box {
  position: relative; height: 340px; flex: 0 0 auto;
  background: rgba(10, 8, 6, .45); border-radius: 10px; overflow: hidden;
}
.cv-box canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

.ph {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 9px; padding: 10px; text-align: center;
}
.ph p { font-size: 11px; color: var(--xuan-dim); font-family: var(--font-ui); line-height: 1.7; margin: 0; }
.ph-spin {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid rgba(232,224,208,.15); border-top-color: var(--zhu);
  animation: demo-spin 1s linear infinite;
}
@keyframes demo-spin { to { transform: rotate(360deg) } }
.ph.miss img { max-width: 80%; max-height: 55%; border-radius: 8px; object-fit: contain; }
.ph-blank {
  width: 56px; height: 56px; border-radius: 12px; display: grid; place-items: center;
  background: rgba(232,224,208,.07); color: var(--xuan-faint); font-size: 14px; letter-spacing: 3px;
}
.ph-note { color: var(--xuan-faint) !important; font-size: 10px !important; }

.prog { position: relative; height: 5px; border-radius: 3px; background: rgba(232,224,208,.1); cursor: pointer; flex: 0 0 auto; }
.prog-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--zhu), var(--jin)); }
.prog-cap {
  position: absolute; top: -3px; width: 3px; height: 11px; border-radius: 2px;
  background: rgba(232,224,208,.75); transform: translateX(-1px);
}

.phases { display: flex; gap: 5px; justify-content: center; flex: 0 0 auto; }
.phases span {
  font-size: 9.5px; color: var(--xuan-faint); font-family: var(--font-ui);
  padding: 2px 8px; border-radius: 9px; background: rgba(232,224,208,.05); transition: all .2s;
}
.phases span.on { color: var(--jin); background: rgba(214,197,158,.14); }

.ctrls { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; flex: 0 0 auto; }
.c-btn {
  padding: 4px 9px; font-size: 11px; border-radius: 7px; border: none; cursor: pointer;
  background: rgba(232,224,208,.09); color: var(--xuan-dim); font-family: var(--font-ui);
}
.c-btn.on { background: var(--zhu); color: #fff; }
.c-btn.sm { padding: 4px 7px; font-size: 10px; }
.c-sep { flex: 1; }
.c-sel {
  padding: 3px 4px; font-size: 10px; border-radius: 6px; max-width: 108px;
  background: var(--ink-3); color: var(--xuan); border: 1px solid rgba(232,224,208,.14);
  font-family: var(--font-ui);
}

.sync-row {
  display: flex; align-items: center; gap: 6px; flex: 0 0 auto;
  font-size: 10px; color: var(--xuan-faint); font-family: var(--font-ui); cursor: pointer;
}
.sync-row input { accent-color: var(--zhu); }

/* 窄屏：抽屉改为底部升起，宽度略收，避开摄像头主画面上半 */
@media (max-width: 980px) {
  .demo {
    right: 8px; left: 8px; top: auto; bottom: 118px; width: auto;
  }
  .cv-box { height: 260px; }
}
</style>
