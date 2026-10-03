<template>
  <main class="legacy-page phone sc legacy-screen">
    <header class="legacy-top"><button class="legacy-round" @click="router.push('/me')">‹</button><strong>身体数据</strong><span></span></header>
    <section class="legacy-hero compact"><img src="/art/landscape.jpg" alt="" /><div><span class="legacy-seal">弦养</span><h1>身体资料</h1><p>资料保存在本机，用于个性化显示与练习偏好。</p></div></section>
    <form class="legacy-card legacy-form" @submit.prevent="save">
      <label>身高（cm）<input v-model.number="form.height" type="number" min="120" max="220" /></label>
      <label>体重（kg）<input v-model.number="form.weight" type="number" min="30" max="200" /></label>
      <label>年龄（岁）<input v-model.number="form.age" type="number" min="12" max="120" /></label>
      <label>主要练习目标<select v-model="form.preferences.goal"><option v-for="goal in goals" :key="goal">{{ goal }}</option></select></label>
      <p class="legacy-muted">不填写也可以正常练习。身体数据不会用于动作识别。</p>
      <button class="legacy-primary" type="submit">保存身体设置</button>
      <p v-if="saved" class="legacy-saved" role="status">已保存到本机</p>
    </form>
  </main>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { profile } from '../stores/profile'
const router = useRouter()
const form = reactive(profile.load())
const goals = ['舒缓肩颈', '放松腰背', '改善睡眠', '舒展身心', '提振精神', '整体练习']
const saved = ref(false)
function save() { Object.assign(form, profile.save(form)); saved.value = true }
</script>
