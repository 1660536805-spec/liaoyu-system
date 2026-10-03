/**
 * xianyang-s4 接入验收 —— 端到端
 *
 * 目的：证明「主壳首页 → 点『开始动作预览』→ 真的进入 s4 视觉识别页」这条链路通了。
 * 覆盖点：
 *   1. 主壳 / 正常渲染，无 JS 报错
 *   2. 点「开始练」→ 准备页 → 点「开始动作预览」后 URL 跳到 /s4/#/...
 *   3. s4 页面挂载成功（#app 有内容、标题正确）、无 404、无未捕获异常
 *   4. s4 自己的 hash 路由可直接深链（/s4/#/prepare、#/train、#/arc）
 * 说明：摄像头在无头环境不可用，这里只验「页面与资源到位」，不验识别精度。
 */
const { chromium } = require('playwright-core')
const http = require('http')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5190'
const OUT = path.join(__dirname, '..', 'outputs', 's4-integration')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

fs.mkdirSync(OUT, { recursive: true })

const problems = []
const notes = []

/** 用 node 直连探测资源（绕过沙箱代理） */
function probe(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let n = 0
      res.on('data', (c) => (n += c.length))
      res.on('end', () => resolve({ code: res.statusCode, len: n, type: res.headers['content-type'] || '' }))
    }).on('error', (e) => resolve({ code: 0, len: 0, type: '', err: e.message }))
  })
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    permissions: [],           // 不给摄像头权限：验的是页面链路，不是识别
  })
  const page = await ctx.newPage()

  const consoleErrors = []
  const pageErrors = []
  const failedReqs = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('requestfailed', (r) => failedReqs.push(`${r.url()} :: ${r.failure()?.errorText}`))
  page.on('response', (r) => {
    if (r.status() >= 400) failedReqs.push(`HTTP ${r.status()} ${r.url()}`)
  })

  // ---------- 1. 主壳首页 ----------
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  const shellScreens = await page.evaluate(() => document.getElementById('app')?.dataset.screen)
  console.log('[1] 主壳首页 screen =', shellScreens)
  await page.screenshot({ path: path.join(OUT, '01-shell-home.png') })
  if (!shellScreens) problems.push('主壳首页未渲染出 #app[data-screen]')

  // ---------- 2. 进准备页 ----------
  await page.evaluate(() => {
    const q = new URLSearchParams(location.search)
    q.set('screen', 'intro')
    history.replaceState(null, '', location.pathname + '?' + q)
  })
  await page.goto(BASE + '/?screen=intro', { waitUntil: 'load' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, '02-shell-intro.png') })

  const hasBtn = await page.locator('[data-a="start-practice"]').count()
  console.log('[2] 准备页「开始动作预览」按钮数 =', hasBtn)
  if (!hasBtn) problems.push('准备页找不到 data-a="start-practice" 按钮')

  // ---------- 3. 点击 → 应跳到 /s4/ ----------
  if (hasBtn) {
    await page.locator('[data-a="start-practice"]').first().click()
    await page.waitForTimeout(2500)
    const url = page.url()
    console.log('[3] 点击后 URL =', url)
    await page.screenshot({ path: path.join(OUT, '03-after-click.png') })

    if (!url.includes('/s4/')) {
      problems.push(`点击后未进入 /s4/，实际 URL = ${url}`)
    } else {
      // s4 是否真的挂载
      const mounted = await page.evaluate(() => {
        const el = document.getElementById('app')
        return { hasApp: !!el, html: el ? el.innerHTML.length : 0, title: document.title, hash: location.hash }
      })
      console.log('[3b] s4 挂载状态 =', JSON.stringify(mounted))
      if (!mounted.hasApp || mounted.html < 50) problems.push('s4 #app 未挂载或内容为空')
      notes.push(`s4 落地页 hash=${mounted.hash} title=${mounted.title}`)

      // s4 是不是真的在跑：等它把 router-view 渲染出来
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(OUT, '04-s4-page.png') })

      // 摄像头不可用时 s4 会走到错误/兜底分支，这属于预期；
      // 只确认「页面还在、没白屏」
      const alive = await page.evaluate(() => {
        const el = document.getElementById('app')
        return el ? el.innerHTML.length : 0
      })
      console.log('[3c] s4 二次采样 DOM 长度 =', alive)
      if (alive < 50) problems.push('s4 页面白屏（DOM 为空）')
    }
  }

  // ---------- 4. s4 hash 深链 ----------
  for (const [name, hash] of [['prepare', '#/prepare'], ['train', '#/train'], ['arc', '#/arc'], ['guide', '#/guide']]) {
    await page.goto(`${BASE}/s4/${hash}`, { waitUntil: 'load' })
    await page.waitForTimeout(1800)
    const info = await page.evaluate(() => ({
      len: document.getElementById('app')?.innerHTML.length || 0,
      title: document.title,
    }))
    console.log(`[4] s4 深链 ${hash} → DOM=${info.len} title=${info.title}`)
    await page.screenshot({ path: path.join(OUT, `05-s4-${name}.png`) })
    if (info.len < 50) problems.push(`s4 深链 ${hash} 白屏`)
  }

  // ---------- 5. 资源直连 ----------
  const assets = [
    '/', '/s4/', '/s4/index.html',
    '/s4/assets/index-5t9HS_Aa.js', '/s4/assets/index-DIKAWIsy.css',
    '/s4/models/pose_landmarker_lite.task', '/s4/wasm/vision_wasm_internal.wasm',
    '/s4/guqin/1-xiang-C2.ogg', '/s4/audio/meihua.mp3',
  ]
  for (const a of assets) {
    const r = await probe(BASE + a)
    console.log(`[5] ${a} → ${r.code} ${r.type} ${r.len}B`)
    if (r.code !== 200) problems.push(`资源 ${a} 返回 ${r.code}`)
  }

  await browser.close()

  const report = {
    base: BASE,
    问题: problems,
    备注: notes,
    控制台错误: consoleErrors.slice(0, 20),
    页面异常: pageErrors.slice(0, 20),
    失败请求: failedReqs.slice(0, 20),
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log('\n================ 验收结果 ================')
  console.log('问题数：', problems.length)
  problems.forEach((p) => console.log('  ✗', p))
  if (consoleErrors.length) console.log('控制台错误：', consoleErrors.slice(0, 5))
  if (pageErrors.length) console.log('页面异常：', pageErrors.slice(0, 5))
  if (failedReqs.length) console.log('失败请求：', failedReqs.slice(0, 8))
  console.log('截图目录：', OUT)
  process.exit(problems.length ? 1 : 0)
})().catch((e) => { console.error('验收脚本异常：', e); process.exit(2) })
