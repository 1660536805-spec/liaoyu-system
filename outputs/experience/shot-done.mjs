import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  for (const [s, n] of [['done', 'J-05-完成.png'], ['profile', 'J-06-我的.png']]) {
    await p.goto(`http://127.0.0.1:${PORT}/?screen=${s}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(700)
    const t = await p.evaluate(() => ({ sc: document.getElementById('app')?.dataset.screen, txt: document.body.innerText.replace(/\s+/g,' ').slice(0,90) }))
    console.log(s, '→', JSON.stringify(t))
    await p.screenshot({ path: 'outputs/experience/' + n })
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
