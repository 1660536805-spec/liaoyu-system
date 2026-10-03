import { createApp, h } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/tokens.css'

import TrainView from './views/TrainView.vue'

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
  { path: '/:pathMatch(.*)*', component: Blank },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  if (to.path === '/train') return true
  backToShell()
  return false
})

createApp(App).use(router).mount('#app')
