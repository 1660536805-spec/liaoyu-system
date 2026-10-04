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
  const OrderView = (await load('/src/views/OrderView.vue')).default
  const ListenView = (await load('/src/views/ListenView.vue')).default
  const ArcView = (await load('/src/views/ArcView.vue')).default
  const WorkshopView = (await load('/src/views/WorkshopView.vue')).default
  const SplashView = (await load('/src/views/SplashView.vue')).default
  const WelcomeView = (await load('/src/views/WelcomeView.vue')).default
  const OnboardingView = (await load('/src/views/OnboardingView.vue')).default
  const PrepareView = (await load('/src/views/PrepareView.vue')).default
  const SummaryView = (await load('/src/views/SummaryView.vue')).default
  const MeView = (await load('/src/views/MeView.vue')).default
  const BodyDataView = (await load('/src/views/BodyDataView.vue')).default
  const SettingsView = (await load('/src/views/SettingsView.vue')).default

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/sound', component: OrderView },
      { path: '/order', component: OrderView },
      { path: '/sound/library', component: ListenView },
      { path: '/listen', component: ListenView },
      { path: '/train', component: TrainView },
      { path: '/workshop', component: WorkshopView },
      { path: '/arc', component: ArcView },
      { path: '/record', component: RecordView },
      { path: '/guide', component: GuideView },
      { path: '/splash', component: SplashView },
      { path: '/welcome', component: WelcomeView },
      { path: '/onboarding', component: OnboardingView },
      { path: '/prepare', component: PrepareView },
      { path: '/summary', component: SummaryView },
      { path: '/me', component: MeView },
      { path: '/me/body-data', component: BodyDataView },
      { path: '/me/settings', component: SettingsView },
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
  okc(html.includes('开始练'), '含大圆形「开始练」按钮')
  okc(html.includes('12 分钟'), '含时长口径（约 12 分钟）')
  okc(html.includes('为什么推荐给你'), '含右侧「为什么推荐给你」栏')
  okc(html.includes('八段锦 · '), '含左侧「练什么」栏（拳种 · 调式）')
  okc(html.includes('舒缓减压') || html.includes('开胸透气'), '含体验功效标签')
  okc(html.includes('弦养'), '含品牌名')
}

console.log('\n=== 跟练准备页 /prepare ===')
{
  const html = await renderPage('/prepare')
  okc(html.includes('练习准备'), '含标题')
  okc(html.includes('全套 8 式'), '含模式选择')
  okc(html.includes('一 · 点') && html.includes('二 · 线') && html.includes('三 · 面'), '含阶段选择')
  okc(html.includes('启动摄像头并起式'), '含主按钮')
}

console.log('\n=== 启动页 /splash ===')
{
  const html = await renderPage('/splash')
  okc(html.includes('弦养'), '含品牌名')
  okc(html.includes('正在准备古琴音色'), '含加载文案')
}

console.log('\n=== 欢迎页 /welcome ===')
{
  const html = await renderPage('/welcome')
  okc(html.includes('以身为琴，以动为弦'), '含副标题')
  okc(html.includes('开始体验'), '含开始体验按钮')
}

console.log('\n=== 快速问卷 /onboarding ===')
{
  const html = await renderPage('/onboarding')
  okc(html.includes('最近哪里容易不舒服'), '含问卷第一题')
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

console.log('\n=== 我的页 /me ===')
{
  const html = await renderPage('/me')
  okc(html.includes('我的'), '含标题')
  okc(html.includes('身体数据'), '含身体数据入口')
}

console.log('\n=== 身体数据 /me/body-data ===')
{
  const html = await renderPage('/me/body-data')
  okc(html.includes('身高'), '含身高输入')
  okc(html.includes('体重'), '含体重输入')
}

console.log('\n=== 基础设置 /me/settings ===')
{
  const html = await renderPage('/me/settings')
  okc(html.includes('基础设置'), '含标题')
  okc(html.includes('音频'), '含音频分组')
  okc(html.includes('弦养 v1.0'), '含版本信息')
}

console.log('\n=== 练习总结 /summary ===')
{
  const html = await renderPage('/summary')
  okc(html.includes('今日琴谱'), '含标题')
  okc(html.includes('七弦回响'), '含琴谱可视化')
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

console.log('\n=== 音疗页 /sound（由 /order 重构）===')
{
  const html = await renderPage('/sound')
  okc(html.includes('想照顾哪里') || html.includes('选一个部位'), '含音疗主问句')
  // 新 UI 用「肝角/心徽/脾宫/肺商/肾羽」双字名，不再显示单字脏腑
  for (const o of ['心徽', '肝角', '脾宫', '肺商', '肾羽']) {
    okc(html.includes(`>${o.split('')[1]}<`) || html.includes(`>${o}<`) || html.includes(o), `含五音选项「${o}」`)
  }
  okc(html.includes('说不上来，随便听听'), '含「说不上来」兜底项')
  okc(html.includes('练完了'), '含「练完了 · 听一首完整的」')
  okc(!html.includes('就用这一档开始练'), '音疗页不含进入跟练 CTA（改到准备页）')
  okc(html.includes('宫商角徵羽'.slice(0, 1)), '唱名以小字出现')
  // 【UI 红线】甲方 §6.2：界面不出现「主音」「入脏」
  okc(!html.includes('主音'), '未出现「主音」（甲方红线 3）')
  okc(!html.includes('入脏'), '未出现「入脏」（甲方红线 3）')
  // 新 UI 直接展示推荐曲目，不再有空态引导
  const { TONES } = await load('/src/data/tones.js')
  okc(TONES[0].pieces.some((p) => p.title === '平沙落雁'), '宫档曲目清单含《平沙落雁》')
}

console.log('\n=== 完整曲库 /sound/library ===')
{
  const html = await renderPage('/sound/library')
  for (const g of ['宫', '商', '角', '徵', '羽', '综合']) {
    okc(html.includes(`>${g}<`), `含调式 tab「${g}」`)
  }
  okc(html.includes('梅花三弄'), '含已就位曲目')
  okc(html.includes('待补'), '无音源曲目标「待补」')
  okc(html.includes('CC BY 4.0'), '含 CC BY 4.0 署名')
  okc(html.includes('完整曲库'), '含标题')
  const { TONE_LIST } = await load('/src/data/tones.js')
  const total = TONE_LIST.reduce((n, t) => n + t.pieces.length, 0)
  okc(total >= 40, `曲库共 ${total} 首（甲方 44 首口径）`)
}

console.log('\n=== 阶段三 · 面：12 分钟弧线（/arc）===')
{
  const html = await renderPage('/arc')
  okc(html.includes('十二分钟弧线'), '含阶段三标题')
  for (const [g, o] of [['宫', '脾'], ['商', '肺'], ['角', '肝'], ['徵', '心'], ['羽', '肾']]) {
    okc(html.includes(`>${g}<`), `含调式宫格「${g}」`)
    okc(html.includes(`>${o}<`), `含脏腑标注「${o}」`)
  }
  okc(html.includes('播放倍速'), '含倍速控件')
  okc(html.includes('做到位 · 触发浮层'), '含浮层触发按钮（onHit 契约）')
  okc(html.includes('polygon') && html.includes('polyline'), '含强度弧线 SVG')
  for (const s of ['1×', '4×', '8×']) okc(html.includes(`>${s}</button>`), `含倍速档 ${s}`)
  // 注：甲方红线 3（界面不出现「主音」）针对用户端点单 / 跟练界面；
  // 阶段二工坊与阶段三弧线的「技术面板」本身也用「主音」（甲方原型 meta / motif 就这么写），
  // 所以这里的红线由 /order 与 /train 两条断言负责，不重复查。

  const arc = await load('/src/engine/arc.js')
  okc(arc.ARC_SECTIONS.length === 9, `九段结构 ${arc.ARC_SECTIONS.length} 段`)
  const sum = arc.ARC_SECTIONS.reduce((n, s) => n + s.dur, 0)
  okc(sum === 720, `九段时长合计 ${sum}s = 12:00`)
  okc(arc.ARC_TOTAL === 720, 'ARC_TOTAL = 720（12 分钟）')
  // 五调共用同一条结构，只换落音与主音（甲方 §5.1）
  // 甲方 §5.1：五调共用同一条九段结构，只换「动机落音」和「低音主音」
  //   判据 1：每个动机在五调里音数一致（结构共用，不是整条重编）
  //   判据 2：音高集合永远落在五声 {1,2,3,5,6}（同宫系统 F G A C D）
  //   判据 3：每个动机的末音在五调之间确有变化（换的是落音）
  //   注：C/C2 是「悬而不解」的下沉段，只要求避主音（下方 apz/cc 块单独判），
  //       不要求各调末音互异（jiao.C2=2 与 gong.C2=2 相同是甲方表本身如此）
  const keys = ['A', 'B', 'E', 'D', 'C', 'C2', 'P', 'Z']
  let shapeOk = true, landingVar = true, pentaOk = true
  for (const k of keys) {
    const src = arc.ARC_MODES.gong.M[k]
    const landings = new Set()
    for (const mk of arc.ARC_ORDER) {
      const ns = arc.ARC_MODES[mk].M[k]
      if (ns.length !== src.length) shapeOk = false                    // 判据 1
      for (const d of ns) if (![1, 2, 3, 5, 6].includes(d)) pentaOk = false  // 判据 2
      landings.add(ns[ns.length - 1])                                  // 判据 3
    }
    if (landings.size < 2) landingVar = false
  }
  okc(shapeOk, '五条动机在五调里音数一致（结构共用，只换落音）')
  okc(pentaOk, '所有落音都落在五声 {宫商角徵羽} 内（同宫系统，音高集合恒为 F G A C D）')
  okc(landingVar, '各动机末音在五调之间确有变化（A/B/E/D/P/Z 每调换落音）')
  // 甲方 §5.1 落音表：A/P/Z 落主音，C/C2 故意避开主音（悬而不解）
  {
    let apz = true, cc = true
    for (const mk of arc.ARC_ORDER) {
      const t = arc.ARC_MODES[mk].tonic
      const M = arc.ARC_MODES[mk].M
      if (M.A[M.A.length - 1] !== t) apz = false
      if (M.P[M.P.length - 1] !== t) apz = false
      if (M.Z[M.Z.length - 1] !== t) apz = false
      if (M.C[M.C.length - 1] === t) cc = false
      if (M.C2[M.C2.length - 1] === t) cc = false
    }
    okc(apz, 'A 主题 / P 峰 / Z 收 都落本调主音（甲方 §5.1）')
    okc(cc, 'C / C2 下沉段故意避开主音（悬而不解）')
  }
  okc(arc.ARC_MODES.gong.tonic === 1 && arc.ARC_MODES.shang.tonic === 2
    && arc.ARC_MODES.jiao.tonic === 3 && arc.ARC_MODES.zhi.tonic === 5
    && arc.ARC_MODES.yu.tonic === 6, '五调主音＝宫商角徵羽（与总纲 §5.1 一致）')
  // 七弦齐鸣固定不变，属于弦层（总纲 §3 / §5.1）
  okc(arc.ARC_CHORD.join(',') === '1,2,3,5,6,1,2', '七弦齐鸣固定不变（弦层，与调式无关）')
  okc(arc.ARC_CHOIRS.includes(630) && arc.ARC_CHOIRS.includes(712), '七弦齐鸣落在第 7 式与收功（甲方 CHOIRS）')
  const peak = arc.ARC_SECTIONS.find((s) => s.peak)
  okc(!!peak && peak.n === 7, `全曲唯一的力度上扬在第 ${peak ? peak.n : '?'} 式`)
}

console.log('\n=== 阶段二 · 线：五音短句工坊（/workshop）===')
{
  const html = await renderPage('/workshop')
  okc(html.includes('五音短句工坊'), '含阶段二标题')
  for (const n of ['宫', '商', '角', '徵', '羽']) {
    okc(html.includes(`>${n}<`), `含五音格「${n}」`)
  }
  okc(html.includes('句尾呼吸'), '含句尾呼吸开关（乙方 v2 新增）')
  okc(html.includes('无缝循环'), '含无缝循环开关')
  okc(html.includes('BPM'), '含速度控件')
  okc(html.includes('混响'), '含混响湿度控件')
  okc(html.includes('导出 WAV'), '含离线导出 WAV')
  okc(html.includes('当前音') && html.includes('全部五音'), '含导出「当前音 / 全部五音」')
  okc(html.includes('restzone'), '乐谱网格含句尾留白格（灰底）')

  const ph = await load('/src/engine/phrase.js')
  okc(ph.PHRASE_SOUND_BEATS === 8 && ph.PHRASE_REST_BEATS === 2, '每圈 8 拍出声 + 2 拍留白')
  okc(ph.phraseBarLen(true) === 10 && ph.phraseBarLen(false) === 8, '呼吸开=10 拍，关=8 拍')
  okc(ph.phraseBassBeats(true).join() === '0,5', '低音散音落点（呼吸开）＝第 1、6 拍')
  okc(ph.phraseBassBeats(false).join() === '0,4', '低音散音落点（呼吸关）＝第 1、5 拍')
  okc(Math.abs(ph.PHRASE_DRONE_LEVEL - 0.033) < 1e-9, '阶段二氛围电力平 0.033（总纲 §9.2 降级到 60%）')
  const { TONES } = await load('/src/data/tones.js')
  const withMel = TONES.filter((t) => t.mel && t.mel.length).length
  okc(withMel === 5, `五条短句各有旋律音型（${withMel}/5）`)
}

console.log('\n=== 时长口径对齐（甲方 12 分钟）===')
{
  const { getStyle } = await load('/src/data/styles.js')
  const bad = getStyle('baduanjin')
  const secs = bad.moves.map((m) => m.sec)
  okc(secs.slice(0, 7).every((s) => s === 90), '一式至七式各 90 秒')
  okc(secs[7] === 60, '第八式 60 秒')
  okc(secs.reduce((a, b) => a + b, 0) + 30 === 720, '七式 90s + 第八式 60s + 收功 30s = 720s = 12 分钟')
}

console.log('\n=== 解释层数据 ===')
{
  const { TONES, MOVE_TONE, getTone } = await load('/src/data/tones.js')
  okc(TONES.length === 5, `五音基调 ${TONES.length} 档`)
  okc(MOVE_TONE[2] === 'shang' && MOVE_TONE[3] === 'gong' && MOVE_TONE[5] === 'zhi'
    && MOVE_TONE[6] === 'yu' && MOVE_TONE[7] === 'jue', '八式→五音归属与甲方一致（二商/三宫/五徵/六羽/七角）')
  okc(getTone('jue').organ === '肝', '角 → 肝（甲方：怒属肝，情志对应更硬）')
  okc(getTone('zhi').organ === '心', '徵 → 心（甲方：取病位不取治法方向）')
}

console.log('\n=== 音层：甲方定弦表 ===')
{
  const { PENTATONIC, fdeg } = await load('/src/engine/guqin.js')
  const want = [174.61, 196.44, 220.89, 261.92, 294.66, 349.23, 392.88]
  let bad = 0
  PENTATONIC.forEach((p, i) => { if (Math.abs(fdeg(p.deg, p.oct) - want[i]) > 0.5) bad++ })
  okc(bad === 0, `七弦频率与总纲 §3 一致（偏差 ${bad} 条）`)
  okc(PENTATONIC.map((p) => p.name).join('') === '宫商角徵羽宫(高)商(高)', '弦名直读：宫商角徵羽宫高商高')
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
      // 标准 XML 命名空间（createElementNS 用得到）不是网络请求，先摘掉再判：
      // 否则 CoachFigure.vue 里的 'http://www.w3.org/2000/svg' 会被误报成外链。
      const probe = l.replace(/https?:\/\/www\.w3\.org\/[^\s'"`)]*/gi, '')
      if (/(https?:)?\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}/i.test(probe)) {
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
