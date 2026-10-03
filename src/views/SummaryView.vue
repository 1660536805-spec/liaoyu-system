<template>
  <div class="wrap">
    <div class="topbar">
      <h1>今日琴谱</h1>
      <div class="spacer"></div>
      <button class="btn ghost sm" @click="$router.push('/')">完成</button>
    </div>

    <div class="body summary">
      <!-- 分数 -->
      <div class="score-ring">
        <div class="score-circle">
          <div class="score-num">{{ score }}</div>
          <div class="score-lbl">分</div>
        </div>
        <div class="score-text">{{ scoreText }}</div>
      </div>

      <!-- 琴谱可视化 -->
      <div class="strings-viz">
        <div class="sv-title">七弦回响<span class="sv-sub">响过的弦会立起来</span></div>
        <div class="strings">
          <div
            v-for="(s, i) in stringBars" :key="i"
            class="s-bar"
            :class="{ lit: s.hit }"
            :style="{ height: s.height, background: s.color }"
          >
            <span class="s-name">{{ s.name }}</span>
          </div>
        </div>
      </div>

      <!-- 详细反馈 -->
      <div class="feedback">
        <div class="fb-title">练习反馈</div>
        <div class="fb-item" v-for="(item, idx) in feedbacks" :key="idx">
          <div class="fb-dot" :class="item.type"></div>
          <div>
            <div class="fb-head">{{ item.title }}</div>
            <div class="fb-body">{{ item.body }}</div>
          </div>
        </div>
      </div>

      <!-- 练习数据 -->
      <div class="data">
        <div class="data-title">练习数据</div>
        <div class="data-grid">
          <div class="data-item"><span class="data-num">{{ done }}</span><span class="data-lab">命中式数</span></div>
          <div class="data-item"><span class="data-num">{{ duration }}</span><span class="data-lab">练习时长</span></div>
          <div class="data-item"><span class="data-num">{{ streak }}</span><span class="data-lab">连续打卡</span></div>
        </div>
      </div>

      <!-- 食谱推荐（定制版） -->
      <div class="recipe" v-if="hasBodyData">
        <div class="recipe-title">今日食谱</div>
        <div class="recipe-card">
          <div class="recipe-name">{{ recipe.name }}</div>
          <div class="recipe-why">{{ recipe.why }}</div>
          <button class="btn ghost sm recipe-save" @click="saveRecipe">收藏</button>
        </div>
      </div>
      <div class="recipe-lock" v-else>
        <span>补充身体数据，解锁定制食谱</span>
        <button class="btn sm" @click="$router.push('/me/body-data')">去补充</button>
      </div>

      <!-- 底部操作 -->
      <div class="actions">
        <button class="btn primary" @click="again">再练一次</button>
        <button class="btn" @click="share">分享琴谱</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getRecords, saveRecord } from '../stores/records'
import { hasBodyData as readHasBodyData, getBodyData } from '../stores/bodyData'
import { getTone } from '../data/tones'

const router = useRouter()
const route = useRoute()

const done = ref(Number(route.query.done) || 0)
const total = ref(Number(route.query.total) || 8)
const toneKey = ref(route.query.tone || localStorage.getItem('xianyang.tone') || 'gong')
const tone = computed(() => getTone(toneKey.value))
// 实际时长：跟练页把真值放进 query；没带就按甲方 12 分钟口径兜底
const duration = computed(() => {
  const m = Number(route.query.minutes)
  return m > 0 ? `${m} 分钟` : '12 分钟'
})

// 持久化打卡
onMounted(() => {
  // 如果 query 带 done，就存一条记录
  if (route.query.done) {
    saveRecord({
      moves: Array.from({ length: done.value }, (_, i) => i),
      names: [],
      tone: toneKey.value,
      minutes: Number(route.query.minutes) || 0,
    })
  }
  hasBodyData.value = readHasBodyData()
  if (hasBodyData.value) pickRecipe()
  syncStreak()
})

const score = computed(() => Math.min(100, Math.round((done.value / total.value) * 100)))
const scoreText = computed(() => {
  const s = score.value
  if (s >= 100) return '行云流水，古琴已为你而鸣'
  if (s >= 75) return '渐入佳境，再练几遍会更稳'
  if (s >= 37) return '动作初成，坚持自有回响'
  return '八段锦在于坚持，明天继续'
})

const stringNames = ['宫', '商', '角', '徵', '羽', '宫高', '商高']
const stringBars = computed(() => {
  // 高度按「这一式响的是第几根弦」排：命中过的弦按命中比例升高，
  // 未命中的给一个明确的矮基线（不能太矮，否则在浅色底上像空白）。
  const hitCount = Math.min(done.value, stringNames.length)
  return stringNames.map((n, i) => {
    const hit = i < hitCount
    // 命中：40% 起，每多一根再长一截；未命中：固定 18% 的可见基线
    const h = hit ? 42 + (i / Math.max(1, stringNames.length - 1)) * 58 : 18
    return {
      name: n,
      hit,
      height: Math.round(h) + '%',
      color: hit ? 'var(--zhu)' : 'rgba(92, 70, 50,.14)',
    }
  })
})

const feedbacks = computed(() => {
  if (done.value >= total.value) {
    return [
      { type: 'good', title: '动作完整', body: '八式俱毕，气息和节奏都保持得不错。' },
      { type: 'tip', title: '明日目标', body: '保持 8 式命中，尝试让第 8 式落脚更轻、更稳。' },
    ]
  }
  return [
    { type: 'warn', title: '还有提升空间', body: `第 ${done.value + 1} 式可以再多感受一下发力的节奏。` },
    { type: 'tip', title: '明日目标', body: `目标完成 ${Math.min(total.value, done.value + 1)} 式，慢慢来。` },
  ]
})

// 连续打卡：与「我的」页同一套算法（按 day 去重后从今天/昨天往回数）
const streak = ref(0)
function syncStreak() {
  const days = [...new Set(getRecords().map((r) => r.day).filter(Boolean))].sort().reverse()
  if (!days.length) { streak.value = 0; return }
  const cur = new Date()
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (!days.includes(iso(cur))) cur.setDate(cur.getDate() - 1)
  let n = 0
  while (days.includes(iso(cur))) { n++; cur.setDate(cur.getDate() - 1) }
  streak.value = n
}

const hasBodyData = ref(false)

// 定制食谱：按身体数据里的运动关注部位 + 练习目标选一行，没填就给默认的温润款。
// 【合规】只写食材与口感取向，不写疗效（禁治疗/祛湿/根治，见 tones.js safeCopy）
const RECIPES = {
  颈肩: { name: '山药枸杞粥', why: '你提到颈肩容易紧，今日练习又偏伸展；山药与枸杞温润平和，适合作为晚餐。' },
  腰背: { name: '黑豆核桃糊', why: '你提到腰背不适，黑豆与核桃都以温润为要，口感顺滑，适合作加餐。' },
  膝盖: { name: '山药木耳汤', why: '你提到膝盖相关关注，山药与木耳口感清爽软糯，不给关节增加负担。' },
  手腕: { name: '小米南瓜羹', why: '你提到手腕相关关注，小米与南瓜质地温软，方便拿握，凉了也不硬。' },
}
const DEFAULT_RECIPE = { name: '山药枸杞粥', why: '温和好入口的一碗，适合练完之后的晚餐。' }
const recipe = ref(DEFAULT_RECIPE)

function pickRecipe() {
  const b = getBodyData()
  if (!b) return
  const inj = Array.isArray(b.injuries) ? b.injuries : []
  const key = inj.find((k) => RECIPES[k])
  recipe.value = key ? RECIPES[key] : DEFAULT_RECIPE
}

function saveRecipe() { alert('已收藏（P1 可接入收藏列表）') }
function again() { router.push('/prepare') }
function share() { alert('分享琴谱（P1 可接入系统分享）') }
</script>

<style scoped>
.summary { padding: 20px 20px var(--body-pad-b); }
.score-ring {
  display: flex; flex-direction: column; align-items: center; padding: 20px 0 26px;
}
.score-circle {
  width: 140px; height: 140px; border-radius: 50%;
  border: 8px solid rgba(92, 70, 50,.08);
  border-top-color: var(--zhu);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.score-num { font-size: 40px; color: var(--xuan); line-height: 1; }
.score-lbl { font-size: 12px; color: var(--xuan-faint); margin-top: 4px; }
.score-text { margin-top: 14px; font-size: 15px; color: var(--jin); text-align: center; }

.strings-viz { margin-bottom: 24px; }
.sv-title { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); margin-bottom: 6px; }
.sv-sub { margin-left: 8px; font-size: 11px; color: var(--xuan-faint); }
/* 柱区下留 26px 给弦名标签，否则标签会压在柱脚上（原先就是这样糊成一团） */
.strings {
  display: flex; align-items: flex-end; gap: 10px; height: 130px;
  justify-content: center; padding-bottom: 26px;
  border-bottom: 1px solid rgba(92, 70, 50,.12);
}
.s-bar {
  width: 28px; border-radius: 4px 4px 0 0; position: relative; transition: .4s;
  min-height: 14px;   /* 再矮也留一条可见的柱脚 */
}
.s-bar.lit { box-shadow: 0 0 12px rgba(200, 93, 77,.35); }
.s-name {
  position: absolute; bottom: -22px; left: 50%; transform: translateX(-50%);
  font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); white-space: nowrap;
}
.s-bar.lit .s-name { color: var(--zhu); }

.feedback { margin-bottom: 24px; }
.fb-title { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); margin-bottom: 12px; }
.fb-item { display: flex; gap: 12px; margin-bottom: 12px; }
.fb-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex: 0 0 auto; }
.fb-dot.good { background: #7fb069; }
.fb-dot.warn { background: var(--zhu); }
.fb-dot.tip { background: var(--jin); }
.fb-head { font-size: 14px; color: var(--xuan); }
.fb-body { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); line-height: 1.7; margin-top: 2px; }

.data { margin-bottom: 24px; }
.data-title { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); margin-bottom: 12px; }
.data-grid { display: flex; gap: 12px; }
.data-item { flex: 1; text-align: center; padding: 14px 8px; border-radius: 12px; background: rgba(92, 70, 50,.04); }
.data-num { display: block; font-size: 20px; color: var(--jin); }
.data-lab { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }

.recipe { margin-bottom: 24px; }
.recipe-title { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); margin-bottom: 12px; }
.recipe-card { padding: 16px; border-radius: 12px; background: rgba(92, 70, 50,.04); border: 1px solid rgba(92, 70, 50,.08); }
.recipe-name { font-size: 16px; color: var(--jin); margin-bottom: 6px; }
.recipe-why { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); line-height: 1.7; margin-bottom: 10px; }
.recipe-save { font-size: 11px; }
.recipe-lock { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 12px; background: rgba(92, 70, 50,.03); border: 1px dashed rgba(92, 70, 50,.12); margin-bottom: 24px; }
.recipe-lock span { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); }

.actions { display: flex; gap: 12px; }
.actions .btn { flex: 1; }
</style>
