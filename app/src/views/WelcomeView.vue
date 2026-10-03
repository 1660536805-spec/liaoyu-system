<template>
  <div class="wrap welcome">
    <div class="brand-block">
      <div class="brand">弦养</div>
      <div class="tag">让传统之美，滋养当下的你</div>
    </div>

    <div class="selling-cards">
      <div class="sell-card">
        <div class="sell-icon">☯</div>
        <div class="sell-title">动静相生</div>
        <div class="sell-desc">动作与古琴音律相合</div>
      </div>
      <div class="sell-card">
        <div class="sell-icon">🎵</div>
        <div class="sell-title">古琴相和</div>
        <div class="sell-desc">以身为琴，以动为弦</div>
      </div>
      <div class="sell-card">
        <div class="sell-icon"></div>
        <div class="sell-title">养身养心</div>
        <div class="sell-desc">舒展身体，安定心神</div>
      </div>
    </div>

    <div class="custom-tip">
      <span class="tip-icon">💡</span>
      <span>在「我的」页面补充身体数据，解锁定制推荐</span>
    </div>

    <div class="actions">
      <button class="btn primary start" @click="start">开始体验</button>
      <button class="btn ghost skip" @click="skip">跳过</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function start() { localStorage.setItem('xianyang.visited', '1'); router.push('/') }
function skip() { localStorage.setItem('xianyang.visited', '1'); router.push('/') }
</script>

<style scoped>
.welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; padding: 40px 28px 80px; }
.brand-block { text-align: center; margin-bottom: 32px; }
.brand { font-size: 64px; letter-spacing: 18px; text-indent: 18px; color: var(--xuan); margin-bottom: 10px; }
.tag { font-size: 14px; color: var(--xuan-dim); font-family: var(--font-ui); letter-spacing: 2px; }

.selling-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; margin-bottom: 32px; }
.sell-card {
  border-radius: 16px; background: var(--bg-card); border: 1px solid var(--border);
  padding: 16px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.sell-icon { font-size: 28px; }
.sell-title { font-size: 14px; font-weight: 600; color: var(--xuan); }
.sell-desc { font-size: 11px; color: var(--xuan-faint); }

.custom-tip {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 12px;
  background: rgba(255,253,246,.7); border: 1px solid rgba(58,51,42,.08);
  font-size: 12px; color: var(--xuan-dim); margin-bottom: 32px; width: 100%;
}
.tip-icon { font-size: 16px; }

.actions { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 12px; }
.start { width: 100%; padding: 14px; border-radius: 999px; background: var(--zhu); color: #fff; font-size: 16px; }
.skip { width: 100%; padding: 12px; border-radius: 999px; background: transparent; color: var(--xuan-dim); font-size: 14px; }
</style>
