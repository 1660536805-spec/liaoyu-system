/* P2-2「幅度治本」A/B 采集器 —— 对 outputs/room-baduanjin/preview.html 做**离线**测量，
 * 不进仓库、不碰 dist/s4。给出两样证据：
 *   ① 数值：全 10 式 × 61 帧的左右肘内夹角（与 diag-elbow.cjs 同口径，>110° 记为「未折死」）
 *   ② 图像：逐式代表帧的「教练小窗小人」特写（.taiji 元素），用于 before|after 并排
 *
 * 用法：node outputs/coach-judge/r2-ab.cjs <outDir> [tag]
 *   例：node outputs/coach-judge/r2-ab.cjs outputs/coach-judge/r2/before before
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const REPO = path.resolve(__dirname, '..', '..')
const PAGE = 'file://' + path.join(REPO, 'outputs/room-baduanjin/preview.html') + '#debug'

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'r2/out'))
const TAG = process.argv[3] || 'ab'

// 逐式「代表帧」：取该式的造型高点（托天抬手到顶、开弓拉满 …）
const SHOTS = [
  [0, 0.50], [1, 0.58], [2, 0.34], [2, 0.58], [3, 0.32],
  [4, 0.44], [5, 0.20], [6, 0.30], [7, 0.34], [8, 0.25], [9, 0.50],
]

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-device-scale-factor=2'] })
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(PAGE, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__tj, { timeout: 30000 })

  // ── ① 数值：全周期肘角采样（一次 evaluate 内跑完，避免 rAF 抢帧）
  const samples = await page.evaluate(() => {
    const T = window.__tj
    T.CP.mode = 'free'                       // 冻结：cur 归我方控制，不再由 coach 推导，也无呼吸抖动
    const svg = document.querySelector('.layer:not(.reflect) .taiji svg')
    const nums = (d) => (d || '').match(/-?\d+(\.\d+)?/g)?.map(Number) || []
    const out = []
    const N = 60
    for (let idx = 0; idx < 10; idx++) {
      T.goto(idx, false)                      // 清拖影
      for (let k = 0; k <= N; k++) {
        const u = k / N
        T.cur.idx = idx; T.cur.u = u; T.cur.playing = false
        T.paint(false)
        const rec = { idx, u: +u.toFixed(4) }
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
            rec[i ? 'R' : 'L'] = {
              elbow: +(Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI).toFixed(1),
              dSE: +Math.hypot(S[0] - Eb[0], S[1] - Eb[1]).toFixed(1),
              dEW: +Math.hypot(Wr[0] - Eb[0], Wr[1] - Eb[1]).toFixed(1),
              dSW: +Math.hypot(S[0] - Wr[0], S[1] - Wr[1]).toFixed(1),
            }
          }
        })
        out.push(rec)
      }
    }
    return out
  })

  const stat = (a) => {
    if (!a.length) return null
    const s = [...a].sort((x, y) => x - y)
    return {
      n: a.length, min: +s[0].toFixed(1),
      p25: +s[Math.floor(s.length * .25)].toFixed(1),
      med: +s[Math.floor(s.length * .5)].toFixed(1),
      p75: +s[Math.floor(s.length * .75)].toFixed(1),
      max: +s[s.length - 1].toFixed(1),
      dead: a.filter((v) => v < 110).length,
      deadPct: +(a.filter((v) => v < 110).length / a.length * 100).toFixed(1),
    }
  }
  const L = samples.filter((s) => s.L).map((s) => s.L.elbow)
  const R = samples.filter((s) => s.R).map((s) => s.R.elbow)
  const stats = { L: stat(L), R: stat(R), both: stat([...L, ...R]) }
  const dsw = samples.filter((s) => s.L).map((s) => s.L.dSW)
  stats.reachL = { max: Math.max(...dsw).toFixed(1), med: (dsw.sort((a, b) => a - b)[Math.floor(dsw.length / 2)]).toFixed(1) }

  // 逐式（只看左臂）肘角峰值，便于定位哪一式还折着
  const perMove = []
  for (let idx = 0; idx < 10; idx++) {
    const a = samples.filter((s) => s.idx === idx && s.L).map((s) => s.L.elbow)
    perMove.push({ idx, max: Math.max(...a).toFixed(1), med: a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(1) })
  }
  stats.perMove = perMove

  // ── ② 图像：逐式代表帧特写
  //   房间里有持续动画（走马文字带、浮动音符、地面倒影）⇒ 元素的「稳定等待」永不满足，
  //   且会混进噪声。这里**把非小人的图层隐藏**，只留小人在纯深底上，再用 box+clip 截图。
  await page.addStyleTag({
    content: '.note,.band,.floor-disk,.room-photo,.room-tint,.room-tone,.room-vignette,.layer.reflect{display:none!important}'
      + '.room-scene{background:#11181E}',
  })
  const el = page.locator('.layer:not(.reflect) .taiji').first()
  const shots = []
  for (const [idx, u] of SHOTS) {
    await page.evaluate(([i, uu]) => {
      const T = window.__tj
      T.goto(i, false); T.cur.idx = i; T.cur.u = uu; T.paint(false)
    }, [idx, u])
    const box = await el.boundingBox()
    const f = path.join(OUT, `${TAG}_mv${String(idx).padStart(2, '0')}_u${String(Math.round(u * 100)).padStart(3, '0')}.png`)
    await page.screenshot({ path: f, clip: {
      x: Math.round(box.x), y: Math.round(box.y),
      width: Math.round(box.width), height: Math.round(box.height),
    } })
    shots.push(path.basename(f))
  }

  fs.writeFileSync(path.join(OUT, `${TAG}_stats.json`), JSON.stringify(stats, null, 2))
  console.log('[' + TAG + '] 肘角 L', JSON.stringify(stats.L))
  console.log('[' + TAG + '] 肘角 R', JSON.stringify(stats.R))
  console.log('[' + TAG + '] 合计  ', JSON.stringify(stats.both), ' 最大伸手 dSW=', JSON.stringify(stats.reachL))
  console.log('[' + TAG + '] 逐式(左臂)峰值:', stats.perMove.map((m) => `${m.idx}:${m.max}`).join(' '))
  console.log('[' + TAG + '] 截图', shots.length, '张 →', OUT)
  await browser.close()
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
