/**
 * 陪练教练 · 三拳种（八段锦 / 五禽戏 / 太极）小窗行为探针
 *
 * 目的：回答「教练能不能正常、完整地演示五禽戏与太极的动作」。
 * 做法（纯观测，不改产品代码）：
 *   对每个拳种进跟练页（?style=…），等教练条就绪后：
 *     1) 抓 DOM 事实：教练条在不在、形象是「房间版小人(.cf svg)」还是「疗养风 canvas」还是「缺动画占位(.ph.miss)」，
 *        以及各自的计算样式可见性（防止 v-if+v-show 留下隐藏节点的假象）。
 *     2) 播放证据：对 .cv-box 连拍 4 帧（间隔 800ms）→ 交给 Python 算逐像素差，判断「是否真在动」。
 *     3) 切换证据：连点「跳过本式」推进 2~3 式，每式留一张图 + 式名，判断「换式是否换动画」。
 *   产物：outputs/coach-check/<style>-*.png + summary.json
 *
 * 用法：node scripts/probe-coach-styles.cjs   （需先起 dev/preview 服务，BASE 环境变量可覆盖）
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5197'
const OUT = process.env.OUT_DIR
  ? path.resolve(process.env.OUT_DIR)
  : path.join(__dirname, '..', 'outputs', 'coach-check')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const STYLES = ['baduanjin', 'wuqinxi', 'taiji']
const SERIES = 4        // 播放证据：连拍帧数
const SERIES_GAP = 800  // ms

fs.mkdirSync(OUT, { recursive: true })

const visFn = null // 下面 facts() 里内联，不用字符串拼装（拼装易出语法错）

async function facts(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const vis = (el) => {
      if (!el) return null
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
      return {
        display: cs.display, visibility: cs.visibility, opacity: +cs.opacity,
        w: Math.round(r.width), h: Math.round(r.height),
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && r.width > 0 && r.height > 0,
      }
    }
    const cf = q('.cf')
    const cfSvg = q('.cf svg')
    const canvas = q('.cv-box canvas')
    const miss = q('.ph.miss')
    const ph = q('.ph:not(.miss)')
    return {
      coachBar: !!q('.coach-bar'),
      cbName: q('.cb-name')?.textContent?.trim() || null,
      cbChip: q('.cb-chip')?.textContent?.trim() || null,
      cap: q('.coach-cap')?.textContent?.trim() || null,
      hasCoachFigureRoot: !!cf, coachFigureRootVis: vis(cf),
      hasCfSvg: !!cfSvg, cfSvgVis: vis(cfSvg),
      hasCanvas: !!canvas, canvasVis: vis(canvas),
      hasMiss: !!miss, missVis: vis(miss),
      hasLoadingPh: !!ph, loadingPhVis: vis(ph),
      missNote: q('.ph.miss .ph-note')?.textContent?.trim() || null,
      cvBox: vis(q('.cv-box')),
      svgPathCount: cfSvg ? cfSvg.querySelectorAll('path').length : 0,
      canvasPx: canvas ? (canvas.width + 'x' + canvas.height) : null,
    }
  })
}

async function waitReady(page, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const f = await facts(page)
    if (f.coachBar && f.cap && f.cap !== '准备中…') return f
    await page.waitForTimeout(250)
  }
  return await facts(page)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    permissions: ['camera', 'microphone'],
  })

  const summary = { base: BASE, at: new Date().toISOString(), styles: {}, errors: {} }

  for (const style of STYLES) {
    // 每个拳种独立 page：只改 hash 的 goto 不会重载组件，会把上一拳种的 stepIdx/finished 串过来
    const page = await ctx.newPage()
    const consoleErrors = []
    const pageErrors = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    const rec = { style, seriesShots: [], switchShots: [] }
    try {
      await page.goto(`${BASE}/#/train?style=${style}`, { waitUntil: 'domcontentloaded' })
      await page.reload({ waitUntil: 'domcontentloaded' })   // 保证全新挂载
      await page.waitForSelector('.coach-bar', { timeout: 20000 }).catch(() => {})
      rec.facts = await waitReady(page, 15000)

      // 播放证据：连拍
      for (let k = 0; k < SERIES; k++) {
        const p = path.join(OUT, `${style}-play-${k}.png`)
        await page.locator('.cv-box').first().screenshot({ path: p, timeout: 5000 }).catch(() => {})
        rec.seriesShots.push(path.basename(p))
        if (k < SERIES - 1) await page.waitForTimeout(SERIES_GAP)
      }
      await page.screenshot({ path: path.join(OUT, `${style}-page.png`) }).catch(() => {})

      // 切换证据：跳过本式推进
      for (let m = 0; m < 3; m++) {
        const skipBtn = page.locator('.cb-btn.skip')
        if (await skipBtn.count() === 0) break
        await skipBtn.first().click().catch(() => {})
        await page.waitForTimeout(1400)
        const f = await facts(page)
        if (!f.coachBar) { rec.switchShots.push({ file: null, name: f.cbName, note: 'finished(教练条消失)' }); break }
        const p = path.join(OUT, `${style}-switch-${m}.png`)
        await page.locator('.cv-box').first().screenshot({ path: p, timeout: 5000 }).catch(() => {})
        rec.switchShots.push({ file: path.basename(p), name: f.cbName, hasCfSvg: f.hasCfSvg, hasCanvas: f.hasCanvas, hasMiss: f.hasMiss })
      }

      rec.rc = {
        consoleErrors: consoleErrors.length, pageErrors: pageErrors.length,
        consoleErrSample: consoleErrors.slice(-3), pageErrSample: pageErrors.slice(-3),
      }
    } catch (e) {
      rec.error = String(e)
      rec.rc = { consoleErrors: consoleErrors.length, pageErrors: pageErrors.length, consoleErrSample: consoleErrors.slice(-3), pageErrSample: pageErrors.slice(-3) }
    }
    summary.styles[style] = rec
    await page.close().catch(() => {})
  }

  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  await browser.close()
  console.log(JSON.stringify(summary, null, 2))
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
