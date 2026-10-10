/* 诊断「教练小人胳膊怪」：解析 CoachFigure 的手臂路径端点，算肘内夹角，逐帧采样。
 * 用法：node outputs/coach-judge/diag-elbow.cjs [port]
 */
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = __dirname
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const URL = `${BASE}/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong`

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForFunction(() => !!document.querySelector('.coach-bar .cf svg'), { timeout: 60000 })
  await page.waitForTimeout(2500)

  // 逐帧采样：读 armL/armR 的 肩(S) 肘(Eb) 腕(Wr)
  const samples = await page.evaluate(async () => {
    const svg = document.querySelector('.coach-bar .cf svg')
    const nums = (d) => (d || '').match(/-?\d+(\.\d+)?/g)?.map(Number) || []
    const out = []
    const t0 = performance.now()
    while (performance.now() - t0 < 12000) {
      const rec = { t: Math.round(performance.now() - t0) }
      ;['armL', 'armR'].forEach((g, i) => {
        const grp = svg.querySelector(`[data-p="${g}"]`)
        if (!grp) return
        const a1 = nums(grp.children[0].getAttribute('d'))   // M S L Eb
        const a2 = nums(grp.children[3].getAttribute('d'))   // M Eb L Wr
        if (a1.length >= 4 && a2.length >= 4) {
          const S = [a1[0], a1[1]], Eb = [a1[2], a1[3]], Wr = [a2[2], a2[3]]
          const v1 = [S[0] - Eb[0], S[1] - Eb[1]], v2 = [Wr[0] - Eb[0], Wr[1] - Eb[1]]
          const dot = v1[0] * v2[0] + v1[1] * v2[1]
          const m = Math.hypot(...v1) * Math.hypot(...v2) || 1
          const deg = Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI
          rec[i ? 'R' : 'L'] = {
            elbow: +deg.toFixed(1),
            dSE: +Math.hypot(S[0] - Eb[0], S[1] - Eb[1]).toFixed(1),
            dEW: +Math.hypot(Wr[0] - Eb[0], Wr[1] - Eb[1]).toFixed(1),
            dSW: +Math.hypot(S[0] - Wr[0], S[1] - Wr[1]).toFixed(1),
          }
        }
      })
      rec.step = document.querySelector('[data-test="step-no"]')?.textContent || ''
      out.push(rec)
      await new Promise((r) => requestAnimationFrame(r))
    }
    return out
  })

  const L = samples.filter((s) => s.L).map((s) => s.L.elbow)
  const R = samples.filter((s) => s.R).map((s) => s.R.elbow)
  const stat = (a) => {
    if (!a.length) return null
    const s = [...a].sort((x, y) => x - y)
    return {
      n: a.length,
      min: +s[0].toFixed(1),
      p25: +s[Math.floor(s.length * .25)].toFixed(1),
      med: +s[Math.floor(s.length * .5)].toFixed(1),
      p75: +s[Math.floor(s.length * .75)].toFixed(1),
      max: +s[s.length - 1].toFixed(1),
      // 「折死」比例：肘内夹角 < 110° 视为永久折死
      dead: a.filter((v) => v < 110).length,
      deadPct: +(a.filter((v) => v < 110).length / a.length * 100).toFixed(1),
    }
  }
  console.log('左臂肘角:', JSON.stringify(stat(L)))
  console.log('右臂肘角:', JSON.stringify(stat(R)))
  const sample = samples.filter((s) => s.L)[0]
  console.log('样例帧 臂长:', JSON.stringify(sample.L), sample.R ? JSON.stringify(sample.R) : '')

  // 抓教练小窗 + 全身多帧
  const boxEl = page.locator('.coach-bar .cv-box').first()
  for (let i = 1; i <= 4; i++) {
    await boxEl.screenshot({ path: path.join(OUT, `DIAG-教练小窗-帧${i}.png`) })
    await page.waitForTimeout(1200)
  }
  console.log('  ✓ DIAG-教练小窗-帧1..4.png')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
