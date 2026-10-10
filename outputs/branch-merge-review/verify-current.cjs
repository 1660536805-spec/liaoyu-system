/* HEAD 回归基线：把「当前 HEAD 的渲染结果」固化为基准，之后任何改动都拿它对比。
 *
 * 为什么要另起一支（而不是沿用 verify-song-merge / verify-inquiry）：
 *   那两支是「特定轮次」的存档，它们把改前快照写死（dom-navfix.json / dom-song.json），
 *   语义是「这一轮相对上一轮只准出现这一处增删」。一旦后续提交合法地又改了同一个屏，
 *   它们必然报假阳性；更糟的是它们的 POST 会覆盖别人的 PRE 基线
 *   （verify-song-merge 的 POST 就是 dom-song.json，正是 verify-inquiry 的 PRE）。
 *   本脚本改成「自更新基线」：--update 时把当前渲染存为基准，之后就要求逐字符复现。
 *
 * 双档：mobile 470×900(dsf2) 与 desktop 1280×900。桌面档是 7be5159 新增的
 *   desktop.css/desktop.js（≥960px 惰性注入侧栏 + 分列），必须一并钉住，
 *   否则以后改坏桌面档没人会发现。
 *
 * 归一化随时间漂移的字段（否则过一天就假阳）：
 *   主壳首页有三处由「当天日期 / 节气」算出 ——
 *     <div class="jq">今日 · <span class="o">寒露</span></div>   ← 节气名
 *     <div class="date">10月11日 农历九月初二</div>              ← 公历+农历
 *     <p class="desc">露气寒冷，将凝为霜，…</p>                  ← 节气养生文案
 *   这三处是「输入随日期变」，不是「代码变了」，剔除后再比对；当前取值仍打印出来可见。
 *   （本轮就踩到了：基线采于 10-10，复跑已是 10-11。）
 *
 * 另一道自检（防止验收本身失效）：服务端 /app.js 的 sha256 必须等于仓库 dist/app.js，
 *   否则验的根本不是线上那一份（预览服务缓存/构建残留时会发生）。
 *
 * 用法：
 *   node outputs/branch-merge-review/verify-current.cjs            # 与基线比对（回归，只读）
 *   node outputs/branch-merge-review/verify-current.cjs --update    # 重新捕获基线
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')

const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = __dirname
const APPJS = path.resolve(DIR, '../../dist/app.js')
const BASELINE = path.join(DIR, 'dom-baseline.json')
const UPDATE = process.argv.includes('--update')

const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body', 'inquiry']
const NAV_SCREENS = ['audio', 'home', 'profile']
const VIEWPORTS = [
  { name: 'mobile', width: 470, height: 900, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1 },
]
const ROOT = () => document.body.outerHTML   // 用 body：桌面层注入的 .dt-side 也在快照内

/* ---------- 归一化：剔除随日期漂移的字段（只 home 有）---------- */
function normalize(html, screen) {
  if (screen !== 'home') return html
  return html
    .replace(/(<div class="jq">)[\s\S]*?(<\/div>)/, '$1__JQ__$2')
    .replace(/(<div class="date">)[\s\S]*?(<\/div>)/, '$1__DATE__$2')
    .replace(/(<p class="desc">)[\s\S]*?(<\/p>)/, '$1__DESC__$2')
}
function volatileOf(html) {
  const g = (re) => { const m = html.match(re); return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null }
  return {
    jq: g(/<div class="jq">([\s\S]*?)<\/div>/),
    date: g(/<div class="date">([\s\S]*?)<\/div>/),
    desc: g(/<p class="desc">([\s\S]*?)<\/p>/),
  }
}

/* ---------- 标签块计数式 diff（沿用既有脚本，便于人读「增/删多少块」）---------- */
function blocks(html) { return html.split(/(?=<)/).filter((x) => x.length) }
function diff(oldH, newH) {
  const A = blocks(oldH), B = blocks(newH)
  const ca = new Map(), cb = new Map()
  for (const x of A) ca.set(x, (ca.get(x) || 0) + 1)
  for (const x of B) cb.set(x, (cb.get(x) || 0) + 1)
  const add = [], del = []
  for (const [k, n] of cb) if (n > (ca.get(k) || 0)) add.push({ s: k, n: n - (ca.get(k) || 0) })
  for (const [k, n] of ca) if (n > (cb.get(k) || 0)) del.push({ s: k, n: n - (cb.get(k) || 0) })
  return { add, del }
}
const clip = (s, n) => s.replace(/\s+/g, ' ').slice(0, n || 140)
let bad = 0
const ok = (c, m) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + m); if (!c) bad++ }

async function capture(page, vp) {
  const res = { screens: {}, volatile: {} }
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 2600 : 700)
    if (vp.name === 'desktop') {
      /* 桌面层是「渲染后」注入，必须等它就绪再抓，否则抓到的是未分列的原生单列 */
      await page.waitForFunction(
        () => document.documentElement.classList.contains('dt') && !!document.querySelector('.dt-side'),
        null, { timeout: 5000 },
      ).catch(() => {})
      await page.waitForTimeout(350)
    }
    const html = await page.evaluate(ROOT)
    res.screens[s] = html
    res.volatile[s] = volatileOf(html)      // 只有 home 会被 normalize 用到
  }
  return res
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const errs = []
  const repoBuf = fs.readFileSync(APPJS)
  const repoSha = crypto.createHash('sha256').update(repoBuf).digest('hex')

  /* ---------- 自检 ①：服务端 app.js 必须就是仓库那份 ---------- */
  const probe = await browser.newPage()
  await probe.goto(BASE + '/', { waitUntil: 'load' })
  const serveSha = await probe.evaluate(async () => {
    const t = await (await fetch('/app.js', { cache: 'no-store' })).text()
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('')
  })
  await probe.close()
  console.log('== 自检 · 服务的 app.js 就是仓库那份 ==')
  ok(serveSha === repoSha, `sha256 一致（repo=${repoSha.slice(0, 12)}… / serve=${serveSha.slice(0, 12)}…）`)

  /* ---------- 采集双档 ---------- */
  const out = { at: new Date().toISOString(), views: {}, appCssLen: {} }
  try { out.head = execSync('git rev-parse --short HEAD', { cwd: path.resolve(DIR, '../..') }).toString().trim() } catch (e) { out.head = 'unknown' }
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor })
    page.on('console', (m) => { if (m.type() === 'error') errs.push(vp.name + ': ' + m.text()) })
    page.on('pageerror', (e) => errs.push(vp.name + ' pageerror: ' + e.message))
    await page.goto(BASE + '/', { waitUntil: 'load' })
    await page.waitForTimeout(900)
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    out.views[vp.name] = await capture(page, vp)
    out.appCssLen[vp.name] = await page.evaluate(async () => (await (await fetch('/app.css')).text()).length)
    /* 桌面档额外结构断言 */
    if (vp.name === 'desktop') {
      await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
      await page.waitForTimeout(1200)
      const d = await page.evaluate(() => {
        const nav = document.querySelector('.nav')
        const side = document.querySelector('.dt-side')
        const btns = side ? [...side.querySelectorAll('.dt-nav button')] : []
        return {
          dt: document.documentElement.classList.contains('dt'),
          side: !!side,
          sideNav: btns.length,
          first5: btns.slice(0, 5).map((b) => b.getAttribute('data-a')).join(','),
          extra: btns.slice(5).map((b) => b.getAttribute('data-a') + '=' + b.textContent.replace(/\s+/g, '').trim()).join(','),
          navHidden: nav ? getComputedStyle(nav).display === 'none' : null,
          cols: document.querySelectorAll('main > .dt-col').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      console.log('\n== 桌面档结构（≥960px，来自 7be5159）==')
      ok(d.dt && d.side, 'html.dt 已置位、.dt-side 侧栏在场')
      /* 侧栏 = 底部那 5 项 + 桌面专属「身体数据」(go-body，手机档该入口在「我的」里) */
      ok(d.sideNav === 6, '侧栏主导航 = ' + d.sideNav + ' 项（底部 5 项 + 桌面专属 ' + d.extra + '）')
      ok(d.first5 === 'nav-home,nav-audio,nav-intro,nav-inquiry,nav-profile', '侧栏前 5 项与底部导航顺序一致：' + d.first5)
      ok(d.navHidden === true, '底部导航在桌面档已隐藏')
      ok(d.cols >= 1, 'home 已分列：main > .dt-col ×' + d.cols)
      ok(d.overflow <= 1, '横向无溢出（scrollWidth − clientWidth = ' + d.overflow + 'px）')
    }
    await page.close()
  }

  if (UPDATE || !fs.existsSync(BASELINE)) {
    fs.writeFileSync(BASELINE, JSON.stringify(out, null, 1), 'utf8')
    console.log(`\n== 已写入基线 ${path.basename(BASELINE)} @ HEAD ${out.head}（${VIEWPORTS.map((v) => v.name).join(' + ')}）==`)
    for (const vp of VIEWPORTS) {
      const v = out.views[vp.name].volatile.home
      console.log(`  (归一化旁路) ${vp.name} home: 节气=${v.jq} / 日期=${v.date}`)
    }
  }

  const pre = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  pre.views = pre.views || {}                       // 兼容旧的单档基线
  if (!pre.views.mobile && pre.screens) pre.views.mobile = { screens: pre.screens, volatile: pre.volatile || {} }

  /* ---------- 证据一 · 逐屏 DOM（归一化后逐字符），双档 ---------- */
  for (const vp of VIEWPORTS) {
    const p = pre.views[vp.name]
    console.log(`\n== 证据一 · [${vp.name} ${vp.width}×${vp.height}] 逐屏 DOM 逐字符比对（基线 HEAD ${pre.head} → 当前 HEAD ${out.head}）==`)
    if (!p) { ok(false, '基线中缺 ' + vp.name + ' 档（请 --update 重建）'); continue }
    for (const s of SCREENS) {
      const a = p.screens[s], b = out.views[vp.name].screens[s]
      if (a === undefined) { ok(b && b.length > 0, s + ' 为基线中不存在的新屏（' + (b ? b.length : 0) + ' 字符）'); continue }
      if (b === undefined) { ok(false, s + ' 当前采集缺失'); continue }
      const na = normalize(a, s), nb = normalize(b, s)
      if (na === nb) {
        const note = (s === 'home' && p.volatile.home && out.views[vp.name].volatile.home)
          ? `（旁路日期 ${p.volatile.home.date} → ${out.views[vp.name].volatile.home.date}）` : ''
        console.log('  ✓ ' + s.padEnd(9) + ' 逐字符相同' + note)
        continue
      }
      const d = diff(na, nb)
      const addN = d.add.reduce((t, x) => t + x.n, 0), delN = d.del.reduce((t, x) => t + x.n, 0)
      console.log('  ✗ ' + s.padEnd(9) + ' 意外变化 +' + addN + ' / -' + delN + ' 块')
      d.add.slice(0, 6).forEach((x) => console.log('        + [' + x.n + '] ' + clip(x.s)))
      d.del.slice(0, 6).forEach((x) => console.log('        - [' + x.n + '] ' + clip(x.s)))
      bad++
    }
    const ca = pre.appCssLen && pre.appCssLen[vp.name] || '?'
    const cb = out.appCssLen[vp.name]
    console.log('  app.css ' + ca + ' → ' + cb + ' 字符  ' + (ca === cb ? '（未变）' : '（已变，非致命；若伴随 DOM 变化请一并核对）'))
  }

  /* ---------- 证据二 · 导航结构（手机档）---------- */
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  console.log('\n== 证据二 · 导航结构（首页/音疗/开始练/问询/我的，开始练居中）==')
  for (const s of NAV_SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const items = await page.$$eval('.nav .nitem', (els) => els.map((e) => e.textContent.replace(/\s+/g, '')))
    ok(items.length === 5, s + ' nav 项数 = ' + items.length + '  [' + items.join(' | ') + ']')
    ok(items[2] === '开始练', s + ' 第 3 项（居中）仍是「开始练」')
  }

  /* ---------- 证据三 · 问询交互往返 ---------- */
  console.log('\n== 证据三 · 问询页交互往返 ==')
  await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
  await page.waitForTimeout(600)
  await page.click('[data-a="nav-inquiry"]')
  await page.waitForTimeout(500)
  const nav = await page.evaluate(() => ({
    on: (document.querySelector('.nav .nitem.on') || {}).textContent || null,
    hasList: !!document.querySelector('#ask-list'),
    seeded: (window.__xy.state.ask.msgs || []).length,
  }))
  ok(nav.on && nav.on.replace(/\s+/g, '') === '问询', '点「问询」→ 高亮切到「问询」（读高亮，因 go() 不改 URL）')
  ok(nav.hasList && nav.seeded === 2, '对话区存在、种子消息 2 条')
  await page.fill('#ask-input', '八段锦第一式注意什么？')
  await page.click('[data-a="ask-send"]')
  await page.waitForTimeout(900)
  const sent = await page.evaluate(() => ({
    n: document.querySelectorAll('#ask-list .ask-b').length,
    msgs: window.__xy.state.ask.msgs.map((m) => m.who + ':' + m.text.slice(0, 16)),
    empty: document.querySelector('#ask-input').value === '',
    last: (document.querySelector('#ask-list .ask-row:last-child .ask-b') || {}).textContent || '',
  }))
  ok(sent.n === 4 && sent.msgs[2].startsWith('u:') && sent.msgs[3].startsWith('a:'), '发送 → 追加用户 + 智能体占位（共 ' + sent.n + ' 气泡）')
  ok(sent.empty, '发送后输入框清空')
  ok(/本地占位/.test(sent.last), '占位回复标注「本地占位」')
  await page.click('.ask-chip')
  ok((await page.$eval('#ask-input', (e) => e.value)).length > 0, '快捷问句点击 → 填入输入框')
  const before = await page.evaluate(() => window.__xy.state.ask.msgs.length)
  await page.focus('#ask-input')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  ok((await page.evaluate(() => window.__xy.state.ask.msgs.length)) === before + 2, '回车即发送')

  /* ---------- 证据四 · 曲库仍是 3 首且第 3 首有音源 ---------- */
  console.log('\n== 证据四 · 曲库（3 首，第 3 首＝七弦散音）==')
  await page.goto(BASE + '/?screen=audio', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  const tracks = await page.$$eval('.track', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
  ok(tracks.length === 3, '音疗页曲目行 = ' + tracks.length + ' 条')
  await page.click('.track:nth-child(3) [data-a="play"]').catch(() => {})
  await page.waitForTimeout(1400)
  const st = await page.evaluate(() => {
    const a = window.__xy.AUDIO.mus
    return { n: window.__xy.TRACKS.length, src: a ? a.src : null, dur: a ? a.duration : null, paused: a ? a.paused : null, key: a ? a.dataset.key : null }
  })
  ok(st.n === 3 && st.key === 'sanyin' && /qixian-sanyin\.mp3$/.test(st.src || '') && st.dur > 6 && st.dur < 9 && st.paused === false,
    'TRACKS=' + st.n + ' / key=' + st.key + ' / ' + (st.src || '').split('/').pop() + ' / ' + (st.dur != null ? st.dur.toFixed(2) + 's' : '-') + ' / paused=' + st.paused)

  console.log('\n控制台报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''))
  if (errs.length) bad++
  console.log('\n' + (bad === 0 ? '===== 全部通过 =====' : '===== 有 ' + bad + ' 项不符 ====='))
  await browser.close()
  process.exit(bad === 0 ? 0 : 1)
})()
