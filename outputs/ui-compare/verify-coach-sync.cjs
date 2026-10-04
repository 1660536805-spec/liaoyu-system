/* 弦养 · 教练同步校验台 —— 端到端验收
 * A 段：正常模式逐时间点巡检（差分层应为 0）
 * B 段：四类差分故障注入（每类都用全新页面 + 播放态测 4.2s）
 * C 段：共模故障（v1 手臂解算）——差分层应保持全绿，绝对层应集体报警
 * D 段：绝对层在 v2 下应全绿
 */
const { chromium } = require('playwright-core')
const path = require('path'), fs = require('fs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FILE = 'file://' + path.resolve('/Users/leo/WorkBuddy/疗愈/outputs/xianyang-room.html')
const OUT = '/Users/leo/WorkBuddy/疗愈/outputs/ui-compare/out/coach-sync'
fs.mkdirSync(OUT, { recursive: true })

let PASS = 0, FAIL = 0
const assert = (ok, msg) => { ok ? (PASS++, console.log('   ✓ ' + msg)) : (FAIL++, console.log('   ✗ ' + msg)) }

const snap = p => p.evaluate(() => {
  const g = id => document.getElementById(id)
  return {
    badgeU: g('badgeU').textContent, badgeC: g('badgeC').textContent,
    v1: g('v1').textContent, v2: g('v2').textContent, v3: g('v3').textContent,
    v4: g('v4').textContent, v5: g('v5').textContent, v6: g('v6').textContent, v7: g('v7').textContent,
    verdict: g('verdictText').textContent, sub: g('verdictSub').textContent,
    n: g('logCount').textContent,
    verdictA: g('verdictAText').textContent, subA: g('verdictASub').textContent,
    nA: g('alogCount').textContent,
    ametrics: [...document.querySelectorAll('#amet .m')].map(m => ({
      k: m.querySelector('.k').textContent,
      v: m.querySelector('.v').textContent,
      fail: m.className.includes('fail'),
    })),
    alogs: [...document.querySelectorAll('#alog li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    logs: [...document.querySelectorAll('#log li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
  }
})

const num = s => parseFloat(String(s).replace(/[^\d.\-]/g, ''))

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1120 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })

  /* ---------------- A ---------------- */
  console.log('=== A. 差分校验 · 正常（同源直连） ===')
  await page.goto(FILE, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  let worst = { ang: 0, pos: 0, amp: 0 }
  for (const t of [0, 1.5, 3.2, 6.0, 9.0, 12.5, 15.0, 18.0, 21.5, 23.5, 24.4]) {
    await page.evaluate(v => { const s = document.getElementById('scrub'); s.value = v; s.dispatchEvent(new Event('input')) }, t)
    await page.waitForTimeout(80)
    const s = await snap(page)
    const ang = num(s.v1), pos = num(s.v2), amp = num(s.v3)
    worst.ang = Math.max(worst.ang, ang); worst.pos = Math.max(worst.pos, pos); worst.amp = Math.max(worst.amp, Math.abs(amp - 1))
    console.log(`  t=${String(t).padStart(4)}s  U:${s.badgeU.padEnd(14)} C:${s.badgeC.padEnd(14)} 角差${s.v1.padStart(7)} 位差${s.v2.padStart(8)} 幅比${s.v3.padStart(8)} 段一致:${s.v5}`)
    if (t === 1.5) await page.locator('.stage').screenshot({ path: path.join(OUT, 'A1-pre-1.5s.png') })
    if (t === 6.0) await page.locator('.stage').screenshot({ path: path.join(OUT, 'A2-cloud-6.0s.png') })
    if (t === 21.5) await page.locator('.stage').screenshot({ path: path.join(OUT, 'A3-post-21.5s.png') })
  }
  console.log(`  → 最坏值：角差 ${worst.ang}° / 位差 ${worst.pos}px / |幅比-1| ${worst.amp.toFixed(3)}`)
  assert(worst.ang <= 0.5, '关节角最大偏差 ≤ 0.5°')
  assert(worst.pos <= 0.35, '关节位置最大偏差 ≤ 0.35px')
  assert(worst.amp <= 0.01, '幅度比偏差 ≤ 0.01')

  /* ---------------- B ---------------- */
  console.log('\n=== B. 差分校验 · 故障注入（每种全新页面 + 播放态 4.2s） ===')
  const EXP = {
    lag:   s => Math.abs(num(s.v4)) >= 60,
    order: s => s.v5 === '否' || num(s.v1) >= 10,
    // +6s = 2×手部圆周期(3.0s)，姿态本身会「转回原样」，只有整步平移暴露出来
    // → 必须靠绝对根位偏差 v7 才能稳定命中
    step:  s => num(s.v7) >= 5 || num(s.v2) >= 5 || s.v5 === '否',
    amp:   s => Math.abs(num(s.v3) - 1) >= 0.1,
  }
  for (const f of ['lag', 'order', 'step', 'amp']) {
    await page.goto(FILE, { waitUntil: 'load' })
    await page.waitForTimeout(400)
    await page.selectOption('#fault', f)
    await page.waitForTimeout(4200)
    const s = await snap(page)
    console.log(`  [${f}] ${s.verdict}${s.sub}  U:${s.badgeU} C:${s.badgeC}`)
    console.log(`      角差 ${s.v1} | 位差 ${s.v2} | 幅比 ${s.v3} | 时移 ${s.v4} | 段一致 ${s.v5} | 手间距差 ${s.v6} | 根位差 ${s.v7}`)
    s.logs.slice(0, 3).forEach(l => console.log('      · ' + l.slice(0, 96)))
    assert(s.verdict === '检出不一致', '[' + f + '] 差分层检出不一致')
    assert(EXP[f](s), '[' + f + '] 命中预期指标特征')
    await page.locator('.panel').nth(0).screenshot({ path: path.join(OUT, `B-${f}.png`) })
  }

  /* ---------------- C ---------------- */
  console.log('\n=== C. 共模故障（v1 手臂解算）· 差分层应保持全绿，绝对层应报警 ===')
  await page.goto(FILE, { waitUntil: 'load' })
  await page.evaluate(() => { const s = document.getElementById('scrub'); s.value = 6.0; s.dispatchEvent(new Event('input')) })
  await page.waitForTimeout(200)
  const cBefore = await snap(page)
  await page.selectOption('#cmode', 'v1')
  await page.waitForTimeout(600)
  const cAfter = await snap(page)
  console.log(`  切换前 差分:${cBefore.verdict} 绝对:${cBefore.verdictA}${cBefore.subA}`)
  console.log(`  切换后 差分:${cAfter.verdict} 绝对:${cAfter.verdictA}${cAfter.subA}`)
  cAfter.ametrics.forEach(m => console.log(`      ${m.fail ? 'FAIL' : 'PASS'}  ${m.k.padEnd(12, '　')} = ${m.v}`))
  cAfter.alogs.slice(0, 5).forEach(l => console.log('      · ' + l.slice(0, 110)))
  assert(cAfter.verdict === '一一对应', '共模故障下差分层仍报「一一对应」（盲区被复现）')
  assert(cAfter.verdictA === '绝对体检越界', '共模故障下绝对层报「越界」')
  assert(cAfter.ametrics.filter(m => m.fail).length >= 3, '共模故障至少触发 3 项绝对指标')
  await page.locator('.stage').screenshot({ path: path.join(OUT, 'C1-commonmode-v1.png') })
  await page.locator('.panel').nth(1).screenshot({ path: path.join(OUT, 'C2-absolute-panel-v1.png') })

  /* ---------------- D ---------------- */
  console.log('\n=== D. 共模模式切回 v2 · 绝对层应全绿 ===')
  await page.selectOption('#cmode', 'v2')
  await page.waitForTimeout(500)
  const d = await snap(page)
  console.log(`  差分:${d.verdict} 绝对:${d.verdictA}${d.subA}`)
  d.ametrics.forEach(m => console.log(`      ${m.fail ? 'FAIL' : 'PASS'}  ${m.k.padEnd(12, '　')} = ${m.v}`))
  assert(d.verdictA === '绝对体检通过', 'v2 下绝对层全绿')
  assert(d.ametrics.every(m => !m.fail), 'v2 下 9 项绝对指标全部通过')

  await page.goto(FILE, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  await page.screenshot({ path: path.join(OUT, 'C-fullpage.png'), fullPage: true })

  console.log('\n================ 汇总 ================')
  console.log(`通过 ${PASS} / 失败 ${FAIL}`)
  console.log('控制台错误：' + (errs.length ? errs.join(' | ') : '无'))
  await b.close()
  process.exit(FAIL ? 1 : 0)
})()
