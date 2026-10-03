import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const browser = await chromium.launch({
  executablePath: 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  proxy: { server: process.env.HTTP_PROXY || 'http://127.0.0.1:7890', bypass: 'localhost,127.0.0.1' },
  headless: true,
})

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const base = 'http://127.0.0.1:5173/#'

const shots = [
  { name: 'sound', url: `${base}/sound` },
  { name: 'home', url: base },
  { name: 'welcome', url: `${base}/welcome` },
  { name: 'me', url: `${base}/me` },
  { name: 'train', url: `${base}/train?stage=line` },
]

for (const s of shots) {
  await page.goto(s.url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `E:/Xian_Hacthon/_shots_new/${s.name}-v2.png` })
  console.log('shot', s.name)
}

// 模拟桌面宽屏（你的电脑屏幕打开时的视觉效果）
const desktopPage = await ctx.newPage()
await desktopPage.setViewportSize({ width: 1200, height: 900 })
await desktopPage.goto(`${base}/train?stage=line`, { waitUntil: 'networkidle' })
await desktopPage.waitForTimeout(800)
await desktopPage.screenshot({ path: `E:/Xian_Hacthon/_shots_new/train-desktop-v2.png` })
console.log('shot train-desktop')

await browser.close()
