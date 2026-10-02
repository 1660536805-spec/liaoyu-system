import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

const page = (t) => ({ template: `<div style="padding:24px">${t}</div>` })
const routes = [
  { path: '/', component: page('首页：定制版 / 通用版（待做）') },
  { path: '/custom', component: page('定制问卷（任务五，P1）') },
  { path: '/boards', component: page('选课（待做）') },
  { path: '/boards/:id', component: page('板块详情（待做）') },
  { path: '/train', component: page('跟练页（任务二）') },
  { path: '/record', component: page('打卡记录（任务二）') },
]
createApp(App).use(createRouter({ history: createWebHashHistory(), routes })).mount('#app')
