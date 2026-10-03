<template>
  <div class="wrap">
    <div class="body sound-page">
      <!-- 问候语 -->
      <div class="greeting">今天想照顾哪里？</div>

      <!-- 五音 / 五脏选择 -->
      <div class="tone-scroll" ref="toneRef">
        <button
          v-for="t in tones" :key="t.key"
          class="tone-card" :class="{ on: curKey === t.key }"
          @click="pick(t)"
        >
          <span class="tone-name">{{ t.name2 }}</span>
          <span class="tone-desc">{{ t.feel }}</span>
          <span class="tone-check" v-if="curKey === t.key">✓</span>
        </button>
      </div>

      <!-- 呼吸引导 -->
      <div class="breathe-card">
        <div class="breathe-title">呼吸 · 共鸣</div>
        <div class="breathe-bar">
          <span class="seg in">慢吸</span>
          <span class="seg hold">平稳</span>
          <span class="seg out">慢呼</span>
        </div>
        <div class="breathe-tip">慢吸 4s → 慢呼 6s → 放松</div>
      </div>

      <!-- 快捷按钮 -->
      <div class="quick-actions">
        <button class="quick ghost" @click="pick(tones[0], true)">说不上来，随便听听</button>
        <button class="quick primary" @click="playAll">练完了 · 听一首完整的</button>
      </div>

      <!-- 推荐曲目 -->
      <div class="rec-title">为你推荐</div>
      <div class="track-list">
        <button
          class="track-card"
          v-for="(tr, i) in tracks" :key="i"
          @click="playTrack(i)"
        >
          <span class="track-icon" :class="tr.color"></span>
          <span class="track-info">
            <span class="track-name">{{ tr.title }}</span>
            <span class="track-dur">{{ tr.dur }}</span>
          </span>
          <span class="track-tags">
            <span class="tag">{{ tr.organ }} · {{ tr.tone }}</span>
            <span class="tag light">{{ tr.effect }}</span>
          </span>
          <span class="track-play" :class="{ on: playing === i }">
            <span class="play-icon">▶</span>
          </span>
        </button>
      </div>
    </div>

    <audio ref="au" @ended="onEnded"></audio>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { TONES, getTone, ALL_TONE } from '../data/tones'
import { unlockAudio } from '../engine/guqin'

const tones = [
  { ...getTone('jue'), name2: '肝角', feel: '舒展疏肝' },
  { ...getTone('zhi'), name2: '心徽', feel: '音悦安神' },
  { ...getTone('gong'), name2: '脾宫', feel: '平和健脾' },
  { ...getTone('shang'), name2: '肺商', feel: '清润守神' },
  { ...getTone('yu'), name2: '肾羽', feel: '沉静潜养' },
]

const curKey = ref('zhi')
const playing = ref(-1)
const au = ref(null)

const tracks = [
  { title: '平湖秋月', dur: '08:24', organ: '心', tone: '徽', effect: '安神助眠', color: 'red' },
  { title: '高山流水', dur: '07:36', organ: '肝', tone: '角', effect: '疏肝解郁', color: 'green' },
  { title: '阳春白雪', dur: '06:52', organ: '脾', tone: '宫', effect: '调和脾胃', color: 'gold' },
  { title: '梅花三弄', dur: '07:28', organ: '肺', tone: '商', effect: '清润守神', color: 'brown' },
]

function pick(t, unsure = false) {
  curKey.value = t.key
  unlockAudio()
  if (!unsure) {
    // 触发短句音色
  }
}

function playAll() {
  playTrack(0)
}

function playTrack(i) {
  const tr = tracks[i]
  const p = ALL_TONE.pieces[i]
  unlockAudio()
  if (p && p.file && au.value) {
    au.value.src = `${import.meta.env.BASE_URL}audio/${p.file}`
    au.value.play().catch(() => {})
    playing.value = i
  }
}

function onEnded() { playing.value = -1 }

onMounted(() => {
  const saved = (() => { try { return localStorage.getItem('xianyang.tone') } catch { return null } })()
  if (saved && tones.some(t => t.key === saved)) curKey.value = saved
})
</script>

<style scoped>
.sound-page { padding: 26px 16px var(--body-pad-b); }
.greeting { font-size: 20px; font-weight: 600; color: var(--xuan); margin-bottom: 18px; }

/* 五音选择 */
.tone-scroll {
  display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 18px;
  scrollbar-width: none;
}
.tone-scroll::-webkit-scrollbar { display: none; }
.tone-card {
  flex: 0 0 auto; width: 110px; min-height: 86px; border-radius: 14px;
  border: 1px solid var(--border); background: var(--bg-card);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  position: relative; cursor: pointer; transition: .18s;
}
.tone-card .tone-name { font-size: 18px; font-weight: 600; color: var(--xuan); }
.tone-card .tone-desc { font-size: 12px; color: var(--xuan-faint); }
.tone-card .tone-check {
  position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--green); color: #fff; font-size: 11px; display: grid; place-items: center;
}
.tone-card.on { border-color: var(--green); background: var(--green-light); }

/* 呼吸引导 */
.breathe-card {
  border-radius: 16px; background: var(--brown-dark); color: #fff;
  padding: 16px; margin-bottom: 16px;
  background-image: linear-gradient(180deg, rgba(139,111,78,.9), rgba(94,70,50,.95));
  box-shadow: 0 6px 18px rgba(94,70,50,.2);
}
.breathe-title { font-size: 15px; letter-spacing: .1em; margin-bottom: 10px; }
.breathe-bar { display: flex; height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 8px; }
.breathe-bar .seg { display: grid; place-items: center; font-size: 11px; color: #fff; }
.breathe-bar .in { flex: 2.5; background: var(--green-light); color: var(--green); }
.breathe-bar .hold { flex: 1.5; background: var(--gold-tone); color: #fff; }
.breathe-bar .out { flex: 3.5; background: var(--green); color: #fff; }
.breathe-tip { font-size: 12px; opacity: .9; text-align: center; }

/* 快捷按钮 */
.quick-actions { display: flex; gap: 10px; margin-bottom: 20px; }
.quick { flex: 1; padding: 12px 8px; border-radius: 12px; font-size: 13px; text-align: center; }
.quick.ghost { border: 1px dashed var(--border); background: transparent; color: var(--xuan-light); }
.quick.primary { background: var(--zhu); color: #fff; }

/* 推荐曲目 */
.rec-title { font-size: 17px; font-weight: 600; margin-bottom: 10px; }
.track-list { display: flex; flex-direction: column; gap: 10px; }
.track-card {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border);
  text-align: left;
}
.track-icon { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  color: #fff; font-size: 16px; flex: 0 0 auto; }
.track-icon.red { background: var(--zhu); }
.track-icon.green { background: var(--green); }
.track-icon.gold { background: var(--gold-tone); }
.track-icon.brown { background: var(--brown); }
.track-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.track-name { font-size: 15px; color: var(--xuan); }
.track-dur { font-size: 12px; color: var(--xuan-faint); }
.track-tags { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.tag { font-size: 11px; padding: 3px 8px; border-radius: 20px; background: var(--green-light); color: var(--green); }
.tag.light { background: var(--gold-light); color: var(--brown); }
.track-play { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border);
  display: grid; place-items: center; color: var(--xuan-faint); }
.track-play.on { background: var(--zhu); color: #fff; border-color: var(--zhu); }
.play-icon { margin-left: 2px; }
</style>
