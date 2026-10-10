<template>
  <main class="legacy-page phone sc">
    <header class="legacy-top"><button class="legacy-round" @click="router.push('/')">‹</button><strong>开始练习</strong><button class="legacy-round" aria-label="动作要领" @click="router.push('/guide')">?</button></header>
    <section class="legacy-hero intro-hero"><img src="/art/landscape.jpg" alt="山水" /><img class="legacy-figure" src="/art/figure-pose.png" alt="八段锦动作示意" /><div class="legacy-hero-copy"><span class="legacy-seal">弦养</span><h1>调身 · 静心 · 启程</h1><p>在古琴的呼吸里安放自己，从这一刻开始练习。</p></div></section>
    <section class="legacy-card"><h2>选择练习内容</h2><div class="legacy-choice-grid two"><button :class="{ selected: mode === 'guided' }" @click="mode = 'guided'">全套八式 <span>约 12 分钟</span></button><button :class="{ selected: mode === 'free' }" @click="mode = 'free'">自由练习 <span>按自己的节奏</span></button></div></section>
    <section class="legacy-card"><h2>练习前准备</h2><ul class="legacy-list"><li>手机或电脑保持稳定，正面受光。</li><li>进入练习后浏览器会请求摄像头权限。</li><li>摄像头不可用时，仍可切换手动点按并继续记录。</li></ul></section>
    <button class="legacy-primary" @click="start">打开摄像头并开始</button>
    <button class="legacy-text-button" @click="startManual">不使用摄像头，手动练习</button>
  </main>
</template>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { profile } from '../stores/profile'
const router = useRouter()
const mode = ref(profile.load().preferences.mode)
function start() {
  const p = profile.load(); profile.save({ ...p, preferences: { ...p.preferences, mode: mode.value } })
  router.push({ path: '/train', query: { mode: mode.value, tone: p.preferences.tone } })
}
function startManual() {
  const p = profile.load(); profile.save({ ...p, preferences: { ...p.preferences, mode: mode.value } })
  router.push({ path: '/train', query: { mode: mode.value, tone: p.preferences.tone, manual: '1' } })
}
</script>
