// 页面渲染自测：真跑 setup + renderToString，断言关键 DOM 是否存在
// 目的：证明「页面能渲染出内容」，而不是「文件能被 curl 到」
// 运行：node scripts/render.test.mjs
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createRouter, createMemoryHistory } from 'vue-router'
import { fileURLToPath } from 'node:url'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const vite = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
const load = (p) => vite.ssrLoadModule(p)

async function renderPage(path) {
  const HomeView = (await load('/src/views/HomeView.vue')).default
  const TrainView = (await load('/src/views/TrainView.vue')).default
  const RecordView = (await load('/src/views/RecordView.vue')).default
  const GuideView = (await load('/src/views/GuideView.vue')).default

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/train', component: TrainView },
      { path: '/record', component: RecordView },
      { path: '/guide', component: GuideView },
    ],
  })
  router.push(path)
  await router.isReady()
  const app = createSSRApp({ template: '<router-view />' })
  app.use(router)
  // 浏览器 API 垫片：SSR 环境没有 window/localStorage/navigator
  // Node 22 的 globalThis.navigator 是只读 getter，必须用 defineProperty 覆写
  if (typeof globalThis.window === 'undefined') globalThis.window = {}
  if (typeof globalThis.localStorage === 'undefined') {
    const mem = {}
    globalThis.localStorage = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v) },
      removeItem: (k) => { delete mem[k] },
    }
  }
  if (!globalThis.navigator?.mediaDevices) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...(globalThis.navigator || {}), mediaDevices: { getUserMedia: async () => { throw new Error('SSR: no camera') } } },
      configurable: true, writable: true,
    })
  }
  return renderToString(app)
}

console.log('\n=== 首页 / ===')
{
  const html = await renderPage('/')
  okc(html.includes('开始练'), '含大按钮「开始练」')
  okc(html.includes('八式') || html.includes('4 分钟'), '含时长说明')
  okc(html.includes('弦养'), '含品牌名')
  okc(!html.includes('还没'), '空态文案正确（无记录时）')
  okc(html.includes('打卡记录'), '含打卡记录入口')
}

console.log('\n=== 跟练页 /train ===')
{
  const html = await renderPage('/train')
  okc(html.includes('双手托天理三焦'), '含第 1 式名称')
  okc(html.includes('做到位即响'), '含「做到位即响」文案（无倒计时，文档 2.4 要求）')
  okc(html.includes('跳过本式') || html.includes('点一下也算响'), '含三级兜底按钮（跳过/点按也算响）')
  okc(html.includes('正在加载本地模型'), '含加载态（模型离线加载）')
  okc(html.includes('自由练习'), '含自由练习模式切换')
  // 七个弦位
  const bars = (html.match(/class="bar"/g) || []).length
  okc(bars === 7, `七弦弦位渲染 ${bars} 个（期望 7）`)
}

console.log('\n=== 记录页 /record ===')
{
  const html = await renderPage('/record')
  okc(html.includes('打卡记录'), '含标题')
  okc(html.includes('还没有练习记录'), '含空态引导')
}

console.log('\n=== 要领页 /guide ===')
{
  const html = await renderPage('/guide')
  const names = ['双手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
    '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消']
  const miss = names.filter((n) => !html.includes(n))
  okc(miss.length === 0, `8 式全在（缺 ${miss.length} 个）`)
  okc(html.includes('七弦齐鸣'), '含第 8 式「七弦齐鸣」标注')
  okc(html.includes('号弦'), '含 1-7 号弦映射标注')
}

console.log('\n=== 内容合规 D9：无禁词 ===')
{
  const moves = (await load('/src/data/moves.json')).default
  const ban = ['治疗', '祛湿', '根治', '调理好', '疗效', '治愈', '药', '疗效', '排毒', '减肥']
  const all = JSON.stringify(moves)
  const hit = ban.filter((w) => all.includes(w))
  okc(hit.length === 0, `8 式文案无禁词${hit.length ? '（命中：' + hit.join(',') + '）' : ''}`)
  okc(moves.length === 8, `8 式齐全（${moves.length}）`)
  const map = moves.map((m) => m.stringIndex)
  okc(moves[7].chord === true && moves[7].stringIndex === 0, '第 8 式 = 七弦齐鸣（stringIndex=0 + chord）')
  okc([1, 2, 3, 4, 5, 6, 7].every((n) => map.includes(n)), '1-7 号弦一一对应到 7 式')
}

console.log('\n=== 判定器接线正确性 ===')
{
  const { MoveJudge, NAMES } = await load('/src/engine/judge.js')
  okc(typeof MoveJudge === 'function', 'MoveJudge 可用')
  okc(NAMES.length === 8, 'NAMES 8 项')
  const j = new MoveJudge({ order: 0 })
  okc(j.order === 0, '顺序模式可指定当前式')
  const jf = new MoveJudge({ order: null })
  okc(jf.order === null, '自由模式 order=null')
}

await vite.close()
console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
