/* 核验「完整体验」入口页：图片加载、链接可达、无报错，并出整页截图 */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const URL = `http://127.0.0.1:${PORT}/outputs/experience/index.html`

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
  const errs = [], bad = []
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)) })
  p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })

  await p.goto(URL, { waitUntil: 'networkidle' })
  const info = await p.evaluate(() => ({
    title: document.title,
    imgs: [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.naturalWidth > 0, w: i.naturalWidth })),
    links: [...document.querySelectorAll('a.btn,a.step')].map((a) => a.getAttribute('href')),
    steps: document.querySelectorAll('.step').length,
  }))
  console.log(JSON.stringify(info, null, 1))
  await p.screenshot({ path: 'outputs/experience/experience-page.png', fullPage: true })

  // 逐一验链接可达
  for (const href of ['/', '/?screen=intro', '/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong', '/?screen=done']) {
    const r = await p.request.get(`http://127.0.0.1:${PORT}${href.split('#')[0]}`)
    console.log(`  link ${href} → ${r.status()}`)
  }
  await b.close()
  console.log('\nimages ok:', info.imgs.filter((i) => i.ok).length, '/', info.imgs.length)
  console.log('http>=400:', bad.length, bad.slice(0, 6))
  console.log('console errors:', errs.length, errs.slice(0, 6))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
