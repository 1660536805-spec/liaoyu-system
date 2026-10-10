/* 重建后自检：s4 默认回落 + 跟练页仍可用。用法：node outputs/branch-merge-review/check-s4-default.cjs */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:' + (Number(process.env.PM_PORT) || 5400)
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 470, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })

  await p.goto(BASE + '/s4/', { waitUntil: 'load' }); await p.waitForTimeout(1200)
  console.log('/s4/          -> ' + p.url() + '   ' + (/\?screen=home/.test(p.url()) ? '✓ 回落主壳首页' : '✗ 未回落'))

  await p.goto(BASE + '/s4/#/train?style=baduanjin', { waitUntil: 'load' }); await p.waitForTimeout(2500)
  const stayed = p.url().indexOf('/s4/') >= 0
  const hasStage = await p.evaluate(() => !!document.querySelector('.ph, .stage, canvas, video, .wrap'))
  console.log('/s4/#/train   -> ' + p.url() + '   ' + (stayed ? '✓ 停留跟练页' : '✗ 被弹回') + '   关键节点:' + hasStage)

  console.log('报错: ' + errs.length + (errs.length ? ' -> ' + errs.slice(0, 3).join(' | ') : ''))
  await b.close()
  process.exit(0)
})()
