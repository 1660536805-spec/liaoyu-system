/**
 * 教练小窗 · 逐式走查探针（接入前后的对照器）
 *
 * 对每个拳种：进跟练页 → 反复点「跳过本式」把能走的式都走一遍，每步抓：
 *   · 进度 / 式名 / 教练文案 / 闸门档位
 *   · 形象事实：房间版小人(.cf svg) / 疗养风 canvas / 缺动画占位(.ph.miss) —— 都用**计算样式+盒子**判定
 *     （`v-if`+`v-show` 会在 state='missing' 时留下隐藏 SVG，只看 `!!el` 会误判为「有小人在动」）
 *   · 小人的**实际绘制**：`.cf svg` 里有多少条带 `d` 的 path、两条手臂 path 的 d 指纹
 *   · console / page 错误
 * 产物：OUT_DIR/<style>-step-<i>.png + walk.json
 *
 * 用法：BASE=http://127.0.0.1:5400/s4 OUT_DIR=outputs/xxx node outputs/kit-wire/probe-coach-walk.cjs
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5400/s4'
const OUT = path.resolve(process.env.OUT_DIR || path.join(__dirname, 'shots'))
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const STYLES = (process.env.STYLES || 'baduanjin,wuqinxi,taiji').split(',')
const MAX_STEPS = +(process.env.MAX_STEPS || 30)
const SETTLE = +(process.env.SETTLE || 1600)

fs.mkdirSync(OUT, { recursive: true })

async function facts(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const box = (el) => {
      if (!el) return null
      const cs = getComputedStyle(el), r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), display: cs.display, vis: cs.visibility,
               op: +cs.opacity,
               visible: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && r.width > 0 && r.height > 0 }
    }
    const cf = q('.cf'), svg = q('.cf svg'), cv = q('.cv-box canvas'), miss = q('.ph.miss')
    const paths = svg ? [...svg.querySelectorAll('path')] : []
    const drawn = paths.filter((p) => (p.getAttribute('d') || '').length > 4)
    const armL = svg && svg.querySelector('[data-p="armL"] path'), armR = svg && svg.querySelector('[data-p="armR"] path')
    const bar = q('.coach-bar')
    return {
      coachBar: !!bar,
      gate: bar ? (bar.className.match(/gate-(\w+)/) || [])[1] || null : null,
      phase: bar ? (bar.className.match(/cp-(\w+)/) || [])[1] || null : null,
      prog: q('.prog')?.textContent?.trim() || null,
      name: q('.cb-name')?.textContent?.trim() || null,
      chip: q('.cb-chip')?.textContent?.trim() || null,
      cap: q('.coach-cap')?.textContent?.trim() || null,
      cfBox: box(cf), svgBox: box(svg), canvasBox: box(cv), missBox: box(miss),
      pathN: paths.length, drawnN: drawn.length,
      armLn: armL ? (armL.getAttribute('d') || '').length : 0,
      armLd: armL ? (armL.getAttribute('d') || '').slice(0, 40) : null,
      armRd: armR ? (armR.getAttribute('d') || '').slice(0, 40) : null,
      missNote: q('.ph.miss .ph-note')?.textContent?.trim() || null,
    }
  })
}

/** 「形象类型」判定：三者互斥，且要求**真的可见** */
function figureKind(f) {
  if (f.svgBox && f.svgBox.visible && f.drawnN > 10) return 'room-figure'
  if (f.missBox && f.missBox.visible) return 'placeholder'
  if (f.canvasBox && f.canvasBox.visible) return 'canvas'
  return 'none'
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
           '--autoplay-policy=no-user-gesture-required'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 }, deviceScaleFactor: 2,
    permissions: ['camera', 'microphone'],
  })
  const out = { base: BASE, at: new Date().toISOString(), styles: {} }

  for (const style of STYLES) {
    const page = await ctx.newPage()
    const cErr = [], pErr = []
    page.on('console', (m) => { if (m.type() === 'error') cErr.push(m.text().slice(0, 300)) })
    page.on('pageerror', (e) => pErr.push(String(e).slice(0, 300)))
    const rec = { steps: [], kinds: {}, errors: {} }
    try {
      await page.goto(`${BASE}/#/train?style=${style}`, { waitUntil: 'domcontentloaded' })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.coach-bar', { timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(1200)

      for (let i = 0; i < MAX_STEPS; i++) {
        const f = await facts(page)
        const kind = figureKind(f)
        rec.steps.push({
          i, kind, prog: f.prog, name: f.name, chip: f.chip, cap: f.cap, gate: f.gate, phase: f.phase,
          drawnN: f.drawnN, pathN: f.pathN, armLn: f.armLn, armLd: f.armLd, armRd: f.armRd,
          svgBox: f.svgBox, canvasBox: f.canvasBox, missBox: f.missBox, missNote: f.missNote,
        })
        rec.kinds[kind] = (rec.kinds[kind] || 0) + 1
        await page.locator('.cv-box').first().screenshot({
          path: path.join(OUT, `${style}-step-${String(i).padStart(2, '0')}-${kind}.png`), timeout: 5000,
        }).catch(() => {})

        const skip = page.locator('.cb-btn.skip')
        if (!f.coachBar || await skip.count() === 0) break
        const before = f.name
        await skip.first().click().catch(() => {})
        await page.waitForTimeout(SETTLE)
        const g = await facts(page)
        if (!g.coachBar) { rec.endReason = `点跳过（${before}）后教练条消失`; break }
        if (g.name === before) { rec.endReason = `点跳过（${before}）后式名未变 → 无法继续推进`; break }
      }
      if (!rec.endReason) rec.endReason = `走满 ${MAX_STEPS} 步`
    } catch (e) { rec.error = String(e) }
    rec.errors = { console: cErr.length, page: pErr.length, consoleSample: cErr.slice(-4), pageSample: pErr.slice(-4) }
    out.styles[style] = rec
    await page.close().catch(() => {})
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify(out, null, 2))

  // —— 摘要 ——
  for (const [style, rec] of Object.entries(out.styles)) {
    console.log(`\n[${style}]  ${rec.endReason || rec.error || ''}   console/page 错误 ${rec.errors.console}/${rec.errors.page}`)
    console.log(`   形象分布：${JSON.stringify(rec.kinds)}`)
    rec.steps.forEach((s) => console.log(
      `   ${String(s.i).padStart(2)}. ${(s.name || '-').padEnd(18)} ${s.kind.padEnd(12)} drawn=${String(s.drawnN).padStart(2)} cap=${s.cap} prog=${s.prog} gate=${s.gate}`))
    if (rec.errors.consoleSample.length) rec.errors.consoleSample.forEach((e) => console.log('   ⚠ console: ' + e))
    if (rec.errors.pageSample.length) rec.errors.pageSample.forEach((e) => console.log('   ⚠ page: ' + e))
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
