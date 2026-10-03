<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="$router.push('/')">← 首页</button>
      <h1>打卡记录</h1>
      <div class="spacer"></div>
      <div v-if="records.length" class="sum">共 {{ records.length }} 次 · 完成 {{ fullCount }} 套</div>
    </div>

    <div class="body list">
      <div v-if="!records.length" class="empty">
        还没有练习记录<br /><span>去首页点「开始练」，练完一套就会出现在这里</span>
      </div>

      <div v-for="r in records" :key="r.ts" class="rec" :class="{ full: r.complete }">
        <div class="rec-head">
          <div class="rec-date">
            {{ r.date }}
            <span v-if="r.tone" class="rec-tone">{{ toneOf(r.tone).name }}调 · {{ toneOf(r.tone).feel }}</span>
          </div>
          <div class="rec-badge">{{ r.complete ? '完整一套' : `${r.doneCount} 式` }}</div>
        </div>
        <div class="rec-names">
          <span v-for="n in r.names" :key="n" class="tag">{{ n }}</span>
          <span v-if="!r.names.length" class="tag dim">无</span>
        </div>
      </div>

      <button v-if="records.length" class="btn ghost clear" @click="clear">清空记录</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getRecords, clearRecords } from '../stores/records'
import { getTone } from '../data/tones'

const records = ref([])
const toneOf = (k) => getTone(k)
onMounted(() => { records.value = getRecords() })
const fullCount = computed(() => records.value.filter((r) => r.complete).length)

function clear() {
  if (confirm('确定清空全部打卡记录？')) { clearRecords(); records.value = [] }
}
</script>

<style scoped>
/* 小按钮在手机上要够点：min-height 36px（比 44 略小但仍远好过 26px） */
.sm { padding: 8px 14px; font-size: 13px; min-height: 40px; }
.sum { font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); }
/* 底部留出 Tab + 安全区，否则最后一条被压住点不到 */
.list { padding: 16px 16px var(--body-pad-b); }
.empty { text-align: center; color: var(--xuan-dim); padding: 18vh 20px; line-height: 2.2; font-size: 15px; }
.empty span { font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); }

.rec { border: 1px solid rgba(92, 70, 50,.08); border-radius: var(--r-m); padding: 13px 15px; margin-bottom: 11px; background: rgba(92, 70, 50,.02); }
.rec.full { border-color: rgba(154, 123, 51,.28); background: rgba(154, 123, 51,.05); }
.rec-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }
.rec-date { font-family: var(--font-ui); font-size: 13px; color: var(--xuan-dim); }
.rec-tone { margin-left: 8px; font-size: 11px; color: var(--jin); }
.rec-badge { font-size: 11px; color: var(--jin); font-family: var(--font-ui); }
.rec-names { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 11.5px; padding: 3px 9px; border-radius: 20px; background: rgba(92, 70, 50,.07); color: var(--xuan-dim); font-family: var(--font-ui); }
.tag.dim { color: var(--xuan-faint); }
.clear { margin-top: 12px; width: 100%; }
</style>
