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
  /* 【跟练页不做整体放大】上面两条 zoom 会把 100dvh 的盒子再放大 1.32/1.42 倍，
     于是整页比屏幕高出约 40%；而 body 是 overflow:hidden，多出来的部分既裁掉又滚不动
     ——底部「自由练习 / 教练指引 开·关 / 跳过本式」这排按钮在桌面端直接点不到。
     跟练页的排版本来就是按 100dvh 精算的（底边只剩 ~12px 余量），zoom:1 才是一屏正好。
     其余页面照旧保留桌面放大。 */
  zoom: 1;
}
</style>
