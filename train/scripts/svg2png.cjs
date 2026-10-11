/**
 * SVG → PNG 小工具（用本机 Chrome 渲染，保真、无外部依赖）
 * 用法：node train/scripts/svg2png.cjs <in.svg> <out.png> [scale]
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

;(async () => {
  const [inp, outp, scaleArg] = process.argv.slice(2)
  if (!inp || !outp) { console.error('用法: node svg2png.cjs <in.svg> <out.png> [scale]'); process.exit(2) }
  const scale = Number(scaleArg) || 2
  const svg = fs.readFileSync(inp, 'utf8')
  const m = svg.match(/width="(\d+)"\s+height="(\d+)"/)
  if (!m) { console.error('SVG 根元素缺少 width/height'); process.exit(2) }
  const w = +m[1], h = +m[2]

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale })
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: outp, clip: { x: 0, y: 0, width: w, height: h } })
  await browser.close()
  console.log(`已写出 ${path.relative(process.cwd(), outp)}（${w * scale}×${h * scale}）`)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
