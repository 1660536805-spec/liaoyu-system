/**
 * 用「假摄像头」渲染 s4 真实识别跟练页，检查它是否已符合最终版视觉。
 * 用法：NODE_PATH=<ws>/node_modules node shot-train-cam.cjs <baseUrl>
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = (process.argv[2] || 'http://127.0.0.1:5320').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out', 'current')
const URL = BASE + '/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong'

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const ctx = await browser.newContext({
    viewport: { width: 470, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['camera'],
    // 用一张静态图当作摄像头画面，便于观察叠加层
    recordVideo: undefined,
  })
  const p = await ctx.newPage()
  const logs = []
  p.on('console', (m) => logs.push(m.type() + ': ' + m.text().slice(0, 140)))
  p.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  // 等模型/引擎初始化 + 首帧
  await p.waitForTimeout(12000)

  const state = await p.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, ' ').trim()
    const v = document.querySelector('video')
    return {
      head: t.slice(0, 260),
      hasVideo: !!v,
      videoReady: v ? v.readyState : null,
      videoSize: v ? [v.videoWidth, v.videoHeight] : null,
      bg: getComputedStyle(document.body).backgroundColor,
      themeColor: (document.querySelector('meta[name="theme-color"]') || {}).content,
      canvasCount: document.querySelectorAll('canvas').length,
    }
  })
  await p.screenshot({ path: path.join(OUT, 's4-train-fakecam.png') })
  fs.writeFileSync(path.join(OUT, 's4-train-fakecam.json'), JSON.stringify({ state, logs: logs.slice(0, 25) }, null, 2))
  console.log(JSON.stringify({ state, logs: logs.slice(0, 25) }, null, 2))
  await browser.close()
})()
