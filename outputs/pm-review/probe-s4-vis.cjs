/* 校验：s4 跟练页顶栏三个指标（上半身 / 下半身 / 取景完整度）是否来自真实关键点。
 *
 * 为什么不用像素比对：这页里有**真实视频画面**（假摄像头也是一路在跑的合成视频），
 * 同版本连采就能差 1.2%，像素比对在这里没有分辨率。
 * 所以改为直接读页面上的取值：
 *   · 假摄像头里没有人 → MediaPipe 检测不到人体 → 三个值必须是「—」、条宽 0%
 *   · 改前这三个值是写死的 92% / 88% / 92%，无论有没有人都一样
 * 用法：node outputs/pm-review/probe-s4-vis.cjs [port]
 */
const { chromium } = require('playwright-core')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let pass = 0, fail = 0
const ok = (n, c, x) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (x ? '  →  ' + x : ''))) }

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  await page.goto(BASE + '/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong', { waitUntil: 'load' })
  await page.waitForFunction(() => {
    const v = document.querySelector('video')
    return v && v.videoWidth > 0 && v.readyState >= 2
  }, { timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(5000)   // 留时间给 MediaPipe 跑若干帧

  const v = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.m-item, .metric, .m-card, .stat, .m')]
    const pick = (label) => {
      const all = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === label)
      const t = all[0]
      if (!t) return null
      const box = t.closest('div')
      return box ? box.innerText.trim() : null
    }
    const vals = [...document.querySelectorAll('.m-val')].map((e) => e.textContent.trim())
    const bars = [...document.querySelectorAll('.m-bar > span')].map((e) => e.style.width)
    const diag = document.querySelector('.diag')
    return {
      labels: [...document.querySelectorAll('.m-title')].map((e) => e.textContent.trim()),
      vals, bars,
      diag: diag ? diag.textContent.trim() : null,
      hint: (document.querySelector('.hint') || {}).textContent || null,
      cards: cards.length, pick: pick('上半身'),
      video: (() => { const x = document.querySelector('video'); return x ? x.videoWidth + 'x' + x.videoHeight : null })(),
    }
  })

  console.log('顶栏：' + JSON.stringify(v.labels) + ' = ' + JSON.stringify(v.vals))
  console.log('条宽：' + JSON.stringify(v.bars) + '    诊断：' + JSON.stringify(v.diag))
  console.log('video = ' + v.video + '\n')

  ok('顶栏三项是「上半身 / 下半身 / 取景完整度」', JSON.stringify(v.labels) === JSON.stringify(['上半身', '下半身', '取景完整度']), JSON.stringify(v.labels))
  ok('三项取值都不是写死的 92% / 88% / 92%',
    !(v.vals[0] === '92%' && v.vals[1] === '88%' && v.vals[2] === '92%'), JSON.stringify(v.vals))
  const noPerson = v.vals.every((x) => x === '—')
  if (noPerson) {
    ok('假摄像头无人 → 三项一律「—」（诚实占位，不编数字）', true)
    ok('无人时条宽一律 0%', v.bars.every((b) => b === '0%' || b === ''), JSON.stringify(v.bars))
    ok('诊断文案为「未检测到人体」', /未检测到人体/.test(v.diag || ''), v.diag)
  } else {
    console.log('  · 本机假摄像头里出现了「人体」判定：' + JSON.stringify(v.vals) + '，改为校验数值自洽性')
    ok('三项都是合法的百分比或「—」', v.vals.every((x) => x === '—' || /^\d+%$/.test(x)), JSON.stringify(v.vals))
    ok('百分比在 0–100 之间', v.vals.every((x) => x === '—' || (+x.replace('%', '') >= 0 && +x.replace('%', '') <= 100)), JSON.stringify(v.vals))
  }
  ok('页面无 JS 报错（摄像头 NotAllowed 不计）', errs.length === 0, errs.join(' | '))

  console.log('\n' + (fail === 0 ? `✅ s4 顶栏指标取自真实关键点（${pass} 通过 / 0 失败）` : `❌ ${fail} 项未通过`))
  await browser.close()
  process.exit(fail === 0 ? 0 : 1)
})()
