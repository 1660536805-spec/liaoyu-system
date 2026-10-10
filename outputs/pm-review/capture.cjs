/* 产品评审用：批量截主壳 9 屏 + s4 真跟练页。
 * 用法：node outputs/pm-review/capture.cjs [port]
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
// 输出目录：环境变量 PM_OUT 优先（用于改前/改后对照），默认脚本所在目录
const OUT = process.env.PM_OUT ? path.resolve(process.env.PM_OUT) : __dirname
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const SHELL_SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const notes = []

  async function newPage(vw, vh) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 })
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
    page.on('requestfailed', (r) => errs.push('reqfail: ' + r.url().replace(BASE, '')))
    return { page, errs }
  }

  // ---------- 主壳 9 屏 ----------
  const { page, errs } = await newPage(470, 900)
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  for (const s of SHELL_SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 2600 : 900)
    const st = await page.evaluate(() => (window.__xy && window.__xy.state && window.__xy.state.screen) || '?')
    const f = `shell-${s}.png`
    await page.screenshot({ path: path.join(OUT, f) })
    notes.push(`shell/${s}  requested=${s} actual=${st}  ${f}`)
    console.log('  ✓', f, 'actual screen =', st)
  }

  // «我的» 有本地记录时的样子（模拟 5 次打卡）
  await page.evaluate(() => {
    const recs = []
    const d = new Date()
    for (let i = 0; i < 5; i++) {
      const x = new Date(d.getTime() - i * 86400000)
      recs.push({ d: x.toISOString().slice(0, 10), at: x.toISOString(), poses: 8, sec: 640 + i * 30 })
    }
    localStorage.setItem('xy-records', JSON.stringify(recs))
  })
  await page.goto(BASE + '/?screen=profile', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(OUT, 'shell-profile-with-records.png') })
  console.log('  ✓ shell-profile-with-records.png')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  // 真跟练入口：intro 页「开始动作预览」真的能跳
  await page.goto(BASE + '/?screen=intro', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const hasEntry = await page.locator('[data-a="start-practice"]').count()
  notes.push(`intro 页 [data-a=start-practice] 数量 = ${hasEntry}`)
  if (hasEntry) {
    await Promise.all([
      page.waitForURL(/s4\//, { timeout: 20000 }).catch(() => {}),
      page.click('[data-a="start-practice"]'),
    ])
    await page.waitForTimeout(1500)
    notes.push('intro→s4 实际落地 URL = ' + page.url().replace(BASE, ''))
  }

  // 主壳 practice 屏里到底有没有「去真跟练」的入口
  await page.goto(BASE + '/?screen=practice', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const inPractice = await page.evaluate(() => {
    const t = document.body.innerText
    const acts = [...document.querySelectorAll('[data-a]')].map((e) => e.getAttribute('data-a'))
    return { s4Link: acts.filter((a) => /s4|practice|goto/.test(a)), hasText: /真实|识别|摄像头/.test(t) }
  })
  notes.push('主壳 practice 屏内的动作 = ' + JSON.stringify(inPractice))

  notes.push('主壳控制台报错 = ' + JSON.stringify(errs.slice(0, 8)))
  await page.close()

  // ---------- s4 真跟练页 ----------
  for (const [name, vw, vh] of [['s4-train-mobile', 470, 900], ['s4-train-desktop', 1280, 900]]) {
    const r = await newPage(vw, vh)
    await r.page.goto(BASE + '/s4/#/train?stage=point&mode=full&style=baduanjin&tone=gong', { waitUntil: 'load' })
    // 等摄像头真的出画面
    await r.page.waitForFunction(() => {
      const v = document.querySelector('video')
      return v && v.videoWidth > 0 && v.readyState >= 2
    }, { timeout: 45000 }).catch(() => notes.push(name + ' 摄像头未就绪（超时）'))
    await r.page.waitForTimeout(3500)
    await r.page.screenshot({ path: path.join(OUT, name + '.png') })
    console.log('  ✓', name + '.png')
    const probe = await r.page.evaluate(() => {
      const v = document.querySelector('video')
      const cb = document.querySelector('.coach-bar')
      const c = document.querySelector('.coach-bar canvas')
      return {
        coach: !!window.__coach,
        coachBar: !!cb,
        coachCanvas: c ? c.width + 'x' + c.height : null,
        figurePoints: document.querySelectorAll('[data-p]').length,
        video: v ? v.videoWidth + 'x' + v.videoHeight + ' ready=' + v.readyState + ' paused=' + v.paused : null,
      }
    })
    notes.push(`${name} probe = ` + JSON.stringify(probe))
    await r.page.close()
  }

  fs.writeFileSync(path.join(OUT, 'capture-notes.txt'), notes.join('\n'), 'utf8')
  console.log('\n---- notes ----\n' + notes.join('\n'))
  await browser.close()
})()
