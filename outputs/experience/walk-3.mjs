/* 继续走查 v3：先选项 → 下一步，过完问卷 → 主界面 */
import { chromium } from 'playwright-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const OUT = 'outputs/experience/'

const dump = (p) => p.evaluate(() => ({
  url: location.href, hash: location.hash, title: document.title,
  bodyLen: document.body.innerText.length,
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
  clickable: [...document.querySelectorAll('a,button,[onclick],[data-go]')].map((el) => ({
    t: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 22),
    go: el.getAttribute('data-go') || '', oc: (el.getAttribute('onclick') || '').slice(0, 70),
    href: el.getAttribute('href') || '',
  })).filter((x) => (x.t || x.oc || x.href)),
}))
const clickText = (p, src) => p.evaluate((s) => {
  const rx = new RegExp(s)
  const el = [...document.querySelectorAll('button,a,[onclick],[data-go],div')]
    .find((x) => rx.test((x.innerText || '').trim()) && x.offsetParent !== null)
  if (el) { el.click(); return (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 22) }
  return null
}, src)

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)) })

  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await clickText(p, '进入弦养')
  await p.waitForTimeout(1400)

  let last = ''
  for (let i = 0; i < 14; i++) {
    const d = await dump(p)
    const prog = (d.text.match(/(\d+)\s*\/\s*(\d+)/) || [])[0] || ''
    if (/跟练|开始练习|今日推荐|首页|我的/.test(d.text) && !/你最近|请选择/.test(d.text)) {
      console.log(`  → 问卷结束（第 ${i} 轮），到达：${d.text.slice(0, 60)}`); break
    }
    // 先选第一项
    const opt = await clickText(p, '^(颈肩|腰背|脾胃|睡眠|情绪|没有|是|否|轻微|中等|严重|经常|偶尔|从不|久坐|一般|较差|很好|有|无)')
    await p.waitForTimeout(260)
    const nx = await clickText(p, '^(下一步|完成|开始|生成|查看|好的)')
    await p.waitForTimeout(900)
    const d2 = await dump(p)
    const prog2 = (d2.text.match(/(\d+)\s*\/\s*(\d+)/) || [])[0] || ''
    console.log(`  轮${i + 1}: 选「${opt}」→「${nx}」 | ${prog || prog2} | ${d2.text.slice(0, 44)}`)
    if (d2.text === last) { console.log('  (无变化，停)'); break }
    last = d2.text
  }
  await p.waitForTimeout(1400)
  const home = await dump(p)
  console.log('\n【当前界面】', JSON.stringify(home, null, 1))
  await p.screenshot({ path: OUT + 'P-03-主界面.png' })
  await b.close()
  console.log('\nconsole errors:', errs.length, errs.slice(0, 6))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
