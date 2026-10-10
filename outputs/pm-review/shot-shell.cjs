/* 主壳逐屏截图（手机档 / 桌面档通用）。
 *
 * 用法：node outputs/pm-review/shot-shell.cjs <输出目录> [宽] [高] [dpr] [fullPage?]
 *   例：node outputs/pm-review/shot-shell.cjs outputs/pm-review/dt-before 470 900 2 0
 *       node outputs/pm-review/shot-shell.cjs outputs/pm-review/dt-desk   1440 900 1 1
 *
 * 环境变量
 *   DT_BLOCK=1   用路由把 /desktop.css /desktop.js 直接 abort —— 等价于「没有桌面层」
 *                的改前状态，不必真的把 index.html 改回去再采集。
 *   DT_REDUCED=1 强制 prefers-reduced-motion:reduce —— loading 页有浮动音符/花瓣/转圈，
 *                默认连采两次就能差几千像素；关掉动效后 9 屏都是确定的，回归判定才有分辨率。
 *
 * 顺带打印：横向溢出量、控制台报错。桌面档同时把每屏的「可见区块高度」打出来，
 * 便于判断有没有把手机竖排硬拉成桌面（内容是否真的铺开了）。
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'dt-after'))
const W = Number(process.argv[3] || 470)
const H = Number(process.argv[4] || 900)
const DPR = Number(process.argv[5] || 2)
const FULL = process.argv[6] === '1'
const BLOCK = process.env.DT_BLOCK === '1'
const REDUCED = process.env.DT_REDUCED === '1'

/* 逐屏清单：默认 9 屏（不含后加的 inquiry，以免作废既有的 9 屏回归基线）；
   需要连 inquiry 一起采时用 PM_SCREENS=... 覆盖。 */
const SCREENS = (process.env.PM_SCREENS
  ? process.env.PM_SCREENS.split(',')
  : ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']
).map((s) => s.trim()).filter(Boolean)

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: DPR,
    reducedMotion: REDUCED ? 'reduce' : 'no-preference',
  })
  if (BLOCK) await page.route('**/desktop.*', (r) => r.abort())
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  console.log(`viewport ${W}x${H} @${DPR}x  fullPage=${FULL ? 'yes' : 'no'}  desktop=${BLOCK ? 'BLOCKED' : 'on'}  motion=${REDUCED ? 'reduce' : 'normal'}  ->  ${OUT}`)
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 1200 : 500)
    const m = await page.evaluate(() => {
      const de = document.documentElement
      const main = document.querySelector('#app main') || document.querySelector('main')
      const kids = main ? Array.from(main.children).map((n) => {
        const r = n.getBoundingClientRect()
        return { c: n.className && typeof n.className === 'string' ? n.className.split(' ')[0] : n.tagName.toLowerCase(), t: Math.round(r.top), h: Math.round(r.height) }
      }) : []
      return {
        scrollW: de.scrollWidth, clientW: de.clientWidth,
        docH: de.scrollHeight,
        shellW: main ? Math.round(main.getBoundingClientRect().width) : 0,
        kids,
      }
    })
    await page.screenshot({ path: path.join(OUT, `shell-${s}.png`), fullPage: FULL })
    const ov = m.scrollW - m.clientW
    console.log(`  ${s.padEnd(9)} 文档高 ${String(m.docH).padStart(5)}  main宽 ${String(m.shellW).padStart(4)}  横向溢出 ${ov}`)
    if (ov > 1) console.log('       ⚠ 横向溢出：' + ov + 'px')
    if (s === 'home' || s === 'practice' || s === 'done') {
      console.log('       区块: ' + m.kids.map((k) => `${k.c}@${k.t}+${k.h}`).join('  '))
    }
  }
  console.log('console-errors: ' + (errs.length ? errs.join(' | ') : 'none'))
  await browser.close()
  process.exit(errs.length ? 2 : 0)
})()
