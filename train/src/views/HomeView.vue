<template>
  <div class="wrap">
    <div class="body home">
      <!-- 顶部 -->
      <header class="top">
        <div class="brand-row">
          <span class="brand-name">弦养</span>
          <span class="seal">弦养</span>
        </div>
        <div class="today-row">
          <span class="today">今日 · {{ term.name }}</span>
          <span class="date">{{ todayStr }} · 农历{{ lunarStr }}</span>
        </div>
        <div class="sub-slogan">顺时调养，身心自在</div>
      </header>

      <!-- 今日推荐卡 -->
      <div class="rec-card">
        <div class="rec-head">
          <span class="rec-badge">{{ rec.badge }}</span>
          <button class="rec-detail" @click="showWhy = true">为什么推荐给你</button>
        </div>
        <div class="rec-main">
          <div class="rec-title">{{ rec.style }} · {{ rec.toneName }}调</div>
          <div class="rec-sub">{{ rec.toneFeel }} · {{ rec.minutes }} 分钟</div>
          <div class="rec-note" v-if="rec.note">{{ rec.note }}</div>
          <div class="rec-tags">
            <span class="rtag" v-for="tag in th.exp" :key="tag">{{ tag }}</span>
          </div>
        </div>
        <button class="start-btn orb" @click="start">
          <span class="play-tri">▶</span>
          <span class="start-label orb-label">开始练</span>
        </button>
      </div>

      <!-- 拳种胶囊 -->
      <div class="style-pills">
        <button
          v-for="s in stylePills" :key="s.key"
          class="spill" :class="{ on: selectedStyle === s.key, off: s.disabled }"
          :disabled="s.disabled"
          @click="selectStyle(s.key)"
        >
          <span class="sp-name">{{ s.name }}</span>
          <span class="sp-desc">{{ s.desc }}</span>
        </button>
      </div>

      <!-- 节气引言 -->
      <div class="verse">
        <span>{{ term.name }}水返壑，风落木归山。——《月令七十二候集解》</span>
      </div>
    </div>

    <!-- 弹层 -->
    <div class="modal" v-if="showWhy" @click.self="showWhy = false">
      <div class="modal-card">
        <div class="modal-title">为什么推荐给你</div>
        <p>{{ th.why }}</p>
        <div class="modal-tags">
          <span>{{ tone.organ }} · {{ tone.name }}音</span>
          <span>{{ term.name }} · 主{{ term.vibe }}</span>
        </div>
        <button class="modal-close" @click="showWhy = false">知道了</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getTone, TONES } from '../data/tones'
import { getStyle, STYLE_LIST } from '../data/styles'
import { currentTerm, todayText } from '../data/solar'
import { unlockAudio, preloadSamples } from '../engine/guqin'
import { primeVoice } from '../engine/voice'

const router = useRouter()
const showWhy = ref(false)

const ICON_MEDITATE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="5.5" r="2.2"/><path d="M12 8v4M5 15c2-3 4.5-4 7-4s5 1 7 4M4 19c2.5-2 5-3 8-3s5.5 1 8 3"/></svg>'
const ICON_DEER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M7 3c0 2 1 3 2 4M17 3c0 2-1 3-2 4M9 7l-1-3M15 7l1-3M12 8c-2 0-3.5 1.5-3.5 3.5S10 15 12 15s3.5-1.5 3.5-3.5S14 8 12 8zM9 15l-1 6M15 15l1 6M12 15v5"/></svg>'
const ICON_DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/></svg>'

// 胶囊来自拳种注册表（styles.js），避免硬编码与注册表漂移；
// 未上线（status==='pending'）的拳种显式置灰，不假装可选。
const PILL_DESC = { baduanjin: '经典·全身调养', wuqinxi: '灵动·强筋养气', taiji: '圆活·调息养神' }
const stylePills = computed(() => [
  ...STYLE_LIST.map((s) => ({
    key: s.id,
    name: s.name,
    desc: PILL_DESC[s.id] || s.subtitle,
    disabled: s.status === 'pending',
    icon: s.id === 'wuqinxi' ? ICON_DEER : ICON_MEDITATE,
  })),
  { key: 'auto', name: '帮我选', desc: '智能推荐练习', disabled: false, icon: ICON_DICE },
])

const TONE_HOME = {
  gong: { what: '动作柔和、节奏平稳，调息养气，适合完成一轮全身练习。', why: '五音文化中，宫音与「脾」相应，意象偏向平稳、承载。配合节气收敛之势，让动作与呼吸更容易慢下来。', exp: ['舒缓减压', '调和气息', '适合日常'] },
  shang: { what: '扩胸开肩、吐纳清畅，适合久坐后的舒展练习。', why: '商音清越，与「肺」相应，意象偏向开阔、通透。让这一轮的呼吸更深、更顺。', exp: ['开胸透气', '呼吸更深', '清爽不闷'] },
  jue: { what: '伸展条达、盘活僵紧，适合身体发紧的时候练。', why: '角音条达，与「肝」相应，意象偏向生发、舒展。把僵住的身体一点点松开。', exp: ['松开僵紧', '盘活肩颈', '心情舒展'] },
  zhi: { what: '节奏明快、提神振气，适合没精神的时候练。', why: '徵音明快，与「心」相应，意象偏向开阔、提振。帮你把劲头慢慢提起来。', exp: ['提振精神', '动作有力', '心里亮堂'] },
  yu: { what: '缓慢深沉、安神入静，适合睡前或心躁的时候练。', why: '羽音幽深，与「肾」相应，意象偏向绵长、沉静。让思绪一点点沉下来。', exp: ['呼吸放慢', '心绪渐稳', '容易安眠'] },
}

function safeGet(k, fallback) { try { return localStorage.getItem(k) || fallback } catch { return fallback } }

const selectedStyle = ref(safeGet('xianyang.style', 'baduanjin'))
const toneKey = ref(safeGet('xianyang.tone', 'gong'))

// 主壳问诊结果（由 dist/app.js 的 saveQuiz 写入 localStorage['xy-quiz']）：
//   { answers, organ:0-4, rec:0宫|1徵|2羽, imode:0全套|1招牌, istage:0-2, tags }
// 「帮我选」真读这份结果；没有就如实说明，不假装个性化推荐。
function readShellQuiz() {
  try {
    const q = JSON.parse(localStorage.getItem('xy-quiz') || 'null')
    if (q && typeof q === 'object' && typeof q.rec === 'number') return q
  } catch {}
  return null
}
const shellQuiz = ref(readShellQuiz())
const REC_TONE = ['gong', 'zhi', 'yu']
// 音调：手动选拳种时用用户偏好；「帮我选」且有问诊时，用问诊算出的调式
const activeToneKey = computed(() => {
  if (selectedStyle.value === 'auto' && shellQuiz.value) {
    return REC_TONE[shellQuiz.value.rec] || toneKey.value
  }
  return toneKey.value
})

const term = computed(() => currentTerm())
const tone = computed(() => getTone(activeToneKey.value))
const th = computed(() => TONE_HOME[tone.value.key] || TONE_HOME.gong)
const weekday = computed(() => '周' + '日一二三四五六'[new Date().getDay()])
const todayStr = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const rec = computed(() => {
  const isAuto = selectedStyle.value === 'auto'
  const sid = isAuto ? 'baduanjin' : selectedStyle.value
  const st = getStyle(sid) || getStyle('baduanjin')
  const secs = st.moves.reduce((n, m) => n + (m.sec || 0), 0) + 30
  const q = isAuto ? shellQuiz.value : null
  return {
    style: st.name,
    moves: st.moves.length,
    minutes: Math.max(1, Math.round(secs / 60)),
    toneName: tone.value.name,
    toneFeel: tone.value.feel,
    // 「帮我选」有问诊 → 今日推荐（音调/套式来自问诊）；无问诊 → 通用推荐 + 如实说明
    badge: q || !isAuto ? '今日推荐' : '通用推荐',
    note: q
      ? (q.imode === 1 ? '按问诊结果：招牌三式 · 约 5 分钟' : '按问诊结果：整套八式 · 约 12 分钟')
      : (isAuto ? '还没做问诊 · 先按最稳妥的八段锦' : ''),
  }
})

function selectStyle(key) {
  const p = stylePills.value.find((x) => x.key === key)
  if (p && p.disabled) return // 未上线的拳种不假装可选中
  selectedStyle.value = key
  try { localStorage.setItem('xianyang.style', key) } catch {}
}

function start() {
  const p = stylePills.value.find((x) => x.key === selectedStyle.value)
  if (p && p.disabled) selectedStyle.value = 'baduanjin'
  unlockAudio()
  preloadSamples()
  primeVoice()
  router.push('/prepare')
}
</script>

<style scoped>
.home { padding: 26px 20px var(--body-pad-b); }
.brand-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.brand-name { font-size: 44px; letter-spacing: 8px; color: #2B251E; line-height: 1; }
.seal {
  width: 24px; height: 34px; border-radius: 4px; background: var(--zhu); color: #FDF8EE;
  font-size: 10px; display: grid; place-items: center; writing-mode: vertical-rl;
  letter-spacing: 2px; padding: 2px 0;
}
.today-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
.today { font-size: 20px; color: #2B251E; font-weight: 600; }
.date { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); }
.sub-slogan { font-size: 13px; color: var(--xuan-dim); margin-bottom: 20px; }

.rec-card {
  position: relative; border-radius: 22px; padding: 22px 20px; min-height: 290px;
  background: linear-gradient(135deg, #FFFDF8 0%, #F9F1E3 100%);
  border: 1px solid var(--border); box-shadow: 0 8px 24px rgba(58,51,42,.09);
  display: flex; flex-direction: column; justify-content: space-between;
  margin-bottom: 18px; overflow: hidden;
}
.rec-card::before {
  content: ''; position: absolute; right: -20px; top: -20px; width: 160px; height: 160px;
  background: radial-gradient(circle, rgba(231,195,168,.35) 0%, transparent 70%); pointer-events: none;
}
.rec-head { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
.rec-badge { font-size: 12px; color: #fff; background: var(--brown); padding: 4px 10px; border-radius: 12px; }
.rec-detail { font-size: 12px; color: var(--xuan-dim); text-decoration: underline; }
.rec-main {
  position: relative; z-index: 1;
  max-width: calc(100% - 145px); /* 留足右侧空间给大号核心入口按钮 */
}
.rec-title { font-size: 22px; font-weight: 600; color: #2B251E; margin-bottom: 6px; }
.rec-sub { font-size: 14px; color: var(--xuan-dim); margin-bottom: 10px; }
.rec-note { font-size: 11px; color: var(--brown); margin: -4px 0 10px; opacity: .9; }
.rec-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.rtag { font-size: 11px; padding: 3px 10px; border-radius: 20px; background: var(--green-light); color: var(--green); }

/* 核心入口大按钮：放大并强化视觉层次与呼吸感 */
.start-btn {
  position: absolute; right: 20px; bottom: 22px;
  width: 130px; height: 130px; border-radius: 50%;
  background: radial-gradient(circle at 40% 30%, #E2715F 0%, #C85D4D 70%, #AB4637 100%);
  color: #FFFDF8;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 8px 28px rgba(200,93,77,.42), 0 0 0 6px rgba(255,255,255,.55), 0 0 0 12px rgba(200,93,77,.14);
  border: 2px solid rgba(255,255,255,.6);
  z-index: 2;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease;
  animation: pulse-entry 3.8s ease-in-out infinite;
}
.start-btn:active {
  transform: scale(.95);
}
@keyframes pulse-entry {
  0%, 100% {
    box-shadow: 0 8px 28px rgba(200,93,77,.42), 0 0 0 6px rgba(255,255,255,.55), 0 0 0 12px rgba(200,93,77,.14);
  }
  50% {
    box-shadow: 0 10px 34px rgba(200,93,77,.52), 0 0 0 7px rgba(255,255,255,.65), 0 0 0 16px rgba(200,93,77,.2);
  }
}
.play-tri {
  font-size: 32px;
  margin-left: 4px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.2));
  line-height: 1;
}
.start-label {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-indent: 2.5px;
  text-shadow: 0 1px 3px rgba(0,0,0,.25);
  font-family: var(--font);
}

@media (min-width: 768px) {
  .rec-card {
    min-height: 310px;
    padding: 26px 24px;
  }
  .rec-main {
    max-width: calc(100% - 170px);
  }
  .start-btn {
    width: 152px;
    height: 152px;
    right: 24px;
    bottom: 24px;
  }
  .play-tri {
    font-size: 38px;
  }
  .start-label {
    font-size: 19px;
  }
}

.style-pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.spill {
  border: 1px solid var(--border); border-radius: 14px; padding: 12px 8px; text-align: center;
  background: var(--bg-card); color: var(--xuan);
}
.spill.on { background: var(--green); color: #fff; border-color: var(--green); }
.spill.off { opacity: .42; cursor: not-allowed; }
.sp-name { display: block; font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.sp-desc { font-size: 10px; opacity: .8; }

.verse {
  padding: 12px 16px; border-radius: 12px; background: rgba(255,253,246,.7);
  border: 1px solid rgba(58,51,42,.08); font-size: 12px; color: var(--xuan-dim);
  font-style: italic; text-align: center;
}

.modal { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100; display: grid; place-items: end center; }
.modal-card { background: var(--bg-card); width: 90%; max-width: 420px; border-radius: 20px 20px 0 0; padding: 20px; margin-bottom: env(safe-area-inset-bottom, 0px); }
.modal-title { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
.modal-card p { font-size: 13px; line-height: 1.8; color: var(--xuan-dim); margin-bottom: 12px; }
.modal-tags { display: flex; gap: 8px; margin-bottom: 16px; }
.modal-tags span { font-size: 11px; padding: 4px 10px; border-radius: 20px; background: var(--green-light); color: var(--green); }
.modal-close { width: 100%; padding: 12px; border-radius: 12px; background: var(--zhu); color: #fff; }
</style>
