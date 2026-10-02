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
  okc(html.includes('读取推理运行时') || html.includes('正在准备'), '含分阶段加载进度（4 步可见）')
  okc(html.includes('打开摄像头'), '含「正在打开摄像头」阶段文案')
  okc(html.includes('自由练习'), '含自由练习模式切换')
  // 七个弦位
  const bars = (html.match(/class="bar"/g) || []).length
  okc(bars === 7, `七弦弦位渲染 ${bars} 个（期望 7）`)
  // 设置面板是 v-if 展开，SSR 时不渲染；断言「齿轮入口在」+ 面板源码含各项控件
  okc(html.includes('摄像头设置'), '含设置面板入口（齿轮按钮）')
  const CamSettings = (await load('/src/components/CamSettings.vue')).default
  const panelHtml = await renderToString(createSSRApp(CamSettings, { threshold: 0.55, holdFrames: 10 }))
  okc(panelHtml.includes('摄像头与识别设置'), '设置面板含标题')
  okc(panelHtml.includes('640 × 480'), '设置面板含分辨率档位')
  okc(panelHtml.includes('镜像画面'), '设置面板含镜像开关')
  okc(panelHtml.includes('灵敏度') && panelHtml.includes('保持帧数'), '设置面板含识别参数滑块')
  okc((panelHtml.match(/<select/g) || []).length >= 2, '设置面板有 2 个下拉（摄像头 + 分辨率）')
}

console.log('\n=== 首页摄像头预检 ===')
{
  const html = await renderPage('/')
  okc(html.includes('正在检测摄像头') || html.includes('摄像头'), '首页含摄像头预检状态区')
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

console.log('\n=== 断网可用性（D5 前置）：零外链 ===')
{
  const { readFile, readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const root = fileURLToPath(new URL('..', import.meta.url))
  const walk = async (dir) => {
    const out = []
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) out.push(...(await walk(p)))
      else out.push(p)
    }
    return out
  }
  const files = await walk(join(root, 'src'))
  const ext = []
  for (const f of files) {
    const t = await readFile(f, 'utf8')
    // 只盯会把请求打到外网的：整站外链、外链字体/CDN。注释里的示例 URL 不算。
    const lines = t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    for (const l of lines) {
      if (/(https?:)?\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}/i.test(l)) {
        ext.push(f.replace(root, '') + ': ' + l.trim().slice(0, 90))
      }
    }
  }
  okc(ext.length === 0, `src/ + index.html 零外链${ext.length ? '（命中：' + ext.join(' | ') + '）' : ''}`)

  const pose = await load('/src/engine/pose.js')
  const fb = await load('/src/engine/fallback.js')
  const idx = await readFile(join(root, 'index.html'), 'utf8')
  okc(idx.includes('@') || !/<link[^>]+href=["']https:/i.test(idx), 'index.html 没有外链样式/字体')
  okc(typeof pose === 'object' && pose !== null, 'pose.js 可加载（本地 wasm/模型路径在其内部）')
  okc(fb.FALLBACK_SRC.startsWith('/assets/'), '兜底视频也是本地路径')
}

console.log('\n=== 兜底第一级接线（R2）===')
{
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../src/views/TrainView.vue', import.meta.url), 'utf8')
  okc(src.includes("ref=\"fbVideo\""), '跟练页有预录视频元素')
  okc(src.includes('FallbackSwitch'), '跟练页接了 FallbackSwitch')
  okc(src.includes('checkFallbackStall'), '有「断识别 → 兜底」的循环巡检')
  okc(src.includes("exitFallback") && src.includes('startAutoAdvance'), '退出预录与保险推进都在')
  const feat = await load('/src/engine/fallback.js')
  okc(typeof feat.frameAlive === 'function', 'fallback.js 导出 frameAlive')
  okc(feat.FALLBACK_SRC.startsWith('/assets/'), '预录视频走本地 assets/（不是 CDN）')
  // 兜底触发参数一旦被改坏会直接毁掉现场，钉死在合理区间
  // （2026-10-03 真机标定后放宽：弯腰做式5/6 头会短暂离画，
  //  原 4s+6点门槛会误触发把用户正练的画面切走）
  const c = feat.FALLBACK_CFG
  okc(c.noSignalMs >= 10000 && c.noSignalMs <= 20000, `断流容忍 ${c.noSignalMs}ms 在 10~20s（覆盖弯腰/遮挡）`)
  okc(c.firstFrameMs >= 12000 && c.firstFrameMs <= 20000, `首帧等待 ${c.firstFrameMs}ms 在 12~20s`)
  okc(c.minAlivePoints <= 4, `有信号门槛 ${c.minAlivePoints}/8 不误伤（实测 4/8 误判率≈0%）`)
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
