<template>
  <div class="app">
    <router-view />
    <AppTab />
  </div>
</template>

<script setup>
import AppTab from './components/AppTab.vue'
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
}
</style>
