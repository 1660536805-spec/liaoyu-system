// 关键页面批量截图（v6 收尾验收用）
// 目的：把「水墨底图 + 浅色体系 + 圆形按钮呼吸动效 + 设置页」这几项
//      用真实浏览器渲染成图，人工过一眼，而不是只看断言。
//
// 用法：
//   node scripts/shot-pages.mjs
//   SHOT_PREFIX=v6 SHOT_FULL=1 node scripts/shot-pages.mjs
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const BASE = process.env.SHOT_BASE || 'http://localhost:8080'
const EXE = process.env.CHROME_EXE
  || 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const PREFIX = process.env.SHOT_PREFIX || 'v6'
const FULL = process.env.SHOT_FULL === '1'
const OUT = 'E:/Xian_Hacthon/_shots'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

const PAGES = [
  ['home', '/#/'],
  ['prepare', '/#/prepare'],
  ['sound', '/#/sound'],
  ['library', '/#/sound/library'],
  ['summary', '/#/summary'],
  ['me', '/#/me'],
  ['body', '/#/me/body-data'],
  ['settings', '/#/me/settings'],
  ['arc', '/#/arc'],
  ['workshop', '/#/workshop'],
  ['guide', '/#/guide'],
  ['record', '/#/record'],
  ['splash', '/#/splash'],
  ['welcome', '/#/welcome'],
  ['onboarding', '/#/onboarding'],
]

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()

for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  // 让水墨底图解码完、字体落位、呼吸动效跑起来再截
  await page.waitForTimeout(900)
  const file = `${OUT}/${PREFIX}_${name}.png`
  await page.screenshot({ path: file, fullPage: FULL })
  console.log('  ✓ ' + file)
}

await browser.close()
console.log(`\n共 ${PAGES.length} 张，prefix=${PREFIX}，fullPage=${FULL}`)
