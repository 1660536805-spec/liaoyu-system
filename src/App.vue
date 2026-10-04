<template>
  <div class="app">
    <router-view />
    <AppTab />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppTab from './components/AppTab.vue'

const route = useRoute()
const router = useRouter()

/**
 * 双入口分流（2026-10-04）
 *
 * 默认行为**完全不变**：不带 `?ia=art` 参数时，一切走原有流程，本文件等于空操作。
 * 带 `?ia=art` 且本机没走过问卷时，落到宣纸插画卡版七步问答（#/onboarding-v2）。
 *
 * 为什么用 URL 参数而不是换端口/换构建：这样同一份产物能同时提供两套 IA，
 * 对比时不用起两个服务，也不会让 8080 的既有行为被污染。
 */
onMounted(() => {
  let flag = ''
  try { flag = new URLSearchParams(window.location.search).get('ia') || '' } catch {}
  if (flag !== 'art') return
  // 已经标记完成过（或老用户已有偏好）就不再打扰，直接放行进首页
  let done = ''
  try { done = localStorage.getItem('xianyang.onboardDone') || '' } catch {}
  if (done) return
  if (route.path === '/' || route.path === '/welcome' || route.path === '/splash') {
    router.replace('/onboarding-v2')
  }
})
</script>

<style>
/* 根容器
   【为什么不用 100vh】移动端浏览器的 vh 是「地址栏完全收起时」的高度。
   地址栏展开（或 iOS 底部工具条弹出）时 window.innerHeight 变小而 vh 不变，
   页面底部就被推到屏幕外，表现为「滑不到底 / 底部按钮点不到」。
   dvh 跟真实可视区同步；不支持 dvh 的旧浏览器回退到 vh。
   注意：先写不支持的、再写支持的，让支持的覆盖掉。 */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  /* 桌面端限宽居中（--shell-w 在 tokens.css 里按断点给值） */
  width: 100%;
  max-width: var(--shell-w);
  margin: 0 auto;
  position: relative;
  transition: max-width .2s ease;
}
/* 宽屏桌面大屏：整体视觉等比放大 32%~42%，让界面真正放大，远距离跟练与大屏看清所有字 */
@media (min-width: 900px) {
  .app {
    zoom: 1.32;
  }
}
@media (min-width: 1400px) {
  .app {
    zoom: 1.42;
  }
}
/* 跟练页全屏展开：释放 100% 宽度，让动作取景画面显著放大，充满整个屏幕 */
.app:has(.train) {
  max-width: 100% !important;
  width: 100% !important;
}
</style>
