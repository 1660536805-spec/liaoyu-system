/* 桌面档分辨率矩阵：一次跑完所有「宽度 × 屏」的
 *   ① 横向溢出  ② 是否两列合成  ③ 侧栏是否在场/高亮对不对  ④ 控制台报错
 * 用法：node outputs/pm-review/probe-desktop-matrix.cjs [宽,宽,...]
 *   PM_ENGINE=chromium(默认，走本机 Chrome) | webkit | firefox
 *     后两者用 playwright 自带二进制（需先 npx playwright@1.56.0 install webkit firefox）
 */
const pw = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const ENGINE = process.env.PM_ENGINE || 'chromium'
if (!pw[ENGINE]) { console.error('不支持的引擎：' + ENGINE); process.exit(2) }

const WIDTHS = (process.argv[2] ? process.argv[2].split(',') : ['960', '1024', '1280', '1440', '1920']).map(Number)
const HEIGHTS = { 960: 720, 1024: 768, 1280: 800, 1366: 768, 1440: 900, 1536: 864, 1920: 1080 }
const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body', 'inquiry']
const WANT_NAV = {
  loading: null, question: null, audio: 'nav-audio', home: 'nav-home',
  intro: 'nav-intro', practice: 'nav-intro', done: 'nav-intro',
  profile: 'nav-profile', body: 'nav-profile', inquiry: 'nav-inquiry',
}

;(async () => {
  /* 两个环境坑，都不是产品问题，但会让跨引擎结果全红：
     ① 本机全局设了 HTTP_PROXY/HTTPS_PROXY（沙箱出口代理）。Chromium 内建 bypass localhost，
        Gecko 不会 ⇒ Firefox 会把 127.0.0.1:5400 的请求发进代理，且用绝对形式 URI
        （GET http://127.0.0.1:5400/?screen=home），本地预览服务的路径解析当场失效、回 404。
        对策：给浏览器进程剥掉代理变量，并让 Firefox 走直连。
     ② Firefox 在受限沙箱里内容进程沙箱起不来（日志 "sandbox initialization failed:
        Operation not permitted"），表现为 launch 成功但 newPage() 永久挂起 ⇒ 降沙箱级别。 */
  const NO_PROXY_ENV = { ...process.env }
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete NO_PROXY_ENV[k]
  NO_PROXY_ENV.NO_PROXY = 'localhost,127.0.0.1,::1'
  NO_PROXY_ENV.no_proxy = 'localhost,127.0.0.1,::1'

  const FF_PREFS = {
    'security.sandbox.content.level': 0,
    'security.sandbox.gpu.level': 0,
    'browser.tabs.remote.autostart': false,
    'browser.tabs.remote.autostart.2': false,
    'dom.ipc.processCount': 1,
    'fission.autostart': false,
    /* 直连，别走环境代理 */
    'network.proxy.type': 0,
    'network.proxy.no_proxies_on': 'localhost, 127.0.0.1, ::1',
  }
  const opts = ENGINE === 'chromium'
    ? { executablePath: CHROME, env: NO_PROXY_ENV }
    : ENGINE === 'firefox'
      ? { firefoxUserPrefs: FF_PREFS, env: { ...NO_PROXY_ENV, MOZ_DISABLE_CONTENT_SANDBOX: '1', MOZ_DISABLE_GPU_SANDBOX: '1' } }
      : { env: NO_PROXY_ENV }
  const browser = await pw[ENGINE].launch(opts)
  console.log(`# 引擎 ${ENGINE} ${browser.version ? '· ' + browser.version() : ''}`)
  let bad = 0
  for (const W of WIDTHS) {
    const H = HEIGHTS[W] || 900
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
    console.log(`\n=== ${W}x${H} ===`)
    for (const s of SCREENS) {
      await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
      await page.waitForTimeout(s === 'loading' ? 900 : 380)
      const m = await page.evaluate(() => {
        const de = document.documentElement
        const main = document.querySelector('#app main') || document.querySelector('main')
        const side = document.querySelector('.dt-side')
        const cols = main ? main.querySelectorAll(':scope > .dt-col').length : 0
        const onBtn = side ? side.querySelector('.dt-nav button.on') : null
        let widest = null
        if (de.scrollWidth - de.clientWidth > 1) {
          document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 && r.height === 0) return
            if (r.right - de.clientWidth > 1) {
              const c = typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''
              widest = el.tagName.toLowerCase() + c + ' 越界 ' + Math.round(r.right - de.clientWidth) + 'px'
            }
          })
        }
        return {
          ov: de.scrollWidth - de.clientWidth,
          cols,
          side: !!side,
          sideVisible: side ? getComputedStyle(side).display !== 'none' : false,
          on: onBtn ? onBtn.getAttribute('data-a') : null,
          navShown: (() => { const n = document.querySelector('.nav'); return n ? getComputedStyle(n).display !== 'none' : false })(),
          widest,
        }
      })
      const wantOn = WANT_NAV[s]
      const needSideVisible = s !== 'loading'
      const ok =
        m.ov === 0 &&
        (needSideVisible ? m.side && m.sideVisible && !m.navShown : !m.sideVisible) &&
        m.on === wantOn
      if (!ok) bad++
      console.log(
        `  ${ok ? '✓' : '✗'} ${s.padEnd(9)} 溢出 ${String(m.ov).padStart(3)}  列 ${m.cols}  ` +
        `侧栏 ${m.side ? (m.sideVisible ? '在场' : '隐藏') : '未注入'}  底部导航 ${m.navShown ? '仍显示!' : '已隐藏'}  ` +
        `高亮 ${m.on || '—'}${wantOn ? '（应 ' + wantOn + '）' : ''}` +
        (m.widest ? `  ⚠ ${m.widest}` : '')
      )
    }
    console.log('  console-errors: ' + (errs.length ? errs.join(' | ') : 'none'))
    if (errs.length) bad++
    await page.close()
  }
  await browser.close()
  console.log(`\n${bad === 0 ? '✅ 全部分辨率 × 全部屏通过' : '❌ 有 ' + bad + ' 项不通过'}`)
  process.exit(bad ? 1 : 0)
})()
