/* 主壳探针：列出所有屏幕名 + 首页可点元素 + 是否含 s4 入口 */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))

  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })

  const info = await p.evaluate(() => {
    const clickable = [...document.querySelectorAll('a,button,[onclick],[data-go],[data-screen]')]
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || '').trim().slice(0, 24),
        onclick: (el.getAttribute('onclick') || '').slice(0, 80),
        dataGo: el.getAttribute('data-go') || el.getAttribute('data-screen') || '',
        href: el.getAttribute('href') || '',
      }))
    return {
      title: document.title,
      bodyLen: document.body.innerText.length,
      appHtmlLen: (document.getElementById('app') || {}).innerHTML?.length || 0,
      clickable,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  console.log('console errors:', errs.length, errs.slice(0, 5))
  await p.screenshot({ path: 'outputs/experience/_probe-home.png', fullPage: false })
  await b.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
