<template>
  <div class="wrap onboard">
    <div class="topbar">
      <div class="spacer"></div>
      <button class="btn ghost sm" @click="skip">跳过</button>
    </div>

    <div class="body">
      <div class="progress">{{ step + 1 }} / {{ questions.length }}</div>
      <h2 class="q">{{ q.title }}</h2>

      <div class="options">
        <button
          v-for="o in q.options" :key="o"
          class="opt"
          :class="{ on: answers[step] === o }"
          @click="answers[step] = o"
        >{{ o }}</button>
      </div>

      <button class="btn primary next" :disabled="!answers[step]" @click="next">{{ step < questions.length - 1 ? '下一题' : '完成' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getTone } from '../data/tones'

const router = useRouter()

const questions = [
  { title: '你最近哪里容易不舒服？', options: ['颈肩', '腰背', '脾胃', '睡眠', '情绪', '没有'] },
  { title: '每天久坐时长？', options: ['<4h', '4–8h', '>8h'] },
  { title: '运动基础？', options: ['零基础', '偶尔练', '有规律'] },
  { title: '今天想练什么氛围？', options: ['平和', '提振', '放松', '帮我选'] },
  { title: '每天能投入多久？', options: ['5 分钟', '10 分钟', '15 分钟以上'] },
  { title: '你更想练什么？', options: ['八段锦', '五禽戏', '帮我选'] },
  { title: '是否有膝盖不适？', options: ['是', '否'] },
]

const step = ref(0)
const answers = ref([])

const q = computed(() => questions[step.value])

import { computed } from 'vue'

function next() {
  if (step.value < questions.length - 1) {
    step.value++
    return
  }
  applyRecommendation()
  router.push('/')
}

function skip() { router.push('/') }

function applyRecommendation() {
  const a = answers.value
  const body = a[0] || '没有'
  const sit = a[1] || '<4h'
  const goal = a[3] || '平和'
  const style = (a[5] === '帮我选' ? '八段锦' : a[5]) || '八段锦'
  const knee = a[6] === '是'

  let tone = 'gong'
  if (['颈肩', '腰背'].includes(body) || sit === '>8h') tone = 'shang'
  else if (['睡眠', '情绪'].includes(body)) tone = 'yu'
  else if (body === '脾胃') tone = 'gong'
  else if (goal === '提振') tone = 'zhi'
  else if (goal === '放松') tone = 'yu'

  try {
    localStorage.setItem('xianyang.tone', tone)
    localStorage.setItem('xianyang.style', style === '五禽戏' ? 'wuqinxi' : 'baduanjin')
  } catch {}
}
</script>

<style scoped>
.onboard .topbar { border-bottom: 0; }
.body { padding: 0 24px 40px; display: flex; flex-direction: column; }
.progress { font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); margin-bottom: 20px; }
.q { font-size: 22px; color: var(--xuan); line-height: 1.5; margin-bottom: 28px; }
.options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
.opt {
  width: 100%; text-align: left; padding: 16px 18px; border-radius: 12px;
  border: 1px solid rgba(92, 70, 50,.12); background: rgba(92, 70, 50,.03);
  color: var(--xuan); font-size: 15px; cursor: pointer; transition: .15s;
}
.opt.on { border-color: var(--zhu); color: var(--zhu); background: rgba(200, 93, 77,.12); }
.next { width: 100%; }
</style>
