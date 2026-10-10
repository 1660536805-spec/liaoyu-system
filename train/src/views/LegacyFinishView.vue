<template>
  <main class="legacy-page phone sc legacy-screen">
    <header class="legacy-top"><button class="legacy-round" @click="router.push('/')">‹</button><strong>练习总结</strong><button class="legacy-round" aria-label="练习记录" @click="router.push('/record')">⌕</button></header>
    <section class="legacy-hero compact"><img src="/art/landscape.jpg" alt="" /><div><span class="legacy-seal">弦养</span><h1>{{ record?.complete ? '一曲练毕，身心舒展' : '练习已保存' }}</h1><p>每一次练习都值得记录，动作来源会如实标注。</p></div></section>
    <section class="legacy-card legacy-result">
      <div class="legacy-result-count"><b>{{ record?.doneCount ?? 0 }}</b><span>/ 8 式完成</span></div>
      <p>{{ record?.complete ? '八式练习已完成。' : '这是一次阶段性练习记录。' }} · {{ duration }}</p>
      <div class="legacy-record-meta">{{ record?.date || '刚刚' }} · {{ toneName }}调</div>
    </section>
    <section class="legacy-card"><h2>动作记录</h2><div class="legacy-move-list"><div v-for="(name, index) in moveNames" :key="index"><span>{{ index + 1 }}. {{ name }}</span><b :class="source(record, index).class">{{ source(record, index).label }}</b></div><p v-if="!moveNames.length" class="legacy-muted">暂无动作完成记录。</p></div></section>
    <div class="legacy-actions"><button class="legacy-primary" @click="router.push('/me')">完成，查看我的记录</button><button class="legacy-secondary" @click="router.push('/intro')">再练一次</button></div>
  </main>
</template>
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { recordStore } from '../stores/records'
import { getTone } from '../data/tones'
const router = useRouter()
const record = computed(() => recordStore.list()[0] || null)
const moveNames = computed(() => record.value?.names || [])
const duration = computed(() => record.value?.minutes ? `${record.value.minutes} 分钟` : '不足 1 分钟')
const toneName = computed(() => getTone(record.value?.tone || 'gong').name)
function source(item, index) {
  const value = item?.sources?.[index] || 'detected'
  return value === 'manual' ? { label: '手动', class: 'manual' } : value === 'fallback' ? { label: '预录兜底', class: 'manual' } : { label: '识别', class: 'detected' }
}
</script>
