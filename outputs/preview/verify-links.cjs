/* 逐张点开启动台的每张卡，确认目标页真的存在、且该有的东西在（教练条 / canvas / 正文长度） */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const B = 'http://127.0.0.1:5400'

const CASES = [
  { n: '①主壳', u: B + '/', want: { '#app': 1 } },
  { n: '②跟练页·新教练', u: B + '/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong', want: { '.coach-bar': 1, 'video': 1 }, minText: 60 },
  { n: '③主壳示例(静态)', u: B + '/?screen=practice', forbid: { '.coach-bar': 1 }, minText: 60 },
  { n: '候选A 房间版', u: B + '/outputs/room-baduanjin/preview.html', minText: 200 },
  { n: '候选B 立体房间', u: B + '/outputs/room3d/preview.html', want: { 'canvas': 1 }, minText: 40 },
  { n: '工具 校验台', u: B + '/outputs/xianyang-room.html', want: { '#svgC': 1 }, minText: 500 },
]

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const p = await b.newPage({ viewport: { width: 470, height: 900 } })
  let pass = 0
  for (const c of CASES) {
    await p.goto(c.u, { waitUntil: 'load' })
    await p.waitForTimeout(2500)
    const counts = await p.evaluate((sels) => {
      const o = {}
      for (const s of sels) o[s] = document.querySelectorAll(s).length
      o['__text'] = (document.body.innerText || '').length
      return o
    }, Object.keys(Object.assign({}, c.want, c.forbid)))
    const parts = []
    for (const [sel, need] of Object.entries(c.want || {})) {
      const n = counts[sel]
      parts.push(sel + '=' + n + (n >= need ? ' ✓' : ' ✗(want≥' + need + ')'))
    }
    for (const sel of Object.keys(c.forbid || {})) {
      const n = counts[sel]
      parts.push(sel + '=' + n + (n === 0 ? ' ✓(应为0)' : ' ✗(应为0)'))
    }
    if (c.minText) parts.push('正文' + counts['__text'] + '字' + (counts['__text'] >= c.minText ? ' ✓' : ' ✗'))
    const ok = !parts.some((x) => x.indexOf('✗') >= 0)
    if (ok) pass++
      console.log((ok ? '✓ ' : '✗ ') + c.n.padEnd(18) + parts.join('  '))
  }
  console.log('\n' + pass + '/' + CASES.length + ' 通过')
  await b.close()
  process.exit(pass === CASES.length ? 0 : 1)
})()
