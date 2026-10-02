<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="$router.push('/')">← 首页</button>
      <h1>{{ style.name }} · 要领</h1>
    </div>
    <div class="body list">
      <div v-if="!moves.length" class="empty">该拳种动作清单待定</div>
      <div v-for="(m, i) in moves" :key="m.id" class="item" :class="{ done: done.has(m.id - 1) }">
        <div class="item-idx">{{ i + 1 }}</div>
        <div class="item-main">
          <div class="item-name">
            {{ m.name }}
            <span class="item-string">{{ m.chord ? '七弦齐鸣' : `${m.stringIndex} 号弦` }}</span>
          </div>
          <div class="item-cue">{{ m.cue }}</div>
          <div class="item-tip">{{ m.tip }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getStyle, resolveStyle } from '../data/styles'
import { getRecords } from '../stores/records'

// 最近一次完成过的式
const route = useRoute()
const style = computed(() => getStyle(resolveStyle(route.query.style)) || getStyle('baduanjin'))
const moves = computed(() => style.value.moves)
const done = computed(() => new Set(getRecords()[0]?.moves ?? []))
</script>

<style scoped>
.sm { padding: 7px 12px; font-size: 12px; }
.list { padding: 16px; }
.item { display: flex; gap: 13px; padding: 14px 0; border-bottom: 1px solid rgba(232,224,208,.06); }
.item-idx { flex: 0 0 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(232,224,208,.2); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); }
.item.done .item-idx { background: var(--zhu); border-color: var(--zhu); color: #fff; }
.item-main { flex: 1; }
.item-name { font-size: 16.5px; letter-spacing: 1.5px; display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
.item-string { font-size: 10.5px; color: var(--jin); font-family: var(--font-ui); letter-spacing: 0; }
.item-cue { font-size: 12.5px; color: var(--xuan-dim); margin-top: 6px; line-height: 1.8; font-family: var(--font-ui); }
.item-tip { font-size: 12px; color: var(--xuan-faint); margin-top: 4px; line-height: 1.7; font-family: var(--font-ui); }
</style>
