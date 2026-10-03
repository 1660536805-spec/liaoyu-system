<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="leave('/sound')">← 点音</button>
      <h1>完整曲库</h1>
      <div class="spacer"></div>
    </div>

    <div class="body">
      <p class="lead">
        练完静坐、日常听，走这一轨。<b>跟练轨是自产合成（要跟动作对齐），赏听轨是真人演奏录音</b>——
        两条轨不互相替代。
      </p>

      <div class="tabs">
        <button
          v-for="t in TONE_LIST" :key="t.key"
          class="tab" :class="{ on: curKey === t.key }"
          @click="pickTab(t)"
        >
          <span class="tg">{{ t.name }}</span>
          <span class="to">{{ t.organ }}</span>
        </button>
      </div>

      <div class="dsc">{{ cur ? safeCopy(cur.ds) : '' }}</div>

      <table class="tbl">
        <tr>
          <th>曲目</th><th>时长</th><th>调式</th><th class="src-col">收录来源</th><th></th>
        </tr>
        <tr
          v-for="(p, i) in cur?.pieces || []" :key="p.title"
          :class="{ cur: curRow === i }" @click="playRow(p, i)"
        >
          <td class="tt">{{ p.title }}</td>
          <td class="du">{{ p.dur }}</td>
          <td><span class="cf" :class="CF[p.cf].cls">{{ CF[p.cf].text }}</span></td>
          <td class="src src-col">{{ p.src }}</td>
          <td>
            <button
              class="pl" :class="{ has: !!p.file }" :disabled="!p.file"
              @click.stop="playRow(p, i)"
            >{{ p.file ? (curRow === i && playing ? '播放中' : '播放') : '待补' }}</button>
          </td>
        </tr>
      </table>

      <div class="note" v-if="cur?.pieces?.length">
        标「待补」的还没拿到音源。已就位的两首：
        <b>梅花三弄</b>（CC BY 4.0）与 <b>醉渔唱晚</b>（卫仲乐 1934，CC0）。
      </div>

      <!-- 播放器 -->
      <div class="player">
        <div class="np">
          <div class="t">{{ curRow >= 0 && cur ? cur.pieces[curRow].title : '未选择曲目' }}</div>
          <div class="c">{{ curRow >= 0 && cur ? (cur.pieces[curRow].src + (cur.pieces[curRow].note ? ' · ' + cur.pieces[curRow].note : '')) : '点上面任意一首' }}</div>
        </div>
        <div class="ctrls">
          <button class="btn sm" :disabled="curRow < 0" @click="toggle">{{ playing ? '暂停' : '播放' }}</button>
          <input type="range" class="seek" min="0" max="1000" v-model.number="seekV" @input="onSeek" :disabled="curRow < 0" />
          <span class="tm">{{ fmt(curT) }} / {{ fmt(durT) }}</span>
          <input type="range" class="vol" min="0" max="100" v-model.number="volV" @input="onVol" />
        </div>
      </div>

      <div class="cred">
        <div class="cred-title">署名与授权</div>
        <div v-for="c in CREDITS" :key="c">{{ c }}</div>
        <div class="cred-note">
          调式归属为<b>按意境编排</b>（是事实的要自核煞音与解题，入哪一脏是编排，两者措辞分开写）。
        </div>
      </div>
    </div>

    <audio ref="au" @ended="onEnded" @timeupdate="onTime" @loadedmetadata="onTime"></audio>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { TONE_LIST, getTone, CF, CREDITS, safeCopy } from '../data/tones'
import { unlockAudio } from '../engine/guqin'

const router = useRouter()
const au = ref(null)

const cur = ref(TONE_LIST[0])
const curKey = ref(TONE_LIST[0].key)
const curRow = ref(-1)
const playing = ref(false)
const seekV = ref(0)
const curT = ref(0)
const durT = ref(0)
const volV = ref(85)
let seeking = false

function fmt(s) {
  s = Math.max(0, Math.floor(s || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function pickTab(t) {
  cur.value = t
  curKey.value = t.key
  curRow.value = -1
  playing.value = false
  curT.value = 0
  durT.value = 0
  seekV.value = 0
  au.value?.pause()
}

function playRow(p, i) {
  if (!p.file || !au.value) return
  curRow.value = i
  unlockAudio()
  if (au.value.src.indexOf(p.file) < 0) au.value.src = `${import.meta.env.BASE_URL}audio/${p.file}`
  au.value.volume = volV.value / 100
  au.value.play().then(() => { playing.value = true }).catch(() => {})
}

function toggle() {
  if (!au.value || curRow.value < 0) return
  if (playing.value) { au.value.pause(); playing.value = false }
  else { unlockAudio(); au.value.play().then(() => { playing.value = true }).catch(() => {}) }
}

function onSeek() {
  if (!au.value || !durT.value) return
  const t = (seekV.value / 1000) * durT.value
  au.value.currentTime = t
  curT.value = t
}

function onVol() { if (au.value) au.value.volume = volV.value / 100 }

function onTime() {
  if (!au.value) return
  curT.value = au.value.currentTime || 0
  durT.value = au.value.duration || 0
  if (!seeking && durT.value) seekV.value = Math.round((curT.value / durT.value) * 1000)
}

function onEnded() { playing.value = false; seekV.value = 0; curT.value = 0 }

function leave(p) { au.value?.pause(); playing.value = false; router.push(p) }

onMounted(() => {
  unlockAudio()
  const saved = (() => { try { return localStorage.getItem('xianyang.tone') } catch { return null } })()
  if (saved) { const t = getTone(saved); cur.value = t; curKey.value = saved }
  if (au.value) au.value.volume = volV.value / 100
})

onBeforeUnmount(() => { au.value?.pause() })
</script>

<style scoped>
.body { padding: 14px 16px var(--body-pad-b); max-width: 760px; margin: 0 auto; }
h1 { font-size: 18px; font-weight: 500; margin: 0; letter-spacing: .06em; }
.spacer { flex: 1; }
/* 小按钮在手机上要够点：min-height 36px（比 44 略小但仍远好过 26px） */
.sm { padding: 8px 14px; font-size: 13px; min-height: 40px; }
.lead { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.85; margin: 4px 0 16px; font-family: var(--font-ui); }
.lead b { color: var(--jin); font-weight: 500; }

.tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.tab {
  appearance: none; font-family: inherit; cursor: pointer; transition: .18s;
  border: 1px solid rgba(92, 70, 50,.14); background: rgba(92, 70, 50,.04);
  color: var(--xuan-dim); border-radius: 10px; padding: 8px 14px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.tab:hover { border-color: rgba(154, 123, 51,.5); }
.tab .tg { font-size: 15px; color: var(--xuan); }
.tab .to { font-size: 10.5px; color: var(--xuan-faint); font-family: var(--font-ui); }
.tab.on { border-color: var(--zhu); background: rgba(200, 93, 77,.14); }
.tab.on .tg { color: var(--zhu); }
.tab.on .to { color: var(--jin); }

.dsc { font-size: 12.5px; color: var(--xuan-dim); line-height: 1.85; margin: 14px 0 4px; font-family: var(--font-ui); }

.tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 8px; }
.tbl th { text-align: left; color: var(--xuan-faint); font-weight: 400; padding: 6px 8px 8px; border-bottom: 1px solid rgba(92, 70, 50,.12); }
.tbl td { padding: 9px 8px; border-bottom: 1px solid rgba(92, 70, 50,.06); color: var(--xuan-dim); cursor: pointer; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl tr.cur td { background: rgba(200, 93, 77,.1); }
.tbl tr.cur .tt { color: var(--zhu); }
.tt { color: var(--xuan); font-size: 13.5px; white-space: nowrap; }
.du { font-variant-numeric: tabular-nums; white-space: nowrap; }
.src { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }
.cf { font-size: 11.5px; white-space: nowrap; }
.cf2 { color: #7fb069; } .cf1 { color: var(--jin); } .cf0 { color: #8a7a66; }
.pl {
  appearance: none; font-family: inherit; border: 1px solid rgba(92, 70, 50,.14);
  background: rgba(92, 70, 50,.05); color: var(--xuan-faint);
  border-radius: 7px; padding: 5px 11px; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.pl.has { border-color: rgba(200, 93, 77,.6); color: var(--zhu); }
.pl.has:hover { background: rgba(200, 93, 77,.16); }
.pl:disabled { cursor: default; opacity: .55; }

.note { font-size: 12px; color: var(--xuan-faint); line-height: 1.9; margin-top: 12px; font-family: var(--font-ui); }
.note b { color: var(--jin); font-weight: 500; }

.player {
  margin-top: 18px; border: 1px solid rgba(92, 70, 50,.12); border-radius: 12px;
  background: rgba(92, 70, 50,.03); padding: 14px 16px;
}
.np .t { font-size: 14.5px; color: var(--xuan); }
.np .c { font-size: 11.5px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 4px; line-height: 1.7; }
.ctrls { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
.seek { flex: 1; min-width: 140px; accent-color: var(--zhu); }
.vol { width: 100px; accent-color: var(--jin); }
.tm { font-size: 11.5px; color: var(--xuan-dim); font-family: var(--font-ui); font-variant-numeric: tabular-nums; }

.cred {
  margin-top: 22px; font-size: 11.5px; color: rgba(92, 70, 50,.3);
  line-height: 1.95; font-family: var(--font-ui);
  border-top: 1px solid rgba(92, 70, 50,.1); padding-top: 14px;
}
.cred-title { color: var(--jin); margin-bottom: 4px; }
.cred-note { margin-top: 8px; }
.cred-note b { color: var(--jin); font-weight: 500; }

@media (max-width: 560px) {
  .src-col { display: none; }
  .vol { display: none; }
}
</style>
