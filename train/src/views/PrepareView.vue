<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="$router.push('/')">← 首页</button>
      <h1>练习准备</h1>
      <div class="spacer"></div>
    </div>

    <div class="body prep">
      <!-- 模式选择 -->
      <section class="section">
        <div class="sec-title">练习模式</div>
        <div class="options">
          <button
            v-for="m in modes" :key="m.key"
            class="opt"
            :class="{ on: mode === m.key }"
            @click="mode = m.key"
          >
            <span class="opt-name">{{ m.name }}</span>
            <span class="opt-dur">{{ m.duration }}</span>
          </button>
        </div>
      </section>

      <!-- 阶段选择 -->
      <section class="section">
        <div class="sec-title">练习阶段</div>
        <div class="stages">
          <button
            v-for="s in stages" :key="s.key"
            class="stage-card"
            :class="{ on: stage === s.key }"
            @click="stage = s.key"
          >
            <span class="stage-k">{{ s.label }}</span>
            <span class="stage-n">{{ s.name }}</span>
            <span class="stage-d">{{ s.desc }}</span>
          </button>
        </div>
      </section>

      <!-- 指引 -->
      <section class="section">
        <div class="sec-title">准备就绪</div>
        <div class="tips">
          <p>请后退 1.5–2 米，让全身进入取景框，正面受光。</p>
          <p>做到位即响，无需倒数；练到哪式，哪根弦会亮起。</p>
        </div>
      </section>

      <button class="btn primary start" @click="begin">启动摄像头并起式</button>

      <!-- 悬浮示例入口 -->
      <button class="float-demo" @click="demo">查看预录演示</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getTone } from '../data/tones'
import { unlockAudio, preloadSamples } from '../engine/guqin'

const router = useRouter()

const modes = [
  { key: 'full', name: '全套 8 式', duration: '约 12 分钟' },
  { key: 'short', name: '招牌 3 式', duration: '约 5 分钟' },
]

const stages = [
  { key: 'point', label: '一 · 点', name: '学架子', desc: '一个动作一声，无节拍压力' },
  { key: 'line', label: '二 · 线', name: '找气感', desc: '五声短句循环，做到位触发一句' },
  { key: 'arc', label: '三 · 面', name: '入静', desc: '12 分钟连续弧线，音乐掌拍' },
]

const mode = ref('full')
const stage = ref('point')

function begin() {
  unlockAudio()
  preloadSamples()
  const tone = localStorage.getItem('xianyang.tone') || 'gong'
  // 冻结稿 §4：Demo 阶段仅实际练习八段锦，其余拳种仅胶囊文案展示
  const style = 'baduanjin'
  // 阶段形态演示：一·点走跟练页；二·线 / 三·面走独立体验页
  if (stage.value === 'point') {
    router.push({ path: '/train', query: { stage: 'point', mode: mode.value, style, tone } })
  } else if (stage.value === 'line') {
    router.push({ path: '/workshop', query: { mode: mode.value, style, tone } })
  } else if (stage.value === 'arc') {
    router.push({ path: '/arc', query: { mode: mode.value, style, tone } })
  }
}

function demo() {
  // 预录演示入口：直接进跟练页但开 demoMode
  const stg = stage.value
  const q = { mode: mode.value, demo: '1', style: localStorage.getItem('xianyang.style') || 'baduanjin', tone: localStorage.getItem('xianyang.tone') || 'gong' }
  if (stg === 'arc') { router.push({ path: '/arc', query: q }); return }
  router.push({ path: '/train', query: { ...q, stage: stg } })
}
</script>

<style scoped>
.prep { padding: 20px 20px var(--body-pad-b); }
.section { margin-bottom: 24px; }
.sec-title {
  font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui);
  margin-bottom: 12px; letter-spacing: .05em;
}

.options { display: flex; gap: 10px; }
.opt {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 12px; border-radius: 12px;
  border: 1px solid rgba(58, 51, 42,.12); background: rgba(58, 51, 42,.03);
  color: var(--xuan); cursor: pointer; transition: .15s;
}
.opt.on { border-color: var(--zhu); background: rgba(200, 93, 77,.12); }
.opt-name { font-size: 15px; }
.opt-dur { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }

.stages { display: flex; flex-direction: column; gap: 10px; }
.stage-card {
  display: grid; grid-template-columns: 56px 1fr; gap: 6px 12px;
  padding: 14px 16px; border-radius: 12px; text-align: left;
  border: 1px solid rgba(58, 51, 42,.12); background: rgba(58, 51, 42,.03);
  color: var(--xuan); cursor: pointer; transition: .15s;
}
.stage-card.on { border-color: var(--zhu); background: rgba(200, 93, 77,.12); }
.stage-k { grid-row: span 2; align-self: center; font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); }
.stage-n { font-size: 16px; color: var(--jin); }
.stage-d { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); }

.tips { padding: 14px 16px; border-radius: 12px; background: rgba(58, 51, 42,.04); }
.tips p { margin: 0 0 6px; font-size: 12.5px; color: var(--xuan-dim); font-family: var(--font-ui); line-height: 1.7; }
.tips p:last-child { margin-bottom: 0; }

.start { width: 100%; padding: 16px; font-size: 16px; margin-top: 8px; }

.float-demo {
  display: block; margin: 16px auto 0;
  font-size: 13px; color: var(--xuan-faint); font-family: var(--font-ui);
  background: transparent; border: 1px dashed rgba(58, 51, 42,.16);
  padding: 11px 18px; border-radius: 22px; cursor: pointer;
  min-height: 40px;
}
</style>
