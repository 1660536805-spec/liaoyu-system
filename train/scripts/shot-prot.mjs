// 设计稿版 /#/prot 融合走查：iframe UI 1:1 + 桥接真数据 + 真判定
// 用法：node scripts/shot-prot.mjs
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:8080'
const EXE = 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const OUT = 'E:/Xian_Hacthon/_shots'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

const fail = []
function must(cond, msg) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg)
  if (!cond) fail.push(msg)
}

const browser = await chromium.launch({
  executablePath: EXE, headless: true, proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--use-fake-ui-for-media-stream'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('main: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('main-console: ' + m.text()) })

console.log('=== 设计稿版融合走查 ===')
await page.goto(BASE + '/#/prot', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const frame = page.frameLocator('iframe')
/* iframe 内的按钮常被宿主页/fixed 层判成 "intercepts pointer events"，
   playwright 的 hit-test 会一直 retry 到超时（实测踩过）。这里直接派发 DOM 点击事件，
   走原型自己的 document 事件委托，行为与真人点击一致。 */
async function tap(fr, sel) {
  return fr.locator(sel).first().evaluate((el) => { el.click(); return true })
}
must(await frame.locator('text=开始练').first().isVisible(), 'iframe 内设计稿首页渲染')

// ① 桥：今日节气换成真节气（不再是写死的「霜降」）
const fest = (await frame.locator('.jq .o').first().innerText().catch(() => '')).trim()
must(fest && fest !== '霜降', `今日节气来自内核节气表（实测「${fest}」，非写死的霜降）`)

// ② 桥：首页推荐走真实处方
const recTitle = (await frame.locator('.rec-cols .l h4').first().innerText().catch(() => '')).trim()
must(/八段锦 · .调/.test(recTitle), `今日推荐由 culture 处方生成（实测「${recTitle}」）`)

// 先把 iframe 内滚回顶部，截「首页」（点大圆会跳到练习模式区，直接截会截错区块）
await frame.locator('body').first().evaluate((el) => { el.scrollTop = 0; const d = document.scrollingElement || el; if (d) d.scrollTop = 0 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/prot_01_home.png` })
console.log('    · prot_01_home.png')

await tap(frame, 'button.disc')
await page.waitForTimeout(900)

// ③ 进入页 → 跟练屏（真判定，无摄像头时走预录兜底）
await tap(frame, 'button[data-a="start-practice"]')
await page.waitForTimeout(1200)
// 回归断言：原型原本在这里 location.href='s4/#/train' 整页跳走，必须已被改成留在设计稿跟练屏
must(page.url().indexOf('/prot') >= 0, 'start-practice 不再整页跳走（仍留在 /prot）')
must(await frame.locator('.pdots').first().isVisible(), '进入跟练屏')
await tap(frame, 'button[data-a="toggle-run"]')
await page.waitForTimeout(1000)
const cur = (await frame.locator('.pinfo .cur').first().innerText().catch(() => '')).trim()
must(/示例|实时/.test(cur), `跟练屏指标来源标注正确（实测「${cur}」）`)
await page.screenshot({ path: `${OUT}/prot_02_practice.png` })
console.log('    · prot_02_practice.png')

// ④ 一路「下一个」到结束页，验证真实记录提示
for (let i = 0; i < 9; i++) {
  const btn = frame.locator('button[data-a="next-step"]').first()
  if (!(await btn.count())) break
  await tap(frame, 'button[data-a="next-step"]')
  await page.waitForTimeout(260)
  if (await frame.locator('.done-h').count()) break
}
must(await frame.locator('.done-h').first().isVisible(), '走到结束页')
const doneNote = (await frame.locator('.done-h ~ .sec-note, .done-h + .sec-note').first().innerText().catch(() => '')).trim()
must(/示例|真实/.test(doneNote), `结束页说明（实测「${doneNote.slice(0, 24)}…」）`)
await page.screenshot({ path: `${OUT}/prot_03_done.png` })
console.log('    · prot_03_done.png')

// ⑤ 宿主页侧：处方 JSON 已回传
const rxBox = await page.locator('.side pre.json').first().innerText().catch(() => '')
// ⚠ 别用「八段锦|调」这种字面断言：面板只截前 420 字符，
//   处方字段一多（加 festSpan/shichen/fromBody）就可能被截断 → 断言随机飘。
//   改用 Prescription 的稳定键。
must(/"generatedAt"/.test(rxBox) && /"constitutionName"/.test(rxBox) && /"tone"/.test(rxBox),
  '宿主页拿到真实处方（右侧 JSON 面板含 generatedAt/constitutionName/tone）')

const real = errs.filter((e) => !/wasm|camera|MediaPipe|getUserMedia|NotAllowed|Failed to load resource|Autoplay|pose/i.test(e))
must(real.length === 0, `无真实报错（过滤环境噪声后剩 ${real.length} 条）`)
if (real.length) console.log(real.slice(0, 5).map((e) => '    ! ' + e).join('\n'))

console.log('    · 录屏已生成于 _shots/page@*.webm（重命名后即为交付录屏）')
await browser.close()
console.log(fail.length ? `\n❌ ${fail.length} 项未通过` : '\n✅ 全部通过')
process.exit(fail.length ? 1 : 0)
