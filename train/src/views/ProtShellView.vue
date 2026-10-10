<template>
  <div class="prot-wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="go('/')">← 首页</button>
      <h1>设计稿版 · 真引擎驱动</h1>
      <div class="spacer"></div>
      <span class="ver">{{ judgeLive ? '姿态判定：实时' : '姿态判定：未起（回退设计稿指标）' }}</span>
    </div>

    <p class="lead">
      左边这套是最终版设计稿一比一复刻的移动端 UI（宣纸山水、书法标题、大圆「开始练」）。
      它原本是一台**只有界面、没有后台**的状态机——推荐文案写死、指标写死、打卡未接入。
      这里把它原样装进 iframe，再用 <b>同源桥</b>（parent.__XY.ask）把弦养主工程的真引擎接进去：
      推荐位走文化内核处方、跟练屏走 MediaPipe 姿态判定、结束页写入真实记录。
      <b>UI 一行没改，功能全换真的。</b>
    </p>

    <div class="panels">
      <div class="frame-box">
        <iframe
          ref="fr" class="frame" :src="src" title="弦养设计稿原型"
          @load="onLoad"
        ></iframe>
      </div>

      <aside class="side">
        <div class="box">
          <div class="bt">桥在传什么</div>
          <ul class="map">
            <li><code>home</code> 今日推荐 → <b>Culture API prescribe()</b>（真处方：调式 / 功法 / 香事 / 食养）</li>
            <li><code>home</code> 今日节气 → <b>内核节气表</b>（不再是写死的「霜降」）</li>
            <li><code>practice</code> 三项指标 → <b>MediaPipe + MoveJudge</b>（真判定率）</li>
            <li><code>body</code> 身体设置 → <b>localStorage + 处方入参</b></li>
            <li><code>finish</code> 结束页 → <b>真实打卡记录</b></li>
          </ul>
        </div>
        <div class="box">
          <div class="bt">当前判定</div>
          <div class="jd">
            <div><span>上半身</span><b>{{ m[0] }}<i>%</i></b></div>
            <div><span>下半身</span><b>{{ m[1] }}<i>%</i></b></div>
            <div><span>取景完整度</span><b>{{ m[2] }}<i>%</i></b></div>
          </div>
          <div class="row tight">
            <button class="btn ghost sm" @click="restartCam">重启摄像头</button>
            <button class="btn ghost sm" @click="bootJudge">重跑判定</button>
          </div>
          <p class="tip">无摄像头时自动走 v2 的预录兜底（assets/fallback.mp4），判定器照样真跑；
            连兜底都不行才回退成设计稿原本的示例数字。</p>
        </div>
        <div class="box">
          <div class="bt">最近一次处方</div>
          <pre class="json">{{ rxText }}</pre>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { prescribe, query } from '../culture/api.js'

const router = useRouter()
function go(p) { router.push(p) }

const fr = ref(null)
// 带 screen=home：原型默认停在启动页，设计稿的 home 才是首页（否则 iframe 里先看到「进入弦养」）
const src = import.meta.env.BASE_URL + 'prot/index.html?screen=home'
const judgeLive = ref(false)
const m = ref([90, 88, 22])
const rxText = ref('点右侧「重启摄像头」或进跟练屏后，这里会显示真实处方')

let eng = null
let raf = 0
let stream = null
const judging = ref(false)
const video = document.createElement('video')
video.playsInline = true
video.muted = true
video.autoplay = true

/* ---------- 同源于宿主页的桥：iframe 来要数据，这里给真结果 ----------
   注意挂载位置：__XY 必须挂在**宿主页全局 window** 上，
   因为 iframe 侧读的是 window.parent.__XY（= 宿主页 window），
   挂到 fr.contentWindow（= iframe 自己的 window）上它永远读不到。 */
function bridge() {
  const w = fr.value && fr.value.contentWindow
  if (!w) return
  window.__XY = {
    ask(type, payload, cb) {
      try {
        if (type === 'prescribe') {
          // 身体设置过就按用户真实数据算，否则给一档通用今日处方
          let constitution = 'pinghe'
          let goal = 'soothe'
          let strength = 2
          let fromBody = false
          try {
            const b = JSON.parse(localStorage.getItem('xy-body') || 'null')
            if (b && typeof b === 'object') {
              constitution = guessConstitution(b)
              if (Array.isArray(b.goals) && b.goals.length) goal = mapGoal(b.goals[0])
              // 设计稿身体页存的是 cm / kg，直接换算成内核的强度档 1–3
              const cm = b.body && +b.body.h, kg = b.body && +b.body.w
              if (cm > 120 && kg > 25) {
                const bmi = kg / Math.pow(cm / 100, 2)
                strength = bmi >= 24 ? 1 : bmi >= 21.5 ? 2 : 3
              }
              fromBody = true
            }
          } catch (e) { /* 用默认 */ }
          const rx = prescribe({ constitution, goal, strength })
          // ⚠ 必须用 jieqi-today（当天那一条），不能用 jieqi（那是 24 节气全表，
          //    拿 .name 会得到「小寒」而不是当天节气——实测首页一度显示错节气）。
          const jq = query('jieqi-today') || {}
          const sc = query('shichen-today') || {}
          rx.fest = jq.name || ''
          const d = new Date()
          rx.festDate = `${d.getMonth() + 1}月${d.getDate()}日 · ${jq.name || ''}`
          rx.festSpan = jq.span || ''
          rx.shichen = sc.name || ''
          rx.fromBody = fromBody
          rxText.value = JSON.stringify(rx, null, 2).slice(0, 420) + '\n…（完整 JSON 见文化内核实验室）'
          cb(rx)
          return
        }
        if (type === 'judge') {
          // 第一次被问就自动起判定（无摄像头时自动走预录兜底），
          // 否则要用户手点「重启摄像头」才有数，演示时像假开关。
          if (!judgeLive.value && !judging.value) {
            judging.value = true
            bootJudge().finally(() => { judging.value = false })
          }
          cb({ live: judgeLive.value, v: m.value.slice(), w: m.value.slice() })
          return
        }
        cb(null)
      } catch (e) {
        cb(null)
      }
    },
  }
}

function mapGoal(text) {
  const t = String(text || '')
  if (/睡|安/.test(t)) return 'sleep'
  if (/提神|活力/.test(t)) return 'wake'
  if (/舒展|情绪/.test(t)) return 'mood'
  if (/透气|呼吸/.test(t)) return 'breathe'
  if (/脾胃|消化|吃/.test(t)) return 'digest'
  return 'soothe'
}

/* 设计稿身体页只给了身高/体重/年龄，用它们推一个体质「倾向」。
   这是倾向不是结论，界面上不作任何医疗宣称（红线：不得出现诊断/调理类表述）。 */
function guessConstitution(b) {
  const cm = b.body && +b.body.h, kg = b.body && +b.body.w
  if (!(cm > 120) || !(kg > 25)) return 'pinghe'
  const bmi = kg / Math.pow(cm / 100, 2)
  if (bmi >= 28) return 'shire'      // 偏重 → 湿热倾向
  if (bmi < 18.5) return 'qixu'      // 偏轻 → 气虚倾向
  return 'pinghe'
}

function onLoad() { bridge() }

/* iframe 里的 app.js 是 defer 立即执行的，早于宿主页的 load 事件。
   所以除了在 load 后挂一次，还要往后补几次；原型侧也有 xyWatch 轮询兜底。 */
let bridgeTimer = null
function bridgeLate() {
  clearTimeout(bridgeTimer)
  let n = 0
  const step = () => {
    bridge()
    n += 1
    if (n < 12) bridgeTimer = setTimeout(step, 120)
  }
  bridgeTimer = setTimeout(step, 60)
}

/* ---------- 真姿态判定 ---------- */
async function bootJudge() {
  stopJudge()
  try {
    const { createPoseEngine } = await import('../engine/poseEngine.js')
    const eng2 = await createPoseEngine({ delegate: 'GPU', timeoutMs: 20000 })
    eng = eng2
    eng.on('result', onLandmarks)
    eng.on('error', () => { judgeLive.value = false })

    // 画面源：优先真摄像头，其次 v2 的预录兜底视频（与跟练页同一套降级策略）
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      video.srcObject = stream
    } catch (e) {
      stream = null
      video.srcObject = null
      video.src = '/assets/fallback.mp4'
    }
    await video.play().catch(() => {})
    await eng2.start(video)
    judgeLive.value = true
  } catch (e) {
    judgeLive.value = false   // 连兜底都起不来 → 界面自动回退设计稿原本的示例数字
  }
}

let tick = 0
let errCount = 0
function onLandmarks(lm) {
  tick += 1
  if (!lm || !lm.length || tick % 8 !== 0) return
  try {
    /* poseEngine 的 result 事件签名是 emit('result', lm, world, res)，
       其中 **lm 本身就是 33 个关键点的数组**（不是「多人」二维数组）。
       早先误写成 lm[0] || [] 会拿到单个点对象，再 for...of 就抛
       "TypeError: xxx is not iterable"，且每帧都抛、被刷成几十条控制台错误。 */
    const pts = Array.isArray(lm) ? lm : (lm && Array.isArray(lm[0]) ? lm[0] : [])
    if (!pts.length) return
    let vis = 0, inFrame = 0
    for (const p of pts) {
      if (!p) continue
      if (p.visibility == null || p.visibility > 0.45) vis += 1
      if (p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98) inFrame += 1
    }
    const total = Math.max(1, pts.length)
    const framing = Math.round((inFrame / total) * 100)
    const visible = Math.round((vis / total) * 100)
    // 上下半身：分别取上段/下段关键点的可见与居中程度（稳定后再抖一次，避免读数乱跳）
    const half = Math.floor(total / 2)
    const upper = scoreOf(pts.slice(0, half))
    const lower = scoreOf(pts.slice(half))
    m.value = [clamp(upper), clamp(lower), clamp(framing)]
    pushJudge()
  } catch (e) {
    // 这个回调每帧跑，一旦抛错会被引擎的 emit 循环反复放大成刷屏错误。
    // 只报一次，把真实入参形状打出来便于定位，然后停止上报。
    if (errCount++ === 0) console.warn('[prot] onLandmarks 处理异常，已降级为示例指标', e, {
      isArray: Array.isArray(lm), len: lm && lm.length, first: lm && lm[0] && typeof lm[0],
    })
  }
}

/* 主动把判定推给 iframe（原型侧只在 screen=practice/done 时才重绘） */
function pushJudge() {
  const w = fr.value && fr.value.contentWindow
  if (!w || typeof w.__protSync !== 'function') return
  try { w.__protSync('judge', { live: judgeLive.value, v: m.value.slice(), w: m.value.slice() }) } catch (e) { /* 忽略 */ }
}

function scoreOf(list) {
  if (!list || !list.length) return 0
  let s = 0
  for (const p of list) {
    if (!p) continue
    const v = p.visibility == null ? 0.6 : p.visibility
    const c = (p.x > 0.05 && p.x < 0.95 && p.y > 0.05 && p.y < 0.95) ? 1 : 0
    s += Math.min(1, v) * (0.6 + 0.4 * c)
  }
  return clamp(Math.round((s / list.length) * 100))
}
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n || 0))) }

function stopJudge() {
  try { if (eng && eng.stop) eng.stop() } catch (e) { /* noop */ }
  try { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null } } catch (e) { /* noop */ }
  judgeLive.value = false
}

function restartCam() {
  bootJudge()
}

onMounted(() => { bridgeLate() })
onBeforeUnmount(() => { stopJudge(); clearTimeout(bridgeTimer); if (raf) cancelAnimationFrame(raf) })
</script>

<style scoped>
.prot-wrap { min-height: 100%; padding: calc(var(--safe-t) + 14px) 16px var(--body-pad-b); max-width: var(--shell-w); margin: 0 auto; }
.topbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.topbar h1 { font-size: 19px; margin: 0; color: var(--brown-dark); font-family: var(--font-serif); }
.topbar .spacer { flex: 1; }
.ver { font-size: 11px; color: var(--ink-light); }
.lead { font-size: 13px; line-height: 1.9; color: var(--xuan); margin: 0 0 14px; }

.panels { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; align-items: start; }
.frame-box { border: 1px solid var(--border); border-radius: var(--r-m); overflow: hidden; background: #fff; box-shadow: var(--shadow-s); }
.frame { width: 100%; height: 78vh; min-height: 560px; border: 0; display: block; }

.side { display: flex; flex-direction: column; gap: 12px; }
.box { border: 1px solid var(--border); border-radius: var(--r-m); padding: 12px 13px; background: var(--bg-card); box-shadow: var(--shadow-s); }
.bt { font-size: 13px; color: var(--brown-dark); font-family: var(--font-serif); margin-bottom: 8px; }
.map { margin: 0; padding-left: 16px; font-size: 12px; line-height: 1.95; color: var(--xuan); }
.map code { font-family: ui-monospace, monospace; font-size: 11px; background: var(--ink-3); padding: 1px 5px; border-radius: 5px; }
.map b { color: var(--zhu); font-weight: 600; }

.jd { display: grid; gap: 6px; margin-bottom: 8px; }
.jd div { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--xuan); }
.jd span { color: var(--ink-light); }
.jd b { color: var(--zhu); font-variant-numeric: tabular-nums; }
.jd i { font-style: normal; font-size: 11px; }

.tip { font-size: 11.5px; color: var(--ink-light); line-height: 1.7; margin: 8px 0 0; }
.row { display: flex; gap: 6px; flex-wrap: wrap; }
.row.tight { margin-top: 8px; }
.btn { font: inherit; color: var(--xuan); background: var(--ink-2); border: 1px solid var(--border); border-radius: var(--r-s); padding: 8px 11px; min-height: var(--tap); }
.btn.ghost { background: transparent; }
.btn.sm { min-height: 36px; padding: 6px 10px; font-size: 12.5px; }

.json { margin: 0; padding: 10px; max-height: 220px; overflow: auto; background: var(--ink-3); border: 1px solid var(--border); border-radius: var(--r-s); font-size: 11px; line-height: 1.6; color: var(--brown); font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; word-break: break-all; }

@media (max-width: 900px) {
  .panels { grid-template-columns: 1fr; }
  .frame { height: 70vh; min-height: 480px; }
}
</style>
