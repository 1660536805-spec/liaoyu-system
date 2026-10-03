<template>
  <main class="legacy-page phone sc legacy-screen">
    <header class="legacy-top"><button class="legacy-round" @click="router.push('/')">‹</button><span>了解你的练习偏好</span><span>1 / 1</span></header>
    <section class="legacy-hero compact"><img src="/art/landscape.jpg" alt="" /><div><span class="legacy-seal">弦养</span><h1>今天想照顾哪里？</h1><p>选一个最贴近此刻状态的方向，我们会据此推荐练习氛围。</p></div></section>
    <section class="legacy-card">
      <h2>你最近哪里容易不舒服？</h2>
      <p>仅用于本机个性化推荐，不会上传。</p>
      <div class="legacy-choice-grid">
        <button v-for="goal in goals" :key="goal" :class="{ selected: selected === goal }" @click="selected = goal">{{ goal }}<span>{{ selected === goal ? '✓' : '○' }}</span></button>
      </div>
    </section>
    <div class="legacy-actions"><button class="legacy-primary" @click="continueToHome">保存并继续</button><button class="legacy-text-button" @click="skip">跳过</button><p v-if="storageWarning" role="status" class="legacy-muted">浏览器未允许本机存储，偏好仅在当前会话内保留。</p></div>
  </main>
</template>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { profile, completeOnboarding, getProfileStorageStatus } from '../stores/profile'
const router = useRouter()
const goals = ['舒缓肩颈', '放松腰背', '改善睡眠', '舒展身心', '提振精神', '整体练习']
const selected = ref(profile.load().preferences.goal || goals[0])
const storageWarning = ref(!getProfileStorageStatus().persistent)
function continueToHome() {
  const current = profile.load()
  profile.save({ ...current, preferences: { ...current.preferences, goal: selected.value } })
  completeOnboarding()
  storageWarning.value = !getProfileStorageStatus().persistent
  router.push('/')
}
function skip() { completeOnboarding(); storageWarning.value = !getProfileStorageStatus().persistent; router.push('/') }
</script>
