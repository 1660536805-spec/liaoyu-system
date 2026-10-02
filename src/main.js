import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/tokens.css'

import HomeView from './views/HomeView.vue'
import TrainView from './views/TrainView.vue'
import RecordView from './views/RecordView.vue'
import GuideView from './views/GuideView.vue'

// 用 hash 路由：现场用手机扫码/输地址打开时，任意子路由刷新都不会 404
const routes = [
  { path: '/', component: HomeView },
  { path: '/train', component: TrainView },
  { path: '/record', component: RecordView },
  { path: '/guide', component: GuideView },
]

createApp(App)
  .use(createRouter({ history: createWebHashHistory(), routes }))
  .mount('#app')
