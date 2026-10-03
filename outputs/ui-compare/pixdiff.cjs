/**
 * 逐像素 diff：主壳(图二基准) vs s4 音疗页 整页截图。
 * 用 data URL 载入以免 canvas 被 file:// 污染；输出差异像素数、包围盒、
 * 按 20px 高条带聚合的差异分布，以及差异可视化图。
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, 'out')
const A = path.join(OUT, 'main-audio-full.png')
const B = path.join(OUT, 's4-audio-full.png')

const dataUrl = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

const DIFF = async ([ua, ub]) => {
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u })
  const [ia, ib] = await Promise.all([load(ua), load(ub)])
  if (ia.width !== ib.width || ia.height !== ib.height) {
    return { sizeMismatch: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` }
  }
  const W = ia.width, H = ia.height
  const ca = new OffscreenCanvas(W, H), cb = new OffscreenCanvas(W, H), cd = new OffscreenCanvas(W, H)
  const xa = ca.getContext('2d'), xb = cb.getContext('2d'), xd = cd.getContext('2d')
  xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0)
  const da = xa.getImageData(0, 0, W, H), db = xb.getImageData(0, 0, W, H)
  const out = xd.createImageData(W, H)
  const A = da.data, B = db.data, O = out.data
  let diff = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1
  const bands = new Map()
  const TOL = 8 // 每通道容差，滤掉极轻微的压缩/合成噪声
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]))
      const isDiff = d > TOL
      // 差异图：差异处标红，其余压暗为灰度
      if (isDiff) {
        diff++
        O[i] = 255; O[i + 1] = 0; O[i + 2] = 0; O[i + 3] = 255
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
        const band = Math.floor(y / 20)
        bands.set(band, (bands.get(band) || 0) + 1)
      } else {
        const g = (A[i] * 0.3 + A[i + 1] * 0.59 + A[i + 2] * 0.11) * 0.45 + 140
        O[i] = O[i + 1] = O[i + 2] = g; O[i + 3] = 255
      }
    }
  }
  xd.putImageData(out, 0, 0)
  const blob = await cd.convertToBlob({ type: 'image/png' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  const bandList = [...bands.entries()].map(([b, n]) => ({ y0: b * 20, y1: b * 20 + 19, n })).sort((p, q) => q.n - p.n).slice(0, 30)
  return {
    W, H, diffPixels: diff, totalPixels: W * H, ratio: +(diff / (W * H) * 100).toFixed(4),
    bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    topBands: bandList,
    diffPng: 'data:image/png;base64,' + btoa(bin),
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage()
  await page.goto('about:blank')
  const r = await page.evaluate(DIFF, [dataUrl(A), dataUrl(B)])
  if (r.sizeMismatch) { console.log('尺寸不一致:', r.sizeMismatch); await browser.close(); return }
  console.log(`尺寸 ${r.W}x${r.H}`)
  console.log(`差异像素 ${r.diffPixels} / ${r.totalPixels}  (${r.ratio}%)`)
  console.log('包围盒:', JSON.stringify(r.bbox))
  console.log('差异最集中的条带(设备px, 20px/条):')
  r.topBands.forEach((b) => console.log(`  y ${b.y0}-${b.y1}  diff=${b.n}`))
  const p = path.join(OUT, 'pixdiff.png')
  fs.writeFileSync(p, Buffer.from(r.diffPng.split(',')[1], 'base64'))
  console.log('差异可视化已写出:', p)
  await browser.close()
})()
