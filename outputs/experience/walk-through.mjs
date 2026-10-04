/* 完整产品链路走查：加载页 → 进入弦养 → 主壳首页 → 跟练入口 → 是否落到真 s4（含教练） */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const OUT = 'outputs/experience/'

const dump = (p) => p.evaluate(() => ({
  url: location.href,
  hash: location.hash,
  title: document.title,
  bodyLen: document.body.innerText.length,
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
  clickable: [...document.querySelectorAll('a,button,[onclick],[data-go]')].map((el) => ({
    t: (el.innerText || '').trim().slice(0, 16),
    go: el.getAttribute('data-go') || '',
    oc: (el.getAttribute('onclick') || '').slice(0, 70),
    href: el.getAttribute('href') || '',
  })).filter((x) => x.t || x.oc || x.href),
}))

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)) })

  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  console.log('【1 加载页】', JSON.stringify(await dump(p)))
  await p.screenshot({ path: OUT + 'P-01-加载页.png' })

  // 点「进入弦养」
  await p.getByRole('button', { name: /进入弦养/ }).first().click().catch(async () => {
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /进入弦养/.test(x.innerText)); b && b.click() })
  })
  await p.waitForTimeout(1600)
  console.log('\n【2 进入后】', JSON.stringify(await dump(p)))
  await p.screenshot({ path: OUT + 'P-02-进入后.png' })

  await b.close()
  console.log('\nconsole errors:', errs.length, errs.slice(0, 6))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
