<template>
  <main class="legacy-page phone sc navpad">
    <header class="legacy-top"><span></span><strong>我的</strong><button class="legacy-round" aria-label="身体数据" @click="router.push('/me/body-data')">⚙</button></header>
    <section class="legacy-hero compact profile-hero"><img src="/art/q-mood.jpg" alt="" /><div><span class="legacy-seal">弦养</span><h1>在弦音中，<br />遇见更好的自己</h1><p>{{ details.age }} 岁 · {{ details.height }} cm · {{ details.weight }} kg</p></div></section>
    <section class="legacy-card legacy-summary"><div><span>练习次数</span><b>{{ records.length }}</b></div><div><span>完成动作</span><b>{{ movesDone }}</b></div><div><span>完整练习</span><b>{{ completeCount }}</b></div></section>
    <section class="legacy-card"><div class="legacy-card-heading"><h2>最近练习</h2><button @click="router.push('/record')">全部记录 ›</button></div>
      <div v-if="latest" class="legacy-last-record"><b>{{ latest.complete ? '八式完整练习' : '阶段性练习' }}</b><span>{{ latest.date }} · {{ latest.doneCount }} 式 · {{ latest.minutes || '<1' }} 分钟</span><p>手动完成 {{ manualCount(latest) }} 式 · 姿态识别 {{ detectedCount(latest) }} 式</p></div>
      <p v-else class="legacy-muted">还没有练习记录，完成一次跟练后会显示在这里。</p>
    </section>
    <section class="legacy-card"><h2>个人资料</h2><div class="legacy-link-row"><button @click="router.push('/me/body-data')">身体数据 <span>身高、体重、年龄和练习偏好 ›</span></button><button @click="router.push('/sound')">五音氛围 <span>{{ toneName }}调 · 本机保存 ›</span></button></div></section>
    <nav class="legacy-nav"><button @click="router.push('/')">首页</button><button @click="router.push('/sound')">音疗</button><button @click="router.push('/intro')">开始练</button><button class="on" @click="router.push('/me')">我的</button></nav>
  </main>
</template>
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { recordStore } from '../stores/records'
import { profile } from '../stores/profile'
import { getTone } from '../data/tones'
const router = useRouter()
const records = computed(() => recordStore.list())
const latest = computed(() => records.value[0] || null)
const details = computed(() => profile.load())
const movesDone = computed(() => records.value.reduce((sum, record) => sum + (record.doneCount || 0), 0))
const completeCount = computed(() => records.value.filter((record) => record.complete).length)
const toneName = computed(() => getTone(details.value.preferences.tone).name)
const manualCount = (record) => (record.sources || []).filter((source) => source === 'manual' || source === 'fallback').length
const detectedCount = (record) => (record.sources || []).filter((source) => source === 'detected').length
</script>
