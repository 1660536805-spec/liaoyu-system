<template>
  <!-- 音疗页 · 按图二（主壳 pgAudio）还原的 4-Tab 底部导航：
       首页 / 音疗 / 开始练(中间凸起圆钮) / 我的。仅音疗页生效，其余页面走 s4 原有 3-Tab。 -->
  <nav v-if="show && isSound" class="nav-ref">
    <button class="nitem" @click="go('/')"><span class="ico" v-html="ICON.home"></span>首页</button>
    <button class="nitem on" @click="go('/sound')"><span class="ico" v-html="ICON.music"></span>音疗</button>
    <button class="nitem" @click="go('/prepare')"><span class="big" v-html="ICON.yinyang"></span>开始练</button>
    <button class="nitem" @click="go('/me')"><span class="ico" v-html="ICON.user"></span>我的</button>
  </nav>

  <!-- 其余页面 · s4 既有 3-Tab 导航 -->
  <nav v-else-if="show" class="app-tab">
    <button
      v-for="t in tabs" :key="t.path"
      class="tab"
      :class="{ on: active === t.path }"
      @click="go(t.path)"
    >
      <span class="icon" v-html="t.icon"></span>
      <span class="label">{{ t.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()

const tabs = [
  {
    path: '/sound',
    label: '音疗',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18.5V6l10-2v12.5"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  },
  {
    path: '/',
    label: '开始练',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9" /><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
  },
  {
    path: '/me',
    label: '我的',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c1.2-3.2 3.7-4.8 6.5-4.8s5.3 1.6 6.5 4.8"/></svg>',
  },
]

// 图二 4-Tab 图标：逐字移植自主壳 app.js 的 ic()
const ICON = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v10h11V10"/></g></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></g></svg>',
  yinyang: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:27px;height:27px"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9 9 9 0 0 0 0-18z" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.4" fill="#F3E9D5" stroke="none"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.6 4.4-5.5 8-5.5s6.5 1.9 8 5.5"/></g></svg>',
}

// 哪些父路由高亮同一个 tab：开始练相关页面都高亮「开始练」
const active = computed(() => {
  const p = route.path
  if (p === '/' || p === '/prepare' || p.startsWith('/train') || p === '/summary') return '/'
  if (p.startsWith('/sound')) return '/sound'
  if (p.startsWith('/me')) return '/me'
  return '/'
})

// 只在需要底部 Tab 的页面显示（跟练页 /train 是沉浸式全屏，不能显示 Tab 挤压视频画面）
const show = computed(() => {
  const p = route.path
  if (p.startsWith('/train')) return false
  const noTab = ['/splash', '/welcome', '/onboarding', '/pose-lab']
  return !noTab.includes(p)
})

// 音疗页（含 /sound/library）：使用图二样式的 4-Tab 导航
const isSound = computed(() => route.path.startsWith('/sound'))

function go(path) {
  if (route.path === path) return
  router.push(path)
}
</script>

<style scoped>
.app-tab {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: var(--shell-w);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-around;
  min-height: var(--tab-h);
  padding-bottom: var(--safe-b);
  padding-left: var(--safe-l);
  padding-right: var(--safe-r);
  background: rgba(248, 245, 237, .96);
  border-top: 1px solid rgba(58, 51, 42, .1);
  box-shadow: 0 -2px 14px rgba(58, 51, 42, .08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--xuan-faint);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-height: var(--tab-h);
  padding: 4px 0;
  cursor: pointer;
  transition: .15s;
}
.tab .icon {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}
.tab .icon svg { width: 100%; height: 100%; }
.tab .label { font-size: 11px; font-family: var(--font-ui); }
.tab.on { color: var(--zhu); }
.tab.on .icon { filter: drop-shadow(0 0 6px var(--zhu-glow)); }

/* ---- 音疗页 4-Tab 导航（还原自图二 / 主壳 app.css 的 .nav，1rem=10px 折算为 px） ---- */
.nav-ref {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, 470px);
  z-index: 100;
  background: rgba(251, 243, 227, .96);
  border-top: 1px solid #E8DCC8;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding: 9px 10px calc(9px + var(--safe-b));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.nav-ref .nitem {
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3.5px;
  flex: 1;
  padding: 0;
  /* s4 全局给 button 设了 min-height:var(--tap)(44px)，会把自然高 39.5px 的
     「开始练」项顶高 4.5px；主壳无此约束，这里归零以对齐图二 */
  min-height: 0;
  color: #A08A70;
  font-size: 11.5px;
  letter-spacing: .06em;
  /* 与主壳 --sans 一致：sa4 默认继承 -apple-system 会使标签行盒高出 4px */
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}
.nav-ref .nitem.on { color: #6B4226; }
/* span 用 display:contents 展开，让 svg 直接成为 flex item（块化），
   与主壳「svg 为 .nitem 直接子元素」的结构一致，避免行高 strut 多出的 1px */
.nav-ref .nitem .ico { display: contents; }
.nav-ref .nitem .big {
  width: 46px;
  height: 46px;
  margin-top: -26px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #5A5148, #241C14 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #F3E9D5;
  box-shadow: 0 4px 10px rgba(40, 25, 10, .35), inset 0 1px 0 rgba(255, 255, 255, .25);
}
</style>
