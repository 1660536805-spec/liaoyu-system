// 移动端适配诊断（真浏览器 + iPhone/Android 视口 + UA）
//
// 目的：**在真移动视口下**把 16 条路由全走一遍，找出真机上才暴露的问题。
// 只截图是不够的 —— 要同时把「量出来的数字」打出来：
//   · 视口 vs 布局视口（有没有横向溢出）
//   · 100vh 与实际可视高度差多少（iOS 地址栏 / 软键盘）
//   · 关键元素是否被底部 Tab / 安全区遮住
//   · 触摸目标尺寸（< 44px 在手机上就是难点）
//   · 字号 < 12px 的正文（手机上不可读）
//   · 横屏（宽 > 高）下的布局塌陷
//
// 用法：
//   node scripts/mobile-audit.mjs
//   MOBILE_BASE=https://xianyang-wuxing-demo.app.workbuddy.host node scripts/mobile-audit.mjs
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium, devices } = pkg

const BASE = process.env.MOBILE_BASE || 'http://localhost:8080'
const EXE = process.env.CHROME_EXE
  || 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const SHOT = process.env.MOBILE_SHOT || 'E:/Xian_Hacthon/_shots/mobile'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

// 只列本机 Chromium 真实存在的 UA，别用 playwright 的 iPhone 描述符（它 UA 是 WebKit，
// 但引擎是 Chromium，用它 UA 会让 <meta viewport> 行为与真机不一致）
const PROFILES = [
  {
    id: 'iphone-se',
    label: 'iPhone SE 375×667（最小常见机）',
    viewport: { width: 375, height: 667 },
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    dpr: 2,
  },
  {
    id: 'iphone-14',
    label: 'iPhone 14 390×844（主流）',
    viewport: { width: 390, height: 844 },
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    dpr: 3,
  },
  {
    id: 'pixel-7',
    label: 'Pixel 7 412×915（Android）',
    viewport: { width: 412, height: 915 },
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    dpr: 2.625,
  },
  {
    id: 'ipad-mini',
    label: 'iPad mini 平板 768×1024',
    viewport: { width: 768, height: 1024 },
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1',
    dpr: 2,
  },
  {
    id: 'desktop',
    label: '桌面 1440×900（电脑端对照）',
    viewport: { width: 1440, height: 900 },
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    dpr: 1,
  },
]

const ROUTES = [
  '/', '/prepare', '/sound', '/sound/library', '/summary', '/me',
  '/me/body-data', '/me/settings', '/arc', '/workshop', '/guide', '/record',
  '/splash', '/welcome', '/onboarding',
]

// 最小触摸目标（iOS HIG 44pt / Material 48dp，取 44）
const MIN_TAP = 44
// 正文字号下限
const MIN_FONT = 12

const browser = await chromium.launch({
  executablePath: EXE, headless: true, proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})

let total = 0
const report = []

for (const prof of PROFILES) {
  const ctx = await browser.newContext({
    viewport: prof.viewport,
    deviceScaleFactor: prof.dpr,
    isMobile: prof.id.startsWith('iphone') || prof.id.startsWith('pixel') || prof.id.startsWith('ipad'),
    hasTouch: true,
    userAgent: prof.ua,
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))

  console.log(`\n=== ${prof.label} ===`)

  for (const route of ROUTES) {
    await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(750)

    const m = await page.evaluate((opts) => {
      const { MIN_TAP, MIN_FONT } = opts
      const docW = document.documentElement.clientWidth
      const winW = window.innerWidth
      const winH = window.innerHeight
      // 100vh 在移动端 Safari/Chrome 里是「最矮的视口」= 地址栏收起时，
      // 与当前实际可视高度差多少，就等于内容被藏掉多少
      const vhProbe = (() => {
        const d = document.createElement('div')
        d.style.cssText = 'position:fixed;height:100vh;top:0;left:0;visibility:hidden;pointer-events:none'
        document.body.appendChild(d)
        const h = d.getBoundingClientRect().height
        d.remove()
        return Math.round(h)
      })()
      const vhGap = winH - vhProbe   // >0 = 可视区比 100vh 高（地址栏收起态）
      const vhGap2 = docW // 占位，避免 lint 抱怨

      // 横向溢出：找出比视口宽的元素
      const overflow = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right > winW + 1.5 || r.left < -1.5) {
          const cls = (el.className && typeof el.className === 'string')
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
            : ''
          overflow.push(`${el.tagName.toLowerCase()}${cls} right=${Math.round(r.right)}`)
        }
        if (overflow.length >= 4) break
      }

      // 触摸目标过小的（只看可交互元素）
      const smallTaps = []
      for (const el of document.querySelectorAll('button, a, input, select, [role=button]')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (getComputedStyle(el).display === 'none') continue
        // 整行通栏的按钮（宽 > 视口 70%）按「宽即可点」算，不判高度
        const fullWidth = r.width > winW * 0.7
        if (!fullWidth && (r.height < MIN_TAP - 2 || r.width < MIN_TAP - 2)) {
          const t = (el.textContent || el.getAttribute('aria-label') || el.type || '').trim().slice(0, 12)
          smallTaps.push(`${el.tagName.toLowerCase()}"${t}" ${Math.round(r.width)}×${Math.round(r.height)}`)
        }
        if (smallTaps.length >= 5) break
      }

      // 正文字号过小（排除 svg 内部 text、canvas）
      const tinyFont = []
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg') || el.tagName === 'CANVAS') continue
        if (!el.childNodes.length) continue
        let hasText = false
        for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break }
        if (!hasText) continue
        const fs = parseFloat(getComputedStyle(el).fontSize)
        if (fs && fs < MIN_FONT) {
          const cls = typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\s+/)[0] : ''
          tinyFont.push(`${el.tagName.toLowerCase()}${cls} ${fs}px "${el.textContent.trim().slice(0, 10)}"`)
        }
        if (tinyFont.length >= 5) break
      }

      // 底部 Tab 遮挡：正文底部 padding 是否够 Tab 高度 + 安全区
      const tab = document.querySelector('.app-tab')
      const tabInfo = tab
        ? (() => {
            const tr = tab.getBoundingClientRect()
            const scroller = document.querySelector('.body')
            const padB = scroller ? parseFloat(getComputedStyle(scroller).paddingBottom) : 0
            const need = tr.height + 8
            return { tabH: Math.round(tr.height), padB: Math.round(padB), need: Math.round(need), ok: padB >= need }
          })()
        : null

      // 文本被裁（scrollHeight 明显大于 clientHeight 且 overflow:hidden）
      const clipped = []
      for (const el of document.querySelectorAll('.card, .grp, .col, .scard, .data-item, .h-item, .row, .tip, .recipe-card')) {
        const cs = getComputedStyle(el)
        if (cs.overflow !== 'hidden') continue
        if (el.scrollHeight > el.clientHeight + 4) {
          clipped.push(`${el.className.split(/\s+/)[0]} ${el.clientHeight}<${el.scrollHeight}`)
        }
        if (clipped.length >= 4) break
      }

      return {
        docW, winW, winH, vhGap, vhGap2, overflow, smallTaps, tinyFont, tabInfo, clipped,
        hasViewportMeta: !!document.querySelector('meta[name=viewport]'),
        viewportContent: (document.querySelector('meta[name=viewport]') || {}).content || '',
        title: document.title,
      }
    }, { MIN_TAP, MIN_FONT })

    // ---- 判定 ----
    const issues = []
    if (m.docW > m.winW + 1) issues.push(`横向溢出 ${m.docW}>${m.winW}（${m.overflow.join(' | ')}）`)
    if (m.smallTaps.length) issues.push(`触摸目标过小(<${MIN_TAP}px)：${m.smallTaps.join(' | ')}`)
    if (m.tinyFont.length) issues.push(`字号过小(<${MIN_FONT}px)：${m.tinyFont.join(' | ')}`)
    if (m.tabInfo && !m.tabInfo.ok) issues.push(`底部被 Tab 遮挡：padding-bottom=${m.tabInfo.padB}px < 需 ${m.tabInfo.need}px`)
    if (m.clipped.length) issues.push(`内容被裁：${m.clipped.join(' | ')}`)
    if (!/viewport-fit=cover/.test(m.viewportContent)) issues.push('viewport 缺 viewport-fit=cover（刘海/安全区不生效）')
    // 100vh 缺口：地址栏收起时会有 60~120px 差，>150 才算病态
    if (m.vhGap > 150) issues.push(`100vh 比可视区矮 ${m.vhGap}px（用 dvh 更稳）`)
    if (errs.length) issues.push(`JS 错误：${errs.slice(0, 2).join(' | ')}`)

    total += issues.length
    const tag = issues.length ? '✗' : '✓'
    console.log(`  ${tag} ${route.padEnd(16)} win=${m.winW}×${m.winH} vhGap=${m.vhGap}${m.tabInfo ? ' tabH=' + m.tabInfo.tabH + '/pad=' + m.tabInfo.padB : ''}`)
    for (const i of issues) console.log(`      · ${i}`)

    report.push({ profile: prof.id, route, ...m, issues })

    await page.screenshot({ path: `${SHOT}/${prof.id}${route.replace(/\//g, '_') || '_home'}.png` })
    errs.length = 0
  }

  // ---- 横屏检查（只查主要页面）----
  if (prof.id === 'iphone-14' || prof.id === 'iphone-se') {
    console.log(`  ── 横屏 ${prof.viewport.height}×${prof.viewport.width} ──`)
    await page.setViewportSize({ width: prof.viewport.height, height: prof.viewport.width })
    for (const route of ['/', '/prepare', '/train', '/me/settings', '/arc']) {
      await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(600)
      const land = await page.evaluate(() => {
        const w = window.innerWidth
        const over = []
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (r.width && r.height && r.right > w + 1.5) { over.push(el.className || el.tagName); break }
        }
        return { w, over, docW: document.documentElement.clientWidth }
      })
      const bad = land.docW > land.w + 1
      if (bad) total++
      console.log(`    ${bad ? '✗' : '✓'} 横屏 ${route.padEnd(14)} w=${land.w}${bad ? ' 溢出: ' + land.over.join(',') : ''}`)
      await page.screenshot({ path: `${SHOT}/land_${prof.id}${route.replace(/\//g, '_')}.png` })
    }
  }

  await ctx.close()
}

await browser.close()
console.log(`\n${'='.repeat(56)}`)
console.log(total === 0 ? '✅ 移动端无问题' : `共发现 ${total} 处问题（见上）`)
process.exit(total === 0 ? 0 : 1)
