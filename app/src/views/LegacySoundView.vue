<template>
  <main class="legacy-page phone sc navpad">
    <header class="legacy-top"><button class="legacy-round" @click="router.push('/')">‹</button><strong>弦养 · 音疗</strong><button class="legacy-text-button" @click="router.push('/sound/library')">曲库</button></header>
    <section class="legacy-hero compact"><img src="/art/landscape.jpg" alt="" /><div><h1>今天想听哪种氛围？</h1><p>选一档五音氛围，也可播放已就位的本地古琴录音。</p></div></section>
    <section class="legacy-card"><h2>选择调式</h2><div class="legacy-tone-grid"><button v-for="t in TONES" :key="t.key" :class="{ selected: tone === t.key }" @click="choose(t.key)"><b>{{ t.name }}</b><span>{{ t.feel }}</span></button></div><p class="legacy-muted">{{ selectedTone.ds }}</p></section>
    <section class="legacy-card"><h2>本地可播放曲目</h2><article v-for="piece in playable" :key="piece.file" class="legacy-track"><div><b>{{ piece.title }}</b><span>{{ piece.dur }} · 古琴录音</span></div><button @click="toggle(piece)">{{ playing === piece.file ? '暂停' : '播放' }}</button></article><p class="legacy-muted" v-if="!playable.length">当前调式暂无本地录音。可选择其他调式试听。</p></section>
    <button class="legacy-primary" @click="router.push('/intro')">选好了，去练习</button>
    <nav class="legacy-nav"><button @click="router.push('/')">首页</button><button class="on" @click="router.push('/sound')">音疗</button><button @click="router.push('/intro')">开始练</button><button @click="router.push('/me')">我的</button></nav>
  </main>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { TONES, getTone } from '../data/tones'
import { profile } from '../stores/profile'
const router = useRouter()
const tone = ref(profile.load().preferences.tone)
const playing = ref('')
let player = null
const selectedTone = computed(() => getTone(tone.value))
const playable = computed(() => selectedTone.value.pieces.filter((piece) => piece.file))
function choose(key) { tone.value = key; profile.save({ ...profile.load(), preferences: { ...profile.load().preferences, tone: key } }) }
async function toggle(piece) {
  if (playing.value === piece.file) { player?.pause(); playing.value = ''; return }
  player?.pause()
  player = new Audio(`/audio/${piece.file}`)
  player.addEventListener('ended', () => { playing.value = '' }, { once: true })
  try { await player.play(); playing.value = piece.file } catch { playing.value = ''; window.alert('浏览器未能播放音频，请点击播放重试。') }
}
onBeforeUnmount(() => { player?.pause(); if (player) player.src = '' })
</script>
