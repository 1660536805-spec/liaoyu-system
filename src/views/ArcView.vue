<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="leave('/')">← 首页</button>
      <h1>十二分钟弧线</h1>
      <div class="spacer"></div>
      <button class="btn ghost sm" @click="leave('/order')">点单</button>
    </div>

    <div class="body">
      <p class="lead">
        一条连续不断的底线——12 分钟不重复，照八段锦八式的起、稳、落、峰、收写。做到位时，上面那层会再叠一声泛音。<br />
        <b>五个调式共用同一条结构，只换内容和基音</b>——这正是「同宫系统」最省事的地方：音高集合完全一样，只换谁当家。
      </p>

      <div class="modes">
        <button
          v-for="(m, k) in ARC_MODES" :key="k"
          class="md" :class="{ on: modeKey === k }"
          @click="pickMode(k)"
        >
          <div class="g">{{ m.g }}</div>
          <div class="o">{{ m.o }}</div>
        </button>
      </div>

      <div class="panel">
        <div class="row">
          <button class="btn primary" @click="toggle">{{ playing ? '停止' : '播放' }}</button>
          <span class="lb"><span class="dot" :class="{ live: playing }"></span>{{ stateText }}</span>
          <button class="btn" @click="hit">{{ hitLabel }}</button>
        </div>
        <div class="row">
          <span class="lbl">播放倍速</span>
          <div class="seg">
            <button
              v-for="s in SPEEDS" :key="s"
              :class="{ on: speed === s }"
              @click="setSpeed(s)"
            >{{ s }}×</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <!-- 强度弧线：九段折线 + 进度游标 -->
        <svg class="curve" :viewBox="'0 0 600 150'" preserveAspectRatio="none" aria-label="强度弧线" v-html="curveSvg"></svg>
        <div class="now">
          <span class="name">{{ secName }}</span>
          <span class="tm">{{ tmm }} / 12:00</span>
        </div>
        <div class="hint" v-html="hintText"></div>
        <div class="mot" v-html="motifText"></div>
      </div>

      <div class="foot">
        调律 <b>三分损益律</b>，宫 = F3 174.61&nbsp;Hz。底线用<b>散音</b>（浑厚、余韵长），浮层用<b>泛音</b>（清灵、一触即散）。<br />
        <b>和声骨架（五调通用）</b>：主题三次落<b>基音</b>（完全终止，确立调性）；中段两次落<b>基音上方四度</b>（半终止，悬着）；五、六式下沉低八度、落到<b>非基音</b>上（最暗、不解）；第七式主题原形强奏落基音——<b>全曲唯一的解决点</b>；第八式、收功两处<b>七弦齐鸣</b>收束。<br />
        <b>换调换的是什么</b>：只换七条动机的<b>落音</b>和<b>低音基音</b>——结构、时长、强度曲线、音区安排全部不变。所以五个调听感不同，但「骨架」是同一副。<br />
        <b>注意定位</b>：这是<b>跟练轨</b>（必须跟八段锦强度曲线对齐，只能自产）。练完静坐、日常赏听是另一条轨，那个位置用真人演奏录音更合适。<b>两条轨不互相替代。</b><br />
        <b>氛围音</b>：这一阶段<b>不叠</b>——弧线自己每几拍就有一次基音低八度散音，再垫反而糊。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ARC_MODES, ARC_ORDER, ARC_SECTIONS, ARC_TOTAL,
  arcIAt, arcSecAt, arcLanding, createArcPlayer,
} from '../engine/arc.js'
import { unlockAudio } from '../engine/guqin.js'
import { safeCopy } from '../data/tones.js'

const router = useRouter()

const SPEEDS = [1, 2, 4, 8]
const DEFAULT_SPEED = 4

const modeKey = ref('gong')
const speed = ref(DEFAULT_SPEED)
const playing = ref(false)
const stateText = ref('已停止')
const hitLabel = ref('做到位 · 触发浮层')
const curT = ref(0)
const hitCount = ref(0)

let player = null

function leave(path) { router.push(path) }

/* ---------- 强度曲线（九段折线 + 游标） ---------- */
const curveSvg = computed(() => {
  const x0 = 22, x1 = 584, yLo = 128, yHi = 22
  const X = (t) => x0 + (t / ARC_TOTAL) * (x1 - x0)
  const Y = (v) => yLo - v * (yLo - yHi)
  const pts = []
  for (const s of ARC_SECTIONS) {
    pts.push(`${X(s.t).toFixed(1)},${Y(s.i0).toFixed(1)}`)
    pts.push(`${X(s.t + s.dur).toFixed(1)},${Y(s.i1).toFixed(1)}`)
  }
  const area = `22,${yLo} ` + pts.join(' ') + ` ${X(ARC_TOTAL).toFixed(1)},${yLo}`
  let svg = `<polygon points="${area}" fill="rgba(200, 93, 77,.13)"/>`
  svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#c8553d" stroke-width="1.6"/>`
  for (let i = 1; i < ARC_SECTIONS.length; i++) {
    const xx = X(ARC_SECTIONS[i].t).toFixed(1)
    svg += `<line x1="${xx}" y1="${yHi}" x2="${xx}" y2="${yLo}" stroke="#4a4238" stroke-width="0.7" stroke-dasharray="3 4"/>`
  }
  svg += `<line x1="22" y1="${yLo}" x2="584" y2="${yLo}" stroke="#4a4238" stroke-width="1"/>`
  for (let i = 0; i < ARC_SECTIONS.length; i++) {
    const s = ARC_SECTIONS[i]
    const cx = ((X(s.t) + X(s.t + s.dur)) / 2).toFixed(1)
    const lbl = s.n <= 8 ? String(s.n) : '收'
    svg += `<text x="${cx}" y="145" font-size="11.5" fill="#888780" text-anchor="middle" font-family="system-ui,sans-serif">${lbl}</text>`
  }
  svg += `<line id="arcHead" x1="22" y1="${yHi}" x2="22" y2="${yLo}" stroke="#d6c59e" stroke-width="1.4" opacity="0"/>`
  return svg
})

const curSec = computed(() => arcSecAt(curT.value))

const secName = computed(() => {
  const s = curSec.value
  return s ? `${s.n}. ${s.name}` : '—'
})

const tmm = computed(() => fmt(curT.value))

const hintText = computed(() => {
  const s = curSec.value
  if (!s) return ''
  const t = arcIAt(s, (curT.value - s.t) / s.dur)
  return `强度 <b>${Math.round(t * 100)}</b>　·　旋律音区 <b>${s.oct < 0 ? '低八度' : '中音区'}</b>　·　动机落音 <b>${arcLanding(s, modeKey.value)}</b>`
    + (s.peak ? '　·　<b>全曲唯一的力度上扬</b>' : '')
})

const motifText = computed(() => {
  const m = ARC_MODES[modeKey.value]
  const keys = ['A', 'D', 'B', 'E', 'C', 'C2', 'P', 'Z']
  const label = { A: 'A 主题', D: 'D 展开', B: 'B 中段', E: 'E 变体', C: 'C 下沉', C2: 'C2 最暗', P: 'P 峰', Z: 'Z 收' }
  const lines = keys.map((k) => {
    const ns = m.M[k].slice()
    const tail = ns[ns.length - 1] === m.tonic ? '   ← 落基音' : ''
    return `${label[k]}  ${ns.join(' ')}${tail}`
  })
  // 文案过 safeCopy：甲方红线禁止界面出现「主音」「入脏」
  return safeCopy(`<b>${m.mode}　基音＝${m.g}　对应${m.o}</b><br>${lines.slice(0, 6).join('<br>')}`)
})

function fmt(s) {
  s = Math.max(0, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ---------- 播放控制 ---------- */
function onTick(t) {
  curT.value = t
  // 游标画在 v-html 里，template ref 拿不到，按 id 取
  const line = document.getElementById('arcHead')
  if (line) {
    const x = 22 + (t / ARC_TOTAL) * 562
    line.setAttribute('opacity', '0.95')
    line.setAttribute('x1', x.toFixed(1))
    line.setAttribute('x2', x.toFixed(1))
  }
}

function toggle() {
  unlockAudio()
  if (playing.value) {
    player && player.stop()
    playing.value = false
    stateText.value = '已停止'
    hitLabel.value = '做到位 · 触发浮层'
    return
  }
  player.setMode(modeKey.value)
  player.setSpeed(speed.value)
  player.start()
  playing.value = true
  stateText.value = '播放中'
}

function hit() {
  if (!player) return
  unlockAudio()
  player.hit()
  hitCount.value += 1
  hitLabel.value = `做到位 · 触发浮层（第 ${hitCount.value} 声）`
}

function pickMode(k) {
  const was = playing.value
  if (was) { player.stop(); playing.value = false; stateText.value = '已停止' }
  modeKey.value = k
  curT.value = 0
  if (was) setTimeout(toggle, 400)
}

function setSpeed(s) {
  const was = playing.value
  if (was) { player.stop(); playing.value = false; stateText.value = '已停止' }
  speed.value = s
  if (was) setTimeout(toggle, 400)
}

function onKey(e) { if (e.code === 'Space') { e.preventDefault(); hit() } }

onMounted(() => {
  player = createArcPlayer({ mode: modeKey.value, speed: speed.value, onTick })
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  player && player.stop()
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.body { padding: 14px 16px var(--body-pad-b); max-width: 720px; margin: 0 auto; }
/* 小按钮在手机上要够点：min-height 36px（比 44 略小但仍远好过 26px） */
.sm { padding: 8px 14px; font-size: 13px; min-height: 40px; }
.lead { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.85; margin: 4px 0 18px; font-family: var(--font-ui); }
.lead b { color: var(--jin); font-weight: 500; }

.modes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; }
.md {
  appearance: none; border: 1px solid rgba(92, 70, 50,.14); background: rgba(92, 70, 50,.04);
  color: var(--xuan); border-radius: 14px; padding: 14px 6px 11px; cursor: pointer;
  transition: .18s; font-family: inherit; text-align: center;
}
.md:hover { border-color: rgba(154, 123, 51,.5); background: rgba(92, 70, 50,.08); }
.md .g { font-size: 22px; line-height: 1.15; }
.md .o { font-size: 11.5px; color: var(--xuan-faint); margin-top: 6px; letter-spacing: .08em; }
.md.on { border-color: var(--zhu); background: rgba(200, 93, 77,.14); }
.md.on .g { color: var(--zhu); }
.md.on .o { color: var(--jin); }

.panel {
  border: 1px solid rgba(92, 70, 50,.12); border-radius: 12px;
  background: rgba(92, 70, 50,.03); padding: 16px 18px; margin: 18px 0 0;
}
.row { display: flex; align-items: center; gap: 13px; flex-wrap: wrap; }
.row + .row { margin-top: 14px; }
.lbl { font-size: 12.5px; color: var(--xuan-dim); font-family: var(--font-ui); }
.lbl .lb { font-size: 12.5px; color: var(--xuan-dim); }

.seg { display: flex; border: 1px solid rgba(92, 70, 50,.16); border-radius: 9px; overflow: hidden; }
.seg button {
  appearance: none; font-family: inherit; background: transparent; color: var(--xuan-faint);
  border: 0; border-right: 1px solid rgba(92, 70, 50,.16); padding: 8px 15px; font-size: 12.5px; cursor: pointer; transition: .15s;
}
.seg button:last-child { border-right: 0; }
.seg button.on { background: rgba(200, 93, 77,.18); color: var(--jin); }

.dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: rgba(92, 70, 50,.2); margin-right: 8px; vertical-align: 1px; transition: .2s;
}
.dot.live { background: var(--zhu); }

.curve { display: block; width: 100%; height: auto; margin-top: 2px; }
.now { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.now .name { font-size: 15px; color: var(--jin); }
.now .tm { font-size: 12.5px; color: var(--xuan-faint); font-variant-numeric: tabular-nums; font-family: var(--font-ui); }
.hint { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.8; margin-top: 10px; font-family: var(--font-ui); }
.hint b { color: var(--jin); font-weight: 500; }
.mot { font-size: 12px; color: #7A6855; line-height: 1.9; margin-top: 10px; font-family: ui-monospace, Consolas, monospace; }
.mot b { color: #888780; font-weight: 500; }

.foot { margin-top: 24px; font-size: 12px; color: #7A6855; line-height: 1.95; border-top: 1px solid rgba(92, 70, 50,.12); padding-top: 16px; }
.foot b { color: var(--jin); font-weight: 500; }

@media (max-width: 560px) {
  .modes { gap: 7px; }
  .md { padding: 11px 4px 9px; }
  .md .g { font-size: 19px; }
  .md .o { font-size: 10.5px; letter-spacing: .02em; }
}
</style>
