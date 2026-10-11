/**
 * 跟练页 HUD 逐拳种运行时探针（纯观测，不改产品代码）
 *
 * 目的：验证「TrainView 三处硬编码八段锦文案 → 随拳种/当前式动态」这次改造：
 *   ① 语音气泡 .hud-bubble  → 应显示当前式的 tip（各拳种第一式各不同）
 *   ② 动作要点面板 .sp-body  → 应显示当前式的 tip + cue 两条
 *   ③ 完成页 .done-sub       → 应随拳种显示 式数·弦数（八式·七弦 / 十式·五弦 / 廿四式·七弦）
 * 另：轻量检查 /s4/#/prot（ProtShellView 兜底引用改 base-aware 后不报错）。
 *
 * 用法：BASE_ROOT=http://127.0.0.1:5400 node scripts/probe-hud-by-style.cjs
 * 产物：outputs/hud-check/by-style.json + <style>-tips.png + <style>-done.png
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const ROOT = process.env.BASE_ROOT || 'http://127.0.0.1:5400'
const OUT = path.join(__dirname, '..', 'outputs', 'hud-check')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// 各拳种第一式的 tip（来自 styles.js / moves.json）
const EXPECT = {
  baduanjin: { tip: '双臂上举，舒展肩背。久坐之后，让身体从下往上松一遍。', done: '八式俱毕 · 七弦和鸣' },
  wuqinxi: { tip: '两手十指撑开成虎爪、再握拳，沿体前中线上提，开筋展肩。', done: '十式俱毕 · 五弦和鸣' },
  taiji: { tip: '两脚开立与肩同宽，两臂自然下垂，浑身松沉。', done: '廿四式俱毕 · 七弦和鸣' },
}
const STYLES = ['baduanjin', 'wuqinxi', 'taiji']

fs.mkdirSync(OUT, { recursive: true })

const readBubble = (page) => page.evaluate(() => {
  const b = document.querySelector('.hud-bubble')
  if (!b) return null
  const spans = [...b.querySelectorAll('span')].map((s) => s.textContent.trim()).filter(Boolean)
  return spans.length ? spans[spans.length - 1] : null
})

const readTips = (page) => page.evaluate(() => {
  const body = document.querySelector('.side-panel-drawer .sp-body')
  if (!body) return null
  return [...body.querySelectorAll('p')].map((p) => p.textContent.trim())
})

const readDone = (page) => page.evaluate(() => document.querySelector('.done-sub')?.textContent?.trim() || null)

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 }, deviceScaleFactor: 2,
    permissions: ['camera', 'microphone'],
  })

  const out = { root: ROOT, at: new Date().toISOString(), styles: {} }

  for (const style of STYLES) {
    const page = await ctx.newPage()
    const cerr = [], perr = []
    page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()) })
    page.on('pageerror', (e) => perr.push(String(e)))
    const rec = { style, exp: EXPECT[style], pass: {} }
    try {
      await page.goto(`${ROOT}/s4/#/train?style=${style}`, { waitUntil: 'domcontentloaded' })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.hud-bubble', { timeout: 25000 }).catch(() => {})
      await page.waitForTimeout(1500)

      // ① 气泡
      rec.bubble = await readBubble(page)
      rec.pass.bubble = rec.bubble === rec.exp.tip

      // ② 动作要点面板
      await page.locator('.snav-btn', { hasText: '动作要点' }).first().click().catch(() => {})
      await page.waitForTimeout(500)
      rec.tips = await readTips(page)
      await page.screenshot({ path: path.join(OUT, `${style}-tips.png`) }).catch(() => {})
      rec.pass.tips = Array.isArray(rec.tips) && rec.tips.length === 2
        && rec.tips[0].includes(rec.exp.tip)
      // 关掉弹层
      await page.locator('.sp-close').first().click().catch(() => {})
      await page.waitForTimeout(300)

      // ③ 逐式跳过直到完成 → 读完成页副标题
      for (let i = 0; i < 40; i++) {
        if (await page.locator('.done-sub').count()) break
        const skip = page.locator('.cb-btn.skip')
        if (await skip.count() === 0) break
        await skip.first().click().catch(() => {})
        await page.waitForTimeout(1100)
      }
      rec.doneSub = await readDone(page)
      rec.pass.doneSub = rec.doneSub === rec.exp.done
      await page.screenshot({ path: path.join(OUT, `${style}-done.png`) }).catch(() => {})
      rec.errors = { console: cerr.length, page: perr.length, consoleSample: cerr.slice(-3), pageSample: perr.slice(-3) }
    } catch (e) {
      rec.error = String(e)
      rec.errors = { console: cerr.length, page: perr.length }
    }
    out.styles[style] = rec
    await page.close().catch(() => {})
  }

  // 轻量：/s4/#/prot 不报错
  {
    const page = await ctx.newPage()
    const cerr = [], perr = []
    page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()) })
    page.on('pageerror', (e) => perr.push(String(e)))
    try {
      await page.goto(`${ROOT}/s4/#/prot`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2500)
      out.prot = { hasFrame: await page.locator('iframe.frame, .frame').count(), cerr: cerr.length, perr: perr.length, cerrSample: cerr.slice(-3) }
    } catch (e) { out.prot = { error: String(e) } }
    await page.close().catch(() => {})
  }

  fs.writeFileSync(path.join(OUT, 'by-style.json'), JSON.stringify(out, null, 2))
  await browser.close()

  let allPass = true
  for (const style of STYLES) {
    const r = out.styles[style]
    const ok = r.pass && r.pass.bubble && r.pass.tips && r.pass.doneSub
    allPass = allPass && ok
    console.log(`\n=== ${style} === ${ok ? '✓' : '✗'}`)
    console.log(`  气泡  : ${r.bubble}`)
    console.log(`          期望 ${r.exp.tip}`)
    console.log(`          判定 ${r.pass?.bubble}  (${r.bubble === r.exp.tip ? '一致' : '不一致'})`)
    console.log(`  要点  : ${JSON.stringify(r.tips)}`)
    console.log(`  完成页: ${r.doneSub}  (期望 ${r.exp.done} → ${r.pass?.doneSub})`)
    console.log(`  err   : console=${r.errors?.console} page=${r.errors?.page}`)
  }
  console.log(`\n/s4/#/prot:`, JSON.stringify(out.prot))
  console.log(allPass ? '\n✅ 三拳种 HUD 均随拳种/当前式动态' : '\n❌ 存在不一致')
  process.exit(allPass ? 0 : 1)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
