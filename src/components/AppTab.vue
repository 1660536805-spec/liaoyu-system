<template>
  <nav class="app-tab" v-if="show">
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
  // 引导类页面要沉浸式全屏，不给底部 Tab 占位。
  // /onboarding-v2 是七步问卷的插画卡形态，与 /onboarding 一样全屏。
  const noTab = ['/splash', '/welcome', '/onboarding', '/onboarding-v2', '/pose-lab']
  return !noTab.includes(p)
})

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
  background: rgba(251, 243, 227, .96);
  border-top: 1px solid rgba(92, 70, 50, .1);
  box-shadow: 0 -2px 14px rgba(92, 70, 50, .08);
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
</style>
