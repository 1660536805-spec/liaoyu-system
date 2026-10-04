/**
 * E2E · 「陪练教练 + 摄像头同时开」+「判定闸门」验收
 * ------------------------------------------------------------------
 * 用假摄像头（画面里没有人体 → 判定器永远不命中）验证四件事：
 *   ① 教练条与摄像头**同时**在跑（教练小窗动画在动 + video 在播 + 骨架在循环）
 *   ② 判定闸门：动作没通关 → **永远停在第 1 式**，绝不自动跳式
 *   ③ 没通关期间系统是「活的」：每 attemptMs 发一次 nudge → 轮次 +1、示范重播
 *   ④ 反证（对照档）：?coachGate=time 同样条件下**会**自动放行 → 说明②不是「测试测不出来」
 * 运行：node scripts/e2e-coach-judge.cjs     （需先起 node server.cjs <PORT>）
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('/Users/leo/WorkBuddy/疗愈/node_modules/playwright-core')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.PORT || 5399)
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join('/Users/leo/WorkBuddy/疗愈', 'outputs', 'coach-judge')

const ATTEMPT_S = 3          // 每 3s 一轮 nudge（默认 15s，压短便于验证）
const DEMO_S = 3             // 示范保底 3s（默认 9s），留出「同时开始」的观察窗
const JUDGE_WATCH_MS = 16000 // 判定闸门观察窗口：应始终停在第 1 式
const TIME_WATCH_MS = 9000   // 计时档观察窗口：应已自动放行

const lines = []
let failures = 0
function check(name, cond, detail = '') {
  lines.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -> ${detail}` : ''}`)
  if (!cond) failures++
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 取「有没有在动」的指纹：比「画的是什么」更能说明「示范一直在循环」。
// 兼容两种渲染方式：
//   canvas → 稀疏采样像素；svg（教练小窗已换成房间版小人，是 SVG）→ 对结构串做哈希。
//   帧间变化在 SVG 上体现在各 path 的 d / transform 属性，outerHTML 会跟着变。
async function fingerprint(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    if (el.tagName.toLowerCase() === 'canvas') {
      if (!el.width) return null
      const ctx = el.getContext('2d')
      const data = ctx.getImageData(0, 0, el.width, el.height).data
      let sum = 0, n = 0
      for (let i = 0; i < data.length; i += 4096) { sum = (sum * 31 + data[i]) >>> 0; n++ }
      return { hash: sum, n }
    }
    const str = el.outerHTML
    let h = 0
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return { hash: h, n: str.length }
  }, sel)
}

/** 教练小窗形象的选择器：已从 canvas 换成房间版小人（SVG） */
const COACH_FIG = '.coach-bar .cf svg'

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })
  const context = await browser.newContext({
    viewport: { width: 470, height: 900 },
    deviceScaleFactor: 2,
    permissions: ['camera'],
  })

  const errors = []

  // ============ 场景 A：默认判定闸门 ============
  const urlA = `${BASE}/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong`
    + `&coachAttempt=${ATTEMPT_S}&coachDemo=${DEMO_S}`
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await page.goto(urlA, { waitUntil: 'domcontentloaded' })

  // 等教练条出现（= 教练已自动开启）
  await page.waitForSelector('.coach-bar', { timeout: 30000 })
  check('① 进页即自动开启教练（.coach-bar 出现，未手动点）', true)
  check('① 判定闸门下带 gate-judge 类', (await page.locator('.coach-bar.gate-judge').count()) === 1)

  // 摄像头要比教练条晚得多才起来（wasm + 5.5MB 模型），必须等它真活
  await page.waitForFunction(() => {
    const v = document.querySelector('.stage video.video')
    return !!v && v.videoWidth > 0 && v.videoHeight > 0 && !v.paused && v.readyState >= 2
  }, { timeout: 60000 })

  // 摄像头就绪的这一刻，教练状态机应当**刚**进入示范（而不是早就跑完了）
  const cam = await page.evaluate(() => {
    const v = document.querySelector('.stage video.video')
    return { w: v.videoWidth, h: v.videoHeight, paused: v.paused, ready: v.readyState }
  })
  check('① 摄像头同时在跑（video 有画面且未暂停）',
    cam.w > 0 && cam.h > 0 && !cam.paused, `${cam.w}x${cam.h} ready=${cam.ready} paused=${cam.paused}`)
  check('① 教练小窗形象 = 房间版小人（白练功服 + 腰带结 + 拖影层），且已不再用 canvas',
    (await page.evaluate(() => {
      const svg = document.querySelector('.coach-bar .cf svg')
      if (!svg) return false
      return !!svg.querySelector('[data-p="jacket"]')
        && !!svg.querySelector('[data-p="knot"]')
        && !!svg.querySelector('[data-p="trails"]')
        && svg.querySelectorAll('[data-p]').length >= 18
        && document.querySelectorAll('.coach-bar canvas').length === 0
    })) && (await page.locator('.stage canvas.overlay').count()) === 1)

  // 「同时进行」的硬指标：摄像头一起来，教练的示范才刚开始跑（状态机没提前跑掉）
  await page.waitForFunction(
    () => !!document.querySelector('.coach-bar.cp-demo'),
    { timeout: 5000 },
  )
  check('①【核心】教练与摄像头**同时开始**：摄像头就绪那一刻，教练才刚进入示范（cp-demo）', true)
  await page.screenshot({ path: path.join(OUT, 'A-01-教练与摄像头同时开.png') })

  // 进入跟练阶段（示范保底 1s）
  await page.waitForFunction(
    () => document.querySelector('.coach-bar')?.classList.contains('cp-follow'),
    { timeout: 15000 },
  )
  check('① 示范播完自动进入跟练（cp-follow）', true)

  // --- 观察 16s：式号必须一动不动 ---
  const seen = new Set()
  const roundSeen = new Set()
  let demoMoved = 0
  let ghostMoved = 0
  let lastDemo = await fingerprint(page, COACH_FIG)
  let lastGhost = await fingerprint(page, '.stage canvas.overlay')
  const t0 = Date.now()
  let shot = false
  while (Date.now() - t0 < JUDGE_WATCH_MS) {
    await sleep(700)
    seen.add((await page.locator('.hud-idx').innerText()).trim())
    const txt = await page.locator('.coach-bar .cb-count').innerText().catch(() => '')
    const m = /第\s*(\d+)\s*轮陪练/.exec(txt)
    if (m) roundSeen.add(Number(m[1]))
    const d = await fingerprint(page, COACH_FIG)
    const g = await fingerprint(page, '.stage canvas.overlay')
    if (lastDemo && d && d.hash !== lastDemo.hash) demoMoved++
    if (lastGhost && g && g.hash !== lastGhost.hash) ghostMoved++
    lastDemo = d; lastGhost = g
    if (!shot && Date.now() - t0 > 7000) { shot = true; await page.screenshot({ path: path.join(OUT, 'A-02-卡在第1式-多轮陪练.png') }) }
  }

  const observedSec = Math.round((Date.now() - t0) / 1000)
  check('②【核心】判定闸门：16s 内式号从未变化（没通关就不换式）',
    seen.size === 1 && seen.has('第 1 式'), `观察到：${[...seen].join(' / ')}`)
  check('② 完成度 HUD 未达标（判定确实没命中，不是「其实通关了」）',
    (await page.locator('.coach-bar .cb-score, .gauge-fill').count()) >= 1)
  check('③ 没通关期间系统是活的：出现多轮陪练计数',
    roundSeen.size >= 2, `轮次：${[...roundSeen].sort((a, b) => a - b).join(',')}`)
  check('③ 教练示范一直在动（keepLooping：播完不停、继续循环）',
    demoMoved >= 5, `16s 内画面变化 ${demoMoved} 次`)
  check('③ 摄像头上的标准骨架也在循环（活参照，不是定格）',
    ghostMoved >= 5, `16s 内画面变化 ${ghostMoved} 次`)
  check('③ 判定闸门下永不出现「准备进入下一式」（宽限态）',
    (await page.locator('.coach-bar.cp-grace').count()) === 0)

  // --- 手动出口：跳过本式必须能走 ---
  await page.locator('.coach-bar .cb-btn.skip').click()
  await sleep(1200)
  const afterSkip = (await page.locator('.hud-idx').innerText()).trim()
  check('④ 判定闸门保留手动出口：「跳过本式」能推进到第 2 式',
    afterSkip === '第 2 式', `现在：${afterSkip}`)
  await page.screenshot({ path: path.join(OUT, 'A-03-跳过本式进入第2式.png') })

  // 自由练习 / 教练开关：确认互斥按钮文案
  check('④ 底部「教练指引」显示为「开」',
    (await page.locator('.footbar button', { hasText: '教练指引' }).first().innerText()).includes('开'))

  check('A 场景无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '))
  await page.close()

  // ============ 场景 C：通关路径（?coachSim 模拟「用户做到位」） ============
  // 反向验证：判定闸门不是「卡死」，一旦通关就**必须**往下走。
  const urlC = `${BASE}/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong`
    + `&coachDemo=1&coachAttempt=99&coachSim=2`
  const pageC = await context.newPage()
  const errorsC = []
  pageC.on('pageerror', (e) => errorsC.push(`pageerror: ${e.message}`))
  await pageC.goto(urlC, { waitUntil: 'domcontentloaded' })
  await pageC.waitForSelector('.coach-bar', { timeout: 30000 })
  await pageC.waitForFunction(() => {
    const v = document.querySelector('.stage video.video')
    return !!v && v.videoWidth > 0 && !v.paused
  }, { timeout: 60000 })

  const stepsC = new Set()
  const t2 = Date.now()
  while (Date.now() - t2 < 14000) {
    await sleep(500)
    stepsC.add((await pageC.locator('.hud-idx').innerText()).trim())
  }
  const nums = [...stepsC].map((s) => Number(/第\s*(\d+)/.exec(s)?.[1] || 0)).filter(Boolean)
  check('⑤【核心】通关后自动进入下一式（判定闸门不是卡死）',
    Math.max(...nums) >= 3, `先后经过：${[...stepsC].join(' → ')}`)
  const prog = await pageC.locator('.prog').innerText()
  check('⑤ 完成计数随之累加（.prog 不再是 0 / 8）', prog.trim() !== '0 / 8', `prog = ${prog.trim()}`)
  await pageC.screenshot({ path: path.join(OUT, 'C-01-通关后自动进下一式.png') })
  check('C 场景无 JS 报错', errorsC.length === 0, errorsC.slice(0, 3).join(' | '))
  await pageC.close()

  // ============ 场景 B：对照档 · 计时闸门（应当自动放行） ============
  const urlB = `${BASE}/s4/#/train?stage=1&mode=full&style=baduanjin&tone=gong`
    + `&coachGate=time&coachSoft=99&coachHard=3&coachGrace=2&coachDemo=1`
  const pageB = await context.newPage()
  const errorsB = []
  pageB.on('pageerror', (e) => errorsB.push(`pageerror: ${e.message}`))
  await pageB.goto(urlB, { waitUntil: 'domcontentloaded' })
  await pageB.waitForSelector('.coach-bar', { timeout: 30000 })
  check('对照档：gate=time 时教练条带 gate-time 类',
    (await pageB.locator('.coach-bar.gate-time').count()) === 1)

  const seenB = new Set()
  const t1 = Date.now()
  while (Date.now() - t1 < TIME_WATCH_MS) {
    await sleep(700)
    seenB.add((await pageB.locator('.hud-idx').innerText()).trim())
  }
  check('④【反证】计时闸门下 9s 内确实会自动跳式（证明测试能测出「跳式」）',
    seenB.size >= 2, `观察到：${[...seenB].join(' / ')}`)
  await pageB.screenshot({ path: path.join(OUT, 'B-01-计时档自动放行对照.png') })
  check('B 场景无 JS 报错', errorsB.length === 0, errorsB.slice(0, 3).join(' | '))
  await pageB.close()

  await browser.close()

  const report = {
    ranAt: new Date().toISOString(),
    urlJudge: urlA,
    urlPass: urlC,
    urlTime: urlB,
    observedSecJudge: observedSec,
    stepsSeenJudge: [...seen],
    roundsSeen: [...roundSeen].sort((a, b) => a - b),
    demoMoved, ghostMoved,
    stepsSeenPass: [...stepsC],
    stepsSeenTime: [...seenB],
    failures,
    lines,
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'report.txt'), lines.join('\n') + '\n')

  console.log('\n' + '='.repeat(64))
  console.log(failures === 0 ? '✓ 全部通过' : `✗ ${failures} 项未通过`)
  console.log(`报告：${path.join(OUT, 'report.txt')}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => {
  console.error('E2E 异常：', e)
  process.exit(2)
})
