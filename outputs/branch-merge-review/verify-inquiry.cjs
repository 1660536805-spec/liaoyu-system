/* 「问询」智能体交互页 + 导航第 5 项的验收
 *
 * 证据一（静态 DOM 逐字符）：改动前快照(dom-song.json) vs 改动后 ——
 *   ① 8 个「无导航」屏（loading/question/intro/practice/done/body…）必须逐字符相同；
 *   ② 3 个「有导航」屏（home/audio/profile）必须只 +1 个 .nitem、0 删除；
 *   ③ 新屏 inquiry 出现。
 * 证据二（导航结构）：每屏 nav 项数 = 5，顺序 = 首页/音疗/开始练/问询/我的，且「开始练」居中(索引 2)。
 * 证据三（路由与交互）：点导航「问询」→ 高亮切到「问询」；?screen=inquiry 可直达；
 *   输入 + 发送 → 追加「用户」与「智能体占位」两条；快捷问句点击 → 填入输入框；回车可发送。
 * 证据四（诚实标注）：页脚与种子消息里确有「尚未接入模型服务 / 本地占位」字样。
 *
 * 用法：node outputs/branch-merge-review/verify-inquiry.cjs [改前快照.json]
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PM_PORT) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = __dirname
const PRE = path.resolve(process.argv[2] || path.join(DIR, 'dom-song.json'))
const POST = path.join(DIR, 'dom-inquiry.json')
const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body', 'inquiry']
const NAV_SCREENS = ['audio', 'home', 'profile']

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
const clip = (s, n) => s.replace(/\s+/g, ' ').slice(0, n || 130)
let bad = 0
const ok = (c, m) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + m); if (!c) bad++ }

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  /* ---------- 采集 ---------- */
  const out = { at: new Date().toISOString(), screens: {} }
  for (const s of SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(s === 'loading' ? 2600 : 700)
    out.screens[s] = await page.evaluate(() => (document.querySelector('.phone') || document.body).outerHTML)
  }
  out.appCssLen = await page.evaluate(async () => (await (await fetch('/app.css')).text()).length)
  fs.writeFileSync(POST, JSON.stringify(out, null, 1), 'utf8')

  /* ---------- 证据一 ---------- */
  const pre = JSON.parse(fs.readFileSync(PRE, 'utf8'))
  console.log('== 证据一 · 逐屏 DOM 逐字符比对（' + path.basename(PRE) + ' → 改后）==')
  for (const s of SCREENS) {
    const a = pre.screens[s], b = out.screens[s] || ''
    if (NAV_SCREENS.includes(s)) continue
    if (s === 'inquiry') { ok(a === undefined && b.length > 500, 'inquiry 为新屏（改前无、改后有 ' + b.length + ' 字符）'); continue }
    if (a === b) { console.log('  ✓ ' + s.padEnd(9) + ' 逐字符相同'); continue }
    const d = diff(a, b)
    console.log('  ✗ ' + s.padEnd(9) + ' 意外变化 +' + d.add.length + '/-' + d.del.length + ' 块')
    d.add.slice(0, 5).forEach((x) => console.log('        + ' + clip(x.s)))
    d.del.slice(0, 5).forEach((x) => console.log('        - ' + clip(x.s)))
    bad++
  }
  for (const s of NAV_SCREENS) {
    const d = diff(pre.screens[s], out.screens[s])
    const addN = d.add.reduce((t, x) => t + x.n, 0), delN = d.del.reduce((t, x) => t + x.n, 0)
    console.log('  Δ ' + s.padEnd(9) + ' +' + addN + ' / -' + delN + ' 块')
    d.add.slice(0, 8).forEach((x) => console.log('        + [' + x.n + '] ' + clip(x.s)))
    d.del.slice(0, 8).forEach((x) => console.log('        - [' + x.n + '] ' + clip(x.s)))
    ok(delN === 0 && addN > 0 && addN <= 16, s + '：0 删除、仅新增（导航第 5 项拆成 ' + addN + ' 个标签块）')
  }
  ok(pre.appCssLen > 0 && out.appCssLen > pre.appCssLen, 'app.css 体积 ' + pre.appCssLen + ' → ' + out.appCssLen + '（只增不改）')

  /* ---------- 证据二 · 导航结构 ---------- */
  console.log('\n== 证据二 · 导航结构 ==')
  for (const s of NAV_SCREENS) {
    await page.goto(BASE + '/?screen=' + s, { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const items = await page.$$eval('.nav .nitem', (els) => els.map((e) => e.textContent.replace(/\s+/g, '')))
    ok(items.length === 5, s + ' nav 项数 = ' + items.length + '  [' + items.join(' | ') + ']')
    ok(items[2] === '开始练', s + ' 第 3 项（居中）仍是「开始练」')
    ok(items.join() === '首页,音疗,开始练,问询,我的', s + ' 顺序 = 首页/音疗/开始练/问询/我的')
  }

  /* ---------- 证据三 · 路由与交互 ---------- */
  console.log('\n== 证据三 · 路由与交互 ==')
  await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
  await page.waitForTimeout(600)
  await page.click('[data-a="nav-inquiry"]')
  await page.waitForTimeout(500)
  const afterNav = await page.evaluate(() => ({
    on: (document.querySelector('.nav .nitem.on') || {}).textContent || null,
    hash: location.hash, search: location.search,
    hasList: !!document.querySelector('#ask-list'),
    seeded: (window.__xy.state.ask.msgs || []).length,
  }))
  ok(afterNav.on && afterNav.on.replace(/\s+/g, '') === '问询', '点「问询」后高亮切到「问询」（URL 不变，故读高亮）：on=' + afterNav.on + '')
  ok(afterNav.hasList, '问询页已渲染对话区 #ask-list')
  ok(afterNav.seeded === 2, '种子消息 2 条（1 条智能体欢迎 + 1 条未接入声明）')

  /* 发送 */
  await page.fill('#ask-input', '八段锦第一式注意什么？')
  await page.click('[data-a="ask-send"]')
  await page.waitForTimeout(900)
  const afterSend = await page.evaluate(() => ({
    n: (document.querySelectorAll('#ask-list .ask-b') || []).length,
    msgs: window.__xy.state.ask.msgs.map((m) => m.who + ':' + m.text.slice(0, 18)),
    inputVal: document.querySelector('#ask-input').value,
    last: (document.querySelector('#ask-list .ask-row:last-child .ask-b') || {}).textContent || '',
  }))
  ok(afterSend.n === 4, '发送后气泡数 = ' + afterSend.n + '（2 种子 + 1 用户 + 1 占位）')
  ok(afterSend.msgs[2].startsWith('u:'), '第 3 条是用户消息：' + afterSend.msgs[2])
  ok(afterSend.msgs[3].startsWith('a:'), '第 4 条是智能体回复：' + afterSend.msgs[3])
  ok(afterSend.inputVal === '', '发送后输入框已清空')
  ok(/本地占位/.test(afterSend.last), '占位回复明确标注「本地占位」')

  /* 快捷问句 */
  await page.click('.ask-chip')
  const chipVal = await page.$eval('#ask-input', (e) => e.value)
  ok(chipVal.length > 0, '快捷问句点击后填入输入框：「' + chipVal + '」')

  /* 回车发送 */
  const before = await page.evaluate(() => window.__xy.state.ask.msgs.length)
  await page.focus('#ask-input')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  const afterEnter = await page.evaluate(() => window.__xy.state.ask.msgs.length)
  ok(afterEnter === before + 2, '回车即发送（消息 ' + before + ' → ' + afterEnter + '）')

  /* ---------- 证据四 · 诚实标注 ---------- */
  const text = await page.evaluate(() => document.querySelector('.ask-note').textContent + '|' + JSON.stringify(window.__xy.state.ask.msgs))
  ok(/尚未接入模型服务/.test(text), '页面确含「尚未接入模型服务」标注')
  ok(/本地占位/.test(text), '页面确含「本地占位」标注')

  console.log('\n控制台报错 ' + errs.length + ' 条' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''))
  console.log('\n' + (bad === 0 ? '===== 全部通过 =====' : '===== 有 ' + bad + ' 项不符 ====='))
  await browser.close()
  process.exit(bad === 0 ? 0 : 1)
})()
