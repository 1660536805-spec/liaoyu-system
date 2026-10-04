// 文化内核实验室 · 演示走查（截图 + 录屏 + 断言）
// 真浏览器点一遍 /#/culture：生成处方 → 一键落地硬件 → 切知识表 → 跑自检
// 用法：node scripts/shot-culture.mjs
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:8080'
const EXE = 'C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
  && 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const OUT = 'E:/Xian_Hacthon/_shots'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

const fail = []
function must(cond, msg) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg)
  if (!cond) fail.push(msg)
}

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT, size: { width: 430, height: 932 } },
})
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(String(e.message || e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/culture_${n}.png`, fullPage: true }); console.log('    · culture_' + n + '.png') }

// 底部 AppTab 是 fixed 的：playwright 的 scrollIntoViewIfNeeded 会把目标停在视口底缘，
// hit-test 打到 Tab 上导致一直 retry。真机能滚到底所以照常可点，这里手动把目标顶到视口上三分之二。
async function clickBtn(text, scope) {
  const loc = (scope || page).locator('button', { hasText: text }).first()
  // -centered 滚动：把目标顶到视口正中，天然避开 fixed 底部 Tab 的 hit-test 区
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(150)
  try {
    await loc.click({ timeout: 6000 })
  } catch (e) {
    // 遮挡兜底：直接派发 DOM click（仍能触发 Vue 逻辑，只是不再验证命中）
    process.stdout.write(`    [降级] ${text} 被遮挡，改用 dispatchEvent\n`)
    await loc.dispatchEvent('click')
  }
}

console.log('=== 文化内核实验室 走查 ===')
await page.goto(BASE + '/#/culture', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

// 1) 空态
must(await page.locator('text=文化内核实验室').count() > 0, '标题渲染')
must(await page.locator('.ad').count() === 4, `4 个适配器已挂载（实测 ${await page.locator('.ad').count()}）`)
await shot('01_empty')

// 2) 内核知识表：五音
must(await page.locator('.tb tbody tr').count() === 5, `五音知识表 5 行（实测 ${await page.locator('.tb tbody tr').count()}）`)
await clickBtn('子午流注', page.locator('.seg'))
await page.waitForTimeout(300)
must(await page.locator('.tb tbody tr').count() === 12, `子午流注 12 行（实测 ${await page.locator('.tb tbody tr').count()}）`)
await shot('02_shichen_table')

// 3) 生成处方
await clickBtn('生成处方')
await page.waitForTimeout(500)
const jsonVisible = await page.locator('pre.json').first().isVisible().catch(() => false)
must(jsonVisible, '处方 JSON 已渲染')
const rxText = await page.locator('.rx').first().innerText().catch(() => '')
must(/调/.test(rxText), '处方展示含调式')
must(/第 .* 式/.test(rxText), '处方展示成功法序列')
await shot('03_prescription')

// 4) 一键落地到硬件
await clickBtn('一键落地到硬件')
await page.waitForTimeout(1600)
const logTxt = await page.locator('.log').first().innerText().catch(() => '')
must(/audio\.guqin/.test(logTxt), '总线日志出现 audio.guqin')
must(/aroma\.link2/.test(logTxt), '总线日志出现 aroma.link2')
must(/pose\.mediapipe/.test(logTxt), '总线日志出现 pose.mediapipe')
must(/light\.ambiance/.test(logTxt), '总线日志出现 light.ambiance')
const liveCount = await page.locator('.ad.live').count()
must(liveCount >= 3, `至少 3 个适配器已连线（实测 ${liveCount}）`)
await shot('04_apply_log')

// 5) 指令速发：停声 + 雾化
await clickBtn('雾化 2 档')
await page.waitForTimeout(600)
const logTxt2 = await page.locator('.log').first().innerText().catch(() => '')
must(/雾化/.test(logTxt2), '雾化指令已进日志')
await shot('05_quick_cmd')

// 6) 断线降级：断开香薰后再下发，应返回 offline 而不是抛异常
await clickBtn('断开', page.locator('.ad', { hasText: 'aroma.link2' }))
await page.waitForTimeout(500)
await clickBtn('雾化 2 档')
await page.waitForTimeout(600)
const logTxt3 = await page.locator('.log').first().innerText().catch(() => '')
must(/offline|链路已断开/.test(logTxt3), '拔掉设备后离线降级，页面不崩')
await shot('06_offline')

// 7) 内核自检
await clickBtn('跑一遍')
await page.waitForTimeout(400)
const selfTxt = await page.locator('pre.json.self').first().innerText().catch(() => '')
must(/全部通过/.test(await page.locator('.tip').last().innerText()), '内核自检全通过')
console.log(selfTxt.split('\n').map((l) => '    ' + l).join('\n'))
await shot('07_selftest')

// 8) 桌面宽屏一张（给评委/文档用）
await page.setViewportSize({ width: 1180, height: 900 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/culture_08_desktop.png`, fullPage: true })
console.log('    · culture_08_desktop.png')

const real = errors.filter((e) => !/wasm|camera|MediaPipe|getUserMedia|Failed to load resource|Autoplay|notAllowed/i.test(e))
must(real.length === 0, `无真实报错（过滤 wasm/摄像头环境噪声后剩 ${real.length} 条）`)
if (real.length) console.log(real.slice(0, 5).map((e) => '    ! ' + e).join('\n'))

await ctx.close()
await browser.close()
console.log(fail.length ? `\n❌ ${fail.length} 项未通过：\n` + fail.map((f) => ' - ' + f).join('\n') : '\n✅ 全部通过')
process.exit(fail.length ? 1 : 0)
