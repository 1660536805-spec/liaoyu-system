import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/tokens.css'
import './styles/legacy-ui.css'

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
import PrepareView from './views/PrepareView.vue'
import SummaryView from './views/SummaryView.vue'
import MeView from './views/MeView.vue'
import BodyDataView from './views/BodyDataView.vue'
import SettingsView from './views/SettingsView.vue'
import PoseLabView from './views/PoseLabView.vue'
import LegacySplashView from './views/LegacySplashView.vue'
import LegacyQuestionsView from './views/LegacyQuestionsView.vue'
import LegacyHomeView from './views/LegacyHomeView.vue'
import LegacySoundView from './views/LegacySoundView.vue'
import LegacyIntroView from './views/LegacyIntroView.vue'
import LegacyFinishView from './views/LegacyFinishView.vue'
import LegacyProfileView from './views/LegacyProfileView.vue'
import LegacyBodyView from './views/LegacyBodyView.vue'

// 用 hash 路由：现场用手机扫码/输地址打开时，任意子路由刷新都不会 404
// v2.3 流程：启动 → 欢迎（首次）→ 快速问卷 → 首页 → 准备页 → 跟练 → 总结
const routes = [
  { path: '/', component: LegacyHomeView },
  { path: '/questions', component: LegacyQuestionsView },
  { path: '/intro', component: LegacyIntroView },
  { path: '/finish', component: LegacyFinishView },
  // 音疗页
  { path: '/sound', component: LegacySoundView },
  { path: '/order', redirect: '/sound' },
  // 完整曲库
  { path: '/sound/library', component: LibraryView },
  { path: '/listen', redirect: '/sound/library' },
  // 跟练流程
  { path: '/prepare', component: PrepareView },
  { path: '/train', component: TrainView },
  { path: '/summary', component: SummaryView },
  // 我的
  { path: '/me', component: LegacyProfileView },
  { path: '/me/body-data', component: LegacyBodyView },
  { path: '/me/settings', component: SettingsView },
  // 记录与要领
  { path: '/record', component: RecordView },
  { path: '/guide', component: GuideView },
  // 技术调试/体验入口（不放在主流程）
  { path: '/workshop', component: WorkshopView },
  { path: '/arc', component: ArcView },
  // 启动与首次流程
  { path: '/splash', component: LegacySplashView },
  { path: '/onboarding', component: LegacyQuestionsView },
  { path: '/welcome', component: WelcomeView },
  { path: '/onboarding', component: OnboardingView },
  // 骨架采集台：调参工具，刻意放在 hash 路由末尾且不进 AppTab。
  // 走 Vue 打包而非 public/ 裸 HTML —— 后者引 /node_modules/*.mjs，
  // vite build 后 dist 里没有 node_modules，部署出去必然 404。
  { path: '/pose-lab', component: PoseLabView },
]

createApp(App)
  .use(createRouter({ history: createWebHashHistory(), routes }))
  .mount('#app')
