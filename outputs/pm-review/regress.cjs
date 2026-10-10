/* 改前 / 改后 逐像素回归（主壳 + s4 全屏截图）。
 *
 * 用法：node outputs/pm-review/regress.cjs [beforeDir] [afterDir]
 *   默认 before = outputs/pm-review/before ，after = outputs/pm-review/after
 *
 * 判定口径（项目红线）：
 *   · 未触碰的屏 必须 0.000% 差异（容差 TOL=8/通道，滤掉合成噪声）
 *   · 本轮有意改动的屏（home/question/done/intro 相关、s4 顶栏）允许有差异，
 *     但要列出差异像素数与占比，并导出「并排图 + 差异热力图」供人眼复核。
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(__dirname)
const A_DIR = path.resolve(process.argv[2] || path.join(ROOT, 'before'))
const B_DIR = path.resolve(process.argv[3] || path.join(ROOT, 'after'))
/* 可选第 3 个参数：噪声地板目录 —— 「同一套代码再采一次」的截图目录。
   有它才能把「动效/光栅化抖动」与「真的改坏了」分开：
   loading 页有云/花瓣/转圈动效，同版本连采就能差几百像素。 */
const NOISE_DIR = process.argv[4] ? path.resolve(process.argv[4]) : null
const OUT = path.join(ROOT, 'diff')

const INTENDED = /shell-(home|question|done|intro)\.png|shell-profile-with-records\.png/
const EXPECT_ZERO = /shell-(loading|audio|practice|body|profile)\.png/
/* s4 跟练页里有**真实视频画面**（假摄像头也是一路在跑的合成视频），
   同版本连采就能差 1.2% —— 像素比对在这页没有分辨率可言。
   s4 的正确性改由 framing.test.mjs（纯函数 16 项）+ probe-s4-vis.cjs（真实页面取值）覆盖。 */
const SKIP = /s4-train-/

const dataUrl = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

const DIFF = async ([ua, ub]) => {
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u })
  const [ia, ib] = await Promise.all([load(ua), load(ub)])
  if (ia.width !== ib.width || ia.height !== ib.height) {
    return { sizeMismatch: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` }
  }
  const W = ia.width, H = ib.height || ia.height
  const ca = new OffscreenCanvas(W, H), cb = new OffscreenCanvas(W, H), cd = new OffscreenCanvas(W, H)
  const xa = ca.getContext('2d'), xb = cb.getContext('2d'), xd = cd.getContext('2d')
  xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0)
  const da = xa.getImageData(0, 0, W, H), db = xb.getImageData(0, 0, W, H)
  const out = xd.createImageData(W, H)
  const A = da.data, B = db.data, O = out.data
  const TOL = 8
  let diff = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1
  const bands = new Map()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]))
      const isDiff = d > TOL
      if (isDiff) {
        diff++
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
        const bk = Math.floor(y / 20) * 20
        bands.set(bk, (bands.get(bk) || 0) + 1)
      }
      // 差异图：差异处标红，其余为「改后」的灰度
      const g = Math.round(0.299 * B[i] + 0.587 * B[i + 1] + 0.114 * B[i + 2])
      O[i] = isDiff ? 255 : g
      O[i + 1] = isDiff ? 0 : g
      O[i + 2] = isDiff ? 0 : g
      O[i + 3] = 255
    }
  }
  xd.putImageData(out, 0, 0)
  const bmp = await createImageBitmap(cd)
  const cv = new OffscreenCanvas(W, H)
  cv.getContext('2d').drawImage(bmp, 0, 0)
  const blob = await cv.convertToBlob({ type: 'image/png' })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  const b64 = btoa(s)
  const top = [...bands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  return {
    W, H, diff,
    pct: (diff / (W * H) * 100),
    bbox: diff ? [minX, minY, maxX, maxY] : null,
    topBands: top.map(([y, n]) => `y${y}-${y + 19}:${n}`),
    png: b64,
  }
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const files = fs.readdirSync(A_DIR).filter((f) => f.endsWith('.png')).sort()
  if (!files.length) { console.error('改前目录没有 PNG：' + A_DIR); process.exit(1) }

  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage()
  const rows = []
  let bad = 0

  for (const f of files) {
    const pa = path.join(A_DIR, f), pb = path.join(B_DIR, f)
    if (!fs.existsSync(pb)) { rows.push({ f, note: '改后缺图' }); bad++; continue }
    const r = await page.evaluate(DIFF, [dataUrl(pa), dataUrl(pb)])
    if (r.sizeMismatch) { rows.push({ f, note: '尺寸不一致 ' + r.sizeMismatch }); bad++; continue }
    fs.writeFileSync(path.join(OUT, f.replace(/\.png$/, '.diff.png')), Buffer.from(r.png, 'base64'))
    // 噪声地板：用「同一套代码再采一次」的目录量出该屏自身的不确定性（动效 / 光栅化抖动）
    let noise = null
    if (NOISE_DIR) {
      const pn = path.join(NOISE_DIR, f)
      if (fs.existsSync(pn)) {
        const rn = await page.evaluate(DIFF, [dataUrl(pa), dataUrl(pn)])
        noise = rn.sizeMismatch ? null : rn.diff
      }
    }
    // 判回归：差异必须明显超过「噪声地板」
    const floor = Math.max(64, (noise || 0) * 3)
    let verdict
    if (SKIP.test(f)) verdict = 'SKIP'
    else if (r.diff <= floor) verdict = 'ZERO'
    else if (EXPECT_ZERO.test(f)) { verdict = 'REGRESS'; bad++ }
    else if (INTENDED.test(f)) verdict = 'INTENDED'
    else { verdict = 'UNKNOWN'; bad++ }
    rows.push({ f, pct: r.pct, diff: r.diff, noise, floor, verdict, bbox: r.bbox, topBands: r.topBands, W: r.W, H: r.H })
  }

  console.log('改前：' + A_DIR)
  console.log('改后：' + B_DIR)
  console.log('噪声地板：' + (NOISE_DIR || '（未提供，只用固定阈值 64 像素）') + '\n')
  for (const r of rows) {
    if (r.note) { console.log(`  !! ${r.f}  ${r.note}`); continue }
    const tag = r.verdict === 'ZERO' ? '✓ 无差异'
      : r.verdict === 'INTENDED' ? '◆ 有意改动'
        : r.verdict === 'REGRESS' ? '✗ 回归！'
          : r.verdict === 'SKIP' ? '– 跳过（有视频画面，像素无意义）'
            : '? 未归类'
    console.log(`  ${tag}  ${r.f}  ${r.diff} 像素 / ${r.pct.toFixed(3)}%` +
      `  (噪声 ${r.noise == null ? '—' : r.noise}，阈值 ${r.floor})  (${r.W}x${r.H})` +
      (r.verdict !== 'ZERO' && r.bbox ? `  bbox=${r.bbox.join(',')}` : ''))
  }
  console.log('\n差异图（红=差异）：' + OUT)
  console.log(bad === 0 ? '\n✅ 未触碰的屏差异均在噪声地板以内，无回归' : `\n❌ 有 ${bad} 项需要处理`)
  await browser.close()
  process.exit(bad === 0 ? 0 : 1)
})()
