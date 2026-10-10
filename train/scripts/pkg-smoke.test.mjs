// 最终版交付包 · 真浏览器冒烟验证
// 作用：确认打包内容在真浏览器里能跑（不是只过 SSR）；PAGES 与 main.js 路由表一致
// 用法：SHOT_BASE=http://127.0.0.1:5180 node scripts/pkg-smoke.test.mjs（默认 5180）
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:5180'
const EXE = 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const OUT = 'E:/Xian_Hacthon/_shots_pkg'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

// [名称, hash, 最小节点数]  —— 引导页本来就只有标题+文案，阈值单独放宽
const PAGES = [
  ['home', '#/', 20],
  ['sound', '#/sound', 20],
  ['library', '#/sound/library', 20],
  ['workshop', '#/workshop', 20],
  ['arc', '#/arc', 20],
  ['culture', '#/culture', 20],
  ['me', '#/me', 20],
  ['record', '#/record', 5],
  ['body-data', '#/me/body-data', 5],
  ['settings', '#/me/settings', 20],
  ['guide', '#/guide', 20],
  ['onboarding-v2', '#/onboarding-v2', 20],
  ['onboarding', '#/onboarding', 10],
  ['welcome', '#/welcome', 5],
  ['splash', '#/splash', 5],
  ['prepare', '#/prepare', 20],
  ['train', '#/train', 20],
  ['summary', '#/summary', 20],
  ['pose-lab', '#/pose-lab', 20],
  ['prot', '#/prot', 20],
]

const fail = []
const must = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail.push(m) }

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message || e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('requestfailed', (r) => {
  const u = r.url()
  if (u.startsWith('http://127.0.0.1')) errors.push('404/fail: ' + u)
})

for (const [name, hash, min] of PAGES) {
  await page.goto(BASE + '/' + hash, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1100)
  const info = await page.evaluate(() => ({
    text: (document.querySelector('#app')?.innerText || '').trim().length,
    nodes: document.querySelectorAll('#app *').length,
    bg: getComputedStyle(document.body).backgroundColor,
  }))
  must(info.nodes >= min, `${name.padEnd(12)} 节点 ${String(info.nodes).padStart(4)}(≥${min}) / 文本 ${String(info.text).padStart(4)} 字 / 底 ${info.bg}`)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

console.log('\n--- 运行时报错（headless 环境噪声已放行）---')
const noise = /MediaPipe|wasm|AbortError|NotAllowedError|Permission|NotFoundError|GL_INVALID|WebGL|onnx|Permissions|getUserMedia|Device|Track/i
const real = errors.filter((e) => !noise.test(e))
for (const e of [...new Set(errors)].slice(0, 12)) console.log('   ·', e.slice(0, 160))
must(real.length === 0, `非噪声报错 ${real.length} 条`)

await browser.close()
console.log(fail.length ? `\n✗ 失败 ${fail.length} 项` : '\n✓ 全部通过')
process.exit(fail.length ? 1 : 0)
