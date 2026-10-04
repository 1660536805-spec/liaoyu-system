/**
 * 验证「陪练教练 / 动作指引」在真实 s4 跟练页上的行为。
 *
 * 用 Chrome 假摄像头（无真人 → 判定永不命中），配合压缩后的等待参数，
 * 观察「教练示范 → 请跟我做 → 重新示范 → 宽限 → 自动进入下一式」整条链，
 * 并确认它就发生在 http://127.0.0.1:5320/s4/#/train 这个真实页面上。
 *
 * 两个关键处理：
 *  ① 每个用例都用「全新文档」（先 about:blank 再进目标 URL）。
 *     hash 路由下同页换查询参数不会重建组件，直接从 A 用例 goto B 用例会测到旧状态。
 *  ② 屏蔽 /assets/fallback.mp4，避免 15s 后预录兜底顶上（兜底会暂停教练计时，
 *     用兜底自己的节奏推进），这样测到的就是教练状态机自己的推进链。
 *
 * 用法：NODE_PATH=/Users/leo/WorkBuddy/疗愈/node_modules \
 *        node outputs/ui-compare/verify-coach.cjs http://127.0.0.1:5320
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = (process.argv[2] || 'http://127.0.0.1:5320').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out', 'coach')
fs.mkdirSync(OUT, { recursive: true })

// 压缩等待参数（秒）：示范 2s / 软等 3s / 硬等 6s / 宽限 4s
const Q = 'stage=point&mode=full&style=baduanjin&tone=gong'
  + '&coachDemo=2&coachSoft=3&coachHard=6&coachGrace=4'

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? '  — ' + detail : ''}`)
}

async function probe(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.coach-bar')
    const demo = document.querySelector('.demo.coach')
    return {
      hasBar: !!bar,
      chip: bar?.querySelector('.cb-chip')?.textContent?.trim() || '',
      name: bar?.querySelector('.cb-name')?.textContent?.trim() || '',
      cue: bar?.querySelector('.cb-cue')?.textContent?.trim() || '',
      count: bar?.querySelector('.cb-count')?.textContent?.trim() || '',
      hasFig: !!demo,
      figCollapsed: demo ? demo.classList.contains('collapsed') : null,
      // 停靠态：教练小人应是「指引条的文档流子元素」，绝不能是浮在摄像头上的浮层
      figDocked: demo ? demo.classList.contains('docked') : null,
      figInBar: !!(bar && demo && bar.contains(demo)),
      figPos: demo ? getComputedStyle(demo).position : null,
      cap: demo?.querySelector('.coach-cap')?.textContent?.trim() || '',
    }
  })
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const ctx = await browser.newContext({
    viewport: { width: 470, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['camera'],
  })
  const page = await ctx.newPage()
  const errors = []
  // 本脚本故意 abort 了 fallback.mp4（见文件头 ②），由此引发的 404/解码报错属预期，不算产品缺陷
  const EXPECTED = /fallback\.mp4|预录兜底未就绪|ERR_FAILED|net::ERR_ABORTED/
  page.on('pageerror', (e) => { if (!EXPECTED.test(e.message)) errors.push('PAGEERROR: ' + e.message) })
  page.on('console', (m) => {
    if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push('console.error: ' + m.text().slice(0, 160))
  })
  await page.route('**/fallback.mp4', (r) => r.abort())   // 见文件头 ②

  const open = async (url) => {
    await page.goto('about:blank')
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  console.log('\n=== A. 教练关闭（不带 mode 参数）：保持原有行为，不出现教练条 ===')
  await open(`${BASE}/s4/#/train?stage=point&style=baduanjin&tone=gong`)
  await page.waitForTimeout(3500)
  const off = await probe(page)
  ok('不带 mode 时无教练指引条', !off.hasBar)
  ok('不带 mode 时无教练示范小人', !off.hasFig)

  console.log('\n=== B. mode=full：教练引导全链路（不命中 → 自动逐式推进）===')
  await open(`${BASE}/s4/#/train?${Q}`)
  await page.waitForTimeout(500)

  const seen = { chips: [], steps: [], dockedOnDemo: false, dockedOnFollow: false, capDemo: '', capFollow: '' }
  const shots = {}
  const t0 = Date.now()
  while (Date.now() - t0 < 40000) {
    const s = await probe(page)
    if (s.chip && seen.chips[seen.chips.length - 1] !== s.chip) seen.chips.push(s.chip)
    const step = (s.name.match(/第\s*(\d+)\s*式/) || [])[1]
    if (step && seen.steps[seen.steps.length - 1] !== step) seen.steps.push(step)
    if (seen.steps.length <= 1) {
      // 教练小人必须是「停靠在指引条内的文档流元素」：figDocked && figInBar && position:static
      const dockedOk = s.figDocked === true && s.figInBar === true && s.figPos === 'static'
      if (s.chip === '教练示范中') {
        seen.capDemo = s.cap
        if (dockedOk) {
          seen.dockedOnDemo = true
          if (!shots.demo) { shots.demo = 1; await page.screenshot({ path: path.join(OUT, '01-demo.png') }) }
        }
      }
      if (s.chip === '请跟我做') {
        seen.capFollow = s.cap
        if (dockedOk) {
          seen.dockedOnFollow = true
          if (!shots.follow) { shots.follow = 1; await page.screenshot({ path: path.join(OUT, '02-follow.png') }) }
        }
      }
      if (s.chip === '再看一次示范' && !shots.redemo) { shots.redemo = 1; await page.screenshot({ path: path.join(OUT, '03-redemo.png') }) }
      if (s.chip === '准备进入下一式' && !shots.grace) { shots.grace = 1; await page.screenshot({ path: path.join(OUT, '04-grace.png') }) }
      // 宽限倒计时应为可见的秒数
      if (s.chip === '准备进入下一式' && /后进入下一式/.test(s.count)) shots.graceCount = s.count
      if (s.cue) shots.lastCue = s.cue
    }
    if (seen.steps.length >= 2) break
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: path.join(OUT, '05-advanced.png') })

  console.log('  阶段序列：', JSON.stringify(seen.chips))
  console.log('  式号序列：', JSON.stringify(seen.steps))
  console.log('  示范卡片文案：', JSON.stringify(seen.capDemo), ' / 跟练卡片文案：', JSON.stringify(seen.capFollow))
  ok('进页即自动开始「教练示范中」', seen.chips[0] === '教练示范中', `首帧=${seen.chips[0]}`)
  ok('示范阶段：教练小人停靠在指引条内（文档流元素，非浮层）', seen.dockedOnDemo, `卡片=${seen.capDemo}`)
  ok('示范结束 → 进入「请跟我做」', seen.chips.includes('请跟我做'))
  ok('跟练阶段：教练小人仍停靠可见、不遮挡摄像头（嵌在指引条内）', seen.dockedOnFollow, `卡片=${seen.capFollow}`)
  ok('迟迟不完成 → 自动「再看一次示范」', seen.chips.includes('再看一次示范'))
  ok('仍不完成 → 进入宽限「准备进入下一式」', seen.chips.includes('准备进入下一式'))
  ok('宽限显示倒计时', !!shots.graceCount, shots.graceCount)
  ok('宽限超时 → 自动推进到第 2 式（不卡死）', seen.steps.includes('2'), `式号=${JSON.stringify(seen.steps)}`)
  ok('第 2 式重新从「教练示范中」开始（mode=full 逐动作连贯引导）',
    seen.chips.filter((c) => c === '教练示范中').length >= 2)

  console.log('\n=== C. 就地切换 mode（hash 变更，不刷新整页）===')
  await open(`${BASE}/s4/#/train?stage=point&style=baduanjin&tone=gong`)
  await page.waitForTimeout(2500)
  const before = await probe(page)
  await page.evaluate(() => { location.hash = '#/train?stage=point&style=baduanjin&tone=gong&mode=full' })
  await page.waitForTimeout(1200)
  const after = await probe(page)
  ok('无 mode → 加 mode=full：教练就地开启', !before.hasBar && after.hasBar, `${before.chip}|${after.chip}`)

  console.log('\n=== D. mode=short + 底部开关 ===')
  await open(`${BASE}/s4/#/train?stage=point&mode=short&style=baduanjin&tone=gong`)
  await page.waitForTimeout(2500)
  const shortS = await probe(page)
  ok('mode=short 也出现教练指引条', shortS.hasBar, `chip=${shortS.chip}`)
  const btnText = await page.evaluate(() =>
    [...document.querySelectorAll('.footbar .btn')].map((b) => b.textContent.trim()).join(' | '))
  ok('底部「教练指引」开关显示为开', /教练指引\s*开/.test(btnText), btnText)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.footbar .btn')].find((x) => /教练指引/.test(x.textContent))
    b?.click()
  })
  await page.waitForTimeout(800)
  const afterOff = await probe(page)
  ok('点开关可关闭教练（指引条 + 小人一起消失）', !afterOff.hasBar && !afterOff.hasFig)

  ok('全程无（非预期）页面报错', errors.length === 0, errors.slice(0, 3).join(' ; '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${failed.length ? '✗ 有失败' : '✓ 全部通过'}（${results.length - failed.length}/${results.length}）`)
  console.log(`截图目录：${OUT}`)
  if (failed.length) process.exitCode = 1
})().catch((e) => { console.error(e); process.exitCode = 1 })
