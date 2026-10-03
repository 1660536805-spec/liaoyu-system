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
            <span v-if="toneOfMove(i + 1)" class="item-tone">
              {{ toneOfMove(i + 1).name }}调 · {{ toneOfMove(i + 1).organ }}
            </span>
            <span v-else class="item-tone dim">骨架式 · 无专属音</span>
          </div>
          <div class="item-cue">{{ m.cue }}</div>
          <div class="item-tip">{{ m.tip }}</div>
        </div>
      </div>
    </div>

    <!-- 素材署名：CC BY 4.0 要求可触达处保留署名。
         刻意不写 <a href>：D5 断网验收要求零外链，此处只留文字署名即可满足。 -->
    <div class="body credits">
      古琴音色素材：RafaelCaro · 许可 CC BY 4.0（署名即可商用，详见素材包内 README）
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getStyle, resolveStyle } from '../data/styles'
import { getRecords } from '../stores/records'
import { MOVE_TONE, getTone } from '../data/tones'

// 解释层：这一式归属哪个五音（只用于文案，不参与播放——弦层仍按一至七弦序号走）
const toneOfMove = (n) => (MOVE_TONE[n] ? getTone(MOVE_TONE[n]) : null)

// 最近一次完成过的式
const route = useRoute()
const style = computed(() => getStyle(resolveStyle(route.query.style)) || getStyle('baduanjin'))
const moves = computed(() => style.value.moves)
const done = computed(() => new Set(getRecords()[0]?.moves ?? []))
</script>

<style scoped>
/* 小按钮在手机上要够点：min-height 36px（比 44 略小但仍远好过 26px） */
.sm { padding: 8px 14px; font-size: 13px; min-height: 40px; }
/* 底部留出 Tab + 安全区，否则最后一条被压住点不到 */
.list { padding: 16px 16px var(--body-pad-b); }
.item { display: flex; gap: 13px; padding: 14px 0; border-bottom: 1px solid rgba(92, 70, 50,.06); }
.credits { padding: 18px 16px 26px; font-size: 11.5px; color: rgba(92, 70, 50,.34); }
.item-idx { flex: 0 0 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(92, 70, 50,.2); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); }
.item.done .item-idx { background: var(--zhu); border-color: var(--zhu); color: #fff; }
.item-main { flex: 1; }
.item-name { font-size: 16.5px; letter-spacing: 1.5px; display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
.item-string { font-size: 10.5px; color: var(--jin); font-family: var(--font-ui); letter-spacing: 0; }
.item-tone { font-size: 10.5px; color: var(--xuan-faint); font-family: var(--font-ui); letter-spacing: 0; }
.item-tone.dim { color: rgba(92, 70, 50,.22); }
.item-cue { font-size: 12.5px; color: var(--xuan-dim); margin-top: 6px; line-height: 1.8; font-family: var(--font-ui); }
.item-tip { font-size: 12px; color: var(--xuan-faint); margin-top: 4px; line-height: 1.7; font-family: var(--font-ui); }
</style>
