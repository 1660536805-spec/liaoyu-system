<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="leave('/')">← 首页</button>
      <h1>五音短句工坊</h1>
      <div class="spacer"></div>
      <button class="btn ghost sm" @click="leave('/order')">点单</button>
    </div>

    <div class="body">
      <p class="lead">
        每一音一条可无缝循环的五声短句。开「句尾呼吸」后，每圈前八拍出声、后两拍不起新音，只让余韵散掉。
        全部由浏览器实时合成：零素材、零版权、拔网线照样响。
      </p>

      <div class="tones">
        <button
          v-for="(t, i) in TONES" :key="t.key"
          class="tone" :class="{ on: curKey === t.key }"
          @click="pick(i)"
        >
          <div class="g">{{ t.name }}</div>
          <div class="o">{{ t.organ }}</div>
        </button>
      </div>

      <div class="panel">
        <div class="row">
          <button class="btn primary" @click="toggle">{{ playing ? '停止' : '播放' }}</button>
          <label class="sw"><input type="checkbox" v-model="loopOn" @change="onLoop">无缝循环</label>
          <label class="sw"><input type="checkbox" v-model="breathOn" @change="onBreath">句尾呼吸</label>
          <span class="lb"><span class="dot" :class="{ live: playing }"></span>{{ stateText }}</span>
        </div>
        <div class="row">
          <span class="lbl">速度</span>
          <input type="range" min="36" max="76" step="2" v-model.number="bpm"
                 @input="onBpm" :disabled="!toneHasMel">
          <span class="val">{{ bpm }} BPM</span>
        </div>
        <div class="row">
          <span class="lbl">混响</span>
          <input type="range" min="0" max="70" step="5" value="30" @input="onWet">
          <span class="val">{{ wetPct }}%</span>
        </div>
        <div class="row">
          <span class="lbl">导出 WAV</span>
          <select v-model.number="expDur">
            <option value="60">约 1 分钟</option>
            <option value="120">约 2 分钟</option>
            <option value="180">约 3 分钟</option>
          </select>
          <button class="btn" @click="expCur" :disabled="busy || !toneHasMel">当前音</button>
          <button class="btn" @click="expAll" :disabled="busy">全部五音</button>
        </div>
        <div class="row">
          <span class="hint" v-html="expMsg"></span>
        </div>
      </div>

      <div class="panel">
        <div class="grid">
          <div v-for="c in scoreCells" :key="c.i" class="cell" :class="{ restzone: c.rest }">
            <div class="n" :class="c.cls">{{ c.ch }}</div>
            <div class="b">{{ c.i + 1 }}</div>
          </div>
        </div>
        <div class="meta" v-html="metaText"></div>
      </div>

      <div class="foot">
        调律用<b>三分损益律</b>（宫 1 → 徵 3/2 → 商 9/8 → 羽 27/16 → 角 81/64），宫 = F3 174.61&nbsp;Hz。<br>
        五条短句同属一个宫系统（F G A C D），只换主音；低音声部落在主音的低八度散音上。<br>
        <b>句尾呼吸版</b>：每圈 10 拍，前 8 拍出声、后 2 拍不起任何新音，只让末音余韵自然散掉；低音散音落在第 1、6 拍。
        关掉开关即回到每圈 8 拍连续形态，可即时 A/B 对比。<br>
        <b>导出</b>：用 OfflineAudioContext 离线渲染<b>同一套音频图</b>，不经扬声器，比实时快几十倍。
        输出 44.1&nbsp;kHz / 16&nbsp;bit 立体声 WAV，长度按整数圈计算，末圈后留 3.5 秒余韵再淡出。<br>
        合成走 Karplus–Strong 拨弦模型 + 程序生成的混响，不经任何音频文件。<br>
        <b>氛围音</b>在阶段二降级到 60%（电平 0.033），固定开启、不给开关——阶段一零选择。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { TONES } from '../data/tones.js'
import { createPhrasePlayer, phraseBarLen, phraseBassBeats, PHRASE_SOUND_BEATS } from '../engine/phrase.js'
import { unlockAudio } from '../engine/guqin.js'

const router = useRouter()

const SPEED_MIN = 36
const SPEED_MAX = 76

const curKey = ref(TONES[0].key)
const playing = ref(false)
const stateText = ref('已停止')
const loopOn = ref(true)
const breathOn = ref(true)
const bpm = ref(48)
const wetPct = ref(30)
const expDur = ref(120)
const busy = ref(false)
const expMsg = ref('离线渲染，不占用实时播放。导出内容与你此刻听到的完全相同（含速度、混响、呼吸开关状态）。')

let player = null

const curIdx = computed(() => TONES.findIndex((t) => t.key === curKey.value))
const tone = computed(() => TONES[curIdx.value] || TONES[0])
const toneHasMel = computed(() => !!tone.value.mel)

/* ---------- 乐谱网格 ---------- */
const scoreCells = computed(() => {
  const t = tone.value
  const n = phraseBarLen(breathOn.value)
  const slots = new Array(n).fill(null)
  if (t.mel) {
    for (const m of t.mel) {
      slots[m[0]] = { deg: m[1], hold: false }
      for (let b = 1; b < m[2]; b++) if (m[0] + b < n) slots[m[0] + b] = { deg: m[1], hold: true }
    }
  }
  const out = []
  for (let i = 0; i < n; i++) {
    const inRest = breathOn.value && i >= PHRASE_SOUND_BEATS
    let cls = 'n'
    let ch = '·'
    let rest = false
    if (inRest) { ch = '·'; cls = 'n rest'; rest = true }
    else if (!slots[i]) { ch = '0'; cls = 'n empty' }
    else if (slots[i].hold) { ch = '–'; cls = 'n hold' }
    else { ch = String(slots[i].deg); cls = slots[i].deg === t.tonic ? 'n tonic' : 'n' }
    out.push({ i, ch, cls, rest })
  }
  return out
})

const metaText = computed(() => {
  const t = tone.value
  const n = phraseBarLen(breathOn.value)
  const bass = phraseBassBeats(breathOn.value).map((x) => x + 1).join('、')
  let barTxt
  let tailTxt
  if (breathOn.value) {
    barTxt = `前 ${PHRASE_SOUND_BEATS} 拍出声，后 2 拍不起新音，只让余韵散掉（灰底两格）；低音散音落在第 ${bass} 拍。`
    tailTxt = '末音余韵跨过留白段，直接叠进下一圈，所以循环依然无缝。'
  } else {
    barTxt = `低音散音落在第 ${bass} 拍，每圈连续无留白。`
    tailTxt = '末音余韵直接叠进下一圈，接缝听不出来。'
  }
  return `主音 <i>${t.name}</i>　·　<i>${t.mode || ''}</i>　·　入 <i>${t.organ}</i>　·　<i>${t.feel || ''}</i><br>`
    + `红字＝调式主音。${barTxt}一圈 ${n} 拍。${tailTxt}`
})

function leave(path) { router.push(path) }

function ensurePlayer() {
  if (player) return player
  player = createPhrasePlayer({ bpm: bpm.value, wet: wetPct.value / 100, breath: breathOn.value })
  return player
}

function pick(i) {
  const was = playing.value
  const t = TONES[i]
  if (!was) { curKey.value = t.key; ensurePlayer().start(t); return }
  ensurePlayer().switchTo(t)
  curKey.value = t.key
}

function toggle() {
  unlockAudio()
  if (playing.value) {
    ensurePlayer().stop()
    playing.value = false
    stateText.value = '已停止'
    return
  }
  ensurePlayer().start(tone.value)
  playing.value = true
  stateText.value = '播放中'
}

function onLoop() { /* 无缝循环常开；这里留给"播放中切循环"的重置逻辑 */ }

function onBreath() {
  ensurePlayer().setBreath(breathOn.value)
  if (playing.value) { playing.value = false; stateText.value = '已停止'; setTimeout(toggle, 360) }
}

function onBpm() {
  ensurePlayer().setBpm(bpm.value)
}

function onWet(e) {
  const v = Number(e.target.value)
  wetPct.value = v
  ensurePlayer().setWet(v / 100)
}

function expCur() {
  if (busy.value) return
  busy.value = true
  expMsg.value = '正在离线渲染…'
  ensurePlayer().exportWav(tone.value, expDur.value).then((r) => {
    download(r.blob, r.name)
    expMsg.value = `已导出 <b>${r.name}</b>（${r.mb} MB，${r.bars} 圈 / ${Math.round(r.sec)} 秒）`
    busy.value = false
  }).catch((e) => {
    expMsg.value = '渲染失败：' + (e && e.message ? e.message : e)
    busy.value = false
  })
}

function expAll() {
  if (busy.value) return
  busy.value = true
  let i = 0
  const step = () => {
    if (i >= TONES.length) {
      expMsg.value = '全部完成，共 <b>5 个文件</b>已下载。浏览器若提示「是否允许下载多个文件」，点允许即可。'
      busy.value = false
      return
    }
    expMsg.value = `正在渲染 ${TONES[i].name} 音…（第 ${i + 1} / 5 个）`
    ensurePlayer().exportWav(TONES[i], expDur.value).then((r) => {
      download(r.blob, r.name)
      i++
      setTimeout(step, 800)
    }).catch((e) => {
      expMsg.value = `第 ${i + 1} 个渲染失败：` + (e && e.message ? e.message : e)
      busy.value = false
    })
  }
  step()
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 20000)
}

onMounted(() => { ensurePlayer() })

onBeforeUnmount(() => { player && player.stop(); player = null })
</script>

<style scoped>
.body { padding: 14px 16px var(--body-pad-b); max-width: 760px; margin: 0 auto; }
/* 小按钮在手机上要够点：min-height 36px（比 44 略小但仍远好过 26px） */
.sm { padding: 8px 14px; font-size: 13px; min-height: 40px; }
.lead { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.85; margin: 4px 0 18px; font-family: var(--font-ui); }

.tones { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 0 0 16px; }
.tone {
  appearance: none; border: 1px solid rgba(58, 51, 42,.14); background: rgba(58, 51, 42,.04);
  color: var(--xuan); border-radius: 12px; padding: 14px 6px 11px; cursor: pointer;
  transition: .18s; font-family: inherit; text-align: center;
}
.tone:hover { border-color: rgba(154, 123, 51,.5); background: rgba(58, 51, 42,.08); }
.tone .g { font-size: 22px; line-height: 1.15; }
.tone .o { font-size: 11.5px; color: var(--xuan-faint); margin-top: 6px; letter-spacing: .08em; }
.tone.on { border-color: var(--zhu); background: rgba(200, 93, 77,.14); }
.tone.on .g { color: var(--zhu); }
.tone.on .o { color: var(--jin); }

.panel {
  border: 1px solid rgba(58, 51, 42,.12); border-radius: 12px;
  background: rgba(58, 51, 42,.03); padding: 16px 18px; margin-bottom: 16px;
}
.row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.row + .row { margin-top: 14px; }
.lbl { font-size: 12.5px; color: var(--xuan-dim); min-width: 62px; letter-spacing: .05em; }
.lbl .lb { font-size: 12.5px; color: var(--xuan-dim); }
button.act { padding: 9px 20px; font-size: 13.5px; }
select {
  appearance: none; font-family: inherit; font-size: 13px; color: var(--xuan); background: rgba(46,39,32,.9);
  border: 1px solid rgba(58, 51, 42,.16); border-radius: 9px; padding: 9px 14px; cursor: pointer;
}
select option { background: #F8F5ED; color: var(--xuan); }
.hint { font-size: 12px; color: #6f6555; line-height: 1.7; }
.hint b { color: var(--jin); font-weight: 500; }
input[type=range] { flex: 1; min-width: 140px; accent-color: var(--zhu); background: transparent; }
input[type=range]:disabled { opacity: .4; }
.val { font-size: 12.5px; color: var(--jin); min-width: 66px; font-variant-numeric: tabular-nums; font-family: var(--font-ui); }
.sw { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--xuan-dim); cursor: pointer; user-select: none; min-height: 40px; padding: 4px 4px; }
.sw input { accent-color: var(--zhu); width: 24px; height: 24px; flex: 0 0 auto; }
.dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: rgba(58, 51, 42,.2); margin-right: 7px; vertical-align: 1px; transition: .2s;
}
.dot.live { background: var(--zhu); }

.grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; margin-bottom: 14px; }
.cell { text-align: center; }
.cell .n { font-size: 20px; line-height: 1.35; color: var(--xuan); font-family: ui-monospace, Consolas, monospace; }
.cell .n.tonic { color: var(--zhu); }
.cell .n.hold { color: rgba(58, 51, 42,.32); }
.cell .n.empty { color: transparent; }
.cell .n.rest { color: #6f6555; }
.cell .b { font-size: 11px; color: #6f6555; font-variant-numeric: tabular-nums; }
.cell.restzone { background: rgba(154, 123, 51,.055); border-radius: 6px; }
.meta { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.85; font-family: var(--font-ui); }
.meta i { font-style: normal; color: var(--jin); }

.foot { margin-top: 26px; font-size: 12px; color: #6f6555; line-height: 1.9; border-top: 1px solid rgba(58, 51, 42,.12); padding-top: 16px; }
.foot b { color: var(--jin); font-weight: 500; }

@media (max-width: 520px) {
  .tones { gap: 7px; }
  .tone { padding: 11px 4px 9px; }
  .tone .g { font-size: 19px; }
  .tone .o { font-size: 10.5px; letter-spacing: .02em; }
  .lbl { min-width: 100%; }
  .grid { gap: 3px; }
  .cell .n { font-size: 14px; }
  .cell .b { font-size: 10px; }
}
</style>
