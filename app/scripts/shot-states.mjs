// 总结页「七弦回响」在有命中时的样子（done=8 全亮）
// 单独一个脚本：默认 shot-pages 走的是空态，看不到柱子的高低差与朱砂色
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const BASE = process.env.SHOT_BASE || 'http://localhost:8080'
const EXE = process.env.CHROME_EXE
  || 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const PREFIX = process.env.SHOT_PREFIX || 'v8'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

const CASES = [
  ['summary_full', '/#/summary?done=8&total=8&tone=gong&minutes=12'],
  ['summary_half', '/#/summary?done=4&total=8&tone=jue&minutes=6'],
  ['me_filled', '/#/me'],
]

const browser = await chromium.launch({
  executablePath: EXE, headless: true, proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

// 先造两条打卡（含今天与昨天），让「我的」页有真实数据可显示
await page.goto(BASE + '/#/me', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  const d = new Date()
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const y = new Date(d); y.setDate(y.getDate() - 1)
  localStorage.setItem('xianyang.records.v1', JSON.stringify([
    { ts: d.getTime(), day: iso(d), date: '10-03 09:10', doneCount: 8, complete: true, moves: [0,1,2,3,4,5,6,7], names: [], tone: 'gong', minutes: 12 },
    { ts: y.getTime(), day: iso(y), date: '10-02 08:40', doneCount: 8, complete: true, moves: [0,1,2,3,4,5,6,7], names: [], tone: 'shang', minutes: 11 },
  ]))
  localStorage.setItem('xianyang.bodyData', JSON.stringify({ height: 175, weight: 70, age: 24, injuries: ['颈肩'], goal: '舒缓肩颈', diet: '无特殊', wantRecipe: true }))
})

for (const [name, path] of CASES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const file = `E:/Xian_Hacthon/_shots/${PREFIX}_${name}.png`
  await page.screenshot({ path: file })
  console.log('  ✓ ' + file)
}

await browser.close()
