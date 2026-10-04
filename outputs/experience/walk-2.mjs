/* 继续走查：过问诊问卷 → 主界面 → 找跟练入口 → 落到 s4 */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const OUT = 'outputs/experience/'

const dump = (p) => p.evaluate(() => ({
  url: location.href,
  hash: location.hash,
  title: document.title,
  bodyLen: document.body.innerText.length,
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
  clickable: [...document.querySelectorAll('a,button,[onclick],[data-go]')].map((el) => ({
    t: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 20),
    go: el.getAttribute('data-go') || '',
    oc: (el.getAttribute('onclick') || '').slice(0, 70),
    href: el.getAttribute('href') || '',
  })).filter((x) => (x.t || x.oc || x.href) && !/^[♪♫✿\s]+$/.test(x.t)),
}))

const clickText = (p, re) => p.evaluate((src) => {
  const rx = new RegExp(src)
  const el = [...document.querySelectorAll('button,a,[onclick],[data-go]')]
    .find((x) => rx.test((x.innerText || '').trim()))
  if (el) { el.click(); return (el.innerText || '').trim().slice(0, 24) }
  return null
}, re.source)
const clickSel = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (e) { e.click(); return true } return false }, sel)

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)) })

  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await clickText(p, /进入弦养/)
  await p.waitForTimeout(1400)

  // 过问卷：最多点 12 次「下一步/跳过/开始/完成」
  for (let i = 0; i < 12; i++) {
    const who = await clickText(p, /^(下一步|跳过|开始|完成|生成|进入弦养|好的|知道了|继续)/)
    if (!who) break
    await p.waitForTimeout(900)
    const d = await dump(p)
    console.log(`  过卷 ${i + 1}: 点了「${who}」→ ${d.url.split(':5400')[1] || d.url} | ${d.text.slice(0, 46)}`)
  }
  await p.waitForTimeout(1200)
  const home = await dump(p)
  console.log('\n【主界面】', JSON.stringify(home, null, 1))
  await p.screenshot({ path: OUT + 'P-03-主界面.png', fullPage: false })

  // 找跟练相关入口
  const cand = home.clickable.filter((c) => /跟练|练习|八段锦|开始|课程|动作/.test(c.t))
  console.log('\n跟练候选入口:', JSON.stringify(cand))
  const ok = await clickText(p, /(跟练|开始练习|八段锦|练习)/)
  console.log('点了:', ok)
  await p.waitForTimeout(2500)
  const after = await dump(p)
  console.log('\n【跟练后】', JSON.stringify(after, null, 1))
  await p.screenshot({ path: OUT + 'P-04-跟练后.png', fullPage: false })

  await b.close()
  console.log('\nconsole errors:', errs.length, errs.slice(0, 6))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
