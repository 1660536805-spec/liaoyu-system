<template>
  <main class="legacy-page phone sc center legacy-cover">
    <img class="legacy-art" src="/art/landscape.jpg" alt="山水间的晨雾" />
    <div class="legacy-cover-content">
      <img class="legacy-guqin" src="/art/guqin.png" alt="古琴" />
      <div class="legacy-seal">弦养</div>
      <h1>以身为琴，以动为弦</h1>
      <p>古琴之音，调息养心；<br />一动一弦，唤回更好的自己。</p>
      <button class="legacy-primary" @click="router.push('/questions')">进入弦养</button>
      <button class="legacy-text-button" @click="router.push('/')">先看看首页</button>
    </div>
  </main>
</template>
<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
