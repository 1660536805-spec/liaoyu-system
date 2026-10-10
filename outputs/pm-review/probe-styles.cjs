/* 逐功法核查：跟练页「教练小窗」到底演示什么。
   对 八段锦 / 五禽戏 / 太极 三个 style 分别打开跟练页，读：
     · .cb-name            当前式名（应用侧）
     · .strings > .string  弦数（随拳种变化）
     · .demo.coach .cv-box 内是 SVG 小人 / 静态照片 / 空占位
     · svg 快照数量        证明「在动」还是「静止」
     · 照片 URL 的 HTTP 状态
   运行： node outputs/pm-review/probe-styles.cjs
*/
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:5400'
const STYLES = ['baduanjin', 'wuqinxi', 'taiji']

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = []
  for (const st of STYLES) {
    const ctx = await browser.newContext({
      viewport: { width: 470, height: 900 },
      deviceScaleFactor: 2,
      permissions: [],
    })
    const page = await ctx.newPage()
    const photoReq = []
    page.on('response', (r) => {
      const u = r.url()
      if (/\/photos\//.test(u)) photoReq.push(r.status() + ' ' + u.replace(BASE, ''))
    })
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)))

    const url = `${BASE}/s4/#/train?stage=point&mode=full&style=${st}&tone=gong`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2600)

    /* 读当前式名与弦数 */
    const info = await page.evaluate(() => {
      const cb = document.querySelector('.cb-name')
      const strs = document.querySelectorAll('.strings .string')
      const box = document.querySelector('.demo.coach .cv-box')
      const svg = box && box.querySelector('svg')
      const miss = box && box.querySelector('.ph.miss')
      const ph = box && box.querySelector('.ph')
      const cap = document.querySelector('.coach-cap')
      const phases = [...document.querySelectorAll('.phases span')].map((s) => s.textContent.trim())
      const vis = (el) => {
        if (!el) return false
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') return false
        const r = el.getBoundingClientRect()
        return r.width > 1 && r.height > 1
      }
      return {
        cbName: cb ? cb.textContent.replace(/\s+/g, ' ').trim() : null,
        stringCount: strs.length,
        hasSvg: vis(svg),                    // 只有「真的看得见」才算有小人
        svgInDom: !!svg,
        svgPaths: svg ? svg.querySelectorAll('path').length : 0,
        hasMiss: vis(miss),                  // 只有「真的看得见」才算降级占位
        phText: ph ? ph.textContent.replace(/\s+/g, ' ').trim() : null,
        cap: cap ? cap.textContent.trim() : null,
        phases,
      }
    })

    /* 3 秒内采样 SVG 快照，看是否在动；同时记录姿态指纹 */
    const snaps = new Set()
    for (let i = 0; i < 12; i++) {
      const s = await page.evaluate(() => {
        const svg = document.querySelector('.demo.coach .cv-box svg')
        if (!svg) return null
        // 用所有 path 的 d 前 40 字符拼指纹
        return [...svg.querySelectorAll('path')].map((p) => (p.getAttribute('d') || '').slice(0, 40)).join('|')
      })
      if (s) snaps.add(s)
      await page.waitForTimeout(250)
    }

    /* 截图：教练小窗区域，留证 */
    try {
      const box = await page.$('.coach-bar')
      if (box) await box.screenshot({ path: `outputs/pm-review/compare/coachwin-${st}.png` })
    } catch { /* 忽略 */ }

    results.push({ style: st, ...info, distinctSvgStates: snaps.size, photoReq, errs })
    await ctx.close()
  }
  await browser.close()

  console.log('================ 逐功法：跟练页教练小窗实测 ================')
  for (const r of results) {
    console.log('\n【style=' + r.style + '】')
    console.log('  当前式名 .cb-name :', r.cbName)
    console.log('  弦数 .string      :', r.stringCount)
    console.log('  教练小窗【可见】SVG 小人:', r.hasSvg, '(DOM 内 ' + r.svgInDom + ', path 数 ' + r.svgPaths + ')')
    console.log('  降级占位【可见】.ph.miss :', r.hasMiss)
    console.log('  占位文案          :', r.phText)
    console.log('  教练卡底说明      :', r.cap)
    console.log('  阶段标签          :', JSON.stringify(r.phases))
    console.log('  3s 内姿态快照数   :', r.distinctSvgStates, r.distinctSvgStates > 1 ? '(在动)' : '(静止/无)')
    console.log('  照片请求          :', r.photoReq.length ? JSON.stringify(r.photoReq) : '（无 /photos/ 请求）')
    console.log('  页面 JS 报错      :', r.errs.length ? JSON.stringify(r.errs) : '无')
  }
  /* 结论行 */
  const b = results.find((r) => r.style === 'baduanjin')
  console.log('\n================ 结论 ================')
  for (const r of results) {
    const same = r.hasSvg === b.hasSvg && r.hasMiss === b.hasMiss
    console.log(`  ${r.style.padEnd(10)} 教练小窗形态=${r.hasSvg ? 'SVG小人' : (r.hasMiss ? '降级占位' : '空')}  与八段锦一致=${same ? '是' : '否'}`)
  }
}

run().catch((e) => { console.error('FAIL', e); process.exit(1) })
