/* 取证 + 回归闸门：分享图页脚是否越出画布左右边界。
   背景：写死 22px 时第二行宽 763.6px > 画布 750px ⇒ 居中后左右各被切 6.8px
        （右端「CC0」的 0 看着像「CC(」）。现改为 measureText 自适应字号。
   做法：
     1) 取 shareCard 的原生 750×1120 dataURL（不取被 CSS 缩放的截图），存 outputs/share-footer/
     2) 把 dataURL 画进离屏 canvas，getImageData 扫「页脚带」里文字色像素的最小/最大 x
     3) 断言左右都有边距（不触边）
   本机预览：node scripts/preview-all.cjs 5400 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5400'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, '..', 'outputs', 'share-footer')
fs.mkdirSync(OUT, { recursive: true })

let fails = 0
function chk(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail === undefined ? '' : '  ' + JSON.stringify(detail)))
  if (!ok) fails++
}

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  const nf404 = []
  /* 见 probe-styles-shell.cjs：/local-config.js 是按设计可缺失的本机私钥文件 */
  const EXPECTED_404 = ['/local-config.js']
  ctx.on('page', (pg) => {
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    pg.on('response', (r) => { if (r.status() === 404) { try { nf404.push(new URL(r.url()).pathname) } catch (_) {} } })
  })

  for (const st of ['baduanjin', 'wuqinxi', 'taiji']) {
    console.log('\n=== ' + st + ' ===')
    const p = await ctx.newPage()
    await p.goto(BASE + '/?screen=done&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('[data-a="share-sheet"]')

    const r = await p.evaluate(async () => {
      document.querySelector('[data-a="share-sheet"]').click()
      await new Promise((r) => setTimeout(r, 300))
      const src = document.querySelector('.xs-shot').src
      const W = 750, H = 1120
      // 1) 原始 22px 文本宽（作为对照，独立于 app 逻辑）
      const c0 = document.createElement('canvas'); c0.width = W; c0.height = H
      const g0 = c0.getContext('2d'); g0.font = '22px "PingFang SC","Microsoft YaHei",sans-serif'
      const rawFootW = g0.measureText('《梅花三弄》· RafaelCaro · CC BY 4.0   《醉渔唱晚》· 卫仲乐 1934 · CC0').width
      // 2) 把成品图画进离屏 canvas，扫页脚带里的文字像素
      const img = new Image()
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src })
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const g = c.getContext('2d'); g.drawImage(img, 0, 0)
      const y0 = 1026, y1 = 1062 /* 避开底部边框 y=1064 与左右竖边框 x=28/722（用亮度阈值分离文字） */
      const d = g.getImageData(0, y0, W, y1 - y0).data
      let minx = W, maxx = -1
      for (let yy = 0; yy < y1 - y0; yy++) {
        for (let xx = 0; xx < W; xx++) {
          const i = (yy * W + xx) * 4
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          if (lum < 180) { if (xx < minx) minx = xx; if (xx > maxx) maxx = xx }
        }
      }
      return { W, rawFootW: +rawFootW.toFixed(1), minx, maxx, leftMargin: minx, rightMargin: W - 1 - maxx, src }
    })

    chk(st + '.share.footer.rawWidth@22px', r.rawFootW > 0, r.rawFootW)
    chk(st + '.share.footer.inkRange', r.maxx > r.minx && r.minx > 0, { x: [r.minx, r.maxx] })
    chk(st + '.share.footer.notClippedL', r.leftMargin >= 4, r.leftMargin)
    chk(st + '.share.footer.notClippedR', r.rightMargin >= 4, r.rightMargin)

    if (r.src && r.src.startsWith('data:image/png;base64,')) {
      fs.writeFileSync(path.join(OUT, 'share-' + st + '-native.png'), Buffer.from(r.src.split(',')[1], 'base64'))
    }
    await p.close()
  }

  const realErrors = errors.filter((e) => !(e.indexOf('Failed to load resource') === 0 && nf404.length > 0 && nf404.every((u) => EXPECTED_404.indexOf(u) >= 0)))
  chk('console.errors=0', realErrors.length === 0, realErrors.slice(0, 3))
  await b.close()
  console.log('\n==> fails=' + fails + '  产物 ' + path.relative(process.cwd(), OUT))
  process.exit(fails ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
