/* ============================================================================
 * verify-kit.cjs —— 房间版小人套件的验收探针（只读，不改产物）
 * ----------------------------------------------------------------------------
 * 跑法：BASE=http://127.0.0.1:5423 node outputs/room-figure-kit/verify-kit.cjs
 * 覆盖四件事：
 *   1) 装配：两张小人（本体 + 倒影）都画出来了、18 层肢体可见、无 console/page 错误
 *   2) 逐式：两个拳种每一式都渲染一帧（签名姿态）→ 出对照图
 *   3) 循环：任取两式连采 24 帧 → 供帧间差/循环连续性分析
 *   4) 独立性：只改一个关节（lean）⇒ 其余关节必须逐字节不变；
 *              只关一层肢体 ⇒ 该层 display:none、其余层不动
 *   5) 跨屏：桌面 1440 / 手机 390 各一张，校验等比缩放后仍清晰（矢量 ⇒ 无位图放大）
 * ========================================================================== */
'use strict'
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const BASE = process.env.BASE || 'http://127.0.0.1:5423'
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = __dirname
const SHOTS = path.join(ROOT, 'shots')
const OUT = path.join(ROOT, 'verify.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n, w) => String(n).padStart(w, '0')

/* 收紧到「小人本人」：.rfk-taiji 是 480x240 的整格（viewBox -100 150 600 300），
   人物只占中间一条；直接截整格会让缩略图里小人很小。
   横取 0.26~0.74（viewBox 56~344，含鸟飞/单鞭这种手臂全开），纵取 -0.05~1.01（含过顶的手与地面影）。 */
function tightClip(box) {
  return {
    x: Math.max(0, box.x + box.width * 0.26),
    y: Math.max(0, box.y - box.height * 0.05),
    width: box.width * 0.48,
    height: box.height * 1.06,
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-device-scale-factor=2'] })
  const out = { base: BASE, chrome: CHROME, desktop: {}, mobile: {}, moves: [], loop: [], independence: {}, errors: [] }

  /* ---------------------------------------------------- 桌面档 */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

  await page.goto(BASE + '/demo.html', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.RFK && window.RFK.player, null, { timeout: 15000 })
  await sleep(1200)

  out.desktop.facts = await page.evaluate(() => window.RFK.facts())
  await page.screenshot({ path: path.join(SHOTS, 'desktop-full.png'), fullPage: true })
  await page.locator('#stage').screenshot({ path: path.join(SHOTS, 'desktop-stage.png') })

  /* 每个拳种、每一式：暂停 → 无混合跳转 → 取签名帧 */
  const styles = await page.evaluate(() => Object.keys(window.RFK.K.libraries()))
  for (const st of styles) {
    const total = await page.evaluate((s) => { window.RFK.setStyle(s); return window.RFK.player.total }, st)
    for (let i = 0; i < total; i++) {
      const info = await page.evaluate(({ s, i }) => {
        const p = window.RFK.player
        p.pause()
        p.goto(i, { playing: false, blend: false })
        p.seek(0.62)
        p.renderOnce()
        const mv = p.move()
        return { style: s, index: i, name: mv && mv.name, desc: mv && mv.desc, dur: mv && mv.dur }
      }, { s: st, i })
      await sleep(180)
      const box = await page.evaluate(() => {
        const el = document.querySelector('#stage .rfk-layer:not(.rfk-reflect) .rfk-taiji')
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      })
      const clip = tightClip(box)
      const file = path.join(SHOTS, `pose-${st}-${pad(i, 2)}.png`)
      await page.screenshot({ path: file, clip })
      out.moves.push(Object.assign({}, info, { file: path.relative(ROOT, file) }))
    }
  }

  /* 循环连续性：各取两式连采 24 帧（blend 关、逐帧 seek） */
  const loopCases = [{ style: 'wuqinxi', index: 1 }, { style: 'taiji', index: 6 }]
  for (const c of loopCases) {
    await page.evaluate(({ s }) => window.RFK.setStyle(s), { s: c.style })
    for (let k = 0; k < 24; k++) {
      const u = k / 24
      await page.evaluate(({ i, u }) => {
        const p = window.RFK.player
        p.pause(); p.goto(i, { playing: false, blend: false }); p.seek(u); p.renderOnce()
      }, { i: c.index, u })
      const box = await page.evaluate(() => {
        const el = document.querySelector('#stage .rfk-layer:not(.rfk-reflect) .rfk-taiji')
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      })
      const file = path.join(SHOTS, `loop-${c.style}-${pad(c.index, 2)}-${pad(k, 2)}.png`)
      await page.screenshot({ path: file, clip: tightClip(box) })
      out.loop.push({ style: c.style, index: c.index, k, u: Number(u.toFixed(4)), file: path.relative(ROOT, file) })
    }
  }

  /* 独立性 A：只改 lean，其余关节必须原样 */
  out.independence.joint = await page.evaluate(() => {
    const p = window.RFK.player
    p.pause(); window.RFK.setStyle('taiji'); p.goto(5, { playing: false, blend: false }); p.seek(0.4); p.renderOnce()
    const before = JSON.parse(JSON.stringify(p.currentState()))
    const drewBefore = JSON.parse(JSON.stringify(window.RFK.fig.drawPose()))
    p.setOverride({ lean: 0.25 })
    const after = JSON.parse(JSON.stringify(p.currentState()))
    const drewAfter = JSON.parse(JSON.stringify(window.RFK.fig.drawPose()))
    p.clearOverride()
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    return {
      before: before, after: after,
      leanChanged: Math.abs(after.lean - before.lean - 0.25) < 1e-9,
      wristsUntouched: same(after.wrists, before.wrists),
      feetUntouched: same(after.feet, before.feet),
      rootUntouched: same(after.root, before.root),
      foldUntouched: after.fold === before.fold,
      headUntouched: after.headOff === before.headOff,
      drawPoseChanged: !same(drewBefore, drewAfter),
    }
  })

  /* 独立性 B：只关一层（trails）
     —— 必须读 getComputedStyle，不能只看元素在不在（v-show 会留隐藏元素） */
  out.independence.part = await page.evaluate(() => {
    const fig = window.RFK.fig
    const vis = (el) => getComputedStyle(el).display !== 'none'
    const list = fig.partNames
    const beforeAll = {}
    list.forEach((n) => { beforeAll[n] = vis(fig.parts[n]) })
    fig.parts.trails.style.display = 'none'
    const afterAll = {}
    list.forEach((n) => { afterAll[n] = vis(fig.parts[n]) })
    fig.parts.trails.style.display = ''
    const others = list.filter((n) => n !== 'trails')
    return {
      trailsHidden: afterAll.trails === false,
      othersIntact: others.every((n) => afterAll[n] === beforeAll[n]),
      countVisible: list.filter((n) => beforeAll[n]).length,
      total: list.length,
    }
  })

  /* 关节列表可寻址：逐个 setJoint 都能改、都无异常 */
  out.independence.jointNames = await page.evaluate(() => {
    const fig = window.RFK.fig, p = window.RFK.player
    p.pause(); window.RFK.setStyle('wuqinxi'); p.goto(0, { playing: false, blend: false }); p.seek(0.5); p.renderOnce()
    const res = {}
    const cases = {
      root: [126, 170], lean: 0.12, fold: 0.3, headOff: 6,
      wristL: [40, -60], wristR: [40, 60], footL: [100, 240], footR: [148, 250],
    }
    Object.keys(cases).forEach((n) => {
      try { fig.setJoint(n, cases[n], false); res[n] = 'ok' } catch (e) { res[n] = 'ERR: ' + e.message }
    })
    const st = fig.state()
    return { jointNames: fig.jointNames, result: res, sampleRoot: st.root }
  })

  await ctx.close()

  /* ---------------------------------------------------- 手机档 */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const mp = await mctx.newPage()
  mp.on('pageerror', (e) => consoleErrors.push('mobile pageerror: ' + e.message))
  await mp.goto(BASE + '/demo.html', { waitUntil: 'domcontentloaded' })
  await mp.waitForFunction(() => window.RFK && window.RFK.player, null, { timeout: 15000 })
  await mp.evaluate(() => { window.RFK.player.pause(); window.RFK.setStyle('taiji'); window.RFK.player.goto(7, { playing: false, blend: false }); window.RFK.player.seek(0.7); window.RFK.player.renderOnce() })
  await sleep(700)
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-full.png'), fullPage: true })
  await mp.locator('#stage').screenshot({ path: path.join(SHOTS, 'mobile-stage.png') })
  out.mobile.facts = await mp.evaluate(() => window.RFK.facts())
  await mctx.close()

  out.errors = consoleErrors
  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({
    desktopStage: out.desktop.facts && out.desktop.facts.stageBox,
    desktopFigures: out.desktop.facts && out.desktop.facts.figures,
    partsVisible: out.independence.part.countVisible + '/' + out.independence.part.total,
    jointIndependence: out.independence.joint,
    partIndependence: out.independence.part,
    moves: out.moves.length,
    loopFrames: out.loop.length,
    mobileScale: out.mobile.facts && out.mobile.facts.scale,
    errors: consoleErrors,
  }, null, 2))
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
