import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/tokens.css'

import HomeView from './views/HomeView.vue'
import SoundView from './views/OrderView.vue'
import LibraryView from './views/ListenView.vue'
import TrainView from './views/TrainView.vue'
import RecordView from './views/RecordView.vue'
import GuideView from './views/GuideView.vue'
import ArcView from './views/ArcView.vue'
import WorkshopView from './views/WorkshopView.vue'
import SplashView from './views/SplashView.vue'
import WelcomeView from './views/WelcomeView.vue'
import OnboardingView from './views/OnboardingView.vue'
import OnboardingV2 from './views/OnboardingV2.vue'
import PrepareView from './views/PrepareView.vue'
import SummaryView from './views/SummaryView.vue'
import MeView from './views/MeView.vue'
import BodyDataView from './views/BodyDataView.vue'
import SettingsView from './views/SettingsView.vue'
import PoseLabView from './views/PoseLabView.vue'
import CultureLabView from './views/CultureLabView.vue'
import ProtShellView from './views/ProtShellView.vue'

// 用 hash 路由：现场用手机扫码/输地址打开时，任意子路由刷新都不会 404
// v2.3 流程：启动 → 欢迎（首次）→ 快速问卷 → 首页 → 准备页 → 跟练 → 总结
const routes = [
  { path: '/', component: HomeView },
  // 音疗页
  { path: '/sound', component: SoundView },
  { path: '/order', redirect: '/sound' },
  // 完整曲库
  { path: '/sound/library', component: LibraryView },
  { path: '/listen', redirect: '/sound/library' },
  // 跟练流程
  { path: '/prepare', component: PrepareView },
  { path: '/train', component: TrainView },
  { path: '/summary', component: SummaryView },
  // 我的
  { path: '/me', component: MeView },
  { path: '/me/body-data', component: BodyDataView },
  { path: '/me/settings', component: SettingsView },
  // 记录与要领
  { path: '/record', component: RecordView },
  { path: '/guide', component: GuideView },
  // 技术调试/体验入口（不放在主流程）
  { path: '/workshop', component: WorkshopView },
  { path: '/arc', component: ArcView },
  // 启动与首次流程
  { path: '/splash', component: SplashView },
  { path: '/welcome', component: WelcomeView },
  { path: '/onboarding', component: OnboardingView },
  // 七步问卷 · 宣纸插画卡形态（队友 A 套 IA 的 Vue 实现，业务规则与上面完全一致）。
  // 独立路径而非替换 /onboarding：两套并存方便对比，不影响既有流程与 8080 现有行为。
  { path: '/onboarding-v2', component: OnboardingV2 },
  // 骨架采集台：调参工具，刻意放在 hash 路由末尾且不进 AppTab。
  // 走 Vue 打包而非 public/ 裸 HTML —— 后者引 /node_modules/*.mjs，
  // vite build 后 dist 里没有 node_modules，部署出去必然 404。
  { path: '/pose-lab', component: PoseLabView },
  // 文化内核实验室：五音/子午流注/节气食养/体质功法/和香 → 处方 → 可插拔硬件总线
  { path: '/culture', component: CultureLabView },
  // 设计稿版：把最终版 UI 原型（/prot 下的原生状态机）装进 iframe，
  // 用同源桥把主工程的文化内核处方 / 姿态判定 / 打卡记录接进去，UI 一行不改。
  { path: '/prot', component: ProtShellView },
]

createApp(App)
  .use(createRouter({ history: createWebHashHistory(), routes }))
  .mount('#app')
