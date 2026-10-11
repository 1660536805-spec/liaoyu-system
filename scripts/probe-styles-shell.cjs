/* 三拳种主壳取证探针（只读预览服务，产物落到 outputs/style-shell/）。
   覆盖：首页模式条（4 段是否溢出）/ 练习准备页 / 跟练示例页 / 结束页 / 版本信息・帮助浮层 /
        s4 跳转地址（s4url）/ 进度点滑窗。
   本机预览：node scripts/preview-all.cjs 5400 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5400'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(__dirname, '..', 'outputs', 'style-shell')
fs.mkdirSync(OUT, { recursive: true })

const STYLES = ['baduanjin', 'wuqinxi', 'taiji']
const EXPECT = {
  baduanjin: { name: '八段锦', full: 8, mode: 0, first: '双手托天理三焦', short: true },
  wuqinxi: { name: '五禽戏', full: 10, mode: 1, first: '虎举', short: false },
  taiji: { name: '太极拳', full: 24, mode: 2, first: '起势', short: false },
}

const report = { base: BASE, generatedAt: new Date().toISOString(), checks: {}, shots: [] }
let fails = 0
function chk(name, ok, detail) {
  report.checks[name] = { ok: !!ok, detail: detail === undefined ? null : detail }
  if (!ok) { fails++; console.log('  ✗', name, detail === undefined ? '' : JSON.stringify(detail)) }
  else console.log('  ✓', name, detail === undefined ? '' : JSON.stringify(detail))
}

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const ctx = await b.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  ctx.on('page', (pg) => { pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) }) })

  for (const st of STYLES) {
    const e = EXPECT[st]
    console.log('\n=== ' + st + ' ===')
    const p = await ctx.newPage()

    /* ---- 首页：模式条 4 段 ---- */
    await p.goto(BASE + '/?screen=home', { waitUntil: 'networkidle' })
    await p.waitForSelector('.modebar .mseg')
    const home = await p.evaluate(() => {
      const bar = document.querySelector('.modebar')
      const segs = Array.from(bar.querySelectorAll('.mseg'))
      const cs = getComputedStyle(bar)
      const avail = bar.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      return {
        n: segs.length,
        labels: segs.map((s) => s.querySelector('b').textContent.trim()),
        descs: segs.map((s) => (s.querySelector('.tx span') ? s.querySelector('.tx span').textContent.trim() : '')),
        onIdx: segs.findIndex((s) => s.classList.contains('on')),
        sum: +segs.reduce((a, s) => a + s.getBoundingClientRect().width, 0).toFixed(1),
        avail: +avail.toFixed(1),
        overflowX: bar.scrollWidth > bar.clientWidth + 1,
        rows: new Set(segs.map((s) => Math.round(s.getBoundingClientRect().top))).size,
      }
    })
    chk(st + '.home.segCount=4', home.n === 4, home.n)
    chk(st + '.home.labels', JSON.stringify(home.labels) === JSON.stringify(['八段锦', '五禽戏', '太极拳', '帮我选']), home.labels)
    chk(st + '.home.noOverflowX', !home.overflowX, { sum: home.sum, avail: home.avail, rows: home.rows })
    chk(st + '.home.singleRow', home.rows === 1, home.rows)
    const sh = path.join(OUT, 'home-' + st + '.png')
    await p.locator('.modebar').screenshot({ path: sh }); report.shots.push(path.relative(process.cwd(), sh))

    /* ---- 练习准备页 ---- */
    await p.goto(BASE + '/?screen=intro&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('.mode-grid')
    const intro = await p.evaluate(() => {
      const grid = document.querySelector('.mode-grid')
      const cards = Array.from(grid.querySelectorAll('.modecard')).map((c) => ({
        tt: c.querySelector('.tt').textContent.replace(/\s+/g, ' ').trim(),
        meta: c.querySelector('.meta').textContent.trim(),
        w: +c.getBoundingClientRect().width.toFixed(1),
      }))
      return { one: grid.classList.contains('one'), cols: getComputedStyle(grid).gridTemplateColumns, cards, stateMode: window.__xy.state.mode, imode: window.__xy.state.imode }
    })
    chk(st + '.intro.mode=' + e.mode, intro.stateMode === e.mode, intro.stateMode)
    chk(st + '.intro.fullN=' + e.full, intro.cards.some((c) => c.tt.includes('全套 ' + e.full + ' 式')), intro.cards.map((c) => c.tt))
    chk(st + '.intro.shortCard', e.short ? intro.cards.length === 2 && intro.cards[1].tt.includes('招牌 3 式') : intro.cards.length === 1 && intro.one, intro.cards.length)
    const si = path.join(OUT, 'intro-' + st + '.png')
    await p.locator('.mode-grid').screenshot({ path: si }); report.shots.push(path.relative(process.cwd(), si))

    /* ---- s4url ---- */
    const url = await p.evaluate(() => {
      const el = document.querySelector('[data-a="start-practice"]')
      // 不真的跳转：复算一遍地址规则（与 app.js s4url 同式）
      const st = window.__xy.curStyle(), s = window.__xy.state
      return 's4/#/train?stage=' + ((['point', 'line', 'arc'])[s.istage] || 'point') + '&mode=' + (s.imode === 1 ? 'short' : 'full') + '&style=' + st.id + '&tone=gong'
    })
    chk(st + '.s4url.style=' + st, url.includes('style=' + st), url)

    /* ---- 跟练示例页（含进度点滑窗） ---- */
    await p.goto(BASE + '/?screen=intro&style=' + st, { waitUntil: 'networkidle' })
    await p.click('[data-a="demo"]')
    await p.waitForSelector('.pdots')
    const pr = await p.evaluate(() => {
      const dots = document.querySelectorAll('.pdots .d')
      const bar = document.querySelector('.pdots')
      return {
        n: dots.length,
        text: Array.from(dots).map((d) => d.textContent),
        on: Array.from(dots).findIndex((d) => d.classList.contains('on')),
        overflow: bar.scrollWidth > bar.clientWidth + 1,
        head: (document.querySelector('.pinfo h3') || {}).textContent,
        cur: (document.querySelector('.pinfo .cur') || {}).textContent,
      }
    })
    chk(st + '.practice.dots<=8', pr.n <= 8, { n: pr.n, text: pr.text.join(',') })
    chk(st + '.practice.noOverflow', !pr.overflow, { sw: pr.n })
    chk(st + '.practice.first=' + e.first, (pr.head || '').includes(e.first), pr.head)
    const sp = path.join(OUT, 'practice-' + st + '.png')
    await p.locator('.pdots').screenshot({ path: sp }); report.shots.push(path.relative(process.cwd(), sp))

    /* 动作要点浮层（切到第 2 式再开） */
    await p.click('[data-a="next-step"]')
    await p.click('.sitem[data-i="2"]')
    await p.waitForSelector('.xs.show')
    const sideTxt = await p.evaluate(() => document.querySelector('.xs-b').textContent.replace(/\s+/g, ' ').trim().slice(0, 120))
    chk(st + '.side.points', sideTxt.length > 8, sideTxt)
    const ss = path.join(OUT, 'side-' + st + '.png')
    await p.locator('.xs-panel').screenshot({ path: ss }); report.shots.push(path.relative(process.cwd(), ss))
    await p.click('.xs-x').catch(() => {})
    await p.evaluate(() => document.querySelectorAll('.xs.show').forEach((x) => x.classList.remove('show')))

    /* ---- 结束页 ---- */
    await p.goto(BASE + '/?screen=done&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('.done-h')
    const done = await p.evaluate(() => ({
      h: document.querySelector('.done-h').textContent.trim(),
      track: (document.querySelector('.trackcard .tx span') || {}).textContent,
      fretRows: document.querySelectorAll('.fret .srow').length,
    }))
    chk(st + '.done.head', done.h.length > 0, done)
    chk(st + '.done.trackHasN=' + e.full, (done.track || '').includes(e.full + ' 式预览'), done.track)
    const sd = path.join(OUT, 'done-' + st + '.png')
    await p.screenshot({ path: sd, fullPage: false }); report.shots.push(path.relative(process.cwd(), sd))

    /* ---- 版本信息 / 帮助浮层 ---- */
    const sheets = await p.evaluate(() => ({ about: window.__xy.sheets.about(), help: window.__xy.sheets.help() }))
    chk(st + '.about.noWuqinxiGap', !sheets.about.includes('五禽戏素材'), null)
    chk(st + '.about.threeStyles', sheets.about.includes('五禽戏 10 式') && sheets.about.includes('太极拳 24 式'), null)
    chk(st + '.help.styleSwitch', sheets.help.includes('三套功法怎么换'), null)

    /* ---- 分享图（canvas 不出画布） ---- */
    await p.goto(BASE + '/?screen=done&style=' + st, { waitUntil: 'networkidle' })
    const shot = await p.evaluate(() => {
      // shareCard 未直接暴露，用分享浮层触发
      document.querySelector('[data-a="share-sheet"]').click()
      const img = document.querySelector('.xs-shot')
      return img ? img.src.length : 0
    })
    chk(st + '.share.dataUrl', shot > 1000, shot)
    await p.waitForSelector('.xs-shot')
    const ssh = path.join(OUT, 'share-' + st + '.png')
    await p.locator('.xs-shot').screenshot({ path: ssh }); report.shots.push(path.relative(process.cwd(), ssh))

    /* ---- 分享图排版几何：末行不得压到页脚 ---- */
    const geom = await p.evaluate(() => window.__xy.shareGeom(window.__xy.curStyle().full))
    chk(st + '.share.geom.cols=' + geom.cols, geom.cols === (e.full > 12 ? 2 : 1), geom)
    chk(st + '.share.noFooterOverlap', geom.yLast <= geom.footerTop - 20, geom)
    chk(st + '.share.stepWithin[30,84]', geom.step >= 30 && geom.step <= 84, geom.step)

    /* ---- 首页「今日推荐」卡随拳种 ---- */
    await p.goto(BASE + '/?screen=home&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('.rec-cols .l h4')
    const recT = await p.evaluate(() => document.querySelector('.rec-cols .l h4').textContent.trim())
    chk(st + '.home.rec=' + e.name, recT.startsWith(e.name + ' · '), recT)

    /* ---- 「我的」页：阶段进度随拳种 ---- */
    await p.goto(BASE + '/?screen=profile&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('.halfgrid')
    const prof = await p.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.halfgrid .card.half'))
      const stage = cards.find((c) => c.textContent.includes('阶段进度'))
      const box = stage.querySelector('.dots8')
      const dots = box.querySelectorAll('i')
      return {
        title: stage.querySelector('p').textContent.trim(),
        note: stage.querySelectorAll('p')[1].textContent.trim(),
        dotN: dots.length,
        onN: Array.from(dots).filter((d) => d.classList.contains('on')).length,
        wrap: box.classList.contains('wrap'),
        pill: document.querySelector('.stagepill').textContent.replace(/\s+/g, ' ').trim(),
        overflow: document.querySelector('.halfgrid').scrollWidth > document.querySelector('.halfgrid').clientWidth + 1,
      }
    })
    chk(st + '.profile.title', prof.title === e.name + '·中级阶段', prof.title)
    chk(st + '.profile.note', prof.note === '已完成 3 / ' + e.full + ' 节', prof.note)
    chk(st + '.profile.dots=' + e.full, prof.dotN === e.full, prof.dotN)
    chk(st + '.profile.dotsOn=3', prof.onN === 3, prof.onN)
    chk(st + '.profile.wrap=' + (e.full > 8), prof.wrap === (e.full > 8), prof.wrap)
    chk(st + '.profile.stagepill', prof.pill.includes(e.name), prof.pill)
    chk(st + '.profile.noOverflowX', !prof.overflow, prof.overflow)
    const spf = path.join(OUT, 'profile-' + st + '.png')
    await p.screenshot({ path: spf, fullPage: false }); report.shots.push(path.relative(process.cwd(), spf))

    /* ---- 问询页快捷 chips 随拳种 ---- */
    await p.goto(BASE + '/?screen=inquiry&style=' + st, { waitUntil: 'networkidle' })
    await p.waitForSelector('.ask-chip')
    const chip = await p.evaluate(() => document.querySelector('.ask-chip').textContent.trim())
    chk(st + '.inquiry.chip=' + e.name, chip.startsWith(e.name), chip)

    await p.close()
  }

  chk('console.errors=0', errors.length === 0, errors.slice(0, 5))
  await b.close()
  report.fails = fails
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log('\n==> fails=' + fails + '  产物 ' + path.relative(process.cwd(), OUT))
  process.exit(fails ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
