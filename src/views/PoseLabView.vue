<template>
  <div class="lab">
    <!-- ========== 顶栏 ========== -->
    <div class="bar">
      <button class="b ghost sm" @click="back">← 返回</button>
      <div class="ttl">
        <span class="t1">骨架采集台</span>
        <span class="t2" :class="dotCls">{{ stateText }}</span>
      </div>
      <div class="sp"></div>
      <!-- 未启动时高亮提示有说明（首次使用者最容易卡在「不会用」上） -->
      <button class="b sm" :class="{ ghost: helpOn, primary: !helpOn && !ready }" @click="helpOn = !helpOn">
        {{ helpOn ? '收起说明' : '?' + ' 如何采集' }}
      </button>
    </div>

    <!-- ========== 操作指引 ========== -->
    <div class="help" v-if="helpOn">
      <b>怎么用（3 步）</b>
      <ol>
        <li>点「开始采集」→ 允许摄像头 → 站到镜头前让<strong>全身入镜</strong>。</li>
        <li>依次做完<strong>八段锦八式</strong>。每做到一式，点一下下面对应的「式N」按钮做标记。</li>
        <li>点「导出 JSON」→ 文件会下载到手机，点「分享」可直接发到微信/文件传输助手 → 把文件发我。</li>
      </ol>
      <p class="tip">
        <b>关键要求：</b>手机竖着拿、<b>摄像头离人 2~2.5 米</b>（太近膝踝会被裁掉，判定会失效）。
        光线暗会掉点，宁可开灯。<b>不要穿纯黑紧身衣</b>（关键点识别不到）。
      </p>
    </div>

    <!-- ========== 画面 ========== -->
    <div class="stage" ref="stageEl">
      <video ref="video" class="vid" :class="{ flip: mirror }" playsinline muted autoplay></video>
      <canvas ref="canvas" class="cv"></canvas>

      <div class="mask" v-if="booting">
        <div class="spin"></div>
        <div class="mtxt">{{ bootMsg }}</div>
      </div>
      <div class="mask err" v-else-if="fatal">
        <div class="mtxt">{{ fatal }}</div>
        <button class="b" @click="boot">重试</button>
        <button class="b ghost" @click="back">返回</button>
      </div>
      <div class="nohum" v-else-if="ready && !seen">未检测到人体 —— 请站远一点、让全身入镜</div>

      <!-- 录制中红点 -->
      <div class="recdot" v-if="recording"><i></i>REC {{ durText }}</div>
      <div class="tags">
        <span class="tag">{{ fps }} fps</span>
        <span class="tag" v-if="camInfo">{{ camInfo }}</span>
        <span class="tag" :class="{ on: delegate === 'GPU' }">{{ delegate || '—' }}</span>
      </div>
      <!-- 当前最可能命中的式 -->
      <div class="best" v-if="ready && seen">{{ bestName }}<i>{{ bestScore.toFixed(2) }}</i></div>
    </div>

    <!-- ========== 关键点可见度（诊断，默认收起） ==========
         折叠的原因：它有 13 条柱状图，占掉约 90px 高度。
         采集时用户真正要盯的是下面的分数条；等发现某式死活判不出来时
         再展开看是哪几个点掉了 —— 面板里已经直接给出「哪几个点不可用」的文字。 -->
    <div class="vis">
      <button class="vhead vtoggle" @click="visOpen = !visOpen">
        <span>关键点可见度</span>
        <span class="vd" :class="visBad ? 'bad' : 'ok'">{{ visText }}</span>
        <span class="vc">{{ visOpen ? '收起 ▾' : '展开 ▸' }}</span>
      </button>
      <div class="vgrid" v-if="visOpen">
        <div class="vi" v-for="v in visList" :key="v.i">
          <div class="vn">{{ v.name }}</div>
          <div class="vbar"><i :style="{ height: (v.val * 100).toFixed(0) + '%', background: v.col }"></i></div>
          <div class="vv">{{ v.val.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <!-- ========== 八式实时分数 ========== -->
    <div class="scores">
      <div class="shead">
        <span>八式判定</span>
        <span class="sd">阈值 <b>{{ cfg.threshold.toFixed(2) }}</b> · 保持 <b>{{ cfg.holdFrames }}</b> 帧</span>
      </div>
      <div class="srow" v-for="(s, i) in scoreRows" :key="i"
           :class="{ hit: s.hit, lead: s.top }">
        <span class="sn">{{ i + 1 }}</span>
        <span class="sname">{{ s.name }}</span>
        <div class="strack">
          <div class="sfill" :style="{ width: (s.score * 100).toFixed(1) + '%' }"
               :class="{ over: s.score >= cfg.threshold }"></div>
          <div class="smark" :style="{ left: (cfg.threshold * 100).toFixed(1) + '%' }"></div>
        </div>
        <span class="sval">{{ s.score.toFixed(2) }}</span>
      </div>
      <!-- 阈值 / 保持帧 实时调，采完也能改 -->
      <div class="cfgrow">
        <label class="cl">阈值
          <input type="range" min="0.30" max="0.85" step="0.01" v-model.number="cfg.threshold" />
        </label>
        <label class="cl">保持帧
          <input type="range" min="2" max="40" step="1" v-model.number="cfg.holdFrames" />
        </label>
        <label class="cl">余量
          <input type="range" min="0" max="0.30" step="0.01" v-model.number="cfg.margin" />
        </label>
      </div>
      <div class="sfoot">
        互斥余量 <b>{{ cfg.margin.toFixed(2) }}</b>（最高分要领先次名这么多才触发，防止串扰）
      </div>
    </div>

    <!-- ========== 采集控制 ========== -->
    <div class="pane">
      <div class="prow">
        <button class="b big" :class="recording ? 'danger' : 'primary'" @click="toggleRec">
          {{ recording ? '■ 停止采集' : '● 开始采集' }}
        </button>
        <button class="b ghost" @click="reset" :disabled="recording">清空</button>
      </div>

      <div class="marks">
        <div class="mhead">式号标记 <span class="mh">做完一式就点一下，我据此对齐数据</span></div>
        <div class="mgrid">
          <button class="mk" v-for="m in MARK_MOVES" :key="m"
                  :class="{ on: curMark === m.i, passed: markCounts[m.i] > 0 }"
                  @click="mark(m.i)">
            <b>{{ m.i + 1 }}</b><span>{{ m.n }}</span>
          </button>
          <button class="mk rest" :class="{ on: curMark === -1 }" @click="mark(-1)">
            <b>·</b><span>站立/休息</span>
          </button>
        </div>
      </div>

      <div class="opt">
        <label class="sw"><input type="checkbox" v-model="cfg.mirror" /> 镜像画面</label>
        <label class="sw"><input type="checkbox" v-model="cfg.recordWorld" @change="onWorldChange" /> 记录 3D 坐标</label>
        <label class="sw"><input type="checkbox" v-model="cfg.slim" @change="onSlimChange" /> 精简数据（不含手部/脚部 3D）</label>
      </div>
      <div class="orow">
        <label class="cl">分辨率
          <select v-model.number="resIdx" @change="switchRes">
            <option v-for="(r, i) in RESOLUTIONS" :key="r.id" :value="i">{{ r.label }}</option>
          </select>
        </label>
        <label class="cl">摄像头
          <select v-model="devId" @change="switchDev">
            <option value="">默认（前置）</option>
            <option v-for="d in cams" :key="d.deviceId" :value="d.deviceId">{{ d.label }}</option>
          </select>
        </label>
      </div>

      <div class="stat">
        <div class="kv"><span>帧数</span><b>{{ frames.length }}</b></div>
        <div class="kv"><span>时长</span><b>{{ durText }}</b></div>
        <div class="kv"><span>预计体积</span><b>{{ sizeText }}</b></div>
        <div class="kv"><span>无效点率</span><b>{{ rejText }}</b></div>
      </div>

      <div class="prow">
        <button class="b primary" :disabled="!frames.length" @click="exportJson">
          导出 JSON 发我
        </button>
        <button class="b ghost" :disabled="!frames.length" @click="copySummary">复制摘要</button>
      </div>
      <div class="msg" v-if="msg">{{ msg }}</div>
      <!-- 剪贴板被拦时的兜底：摘要原文显示出来，长按可选中 -->
      <textarea v-if="summaryFallback" class="sumfall" readonly
                :value="summaryFallback" @focus="$event.target.select()"></textarea>
    </div>

    <!-- ========== 阈值扫描（拿已采数据离线试参数） ========== -->
    <div class="pane" v-if="frames.length">
      <div class="phead">阈值扫描 <span class="mh">用刚采的数据，逐个阈值试命中率</span></div>
      <div class="scanwrap">
        <table class="scan">
          <thead>
            <tr><th>阈值</th><th v-for="i in 8" :key="i">{{ i }}</th><th>命中</th><th>误报</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in scanRows" :key="row.th"
                :class="{ cur: Math.abs(row.th - cfg.threshold) < 0.005 }">
              <td class="th">{{ row.th.toFixed(2) }}</td>
              <td v-for="(n, i) in row.hit" :key="i" :class="{ on: n > 0 }">{{ n }}</td>
              <td class="ok">{{ row.tp }}</td>
              <td class="bad">{{ row.fp }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="sfoot">
        「命中」＝该式被正确触发的次数；「误报」＝在<b>没标该式</b>的段里被误触发的次数。
        当前阈值行会高亮 —— 直接看它落在哪。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createPoseEngine, drawPose, listCameras, RESOLUTIONS } from '../engine/poseEngine'
import { MoveJudge, NAMES, LM } from '../engine/judge'
import { headPose } from '../engine/pose'

const router = useRouter()
const back = () => router.push('/')

/* ------------------------------------------------------------------
   采集规格常量
   为什么用「帧序号 + 时间戳」而不是只存时间戳：MediaPipe 在不同手机上
   帧率差很多（实测 12~34fps），离线回放时按帧号对齐比按时间稳。
------------------------------------------------------------------ */
// 判定实际依赖的关键点。存全量 33 点会让文件大 2 倍但调参用不上，
// 唯一例外是式4 要鼻子/双眼 —— 已包含。
const KEEP_IDX = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
// 精简模式再砍掉手/脚（15/16/27/28）——只在体积吃紧时用
const KEEP_IDX_SLIM = KEEP_IDX.filter((i) => ![15, 16, 27, 28].includes(i))
// 坐标精度：4 位小数 = 0.1mm 级，判定用 1~3 位，足够；6 位纯浪费体积
const R = (n) => Math.round(n * 10000) / 10000

const MARK_MOVES = NAMES.map((n, i) => ({ i, n: n.slice(0, 4) }))
/* 命中时高亮的点：判定真正依赖的那些（与 judge.js 的 need() 依赖一致） */
const HL_POINTS = [LM.NOSE, LM.L_SHO, LM.R_SHO, LM.L_ELB, LM.R_ELB, LM.L_WRI, LM.R_WRI,
  LM.L_HIP, LM.R_HIP, LM.L_KNE, LM.R_KNE, LM.L_ANK, LM.R_ANK]

/* ---------------- DOM 引用 ---------------- */
const stageEl = ref(null)
const video = ref(null)
const canvas = ref(null)

/* ---------------- 运行状态 ---------------- */
const booting = ref(false)
const bootMsg = ref('')
const fatal = ref('')
const ready = ref(false)
const seen = ref(false)
const stageNow = ref('')
const camInfo = ref('')
const delegate = ref('')
const fps = ref(0)
const helpOn = ref(false)   /* 默认收起：说明占掉首屏 1/3，而用户要盯的是分数条 */
const visOpen = ref(false)  /* 可见度 13 条柱状图占 ~90px，采集时用不到，先收起 */
const msg = ref('')
/* 剪贴板被拒时的兜底内容（非空才渲染 textarea） */
const summaryFallback = ref('')

const cfg = reactive({
  threshold: 0.55,
  holdFrames: 10,
  margin: 0.10,
  mirror: true,
  recordWorld: false,
  slim: false,
})

const recording = ref(false)
const frames = ref([])     // 采集到的帧序列
const marks = ref([])       // { frame: 帧序号, move: 式号(-1=休息) }
const curMark = ref(0)
const markCounts = reactive({})

const resIdx = ref(0)
const devId = ref('')
const cams = ref([])

let engine = null
let judge = null
let rafUI = 0
let fpsAcc = { t: performance.now(), n: 0 }

/* 实时分数（不落盘，用于屏幕显示） */
const liveScores = ref(new Array(8).fill(0))
const liveHits = ref([])
/* 已落盘帧的索引（阈值扫描用）。
   必须是 ref —— 普通数组的 push 不会触发 computed 重算，
   扫描表会一直停在「采集中」的空状态。 */
const replayIdx = ref([])

/* ---------------- 采集 ---------------- */
function startRec() {
  if (!ready.value) return
  frames.value = []
  replayIdx.value = []
  marks.value = [{ frame: 0, move: 0 }]
  for (let i = 0; i < 8; i++) markCounts[i] = 0
  curMark.value = 0
  recording.value = true
  if (judge) judge.reset()
  summaryFallback.value = ''
  msg.value = '采集中。做完一式，点下面对应式号标记；停止后导出 JSON。'
}

function stopRec() {
  recording.value = false
  if (judge) judge.reset()
  // 把最后一帧归到当前标记
  if (frames.value.length) {
    const last = marks.value[marks.value.length - 1]
    last.end = frames.value.length
  }
  const d = durSec.value
  syncReplay()
  msg.value = frames.value.length
    ? `已采 ${frames.value.length} 帧 / ${d.toFixed(1)} 秒（约 ${sizeText.value}）。点「导出 JSON 发我」。`
    : '一帧都没采到，检查摄像头是否被系统占用。'
}

/* 每采完 32 帧挂一次索引，避免每帧都触发 computed 重算（扫描是 O(帧数×12) 的活） */
function syncReplay() {
  replayIdx.value = frames.value.map((_, i) => i)
}

function toggleRec() {
  recording.value ? stopRec() : startRec()
}

function mark(i) {
  curMark.value = i
  if (i >= 0) markCounts[i]++
  if (!recording.value) {
    // 没在采集时点＝预设下一段从第 0 帧开始
    if (!marks.value.length) marks.value.push({ frame: 0, move: i })
    return
  }
  const last = marks.value[marks.value.length - 1]
  if (last && last.move === i && frames.value.length - last.frame < 3) return  // 防抖
  if (last) last.end = frames.value.length
  marks.value.push({ frame: frames.value.length, move: i })
}

function reset() {
  frames.value = []
  replayIdx.value = []
  marks.value = []
  summaryFallback.value = ''
  msg.value = '已清空。'
}

/* ---------------- 每一帧 ---------------- */
function onResult(lm, world, res) {
  if (!ready.value) return

  /* FPS：每 500ms 算一次，不逐帧刷 DOM */
  fpsAcc.n++
  const now = performance.now()
  if (now - fpsAcc.t > 500) {
    fps.value = Math.round((fpsAcc.n * 1000) / (now - fpsAcc.t))
    fpsAcc = { t: now, n: 0 }
  }

  if (!lm) { seen.value = false; liveScores.value = new Array(8).fill(0); return }
  seen.value = true

  /* 判定。
     【顺序坑，踩了两次】MoveJudge.scores() 会往 landmarks 上挂 __bob/__handSwing 等
     时序量，而 __handSwing 持有的是**内部数组的引用**。若先把 landmarks 存进 frames
     再算分，下一帧 _withBob 会 shift 同一个数组，历史帧记录到的值就被改掉了。
     所以必须：先算分 → 再拷贝快照存盘。 */
  let sc = new Array(8).fill(0)
  let hit = []
  let yaw = null
  if (judge) {
    yaw = yawOf(lm, world)
    sc = judge.scores(lm)
    hit = judge.update(lm, yaw)
  }
  liveScores.value = sc
  liveHits.value = hit

  if (recording.value) frames.value.push(snapshotOf(lm, world, sc, yaw))
}

/* 拷贝一帧用于落盘。必须在 judge 算分之后调用（见 onResult 里的顺序坑） */
function snapshotOf(lm, world, scores, yaw) {
  const idx = cfg.slim ? KEEP_IDX_SLIM : KEEP_IDX
  const p = []
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]
    const q = lm[i]
    if (!q) { p.push([0, 0, 0, 0]); continue }
    p.push([R(q.x), R(q.y), R(q.z ?? 0), R(q.visibility ?? 0)])
  }
  const out = { i: frames.value.length, t: Math.round(performance.now()), p, s: scores.slice() }

  if (cfg.recordWorld && world) {
    const w = []
    for (let k = 0; k < idx.length; k++) {
      const q = world[idx[k]]
      if (!q) { w.push([0, 0, 0]); continue }
      w.push([R(q.x), R(q.y), R(q.z ?? 0)])
    }
    out.w = w
  }

  out.y = yaw == null ? null : R(yaw)
  return out
}

/* 头部 yaw（式4 判「转头」要用）。headPose 需要 3D world，没有就返回 null */
function yawOf(lm, world) {
  if (!world) return null
  const hp = headPose(lm, world)
  return hp && hp.available ? hp.yawDeg : null
}

let currentLM = null

/* ---------------- 显示 ---------------- */
function draw(lm) {
  const c = canvas.value
  if (!c) return
  const w = c.clientWidth || 320
  const h = c.clientHeight || 426
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  if (!lm) { c.getContext('2d').clearRect(0, 0, w, h); return }
  // 命中时把判定依赖的关键点全部高亮（金色发光）
  const glow = liveHits.value.length > 0
  drawPose(c.getContext('2d'), lm, w, h, {
    highlight: glow ? HL_POINTS : null,
    glow,
  })
}

/* UI 刷新循环（分数条 / 骨架重绘，不跑推理） */
function uiLoop() {
  if (currentLM) draw(currentLM)
  rafUI = requestAnimationFrame(uiLoop)
}

/* ---------------- 可见度诊断 ---------------- */
// 这几个点是判定硬依赖的，任一低于 VIS_MIN(0.35) 对应式子直接判 0。
const VIS_POINTS = [
  { i: LM.L_SHO, name: '左肩' }, { i: LM.R_SHO, name: '右肩' },
  { i: LM.L_ELB, name: '左肘' }, { i: LM.R_ELB, name: '右肘' },
  { i: LM.L_WRI, name: '左腕' }, { i: LM.R_WRI, name: '右腕' },
  { i: LM.L_HIP, name: '左髋' }, { i: LM.R_HIP, name: '右髋' },
  { i: LM.L_KNE, name: '左膝' }, { i: LM.R_KNE, name: '右膝' },
  { i: LM.L_ANK, name: '左踝' }, { i: LM.R_ANK, name: '右踝' },
  { i: LM.NOSE, name: '鼻子' },
]

const visList = ref([])
const visBad = ref(false)
const visText = ref('')

function updateVis(lm) {
  const out = []
  let bad = []
  for (const p of VIS_POINTS) {
    const v = lm[p.i]?.visibility ?? 0
    out.push({
      i: p.i, name: p.name, val: v,
      col: v < 0.35 ? '#B0552E' : v < 0.6 ? '#d8a03a' : '#5E7C6B',
    })
    if (v < 0.35) bad.push(p.name)
  }
  visList.value = out
  visBad.value = bad.length > 0
  visText.value = bad.length ? `${bad.length} 个点不可用：${bad.slice(0, 4).join('、')}` : '全部可用'
}

/* ---------------- 派生量 ---------------- */
const scoreRows = computed(() => {
  const sc = liveScores.value
  const best = sc.length ? Math.max(...sc) : 0
  const bestI = sc.indexOf(best)
  return NAMES.map((n, i) => ({
    name: n,
    score: sc[i] || 0,
    top: i === bestI && best > 0,
    hit: liveHits.value.some((h) => h.index === i),
  }))
})
const bestScore = computed(() => (liveScores.value.length ? Math.max(...liveScores.value) : 0))
const bestName = computed(() => {
  const s = bestScore.value
  if (s < 0.05) return '—'
  return NAMES[liveScores.value.indexOf(s)] || '—'
})

const durSec = computed(() => {
  const f = frames.value
  if (f.length < 2) return 0
  return (f[f.length - 1].t - f[0].t) / 1000
})
const durText = computed(() => {
  const s = durSec.value
  return `${s.toFixed(1)}s`
})
const sizeText = computed(() => {
  const n = frames.value.length
  if (!n) return '0 KB'
  // 每帧约 (点数×4 + 8 分数) 个数，一个数按 7 字节估
  const per = (cfg.slim ? KEEP_IDX_SLIM.length : KEEP_IDX.length) * 4 * 7 + 8 * 5
  const kb = (n * per) / 1024
  return kb > 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`
})
const rejText = computed(() => {
  if (!engine || !ready.value) return '—'
  const s = engine.cleanStats
  if (!s.frames) return '0%'
  return ((s.rate || 0) * 100).toFixed(1) + '%'
})

const dotCls = computed(() => {
  if (fatal.value) return 'bad'
  if (recording.value) return 'rec'
  if (ready.value) return 'ok'
  return 'wait'
})
const stateText = computed(() => {
  if (fatal.value) return '启动失败'
  if (booting.value) return bootMsg.value || '启动中'
  if (recording.value) return '采集中'
  if (ready.value) return '就绪'
  return '待启动'
})

/* ---------------- 阈值扫描 ----------------
   用已采数据离线遍历一遍阈值，比在真机上反复试快几十倍。
   判定：每个标记段内，该式是否被触发过（命中）；不在该式段内却触发（误报）。

   【必须复用同一个 judge 实例】MoveJudge 靠内部历史窗口（hipHist/wriXHist）
   算式5/6/8 需要的 __bob/__handSwing。每帧 new 一个 → 窗口永远是空的
   → __ready 恒 false → 这三式恒判 0，扫描结果会误导我们。
   所以：外层建一个实例，内层只改 threshold / order（不 reset，
   因为时序窗口必须跨帧连续）。段切换时手动清 counts/latched。 */
const scanRows = computed(() => {
  void replayIdx.value.length          // 建立依赖：采集停止后索引变化会触发重算
  const F = frames.value
  if (F.length < 5) return []
  const segOf = buildSegMap()
  const out = []
  for (let th = 0.30; th <= 0.851; th += 0.05) {
    const thR = Math.round(th * 100) / 100
    const hit = new Array(8).fill(0)
    let tp = 0, fp = 0
    const j = new MoveJudge({ holdFrames: cfg.holdFrames, threshold: thR, margin: cfg.margin })
    let prevWant = undefined
    for (let i = 0; i < F.length; i++) {
      const want = segOf[i]
      // 段切换：清锁存让新段能重新触发；历史窗口保留（时序要连续）
      if (want !== prevWant) { j.counts.fill(0); j.latched.fill(false); prevWant = want }
      j.order = want >= 0 ? want : null
      const h = j.update(lmOf(F[i]), F[i].y)
      if (h.length) {
        h.forEach((x) => {
          if (x.index < 8) hit[x.index]++
          if (want < 0 || x.index !== want) fp++
          else tp++
        })
      }
    }
    out.push({ th: thR, hit, tp, fp })
  }
  return out
})

function buildSegMap() {
  const n = frames.value.length
  const m = new Array(n).fill(-1)
  for (let k = 0; k < marks.value.length; k++) {
    const s = marks.value[k]
    const end = s.end != null ? s.end : n
    for (let i = s.frame; i < Math.min(end, m.length); i++) m[i] = s.move
  }
  return m
}

/* 还原成 judge 能吃的 33 点数组。
   点索引表不靠 cfg.slim 反推 —— 用户可能采到一半才切「精简」，
   那样前后帧的点数不同，反推会错位。逐帧按实际长度匹配，两张表长度不同
   （17 vs 13）不会歧义；都不匹配就按完整表读（宁可多读也不要错位）。 */
function lmOf(f) {
  const n = f.p.length
  const idx = n === KEEP_IDX_SLIM.length ? KEEP_IDX_SLIM
    : n === KEEP_IDX.length ? KEEP_IDX
    : KEEP_IDX
  const a = new Array(33).fill(null)
  for (let k = 0; k < idx.length; k++) {
    const v = f.p[k]
    if (!v) continue
    a[idx[k]] = { x: v[0], y: v[1], z: v[2], visibility: v[3] }
  }
  return a
}

/* ---------------- 导出 ---------------- */
function buildPayload() {
  return {
    tool: 'xianyang-pose-lab',
    v: 1,
    at: new Date().toISOString(),
    device: {
      ua: navigator.userAgent,
      platform: navigator.platform || '',
      touch: 'ontouchstart' in window,
      screen: `${window.screen.width}x${window.screen.height}`,
      dpr: window.devicePixelRatio,
      secure: window.isSecureContext,
    },
    cam: { info: camInfo.value, delegate: delegate.value, res: RESOLUTIONS[resIdx.value]?.id },
    pointIdx: cfg.slim ? KEEP_IDX_SLIM : KEEP_IDX,
    config: { threshold: cfg.threshold, holdFrames: cfg.holdFrames, margin: cfg.margin, slim: cfg.slim, world: cfg.recordWorld },
    nFrames: frames.value.length,
    durationSec: +durSec.value.toFixed(2),
    marks: marks.value,
    frames: frames.value,
  }
}

function fileName(ext) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const dev = (camInfo.value || 'cam').replace(/[^\w一-龥]+/g, '').slice(0, 12)
  return `pose_${dev}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${ext}`
}

function exportJson() {
  const data = JSON.stringify(buildPayload())
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName('json')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  msg.value = `已导出 ${fileName('json')}（${(data.length / 1024).toFixed(0)} KB）。手机上到「文件/下载」里找它，或在下载提示里点「分享」发到微信。`
}

async function copySummary() {
  const s = buildSummary()
  try {
    await navigator.clipboard.writeText(s)
    msg.value = '摘要已复制，粘贴到聊天框发我即可（数据量大时还是发 JSON 文件更准）。'
  } catch {
    // 剪贴板在三种情况下会被拒：非安全上下文（http + 局域网 IP）、
    // 无用户手势、浏览器策略禁用。iOS Safari 尤其容易命中。
    // 兜底：把摘要显示出来让用户长按选中复制。
    summaryFallback.value = s
    msg.value = '剪贴板被浏览器拦住了（手机端常见）。摘要已显示在下方，长按选中复制即可；或直接用「导出 JSON 发我」。'
  }
}

function buildSummary() {
  const p = buildPayload()
  const L = []
  L.push(`【弦养·骨架采集摘要】`)
  L.push(`时间：${p.at}`)
  L.push(`设备：${p.device.platform || p.device.ua.slice(0, 60)} / 触屏=${p.device.touch} / ${p.device.screen}@${p.device.dpr}x / 安全上下文=${p.device.secure}`)
  L.push(`摄像头：${p.cam.info} / delegate=${p.cam.delegate} / ${p.cam.res}`)
  L.push(`数据：${p.nFrames} 帧 / ${p.durationSec}s / 精简=${p.config.slim} / 含3D=${p.config.world}`)
  L.push(`参数：阈值=${p.config.threshold} 保持=${p.config.holdFrames} 余量=${p.config.margin}`)
  L.push(`标记段：${p.marks.map((m) => `#${m.frame}${m.move < 0 ? '(休息)' : '式' + (m.move + 1)}`).join(' → ')}`)
  const rej = engine?.cleanStats
  if (rej) L.push(`净化：总帧 ${rej.frames}，剔除点 ${rej.rejected}（${((rej.rate || 0) * 100).toFixed(2)}%）`)
  const vv = visList.value
  if (vv.length) L.push(`末帧可见度：${vv.map((v) => `${v.name}${v.val.toFixed(2)}`).join(' ')}`)
  L.push(`实时分数：${liveScores.value.map((s, i) => `${i + 1}:${(s || 0).toFixed(2)}`).join(' ')}`)
  const sc = scanRows.value.filter((r) => Math.abs(r.th - cfg.threshold) < 0.026)
  if (sc.length) L.push(`阈值扫描(当前附近)：命中=${sc[0].hit.join(',')} 命中数=${sc[0].tp} 误报=${sc[0].fp}`)
  return L.join('\n')
}

/* ---------------- 启动 ---------------- */
async function boot() {
  fatal.value = ''
  booting.value = true
  ready.value = false
  seen.value = false
  bootMsg.value = '读取推理运行时…'
  stageNow.value = 'wasm'
  try {
    if (engine) { engine.dispose(); engine = null }
    engine = await createPoseEngine({ numPoses: 1, delegate: 'GPU' })
    engine.on('status', (s) => {
      stageNow.value = s.stage
      bootMsg.value = stageDetail(s)
      if (s.stage === 'model' && s.detail && /CPU/.test(s.detail)) delegate.value = 'CPU'
    })
    engine.on('error', (e) => { console.error('[poselab]', e) })
    engine.on('result', (lm, world) => {
      currentLM = lm
      onResult(lm, world)
      if (lm) updateVis(lm)
    })

    bootMsg.value = '打开摄像头…'
    stageNow.value = 'camera'
    // 摄像头可能被别的程序占着（相机 / 会议软件 / 另一个浏览器页）。
    // 「Device in use」是可恢复的 —— 退避重试 3 次（1/2/4 秒），
    // 比直接报死「启动失败」对现场有用得多。
    const info = await openCameraWithRetry()
    camInfo.value = `${info.width}×${info.height}${info.label ? ' ' + info.label : ''}`
    if (!delegate.value) delegate.value = 'GPU'
    ready.value = true
    bootMsg.value = '就绪'
    loadCams()
  } catch (e) {
    console.error(e)
    fatal.value = camErrorText(e)
  } finally {
    booting.value = false
  }
}

/** 摄像头被占时退避重试。3 次（1s / 2s / 4s），共约 7 秒。 */
async function openCameraWithRetry() {
  const waits = [0, 1000, 2000, 4000]
  let lastErr = null
  for (let i = 0; i < waits.length; i++) {
    if (waits[i]) {
      bootMsg.value = `摄像头被占用，${(waits[i] / 1000)} 秒后重试（${i}/3）…`
      // 循环 await，但让出主线程，UI 上的提示才能刷新出来
      await new Promise((r) => setTimeout(r, waits[i]))
    }
    const r = RESOLUTIONS[resIdx.value]
    try {
      return await engine.start(video.value, {
        deviceId: devId.value || null,
        width: r.w, height: r.h,
      })
    } catch (e) {
      lastErr = e
      if (!/in use|Track start|NotReadable/i.test(String(e?.message || e))) throw e
    }
  }
  throw lastErr
}

function stageDetail(s) {
  if (s.stage === 'wasm') return '读取推理运行时…'
  if (s.stage === 'model') return s.detail || '加载姿态模型…'
  if (s.stage === 'camera') return '打开摄像头…'
  if (s.stage === 'ready') return `就绪 ${s.detail}`
  return '启动中…'
}

function camErrorText(e) {
  const m = String(e?.message || e || '')
  if (/in use|NotReadable|Track start/i.test(m)) {
    return '摄像头正被其它程序占用（相机、微信视频、会议软件，或本机另一个浏览器页）。关掉它们后点「重试」——本工具已自动重试过 3 次。'
  }
  if (/Permission|NotAllowed|denied/i.test(m)) return '摄像头权限被拒绝。请在浏览器地址栏的权限图标里允许摄像头，然后重试。'
  if (/NotFound|Requested device/i.test(m)) return '找不到摄像头设备。换一台设备试试，或在「摄像头」下拉里手动选。'
  if (/secure|Insecure/i.test(m)) return '当前不是安全上下文。摄像头要求 https 或 localhost，请用 https 链接打开。'
  return '启动失败：' + m
}

async function loadCams() {
  try {
    cams.value = await listCameras()
  } catch { /* 枚举失败不影响主流程 */ }
}

async function switchDev() {
  if (!engine || !video.value) return
  const r = RESOLUTIONS[resIdx.value]
  try {
    const info = await engine.switchDevice(video.value, devId.value, { width: r.w, height: r.h })
    camInfo.value = `${info.width}×${info.height}${info.label ? ' ' + info.label : ''}`
    msg.value = '已切摄像头。'
  } catch (e) { msg.value = '切换失败：' + (e?.message || e) }
}

async function switchRes() {
  if (!engine || !video.value) return
  const r = RESOLUTIONS[resIdx.value]
  const out = await engine.setResolution(video.value, r.w, r.h)
  msg.value = out ? `分辨率 → ${out.width}×${out.height}` : '该设备不支持此分辨率（保持原样）。'
}

function onWorldChange() {
  if (cfg.recordWorld && !frames.value.length) return
  msg.value = cfg.recordWorld
    ? '已开 3D 记录。注意：改这个开关不会改变已采的帧，切换后请重新采集。'
    : '已关 3D 记录。'
}
function onSlimChange() {
  msg.value = cfg.slim
    ? '精简模式：体积约减半，但不含手/脚细节。切换后请重新采集。'
    : '完整模式。切换后请重新采集。'
}

/* 尺寸跟随 */
function fitCanvas() {
  const c = canvas.value
  if (!c) return
  const w = c.clientWidth || 320
  const h = c.clientHeight || 426
  c.width = w
  c.height = h
}

/* 配置变化 → 换 judge 实例（阈值等要在下一帧生效） */
watch(() => [cfg.threshold, cfg.holdFrames, cfg.margin], () => {
  if (judge) {
    judge.threshold = cfg.threshold
    judge.holdFrames = cfg.holdFrames
    judge.margin = cfg.margin
  }
})
watch(() => cfg.mirror, () => {})

onMounted(async () => {
  judge = new MoveJudge({ holdFrames: cfg.holdFrames, threshold: cfg.threshold, margin: cfg.margin })
  await nextTick()
  fitCanvas()
  window.addEventListener('resize', fitCanvas)
  window.addEventListener('orientationchange', fitCanvas)
  rafUI = requestAnimationFrame(uiLoop)
  // iOS 需要用户手势里才能起摄像头，直接 autoplay 会被拒
  await boot()
  // 8 秒后若摄像头 label 还是空的（说明刚拿到权限），补枚举一次
  setTimeout(loadCams, 8000)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafUI)
  window.removeEventListener('resize', fitCanvas)
  window.removeEventListener('orientationchange', fitCanvas)
  engine?.dispose()
  engine = null
})
</script>

<style scoped>
/* 采集台是调试工具，用深色底（和摄像头 HUD 一致），不套 .wrap 的水墨底。
   深色下白骨架才看得清 —— 这是深色 HUD 清单里的一员，
   fix-light-rgba.py 的 LIGHT_VIEWS 不含本文件。 */
.lab {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  overflow: hidden;
  background: #14120f;
  color: #e8e0d0;
  font-family: var(--font-ui);
}

.bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; row-gap: 6px;
  padding: calc(10px + var(--safe-t)) calc(12px + var(--safe-r)) 10px calc(12px + var(--safe-l));
  border-bottom: 1px solid rgba(232, 224, 208, .12);
  flex: 0 0 auto;
}
.bar .ttl { display: flex; flex-direction: column; line-height: 1.25; }
.bar .t1 { font-size: 15px; letter-spacing: 2px; font-family: var(--font); }
.bar .t2 { font-size: 11px; color: #8a8172; }
.bar .t2.ok { color: #7fb069; }
.bar .t2.rec { color: #B0552E; }
.bar .t2.bad { color: #B0552E; }
.bar .t2.wait { color: #8a8172; }
.sp { flex: 1; }

.b {
  padding: 9px 16px; border-radius: 9px; font-size: 13px;
  background: rgba(232, 224, 208, .1); color: #e8e0d0;
  border: 1px solid rgba(232, 224, 208, .18);
  min-height: var(--tap);
  transition: .16s;
}
.b:active { transform: scale(.97); }
.b.sm { padding: 7px 12px; font-size: 12px; min-height: 38px; }
.b.primary { background: var(--zhu); border-color: var(--zhu); color: #fff; }
.b.danger { background: #8c2f22; border-color: #8c2f22; color: #fff; }
.b.ghost { background: transparent; }
.b.big { flex: 1; min-height: 50px; font-size: 15px; letter-spacing: 1px; }
.b:disabled { opacity: .38; }

.help {
  padding: 12px 14px; background: rgba(232, 176, 32, .1);
  border-bottom: 1px solid rgba(232, 176, 32, .28);
  font-size: 12px; line-height: 1.75; color: #d8cfbe; flex: 0 0 auto;
}
.help b { color: #e8c07a; }
.help ol { margin: 6px 0 8px; padding-left: 20px; }
.help li { margin: 3px 0; }
.help strong { color: #e8c07a; }
.help .tip { margin: 0; color: #a89e8c; }
.help .tip b { color: #d8a03a; }

/* ---- 画面区：竖屏 3:4 ----
   【为什么限高 42dvh】采集台的首屏必须能看到「八式判定」分数条 ——
   那是用户做动作时唯一要盯的反馈。画面给太大就会把它顶到折叠线以下
   （实测 52dvh 时分数条完全在首屏外，等于没有）。
   42dvh 留给：顶栏 + 画面 + 分数条前 4 行，够用。 */
.stage {
  position: relative; flex: 0 0 auto;
  width: 100%; aspect-ratio: 3 / 4;
  max-height: 42vh; max-height: 42dvh;
  background: #000; overflow: hidden;
}
.vid, .cv { position: absolute; inset: 0; width: 100%; height: 100%; }
.vid { object-fit: contain; opacity: .9; }
.vid.flip { transform: scaleX(-1); }
.cv { pointer-events: none; }

.mask {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: rgba(10, 9, 8, .82); padding: 20px; text-align: center;
}
.mtxt { font-size: 13px; color: #d8cfbe; max-width: 300px; line-height: 1.7; }
.mask.err .mtxt { color: #f0a898; }
.spin {
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid rgba(232, 224, 208, .2); border-top-color: var(--zhu);
  animation: sp .8s linear infinite;
}
@keyframes sp { to { transform: rotate(360deg); } }

.nohum {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: rgba(10, 9, 8, .72); padding: 9px 14px; border-radius: 8px;
  font-size: 12px; color: #e8c07a; white-space: nowrap;
}

.recdot {
  position: absolute; left: 10px; top: 10px;
  display: flex; align-items: center; gap: 6px;
  background: rgba(140, 47, 34, .85); padding: 4px 9px; border-radius: 7px;
  font-size: 11.5px; color: #fff; font-variant-numeric: tabular-nums;
}
.recdot i { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: bl 1s infinite; }
@keyframes bl { 50% { opacity: .25; } }

.tags {
  position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column;
  gap: 4px; align-items: flex-end;
}
.tag {
  background: rgba(10, 9, 8, .6); padding: 2px 7px; border-radius: 5px;
  font-size: 10.5px; color: #b8ae9c; font-variant-numeric: tabular-nums;
}
.tag.on { color: #7fb069; }

.best {
  position: absolute; left: 10px; bottom: 10px;
  background: rgba(10, 9, 8, .7); padding: 4px 10px; border-radius: 8px;
  font-size: 12px; color: #e8e0d0; display: flex; align-items: baseline; gap: 7px;
}
.best i { font-style: normal; color: var(--zhu); font-variant-numeric: tabular-nums; font-size: 14px; }

/* ---- 以下区块可滚动 ---- */
.lab > .vis, .lab > .scores, .lab > .pane {
  flex: 0 0 auto;
}
.lab { overflow-y: auto; -webkit-overflow-scrolling: touch; }
.stage { position: sticky; top: 0; z-index: 3; }

.vis, .scores, .pane {
  padding: 11px 13px;
  border-top: 1px solid rgba(232, 224, 208, .1);
  padding-bottom: 11px;
  padding-left: calc(13px + var(--safe-l));
  padding-right: calc(13px + var(--safe-r));
}
.vhead, .shead, .phead, .mhead {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  font-size: 11.5px; color: #8a8172; margin-bottom: 8px;
}
/* 可点击的折叠头：整行都是热区，手机上不用精准点 */
.vtoggle {
  width: 100%; text-align: left; min-height: 34px;
  margin-bottom: 0; background: transparent; color: #8a8172;
  font-size: 11.5px; font-family: inherit;
}
.vtoggle .vc { margin-left: auto; color: #7A6855; font-size: 10.5px; }
.vhead .vd { margin-left: auto; }
.vhead .vd + .vc { margin-left: 10px; }
.vd.ok { color: #7fb069; }
.vd.bad { color: #e0a44a; }
.mh { color: #7A6855; font-size: 10.5px; }

.vgrid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 9px;
}
.vi { text-align: center; }
.vn { font-size: 9.5px; color: #8a8172; margin-bottom: 3px; }
.vbar {
  height: 34px; background: rgba(232, 224, 208, .08); border-radius: 3px;
  position: relative; overflow: hidden;
}
.vbar i { position: absolute; left: 0; right: 0; bottom: 0; display: block; transition: height .12s; }
.vv { font-size: 9px; color: #7A6855; margin-top: 2px; font-variant-numeric: tabular-nums; }

.srow {
  display: flex; align-items: center; gap: 7px; padding: 2px 0;
  font-size: 11px;
}
.srow .sn {
  width: 17px; height: 17px; border-radius: 4px; flex: 0 0 auto;
  background: rgba(232, 224, 208, .1); color: #8a8172;
  display: grid; place-items: center; font-size: 10px;
}
.srow .sname {
  width: 62px; flex: 0 0 auto; color: #8a8172;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.strack {
  flex: 1; height: 8px; background: rgba(232, 224, 208, .08);
  border-radius: 4px; position: relative; overflow: hidden;
}
.sfill {
  height: 100%; background: rgba(200, 93, 77, .5); border-radius: 4px;
  transition: width .1s linear;
}
.sfill.over { background: var(--zhu); }
.smark { position: absolute; top: -1px; bottom: -1px; width: 1px; background: rgba(232, 224, 208, .55); }
.sval {
  width: 30px; flex: 0 0 auto; text-align: right;
  font-variant-numeric: tabular-nums; color: #b8ae9c; font-size: 10.5px;
}
.srow.lead .sname { color: #e8e0d0; }
.srow.hit .sn { background: var(--zhu); color: #fff; }
.srow.hit .sname { color: #e8c07a; }
.srow.hit .sval { color: #e8c07a; }

.sd { margin-left: auto; font-size: 10.5px; color: #7A6855; }
.sd b { color: #d8a03a; font-weight: 500; }
.sfoot { font-size: 10.5px; color: #7A6855; margin-top: 7px; line-height: 1.6; }
.sfoot b { color: #b8ae9c; }

.cfgrow, .orow { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 9px; }
.cl { font-size: 11px; color: #8a8172; display: flex; align-items: center; gap: 6px; flex: 1 1 45%; }
.cl input[type=range] { flex: 1; min-width: 70px; }
.cl select {
  flex: 1; min-height: 38px; font-size: 12px; font-family: inherit;
  background: rgba(232, 224, 208, .1); color: #e8e0d0;
  border: 1px solid rgba(232, 224, 208, .18); border-radius: 7px; padding: 6px 8px;
}
.cl select option { background: #14120f; color: #e8e0d0; }

.opt { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 9px; }
.sw {
  display: flex; align-items: center; gap: 7px; font-size: 11.5px;
  color: #b8ae9c; cursor: pointer; min-height: 38px; padding: 2px 2px;
}
.sw input { accent-color: var(--zhu); width: 22px; height: 22px; flex: 0 0 auto; }

.prow { display: flex; gap: 9px; margin-top: 11px; }

.mgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.mk {
  padding: 7px 4px; border-radius: 9px; text-align: center;
  background: rgba(232, 224, 208, .07); border: 1px solid rgba(232, 224, 208, .14);
  min-height: var(--tap);
}
.mk b { display: block; font-size: 15px; color: #d8cfbe; line-height: 1.2; }
.mk span { display: block; font-size: 9.5px; color: #7A6855; margin-top: 2px; }
.mk.passed { border-color: rgba(127, 176, 105, .45); }
.mk.passed b { color: #7fb069; }
.mk.on { background: var(--zhu); border-color: var(--zhu); }
.mk.on b, .mk.on span { color: #fff; }
.mk.rest { grid-column: span 3; }

.stat {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(232, 224, 208, .1);
}
.kv { text-align: center; }
.kv span { display: block; font-size: 9.5px; color: #7A6855; }
.kv b { display: block; font-size: 13px; color: #d6c59e; font-weight: 500; margin-top: 2px; font-variant-numeric: tabular-nums; }

.msg {
  margin-top: 9px; font-size: 11.5px; line-height: 1.7; color: #a89e8c;
  background: rgba(232, 224, 208, .05); padding: 9px 11px; border-radius: 8px;
}
/* 剪贴板兜底：手机上长按可选中整段。字号 ≥16px 否则 iOS 会自动放大页面 */
.sumfall {
  width: 100%; margin-top: 8px; min-height: 150px; resize: vertical;
  font-family: ui-monospace, Consolas, monospace; font-size: 16px; line-height: 1.55;
  color: #d8cfbe; background: rgba(10, 9, 8, .6);
  border: 1px solid rgba(232, 224, 208, .2); border-radius: 8px; padding: 10px;
  -webkit-user-select: text; user-select: text;
}

.scanwrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.scan { border-collapse: collapse; font-size: 10.5px; width: 100%; min-width: 340px; }
.scan th, .scan td {
  padding: 3px 4px; text-align: center;
  border-bottom: 1px solid rgba(232, 224, 208, .08);
  font-variant-numeric: tabular-nums;
}
.scan th { color: #7A6855; font-weight: 400; }
.scan td.th { color: #8a8172; }
.scan td.on { color: var(--zhu); font-weight: 600; }
.scan td.ok { color: #7fb069; }
.scan td.bad { color: #e0a44a; }
.scan tr.cur { background: rgba(200, 93, 77, .12); }
.scan tr.cur td.th { color: #e8c07a; }

@media (min-width: 900px) {
  .stage { max-height: 60vh; }
  .vgrid { grid-template-columns: repeat(13, 1fr); }
  .mgrid { grid-template-columns: repeat(9, 1fr); }
  .mk.rest { grid-column: span 1; }
}
</style>
