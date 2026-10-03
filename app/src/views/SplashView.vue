<template>
  <div class="wrap splash">
    <div class="brand">弦养</div>
    <div class="tag">以身为琴，以动为弦</div>
    <div class="loading" v-if="state === 'loading'">
      <div class="dots"><span></span><span></span><span></span></div>
      <div class="txt">正在准备古琴音色与动作识别…</div>
    </div>
    <div class="actions" v-if="state === 'ready'">
      <button class="btn primary enter" @click="enter">进入弦养</button>
    </div>
    <div class="actions" v-if="state === 'error'">
      <button class="btn primary" @click="retry">重试</button>
      <button class="btn ghost" @click="demo">查看预录演示</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { preloadSamples, unlockAudio } from '../engine/guqin'
import { primeVoice } from '../engine/voice'
import { getSetting } from '../stores/settings'

const router = useRouter()
const state = ref('loading')
const audioOn = ref(true)

onMounted(async () => {
  try {
    // 「进入时初始化音频」开关：关掉就连音色上下文都不建，
    // 之后第一次真正用到音频时（用户点了开始练）才在手势内解锁。
    audioOn.value = getSetting('audioOn')
    if (audioOn.value) {
      unlockAudio()
      preloadSamples()
      primeVoice()
    }
    await new Promise(r => setTimeout(r, 1200))
    state.value = 'ready'
  } catch (e) {
    state.value = 'error'
  }
})

function enter() {
  const visited = localStorage.getItem('xianyang.visited')
  if (!visited) {
    router.push('/welcome')
  } else {
    router.push('/')
  }
}

function retry() {
  state.value = 'loading'
  setTimeout(() => { state.value = 'ready' }, 800)
}
function demo() { router.push({ path: '/train', query: { demo: '1', stage: 'point', mode: 'full' } }) }
</script>

<style scoped>
.splash { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px; }
.brand { font-size: 64px; letter-spacing: 18px; text-indent: 18px; color: var(--xuan); margin-bottom: 14px; }
.tag { font-size: 14px; color: var(--xuan-dim); font-family: var(--font-ui); letter-spacing: 2px; margin-bottom: 48px; }
.loading { display: flex; flex-direction: column; align-items: center; }
.dots { display: flex; gap: 8px; margin-bottom: 14px; }
.dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--zhu); animation: bounce 1.2s infinite; }
.dots span:nth-child(2) { animation-delay: .2s; }
.dots span:nth-child(3) { animation-delay: .4s; }
.txt { font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); }
.enter { padding: 14px 48px; font-size: 16px; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(.7); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }
</style>
