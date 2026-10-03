<template>
  <main class="legacy-page phone sc navpad">
    <section class="legacy-hero home-hero"><img src="/art/landscape.jpg" alt="山水晨景" /><div class="legacy-hero-copy"><span class="legacy-seal">弦养</span><h1>让传统之美，<br />滋养当下的你</h1><p>以古琴相伴，循序练习，安放身心。</p></div></section>
    <div class="legacy-section-title">今日推荐</div>
    <button class="legacy-practice-orb" @click="router.push('/intro')"><span>▶</span><b>开始练</b><small>八段锦 · {{ toneName }}调 · 约 12 分钟</small></button>
    <section class="legacy-card recommendation"><div><h2>八段锦 · {{ toneName }}调</h2><p>舒展身心，适合日常练习。动作与琴声跟随真实练习进度。</p><span class="legacy-pill">{{ current.preferences.goal }}</span></div><button @click="changeTone">换个氛围</button></section>
    <section class="legacy-card"><h2>练习入口</h2><div class="legacy-link-row"><button @click="router.push('/sound')">音疗点单 <span>选择调式与本地曲目 ›</span></button><button @click="router.push('/guide')">动作示范 <span>查看八式要领 ›</span></button><button @click="router.push('/record')">练习记录 <span>查看本机练习历史 ›</span></button></div></section>
    <nav class="legacy-nav"><button class="on" @click="router.push('/')">首页</button><button @click="router.push('/sound')">音疗</button><button @click="router.push('/intro')">开始练</button><button @click="router.push('/me')">我的</button></nav>
  </main>
</template>
<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { profile } from '../stores/profile'
import { getTone, TONES } from '../data/tones'
const router = useRouter()
const current = ref(profile.load())
const toneName = computed(() => getTone(current.value.preferences.tone).name)
function changeTone() {
  const idx = TONES.findIndex((tone) => tone.key === current.value.preferences.tone)
  current.value = profile.save({ ...current.value, preferences: { ...current.value.preferences, tone: TONES[(idx + 1) % TONES.length].key } })
}
</script>
