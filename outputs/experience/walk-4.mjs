/* 完整旅程：加载页 → 进入弦养 → 7 步问诊 → 主界面 → 找跟练 → 真 s4 */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const OUT = 'outputs/experience/'
const shot = (p, n) => p.screenshot({ path: OUT + n })

const dump = (p) => p.evaluate(() => ({
  screen: document.getElementById('app')?.dataset.screen || '',
  url: location.href.replace('http://127.0.0.1:' + location.port, ''),
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
  btns: [...document.querySelectorAll('button')].map((b) => ({
    t: (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 18), a: b.getAttribute('data-a') || '', i: b.getAttribute('data-i') || '',
  })).filter((x) => x.t || x.a),
}))

;(async () => {
  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, permissions: ['camera'] })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)) })

  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await shot(p, 'J-01-加载页.png')
  console.log('① 加载页:', (await dump(p)).screen)

  await p.locator('button', { hasText: '进入弦养' }).first().click()
  await p.waitForTimeout(1200)
  console.log('② 进入后:', (await dump(p)).screen)

  for (let i = 1; i <= 7; i++) {
    const d0 = await dump(p)
    if (!d0.btns.some((x) => x.a === 'qsel')) { console.log('   (无问诊卡，停在第', i, '步)'); break }
    await p.locator('.qcard').first().click()
    await p.waitForTimeout(180)
    await p.locator('[data-a="q-next"]').click()
    await p.waitForTimeout(850)
    const d = await dump(p)
    if (i <= 2 || i >= 6) await shot(p, `J-0${i < 3 ? 2 : 3}-问诊第${i}步.png`)
    console.log(`   问诊 ${i} → screen=${d.screen} | ${d.text.slice(0, 40)}`)
  }
  await p.waitForTimeout(1400)
  const home = await dump(p)
  console.log('\n③ 主界面:', JSON.stringify(home, null, 1))
  await shot(p, 'J-04-主界面.png')

  // 找去 intro / 跟练的按钮
  const goBtn = home.btns.find((x) => /练习|开始|推荐|跟练|今日/.test(x.t))
  console.log('\n找到入口按钮:', JSON.stringify(goBtn))
  await b.close()
  console.log('console errors:', errs.length, errs.slice(0, 6))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
