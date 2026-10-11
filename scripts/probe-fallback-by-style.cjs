/**
 * 兜底预录「按拳种分流」运行时探针（纯观测）
 *
 * 目的：回答「摄像头失效时，主画面（检测人体界面）放的是不是当前拳种的预录卡」。
 * 做法：不给摄像头权限 → 触发预录兜底 → 读 <video.fb> 的实际 src，
 *      并抓主画面截图（字幕卡式名已烧进画面，可肉眼核对）。
 * 三拳种各跑一遍。
 *
 * 用法：BASE_ROOT=http://127.0.0.1:5400 node scripts/probe-fallback-by-style.cjs
 * 产物：outputs/fallback-check/<style>-fallback.png + by-style.json
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const ROOT = process.env.BASE_ROOT || 'http://127.0.0.1:5400'
const OUT = path.join(__dirname, '..', 'outputs', 'fallback-check')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const STYLES = ['baduanjin', 'wuqinxi', 'taiji']

fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    // 强制拒绝摄像头授权 → 初始化必失败 → 真触发预录兜底（复现用户截图那条路径）
    args: ['--deny-permission-prompts', '--use-fake-device-for-media-stream=0'],
  })
  // 不给 camera 权限 → 初始化必失败 → 走预录兜底
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })

  const out = { root: ROOT, at: new Date().toISOString(), styles: {} }

  for (const sid of STYLES) {
    const page = await ctx.newPage()
    const cerr = []
    page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()) })
    const rec = {}
    try {
      await page.goto(`${ROOT}/s4/#/train?style=${sid}`, { waitUntil: 'domcontentloaded' })
      await page.reload({ waitUntil: 'domcontentloaded' })
      // 等预录兜底顶上（.fb 元素的 on 类）
      await page.waitForFunction(() => {
        const v = document.querySelector('video.fb')
        return v && v.classList.contains('on')
      }, { timeout: 30000 }).catch(() => {})

      const f = await page.evaluate(() => {
        const v = document.querySelector('video.fb')
        const bar = document.querySelector('.fb-bar')
        return {
          fbOn: v ? v.classList.contains('on') : false,
          fbSrc: v ? v.getAttribute('src') : null,
          fbResolved: v ? v.currentSrc : null,
          fbReady: v ? v.readyState : -1,
          curIdx: document.querySelector('.cur-idx')?.textContent?.trim() || null,
          curName: document.querySelector('.cur-name')?.textContent?.trim() || null,
          hudIdx: document.querySelector('.hud-idx')?.textContent?.trim() || null,
          hudName: document.querySelector('.hud-name')?.textContent?.trim() || null,
          fbBar: bar ? bar.textContent.trim().slice(0, 40) : null,
        }
      })
      // 让预录跑一段，落到某式的稳定帧再截图
      await page.waitForTimeout(2500)
      await page.locator('.stage').first().screenshot({ path: path.join(OUT, `${sid}-fallback.png`) }).catch(() => {})
      rec.facts = f
      rec.consoleErr = cerr.slice(-3)
      rec.expectSrc = `/assets/fallback-${sid}.mp4`
      rec.srcOk = String(f.fbResolved || '').endsWith(`/assets/fallback-${sid}.mp4`)
    } catch (e) {
      rec.error = String(e)
    }
    out.styles[sid] = rec
    await page.close().catch(() => {})
  }

  fs.writeFileSync(path.join(OUT, 'by-style.json'), JSON.stringify(out, null, 2))
  await browser.close()

  let bad = 0
  for (const sid of STYLES) {
    const r = out.styles[sid]
    const f = r.facts || {}
    const ok = r.srcOk ? '✓' : '✗'
    if (!r.srcOk) bad++
    console.log(`${ok} ${sid.padEnd(9)} src=${f.fbResolved || '(无)'}  fbOn=${f.fbOn}  ready=${f.fbReady}  当前式=${f.hudName || f.curName || '?'}`)
  }
  console.log(bad ? `\n✗ ${bad} 个拳种的兜底视频不是按拳种分的` : '\n✓ 三拳种兜底视频均按拳种分流')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
