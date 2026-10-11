/**
 * 教练小窗 · 循环连续性专项探针
 *
 * 目的：教练在「判定闸门」下是 keepLooping（u 到 1 就 %= 1 回卷）。
 *       回卷若姿态不连续，画面上会看到「突然跳一下」。
 * 做法：对某拳种第 1 式，固定间隔连拍 N 帧，跨过至少一个完整回卷，
 *       交给 Python 算「相邻帧差」；回卷处的帧差若与常态帧差同量级 → 无缝。
 *
 * 用法：node scripts/probe-coach-loop.cjs
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5197'
const OUT = path.join(__dirname, '..', 'outputs', 'coach-check')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TARGETS = [['taiji', 1], ['wuqinxi', 1]]
const N = 26
const GAP = 300   // ms → 总时长约 7.8s，覆盖 dur≈6s 的一个完整循环

fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, permissions: ['camera', 'microphone'] })
  const out = {}
  for (const [style] of TARGETS) {
    const page = await ctx.newPage()
    await page.goto(`${BASE}/#/train?style=${style}`, { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.coach-bar', { timeout: 20000 }).catch(() => {})
    await page.waitForSelector('.cv-box canvas', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(600)
    const files = []
    for (let i = 0; i < N; i++) {
      const p = path.join(OUT, `${style}-loop-${String(i).padStart(2, '0')}.png`)
      await page.locator('.cv-box').first().screenshot({ path: p, timeout: 5000 }).catch(() => {})
      files.push(path.basename(p))
      if (i < N - 1) await page.waitForTimeout(GAP)
    }
    out[style] = { frames: files, gapMs: GAP }
    await page.close()
  }
  fs.writeFileSync(path.join(OUT, 'loop.json'), JSON.stringify(out, null, 2))
  await browser.close()
  console.log('loop frames captured:', Object.keys(out).map((k) => `${k}:${out[k].frames.length}`).join(' '))
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
