import { createApp, h } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/tokens.css'

import TrainView from './views/TrainView.vue'

// ───────────────────────────────────────────────────────────────────────────
// 【本次新增 · 纯追加】三个「手敲地址才进得来」的预览页（不放进任何导航/按钮）：
//   /culture        文化内核实验室（五音 / 子午流注 / 节气食养 / 体质功法 / 和香
//                   + 可插拔硬件总线 PlugBus）
//   /prot           设计稿 × 真引擎融合壳（iframe 装最终版设计稿，用 __XY 同源桥接真数据）
//   /onboarding-v2  七步问卷「宣纸插画卡」形态（与旧问卷并存，不改旧问卷）
//
// 下面这份白名单原先是「只有 /train」，现在只多了上面三条。
// 其余一切路径的规则完全不变：仍一律整页跳回主壳。
// ───────────────────────────────────────────────────────────────────────────
const CultureLabView = () => import('./views/CultureLabView.vue')
const ProtShellView = () => import('./views/ProtShellView.vue')
const OnboardingV2 = () => import('./views/OnboardingV2.vue')

const KEEP_IN_APP = new Set(['/train', '/culture', '/prot', '/onboarding-v2'])

// 只有显式带 ?ia=art 才为真。不带时，下面的守卫一切照旧。
function wantsArtIA() {
  try {
    return new URL(window.location.href).searchParams.get('ia') === 'art'
  } catch {
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 本应用（s4）只对外保留「跟练识别页 /train」这一个页面。
// 其余所有路径 —— 根路径 / 、首页 /sound 、我的 /me 、准备页 /prepare 、
// 旧链接、深链、笔误路径 —— 一律回到主壳（dist/app.js 那套 9 页设计稿页面）。
//
// 为什么用 location.replace 而不是 router 跳转：
//   hash 路由下 router.push('/') 会被解析成 /s4/#/（自身），造成死循环；
//   两个不同的前端之间必须整页跳转。
//
// 为什么用全局 beforeEach 而不是路由级 beforeEnter：
//   无 component 的「纯守卫」路由在 vue-router 4 里不会参与匹配，
//   实测 beforeEnter 根本不触发（根路径直接渲染空白 + 底部 Tab）。
//   全局守卫对「未匹配任何路由」的情况同样生效，最稳。
// ───────────────────────────────────────────────────────────────────────────
const BACK_TO_SHELL = '/?screen=home'
function backToShell() {
  if (typeof window !== 'undefined') window.location.replace(BACK_TO_SHELL)
}

// 非 /train 路径的占位组件：什么都不渲染，因为马上就会整页跳走。
// 用 render 而不是 template —— 生产构建是 runtime-only，没有模板编译器。
const Blank = { name: 'Blank', render: () => h('div') }

const routes = [
  { path: '/train', component: TrainView },
  { path: '/culture', component: CultureLabView },
  { path: '/prot', component: ProtShellView },
  { path: '/onboarding-v2', component: OnboardingV2 },
  { path: '/:pathMatch(.*)*', component: Blank },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  if (KEEP_IN_APP.has(to.path)) return true
  // 仅在「显式带 ?ia=art」时放行根路径，交给 App.vue 落到 /onboarding-v2。
  // 不带该参数时根路径照旧整页跳回主壳，与改造前完全一致。
  if (to.path === '/' && wantsArtIA()) return true
  backToShell()
  return false
})

createApp(App).use(router).mount('#app')
