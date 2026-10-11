/**
 * 五禽戏「应用 10 式」全链运行时探针（纯观测，不改产品代码）
 *
 * 目的：验证「应用五禽戏 5 式 → 10 式」改造在**真实跟练页**上的表现：
 *   1) 逐式走完，记录每式的式名（应依次为 虎举/虎扑/鹿抵/鹿奔/熊运/熊晃/猿提/猿摘/鸟伸/鸟飞）；
 *   2) 每式记录教练小窗的形象：是「房间版小人 .cf svg」还是「疗养风 canvas」还是「缺动画 .ph.miss」，
 *      并读计算样式可见性（防 v-if+v-show 留下隐藏节点的假象）；
 *   3) 抓 console error / pageerror。
 * 双档对照（改前 /s4b = 旧 5 式构建；改后 /s4 = 新 10 式构建）。
 *
 * 用法：BASE_ROOT=http://127.0.0.1:5400 node scripts/probe-wq10.cjs
 * 产物：outputs/wq10-check/<tag>-summary.json
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const ROOT = process.env.BASE_ROOT || 'http://127.0.0.1:5400'
const OUT = path.join(__dirname, '..', 'outputs', 'wq10-check')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TARGETS = [
  { tag: 'after', base: `${ROOT}/s4` },   // 改后：10 式
  { tag: 'before', base: `${ROOT}/s4b` }, // 改前：5 式
]

fs.mkdirSync(OUT, { recursive: true })

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
    const cfSvg = q('.cf svg')
    const canvas = q('.cv-box canvas')
    return {
      idxText: q('.cur-idx')?.textContent?.trim() || null,
      curName: q('.cur-name')?.textContent?.trim() || null,
      cbName: q('.cb-name')?.textContent?.trim() || null,
      cap: q('.coach-cap')?.textContent?.trim() || null,
      strings: document.querySelectorAll('.strings .string').length,
      hasCfSvg: !!cfSvg, cfSvgVis: vis(cfSvg),
      hasCanvas: !!canvas, canvasVis: vis(canvas),
      hasMiss: !!q('.ph.miss'), missVis: vis(q('.ph.miss')),
      finished: !q('.coach-bar'),
      pathCount: cfSvg ? cfSvg.querySelectorAll('path').length : 0,
    }
  })
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

  const out = { root: ROOT, at: new Date().toISOString(), targets: {} }

  for (const { tag, base } of TARGETS) {
    const page = await ctx.newPage()
    const cerr = [], perr = []
    page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()) })
    page.on('pageerror', (e) => perr.push(String(e)))

    const rec = { base, steps: [] }
    try {
      await page.goto(`${base}/#/train?style=wuqinxi`, { waitUntil: 'domcontentloaded' })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.coach-bar', { timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(1500)

      // 逐式走完（最多 40 式，防死循环）
      for (let i = 0; i < 40; i++) {
        const f = await facts(page)
        if (f.finished) break
        const shot = path.join(OUT, `${tag}-step-${String(i + 1).padStart(2, '0')}.png`)
        await page.locator('.cv-box').first().screenshot({ path: shot, timeout: 5000 }).catch(() => {})
        rec.steps.push({
          n: i + 1,
          idxText: f.idxText, curName: f.curName, cbName: f.cbName,
          cfSvg: !!(f.cfSvgVis && f.cfSvgVis.visible), canvas: !!(f.canvasVis && f.canvasVis.visible),
          miss: !!(f.missVis && f.missVis.visible), paths: f.pathCount,
          shot: path.basename(shot),
          status: f.cfSvgVis && f.cfSvgVis.visible ? '房间版小人'
            : (f.canvasVis && f.canvasVis.visible) ? '疗养风canvas'
              : (f.missVis && f.missVis.visible) ? '缺动画占位' : '无形象',
        })
        const skip = page.locator('.cb-btn.skip')
        if (await skip.count() === 0) break
        await skip.first().click().catch(() => {})
        await page.waitForTimeout(1600)
      }
      // 走完后若还有 .cur-idx 收尾
      const fin = await facts(page)
      rec.finished = fin.finished
      rec.strings = fin.strings
      rec.totalSteps = rec.steps.length
      rec.names = rec.steps.map((s) => s.curName)
      rec.errors = { console: cerr.length, page: perr.length, consoleSample: cerr.slice(-3), pageSample: perr.slice(-3) }
    } catch (e) {
      rec.error = String(e)
      rec.errors = { console: cerr.length, page: perr.length }
    }
    out.targets[tag] = rec
    await page.close().catch(() => {})
  }

  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(out, null, 2))
  await browser.close()

  for (const tag of Object.keys(out.targets)) {
    const r = out.targets[tag]
    console.log(`\n=== ${tag} (${r.base}) ===`)
    console.log(`  式数=${r.totalSteps} 弦数=${r.strings} finished=${r.finished} consoleErr=${r.errors?.console} pageErr=${r.errors?.page}`)
    console.log(`  次序: ${(r.names || []).join('/')}`)
    if (r.steps) for (const s of r.steps) console.log(`   ${String(s.n).padStart(2)}. ${s.curName}  形象=${s.status}  paths=${s.paths}`)
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
