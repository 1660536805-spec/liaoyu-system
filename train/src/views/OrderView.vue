<template>
  <div class="ls" :style="{ '--ls-cloud': `url(${BASE}art/cloud.jpg)` }">
    <div class="ls-phone">
      <main class="sc navpad ls-main">
        <!-- 顶部横幅 -->
        <div class="a-hero">
          <img :src="BASE + 'art/landscape.jpg'" alt="" />
          <div class="fade"></div>
          <div class="in">
            <div class="brandrow">
              <span class="t-callig" style="font-size:4.4rem">弦养·点单</span>
              <span class="seal">弦养</span>
            </div>
          </div>
        </div>

        <!-- 标题 -->
        <div class="ls-h">今天想照顾哪里？</div>
        <p class="ls-lead">五音入五脏，<br />以琴音和身心，<br />让此刻的你，被温柔照顾。</p>

        <!-- 选择调养方向 -->
        <section class="card ls-sec-organ">
          <div class="sec-h">
            <svg class="knot" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M12 7 17 12l-5 5-5-5z"/></g></svg>选择调养方向<span class="sec-note">根据当下的身心状态，选择一个想要照顾的方向</span>
          </div>
          <div class="organ-row">
            <button
              v-for="(o, i) in organs" :key="o.yun"
              class="organ" :class="{ sel: selOrgan === i }"
              @click="pickOrgan(i)"
            >
              <span class="ck" v-html="icon('check')"></span>
              <div class="zi" :style="{ color: o.color }">{{ o.zi }}</div>
              <div class="yun">{{ o.yun }}</div>
              <div class="tip">{{ o.tip }}</div>
              <img class="pic" :src="BASE + 'art/' + o.img" :style="o.filt" alt="" />
            </button>
          </div>
        </section>

        <!-- 两个快捷入口 -->
        <div class="ls-quick">
          <button class="btn btn-gho" v-html="icon('shuffle', 'width:2rem;height:2rem') + '说不上来，随便听听 ›'" @click="randomTrack"></button>
          <button class="btn" v-html="icon('music', 'width:2rem;height:2rem') + '练完了·听一首完整的 ›'" @click="playTrack(0)"></button>
        </div>

        <!-- 曲目预览播放器 -->
        <section class="player card">
          <img class="pic" :src="BASE + 'art/' + cur.img" alt="" />
          <div class="pr">
            <span class="live" v-html="icon('music', 'width:1.2rem;height:1.2rem') + liveText"></span>
            <div class="tt">{{ cur.title }} <i aria-hidden="true">♡</i></div>
            <p>{{ cur.desc }}</p>
            <div class="tags">
              <span class="tag" :class="cur.cls">{{ cur.organ }}</span>
              <span class="tag">{{ cur.t1 }}</span>
              <span class="tag">{{ cur.t2 }}</span>
            </div>
            <div class="pbar"><i :style="{ width: pct + '%' }"></i></div>
            <div class="times"><span>{{ timeLabel }}</span><span>{{ totalLabel }}</span></div>
            <div class="pctrl">
              <button v-html="icon('refresh')" aria-label="循环播放" @click="previewOnly"></button>
              <button v-html="icon('prev')" aria-label="上一首曲目预览" @click="step(-1)"></button>
              <button class="pc" v-html="icon(playing ? 'pause' : 'play')" :aria-label="playing ? '暂停' : '尝试播放当前曲目'" @click="togglePlay"></button>
              <button v-html="icon('next')" aria-label="下一首曲目预览" @click="step(1)"></button>
              <button v-html="icon('list')" aria-label="查看推荐曲目" @click="jumpToList"></button>
            </div>
          </div>
        </section>

        <!-- 跟着呼吸 -->
        <section class="card ls-sec-breath">
          <div class="sec-h">
            <svg class="knot" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M12 7 17 12l-5 5-5-5z"/></g></svg>跟着呼吸，更好地感受音乐<span class="sec-note">让呼吸与琴音同频，放松身心</span>
          </div>
          <div class="breath-row">
            <div class="bstep"><span class="c" v-html="icon('medit')"></span><b>慢吸 4 秒</b><span>感受气息流入丹田</span></div>
            <span class="barrow" v-html="icon('chev', 'width:2rem;height:2rem')"></span>
            <div class="bstep"><span class="c" v-html="icon('hand')"></span><b>慢呼 6 秒</b><span>慢慢释放紧张与杂念</span></div>
            <span class="barrow" v-html="icon('chev', 'width:2rem;height:2rem')"></span>
            <div class="bstep"><span class="c" v-html="icon('lotus')"></span><b>放松</b><span>跟随音乐享受此刻的宁静</span></div>
          </div>
        </section>

        <!-- 为你推荐 -->
        <section class="card ls-sec-rec" ref="recRef">
          <div class="sec-h">
            <svg class="knot" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M12 7 17 12l-5 5-5-5z"/></g></svg>为你推荐<button class="sec-note ls-swap" v-html="icon('refresh', 'width:1.4rem;height:1.4rem') + '换一批'" @click="swapTracks"></button>
          </div>
          <div class="ls-rec-list">
            <div class="track" v-for="(t, i) in tracks" :key="t.title + i">
              <img class="thumb" :src="BASE + 'art/' + t.img" :style="t.filt" alt="" />
              <div class="ls-track-tx">
                <div class="tt">{{ t.title }}<span class="note" v-if="curTrack === i">已选预览</span></div>
                <div class="ls-track-desc">{{ t.desc }}</div>
                <div class="tags">
                  <span class="tag" :class="t.cls">{{ t.organ }}</span>
                  <span class="tag">{{ t.t1 }}</span>
                  <span class="tag">{{ t.t2 }}</span>
                </div>
              </div>
              <span class="dur">预览</span>
              <button class="play-c" :class="{ on: curTrack === i && playing }" v-html="icon('play')" :aria-label="'尝试播放' + t.title" @click="playTrack(i)"></button>
            </div>
          </div>
        </section>
      </main>
    </div>

    <div class="toast" :class="{ show: !!toastMsg }" role="status" aria-live="polite">{{ toastMsg }}</div>
    <audio
      ref="au"
      @timeupdate="onTime"
      @loadedmetadata="onMeta"
      @play="playing = true"
      @pause="playing = false"
      @ended="onEnded"
    ></audio>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { unlockAudio } from '../engine/guqin'

// 资源基址：开发为 '/'，构建时用 --base=/s4/ → '/s4/'
const BASE = import.meta.env.BASE_URL

/* ---------- 图标（逐字移植自主壳 dist/app.js 的 ic()） ---------- */
const PATHS = {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  chev: '<path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  music: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></g>',
  refresh: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/></g>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<g fill="currentColor"><rect x="7" y="5" width="3.4" height="14" rx="1.2"/><rect x="13.6" y="5" width="3.4" height="14" rx="1.2"/></g>',
  prev: '<g fill="currentColor"><path d="M17 5v14L8 12z"/><rect x="6" y="5" width="2.4" height="14" rx="1"/></g>',
  next: '<g fill="currentColor"><path d="M7 5v14l9-7z"/><rect x="15.6" y="5" width="2.4" height="14" rx="1"/></g>',
  shuffle: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l10 10h4M21 17l-2.5-2.5M21 17l-2.5 2.5M3 17h4l2.5-2.5M14.5 9.5 17 7h4M21 7l-2.5-2.5M21 7l-2.5 2.5"/></g>',
  medit: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5.5" r="2.2"/><path d="M12 9v4M12 13c-2.6 0-4.8 1.4-6 3.6M12 13c2.6 0 4.8 1.4 6 3.6M8 19h8"/></g>',
  hand: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v7c0 3.5-2.3 6-5.7 6-2.7 0-4.3-1.2-5.6-3.6L4 13.6c-.8-1.3.6-2.7 1.9-1.8L8 13.5"/></g>',
  lotus: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4 0-7-2.4-8-6 2.4-.4 4.6.2 6.2 1.6C9.4 12 10.4 8.6 12 6c1.6 2.6 2.6 6 1.8 9.6C15.4 14.2 17.6 13.6 20 14c-1 3.6-4 6-8 6z"/></g>',
  list: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/></g>',
}
function icon(name, style) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"${style ? ` style="${style}"` : ''}>${PATHS[name] || ''}</svg>`
}

/* ---------- 数据（逐字移植自主壳 pgAudio 的 organs / tracks） ---------- */
const organs = [
  { zi: '心', yun: '徵', tip: '喜悦安神', color: '#C4472F', img: 'card-landscape.jpg', filt: 'filter:hue-rotate(-10deg) saturate(.9)' },
  { zi: '肝', yun: '角', tip: '舒展疏肝', color: '#5E7C6B', img: 'q-none.jpg', filt: '' },
  { zi: '脾', yun: '宫', tip: '平和健脾', color: '#B8862D', img: 'card-landscape.jpg', filt: 'filter:sepia(.5)' },
  { zi: '肺', yun: '商', tip: '清润宁神', color: '#7A8C99', img: 'q-none.jpg', filt: 'filter:hue-rotate(160deg) saturate(.55)' },
  { zi: '肾', yun: '羽', tip: '沉静滋养', color: '#4A5E82', img: 'card-landscape.jpg', filt: 'filter:hue-rotate(190deg) saturate(.8) brightness(.85)' },
]

const TRACKS = [
  { title: '平湖秋月', desc: '月映平湖，心境澄明。', organ: '心·徵', cls: 'org', t1: '安神助眠', t2: '平稳情绪', dur: '08:24', img: 'card-landscape.jpg', filt: '', file: '' },
  { title: '高山流水', desc: '清泉如诉，舒展胸怀。', organ: '肝·角', cls: 'grn', t1: '疏肝解郁', t2: '放松身心', dur: '07:36', img: 'q-none.jpg', filt: '', file: '' },
  { title: '阳春白雪', desc: '和煦温暖，健脾养中。', organ: '脾·宫', cls: 'org', t1: '调和脾胃', t2: '提升专注', dur: '06:52', img: 'card-landscape.jpg', filt: 'filter:sepia(.5)', file: '' },
  { title: '梅花三弄', desc: '清音入肺，涤尘安神。', organ: '肺·商', cls: 'blu', t1: '清润宁神', t2: '改善睡眠', dur: '07:28', img: 'q-none.jpg', filt: 'filter:hue-rotate(160deg) saturate(.55)', file: 'meihua.mp3' },
]

/* ---------- 状态 ---------- */
const tracks = ref(TRACKS.map((t) => ({ ...t })))
const selOrgan = ref(0)
const curTrack = ref(0)
const playing = ref(false)
const curTime = ref(0)
const curDur = ref(0)
const au = ref(null)
const recRef = ref(null)

const cur = computed(() => tracks.value[curTrack.value] || tracks.value[0])
const pct = computed(() => (curDur.value > 0 ? Math.min(100, (curTime.value / curDur.value) * 100) : 0))
const liveText = computed(() => (playing.value ? '正在播放' : cur.value.file ? '曲目预览 · 可试听' : '曲目预览 · 未提供音源'))
const timeLabel = computed(() => fmt(curTime.value))
const totalLabel = computed(() => (curDur.value > 0 ? fmt(curDur.value) : '时长待确认'))

function fmt(s) {
  const m = Math.floor(s / 60)
  const x = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
}

/* ---------- toast ---------- */
const toastMsg = ref('')
let toastTimer = 0
function toast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2600)
}

/* ---------- 交互 ---------- */
function pickOrgan(i) {
  selOrgan.value = i
  unlockAudio()
}

function step(dir) {
  const n = tracks.value.length
  curTrack.value = (curTrack.value + dir + n) % n
  resetAudio()
}

function showTrack(i) {
  curTrack.value = i
  resetAudio()
}

function resetAudio() {
  playing.value = false
  curTime.value = 0
  curDur.value = 0
  if (au.value) {
    au.value.pause()
    au.value.removeAttribute('src')
    au.value.load()
  }
}

function playTrack(i) {
  curTrack.value = i
  resetAudio()
  unlockAudio()
  const t = tracks.value[i]
  if (!t.file) {
    toast('这一首仅作预览，暂未接入音源')
    return
  }
  const el = au.value
  if (!el) return
  el.src = `${BASE}audio/${t.file}`
  el.play().then(() => { playing.value = true }).catch(() => toast('浏览器拦下了播放，请再点一次'))
}

function togglePlay() {
  if (playing.value) {
    au.value?.pause()
    return
  }
  if (!cur.value.file) {
    toast('这一首仅作预览，暂未接入音源')
    return
  }
  if (au.value?.src) {
    au.value.play().then(() => { playing.value = true }).catch(() => {})
  } else {
    playTrack(curTrack.value)
  }
}

// 「说不上来，随便听听」：随机挑一首
function randomTrack() {
  const i = Math.floor(Math.random() * tracks.value.length)
  showTrack(i)
  toast('已为你随机挑一首')
}

// 「换一批」：洗牌
function swapTracks() {
  const arr = [...tracks.value]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  tracks.value = arr
  curTrack.value = 0
  toast('已换一批')
}

function jumpToList() {
  recRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function previewOnly() {
  toast('此功能仅作界面预览')
}

/* ---------- 音频事件 ---------- */
function onTime() { curTime.value = au.value?.currentTime || 0 }
function onMeta() { curDur.value = au.value?.duration || 0 }
function onEnded() { playing.value = false; curTime.value = 0 }

/* ---------- 设计基准字号：1rem = 设计稿 10pt（仅本页挂载期间生效） ---------- */
onMounted(() => document.documentElement.classList.add('ls-scale'))
onBeforeUnmount(() => {
  document.documentElement.classList.remove('ls-scale')
  clearTimeout(toastTimer)
})
</script>

<!--
  说明：这里刻意使用**非 scoped** 样式，与主壳 dist/app.css 保持 1:1 移植。
  所有选择器都以 .ls 前缀，作用域被限制在本页容器内，不会污染其他页面。
  .ls 上重定义了与主壳同名的设计 token（--brown/--ink/--green…），同样只在 .ls 子树内生效。
-->
<style>
/* 设计基准：470pt 画布，1rem = 10pt（与主壳 app.css 的 html 规则一致） */
html.ls-scale { font-size: min(calc(100vw / 47), 10px); -webkit-text-size-adjust: 100%; }
@media (min-width: 470px) { html.ls-scale { font-size: 10px; } }

.ls {
  --cream: #FBF3E3; --cream-2: #FDF9EF; --cream-3: #F6ECD9;
  --line: #E8DCC8; --line-2: #D9C6A8;
  --ink: #4A2C1A; --brown: #6B4226; --text: #5C4632; --muted: #97836D;
  --terra: #B0552E; --terra-2: #C4663B; --terra-deep: #8F3F1F;
  --orange: #C05A2E; --green: #5E7C6B; --green-deep: #46685A;
  --gold: #C9A063; --gold-deep: #A87F3F;
  --serif: "Xingkai SC", "STXingkai", "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", "STSong", "Noto Serif SC", serif;
  --sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --shadow: 0 .18rem .7rem rgba(122, 86, 44, .10);
  --shadow-lg: 0 .5rem 1.6rem rgba(122, 86, 44, .18);

  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  background: #EFE6D2; color: var(--text);
  font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased;
}
/* 主壳 app.css 的全局 reset（*{margin:0;padding:0}）必须一并移植：
   否则 s4 自身的全局 .btn{padding:11px 20px} 等会漏进来，
   按钮被撑高、图标被挤扁、文字被迫换行。作用域仍限制在 .ls 内。 */
.ls * { margin: 0; padding: 0; box-sizing: border-box; }
.ls img { display: block; max-width: 100%; }
.ls button { font-family: inherit; border: 0; background: none; cursor: pointer; color: inherit; min-height: 0; }

/* 手机画布 */
.ls .ls-phone {
  max-width: 47rem; margin: 0 auto; min-height: 100dvh; position: relative; overflow-x: clip;
  background: var(--cream); background-image: var(--ls-cloud); background-size: 23.5rem; background-attachment: local;
}
.ls .ls-phone::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(251, 243, 227, .55), rgba(251, 243, 227, .88) 30%, rgba(251, 243, 227, .92));
}
.ls .ls-phone > * { position: relative; z-index: 1; }
.ls .ls-main { min-height: 100dvh; display: flex; flex-direction: column; }

/* 屏幕骨架 */
.ls .sc { padding: 0 1.55rem 2rem; }
.ls .navpad { padding-bottom: 11rem; }

/* 品牌区 */
.ls .brandrow { display: flex; align-items: flex-start; gap: .9rem; }
.ls .t-callig { font-family: var(--serif); font-weight: 700; color: var(--ink); letter-spacing: .12em; line-height: 1.08; }
.ls .seal {
  display: inline-flex; align-items: center; justify-content: center; background: #C03A26; color: #FBF3E3; border-radius: .5rem;
  font-family: var(--serif); font-weight: 700; writing-mode: vertical-rl; letter-spacing: .1em; line-height: 1;
  padding: .35rem .22rem; font-size: 1rem !important; box-shadow: 0 .1rem .3rem rgba(150, 40, 20, .3); margin-top: .5rem;
}

/* 卡片 & 按钮 */
.ls .card { background: rgba(253, 250, 242, .92); border: 1px solid var(--line); border-radius: 1.5rem; box-shadow: var(--shadow); }
.ls .btn {
  display: flex; align-items: center; justify-content: center; gap: .8rem; width: 100%; min-height: 5.6rem; border-radius: 3.2rem;
  font-size: 1.9rem; letter-spacing: .12em; color: #FDF6EA; font-weight: 600; position: relative; overflow: hidden;
  background: linear-gradient(180deg, var(--terra-2), var(--terra) 55%, var(--terra-deep));
  box-shadow: 0 .5rem 1.2rem rgba(150, 72, 35, .35), inset 0 1px 0 rgba(255, 235, 210, .4);
}
.ls .btn::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(6rem 2.4rem at 18% 100%, rgba(255, 225, 190, .28), transparent 70%),
              radial-gradient(7rem 2.6rem at 85% 0%, rgba(255, 230, 200, .22), transparent 70%);
}
.ls .btn:active { transform: translateY(.1rem); }
.ls .btn-gho { background: rgba(253, 250, 242, .95); border: 1px solid var(--line-2); color: var(--brown); box-shadow: var(--shadow); }

/* 标记 / 标签 */
.ls .knot { width: 1.7rem; height: 1.7rem; flex: none; color: var(--gold-deep); }
.ls .sec-h { display: flex; align-items: center; gap: .8rem; font-size: 1.7rem; font-weight: 700; color: var(--brown); flex-wrap: wrap; }
.ls .sec-h .knot { width: 1.9rem; height: 1.9rem; }
.ls .sec-note { margin-left: auto; font-size: 1.15rem; color: var(--muted); letter-spacing: .04em; font-weight: 400; }
.ls .tag {
  display: inline-flex; align-items: center; padding: .35rem 1.1rem; border-radius: 2rem; font-size: 1.1rem !important;
  background: rgba(253, 250, 242, .8); border: 1px solid var(--line); color: var(--muted); white-space: nowrap;
}
.ls .tag.org { color: var(--orange); border-color: #E4C4A8; background: rgba(252, 240, 228, .7); }
.ls .tag.grn { color: var(--green-deep); border-color: #C6D4C8; background: rgba(238, 244, 238, .7); }
.ls .tag.blu { color: #5A7290; border-color: #C3CFDD; background: rgba(236, 241, 247, .7); }

/* 音疗页 · 顶部横幅 */
.ls .a-hero { position: relative; margin: 0 -1.55rem; height: 17rem; overflow: hidden; }
.ls .a-hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 28%; }
.ls .a-hero .fade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(251, 243, 227, .18), rgba(251, 243, 227, 0) 38%, rgba(251, 243, 227, .88) 90%, var(--cream)); }
.ls .a-hero .in { position: absolute; inset: 0; padding: 2.4rem 3rem 0; }

/* 音疗页 · 标题 */
.ls .ls-h { margin-top: 1.8rem; font-size: 1.8rem; font-weight: 700; color: var(--brown); letter-spacing: .06em; }
.ls .ls-lead { font-size: 1.3rem; color: var(--muted); margin-top: .8rem; line-height: 1.8; }

/* 音疗页 · 五音选择 */
.ls .organ-row { display: flex; gap: .8rem; margin-top: 1.4rem; }
.ls .organ { flex: 1; border-radius: 1.1rem; background: rgba(253, 250, 242, .95); border: 1px solid var(--line); padding: .9rem .5rem .6rem; text-align: center; position: relative; box-shadow: var(--shadow); }
.ls .organ:active { transform: scale(.96); }
.ls .organ .zi { font-family: var(--serif); font-size: 2.6rem; font-weight: 700; line-height: 1.15; }
.ls .organ .yun { font-size: 1.35rem; color: var(--brown); font-weight: 600; letter-spacing: .08em; }
.ls .organ .tip { font-size: .95rem !important; color: var(--muted); margin: .2rem 0 .6rem; white-space: nowrap; }
.ls .organ .pic { width: 100%; height: 6.2rem; object-fit: cover; border-radius: .7rem; }
.ls .organ.sel { border-color: var(--terra); box-shadow: 0 0 0 .2rem rgba(192, 90, 46, .16), var(--shadow); }
.ls .organ .ck { position: absolute; top: .5rem; left: 50%; transform: translateX(-50%); width: 2.2rem; height: 2.2rem; border-radius: 50%; background: var(--terra); border: .2rem solid #FDF6EA; display: none; align-items: center; justify-content: center; color: #fff; z-index: 2; }
.ls .organ .ck svg { width: 1.2rem; height: 1.2rem; }
.ls .organ.sel .ck { display: flex; }

/* 音疗页 · 快捷入口 */
.ls .ls-quick { display: flex; gap: 1.2rem; margin-top: 1.4rem; }
.ls .ls-quick .btn { flex: 1; min-height: 4.8rem; font-size: 1.45rem; }
.ls .ls-quick .btn:last-child { flex: 1.15; }

/* 音疗页 · 播放器 */
.ls .player { display: flex; gap: 1.3rem; padding: 1.3rem; margin-top: 1.8rem; }
.ls .player .pic { width: 13.5rem; height: 16rem; object-fit: cover; border-radius: 1.1rem; flex: none; }
.ls .player .pr { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ls .player .live { align-self: flex-start; display: inline-flex; align-items: center; gap: .4rem; background: #E3EEE5; border: 1px solid #C6D4C8; color: var(--green-deep); font-size: 1.1rem; border-radius: 2rem; padding: .32rem 1rem; letter-spacing: .05em; }
.ls .player .tt { font-family: var(--serif); font-size: 2.3rem; font-weight: 700; color: var(--ink); margin-top: .7rem; display: flex; align-items: center; gap: .7rem; line-height: 1.1; }
.ls .player .tt i { font-style: normal; color: var(--terra); font-size: 1.8rem; font-family: var(--sans); }
.ls .player .pr > p { font-size: 1.12rem; color: var(--muted); margin-top: .5rem; line-height: 1.6; }
.ls .player .tags { display: flex; gap: .5rem; margin-top: .7rem; flex-wrap: wrap; }
.ls .player .pbar { height: .45rem; border-radius: .3rem; background: #EADCC2; margin-top: auto; overflow: hidden; }
.ls .player .pbar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--green), #7FA08C); border-radius: .3rem; transition: width .2s; }
.ls .player .times { display: flex; justify-content: space-between; font-size: 1rem; color: var(--muted); margin-top: .35rem; }
.ls .player .pctrl { display: flex; align-items: center; justify-content: space-between; margin-top: .4rem; color: var(--brown); }
.ls .player .pc { width: 4.4rem; height: 4.4rem; border-radius: 50%; background: var(--green); color: #F2F6F0; display: flex; align-items: center; justify-content: center; box-shadow: 0 .35rem 1rem rgba(70, 104, 90, .4); }
.ls .player .pc svg { width: 2rem; height: 2rem; }
.ls .player .pctrl > button { display: flex; align-items: center; justify-content: center; min-width: 2.8rem; min-height: 2.8rem; }
.ls .player .pctrl > button > svg { width: 2rem; height: 2rem; }

/* 音疗页 · 呼吸 */
.ls .breath-row { display: flex; align-items: center; justify-content: space-between; margin-top: 1.6rem; }
.ls .bstep { display: flex; flex-direction: column; align-items: center; gap: .5rem; width: 9.6rem; text-align: center; }
.ls .bstep .c { width: 4.8rem; height: 4.8rem; border-radius: 50%; background: rgba(238, 244, 238, .9); border: 1px solid #C6D4C8; display: flex; align-items: center; justify-content: center; color: var(--green-deep); }
.ls .bstep .c svg { width: 2.4rem; height: 2.4rem; }
.ls .bstep b { font-size: 1.45rem; color: var(--brown); }
.ls .bstep span { font-size: 1.05rem; color: var(--muted); line-height: 1.4; }
.ls .barrow { color: var(--line-2); flex: 1; display: flex; justify-content: center; margin-bottom: 3.4rem; }

/* 音疗页 · 曲目列表 */
.ls .track { display: flex; align-items: center; gap: 1.1rem; padding: 1rem 0; border-bottom: 1px dashed var(--line); }
.ls .track:last-child { border-bottom: 0; padding-bottom: .2rem; }
.ls .track .thumb { width: 4.6rem; height: 4.6rem; border-radius: .8rem; object-fit: cover; flex: none; }
.ls .track .tt { font-size: 1.5rem; font-weight: 700; color: var(--brown); }
.ls .track .note { color: #C4472F; font-size: 1.1rem !important; margin-left: .4rem; }
.ls .track .tags { display: flex; gap: .5rem; margin-top: .45rem; flex-wrap: wrap; }
.ls .track .dur { font-size: 1.2rem; color: var(--muted); margin-left: auto; flex: none; }
.ls .play-c { width: 3.4rem; height: 3.4rem; border-radius: 50%; background: var(--green); display: flex; align-items: center; justify-content: center; color: #F2F6F0; flex: none; box-shadow: 0 .25rem .7rem rgba(70, 104, 90, .35); }
.ls .play-c svg { width: 1.5rem; height: 1.5rem; }
.ls .play-c.on { background: var(--terra); box-shadow: 0 .25rem .7rem rgba(176, 85, 46, .35); }
.ls .ls-track-tx { flex: 1; min-width: 0; }
.ls .ls-track-desc { font-size: 1.15rem; color: var(--muted); margin-top: .2rem; }
.ls .ls-swap { display: inline-flex; align-items: center; gap: .4rem; }

/* 音疗页 · 分区外距（对应主壳中的行内 style） */
.ls .ls-sec-organ { padding: 1.6rem 1.4rem 1.4rem; margin-top: 2rem; }
.ls .ls-sec-breath { padding: 1.6rem 1.5rem; margin-top: 2rem; }
.ls .ls-sec-rec { padding: 1.6rem 1.5rem 1.2rem; margin-top: 2rem; }
.ls .ls-rec-list { margin-top: .6rem; }

/* toast */
.ls .toast {
  position: fixed; left: 50%; bottom: 12rem; transform: translateX(-50%) translateY(2rem); background: rgba(58, 40, 24, .92); color: #F6ECDC;
  font-size: 1.35rem; border-radius: 2rem; padding: .9rem 2rem; opacity: 0; pointer-events: none; transition: all .25s; z-index: 99; letter-spacing: .06em;
  max-width: calc(100vw - 2rem); width: max-content; text-align: center; overflow-wrap: anywhere;
}
.ls .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

@media (prefers-reduced-motion: reduce) {
  .ls *, .ls *::before, .ls *::after { animation: none !important; transition: none !important; }
}
</style>
