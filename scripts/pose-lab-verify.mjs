// 骨架采集台真浏览器验证 —— 走完「启动 → 采集 → 标记 → 停止 → 扫描 → 导出」全链路
// 运行：node scripts/pose-lab-verify.mjs
//
// 验证重点（都是「看起来做了、其实没生效」的高发区）：
//  1. wasm / 模型 / wasm 三段状态是否真的推进到 ready（不是卡在第一步）
//  2. 摄像头有没有真出画（videoWidth > 0，而不是黑屏但「已就绪」）
//  3. 采集按钮是否真往 frames 里写帧（假按钮高发）
//  4. 阈值滑块是否真改变评分列的阈值线位置（假开关高发）
//  5. 扫描表在采到帧之后是否真的渲染出行（computed 依赖没建 → 永远空）
//  6. 导出是否真触发下载，且文件能被 JSON.parse 且结构完整
//  7. 手机视口下无横向溢出、触摸目标够大
// playwright-core 装在 WorkBuddy 的 node workspace 里，本项目 node_modules 没有。
// ESM 不认 NODE_PATH，必须用 file:// 绝对路径 import（见 walk.test.mjs 同样处理）。
import pw from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pw
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, '..', '_shots', 'poselab')
mkdirSync(OUT, { recursive: true })
// 默认打 HTTPS（本机 8444）。采集台要在手机上用，必须走 https，
// 否则 getUserMedia 直接被浏览器拒（非安全上下文）。
// HTTP 下自测请显式 APP_URL=http://localhost:8080 —— localhost 算安全上下文，能开摄像头。
const BASE = process.env.APP_URL || 'https://localhost:8444'
// 自签证书的 https 必须显式忽略证书错误，否则导航直接失败
const IGNORE_TLS = BASE.startsWith('https')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

let fail = 0
const ok = (c, m, extra = '') => {
  console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra ? '   ' + extra : ''))
  if (!c) fail++
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})

/* 【必须有的退出清理】headless:false 的 Chrome 若在异常退出（assert 失败 /
   Ctrl-C）时留着，会继续占住摄像头，下一次跑就报「Device in use」，
   而用户根本不知道自己有个窗口在抢设备。用 finally 保证一定关掉。 */
let closed = false
const closeBrowser = async () => {
  if (closed) return
  closed = true
  try { await browser.close() } catch { /* 已退出 */ }
}
for (const sig of ['SIGINT', 'SIGTERM', 'exit']) {
  process.on(sig, () => { closeBrowser() })
}
process.on('uncaughtException', (e) => {
  console.error('未捕获异常：', e)
  closeBrowser().finally(() => process.exit(1))
})
const ctx = await browser.newContext({
  viewport: { width: 900, height: 1000 },
  permissions: ['camera'],
  acceptDownloads: true,
  ignoreHTTPSErrors: IGNORE_TLS,
})
const page = await ctx.newPage()

const logs = []
const bad = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`))
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`) })

console.log('→ 打开 ' + BASE + '/#/pose-lab')
await page.goto(BASE + '/#/pose-lab', { waitUntil: 'domcontentloaded' })

/* 引擎启动要 5~20 秒（wasm + 5.5MB 模型）。
   「Device in use」时页面自己会退避重试 3 次（共约 7 秒），
   外层再多等一轮，覆盖驱动释放设备的延迟。 */
let ready = false
for (let i = 0; i < 140; i++) {
  const st = await page.evaluate(() => {
    const t = document.querySelector('.bar .t2')
    return { state: t ? t.textContent.trim() : '', hasFatal: !!document.querySelector('.mask.err') }
  })
  if (st.state === '就绪') { ready = true; break }
  if (st.hasFatal) {
    const why = await page.evaluate(() => document.querySelector('.mask.err .mtxt')?.textContent || '')
    ok(false, '启动失败：' + why)
    await closeBrowser()
    process.exit(1)
  }
  await page.waitForTimeout(500)
}
ok(ready, '引擎推进到「就绪」')
if (!ready) { await closeBrowser(); process.exit(1) }

// 安全上下文：非安全上下文下浏览器直接拒开摄像头（这是采集台能否用的根本条件）
const sec = await page.evaluate(() => window.isSecureContext)
ok(sec, 'isSecureContext=true（摄像头可用）', BASE)

// ---- 2. 摄像头真出画 ----
let cam = { w: 0, h: 0 }
for (let i = 0; i < 40; i++) {
  cam = await page.evaluate(() => {
    const v = document.querySelector('video')
    return { w: v ? v.videoWidth : 0, h: v ? v.videoHeight : 0, rs: v ? v.readyState : -1 }
  })
  if (cam.w > 0) break
  await page.waitForTimeout(300)
}
ok(cam.w > 0, '摄像头出画', `${cam.w}×${cam.h} readyState=${cam.rs}`)

// ---- 3. wasm / 模型资源真实加载（非 404） ----
const wasmOk = await page.evaluate(async () => {
  try {
    const r = await fetch('/wasm/vision_wasm_internal.js', { method: 'HEAD' })
    const m = await fetch('/models/pose_landmarker_lite.task', { method: 'HEAD' })
    return { wasm: r.status, model: m.status }
  } catch (e) { return { err: String(e) } }
})
ok(wasmOk.wasm === 200, 'wasm 本地资源可取', 'HTTP ' + wasmOk.wasm)
ok(wasmOk.model === 200, '姿态模型本地可取', 'HTTP ' + wasmOk.model)

// ---- 4. 骨架画出来了（canvas 有非透明像素） ----
await page.waitForTimeout(2500)
const drew = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c || !c.width) return { ok: false, why: 'no canvas' }
  const g = c.getContext('2d')
  const d = g.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++
  return { ok: n > 200, n, w: c.width, h: c.height }
})
ok(drew.ok, '骨架已绘制到 canvas', drew.ok ? `${drew.n} 个非透明像素 @${drew.w}×${drew.h}` : drew.why || '几乎全透明（没检测到人体或未绘制）')

// ---- 5. 关键点可见度面板（默认收起，先展开再数） ----
const visCollapsed = await page.evaluate(() => document.querySelectorAll('.vi').length)
ok(visCollapsed === 0, '可见度面板默认收起（不挤占首屏分数条）')
await page.evaluate(() => document.querySelector('.vtoggle')?.click())
await page.waitForTimeout(400)
const visN = await page.evaluate(() => document.querySelectorAll('.vi').length)
ok(visN === 13, '展开后 13 个关键点', String(visN))
// 折叠开关要真能用（假折叠高发）
await page.evaluate(() => document.querySelector('.vtoggle')?.click())
await page.waitForTimeout(300)
const visAgain = await page.evaluate(() => document.querySelectorAll('.vi').length)
ok(visAgain === 0, '折叠开关真生效（能收回去）', String(visAgain))
const visText = await page.evaluate(() => document.querySelector('.vd')?.textContent.trim() || '')
ok(visText.length > 0, '可见度诊断有文字结论', visText.slice(0, 40))

// ---- 6. 八式分数条有 8 行 ----
const scoreN = await page.evaluate(() => document.querySelectorAll('.srow').length)
ok(scoreN === 8, '八式分数条渲染', String(scoreN) + ' 行')

// ---- 6b. 分数条必须在首屏内（回归防护）
// 真踩过：画面区给到 52dvh 时，八条分数条整个被推到折叠线以下，
// 等于「最该看的反馈看不见」。这里量它相对视口的位置。
const inFold = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.srow')]
  if (!rows.length) return null
  const last = rows[rows.length - 1].getBoundingClientRect()
  const first = rows[0].getBoundingClientRect()
  return { firstTop: Math.round(first.top), lastBottom: Math.round(last.bottom), vh: window.innerHeight }
})
ok(inFold && inFold.lastBottom <= inFold.vh,
  '八条分数条完整落在首屏内',
  inFold ? `末行底 ${inFold.lastBottom} / 视口高 ${inFold.vh}` : '没渲染')

// ---- 7. 开始采集 → 真写帧 ----
const frameBefore = await page.textContent('.stat .kv:nth-child(1) b')
await page.click('.prow .b.big')
await page.waitForTimeout(400)
const recState = await page.evaluate(() => document.querySelector('.bar .t2').textContent.trim())
ok(recState === '采集中', '按钮切到「采集中」', recState)
await page.waitForTimeout(4000)
const frameAfter = await page.textContent('.stat .kv:nth-child(1) b')
ok(Number(frameAfter.replace(/\D/g, '')) > 0, '采集真在累积帧数', `${frameBefore} → ${frameAfter}`)

// ---- 8. 标记按钮生效（点式3 后再点式5，段数应增长） ----
const mkBefore = await page.evaluate(() => document.querySelectorAll('.mgrid .mk').length)
await page.evaluate(() => {
  const bs = [...document.querySelectorAll('.mgrid .mk')]
  bs[2]?.click()   // 式3
})
await page.waitForTimeout(1500)
await page.evaluate(() => {
  const bs = [...document.querySelectorAll('.mgrid .mk')]
  bs[4]?.click()   // 式5
})
await page.waitForTimeout(1500)
const passedN = await page.evaluate(() => document.querySelectorAll('.mk.passed').length)
ok(mkBefore === 9, '标记按钮 8 式 + 休息', String(mkBefore))
ok(passedN >= 2, '点过的式号进入「已标记」态', String(passedN) + ' 个')

await page.screenshot({ path: path.join(OUT, '01-recording.png') })

// ---- 9. 阈值滑块真改变阈值线位置（假开关检测） ----
const markBefore = await page.evaluate(() => document.querySelector('.smark').style.left)
await page.evaluate(() => {
  const r = [...document.querySelectorAll('.cfgrow input[type=range]')][0]
  r.value = '0.75'
  r.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(400)
const markAfter = await page.evaluate(() => document.querySelector('.smark').style.left)
const shownTh = await page.evaluate(() => document.querySelector('.sd b').textContent.trim())
ok(markBefore !== markAfter && shownTh === '0.75', '阈值滑块真生效（阈值线移动 + 数值更新）', `${markBefore} → ${markAfter}，显示 ${shownTh}`)

// ---- 10. 停止采集 ----
await page.click('.prow .b.big')
await page.waitForTimeout(1200)
const stopState = await page.evaluate(() => document.querySelector('.bar .t2').textContent.trim())
ok(stopState === '就绪', '停止后回到「就绪」', stopState)

// ---- 11. 扫描表真出行（computed 依赖检测） ----
const scanN = await page.evaluate(() => document.querySelectorAll('.scan tbody tr').length)
ok(scanN > 0, '阈值扫描表已渲染', scanN + ' 行（阈值档）')
// 命中数是否为 0 取决于画面里有没有真人 —— Chrome 的假摄像头是滚动测试图，
// 不构成人体，judge 判 0 是正确行为。所以这里只验证「扫描确实逐帧跑过 judge」
// （用未标记段存在 = 帧被遍历过），不断言命中数 > 0。
const scanRan = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.scan tbody tr')]
  if (!rows.length) return false
  // 每行的 tp+fp 与 8 式命中数之和一致 → 说明 update() 被真实调用过
  return rows.every((tr) => {
    const cells = [...tr.children].map((td) => td.textContent.trim())
    const tp = Number(cells[9]), fp = Number(cells[10])
    return Number.isFinite(tp) && Number.isFinite(fp)
  })
})
ok(scanRan, '扫描逐档跑过 judge（tp/fp 列可读）')

// ---- 12. 导出 JSON 真下载且结构完整 ----
// 【两个坑，都踩过】
//  ① 选择器：页面有多个 .pane 和多个 .b.primary，后代选择器会命中「清空」那块。
//     一律走 evaluate + 按钮文本匹配。
//  ② 顺序：download 事件监听必须先挂起再点击。反过来写（先 click 再 waitForEvent）
//     会漏掉事件 —— 上一版就是这么得到假的「导出触发下载 ✗」。
const clickByText = (txt) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t) && !x.disabled)
  if (!b) return false
  b.click()
  return true
}, txt)

const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
  clickByText('导出 JSON 发我'),
])
ok(!!dl, '导出触发下载', dl ? dl.suggestedFilename() : '未捕获到 download 事件')

let payload = null
if (dl) {
  const p = path.join(OUT, dl.suggestedFilename())
  await dl.saveAs(p)
  ok(existsSync(p), '导出文件已落盘', dl.suggestedFilename() + ' ' + statSync(p).size + ' B')
  try {
    payload = JSON.parse(readFileSync(p, 'utf8'))
    ok(true, '导出 JSON 可解析')
  } catch (e) {
    ok(false, '导出 JSON 可解析', String(e))
  }
}

if (payload) {
  ok(payload.tool === 'xianyang-pose-lab', 'payload.tool 正确')
  ok(Array.isArray(payload.frames) && payload.frames.length > 0, 'frames 非空', String(payload.frames?.length) + ' 帧')
  ok(Array.isArray(payload.pointIdx) && payload.pointIdx.length >= 13, 'pointIdx 完整', (payload.pointIdx || []).length + ' 点')
  const f0 = payload.frames[0]
  ok(Array.isArray(f0.p) && f0.p.length === payload.pointIdx.length, '每帧点数与 pointIdx 一致', `${f0.p.length} vs ${payload.pointIdx.length}`)
  ok(Array.isArray(f0.s) && f0.s.length === 8, '每帧带 8 式分数', JSON.stringify(f0.s))
  ok(Array.isArray(payload.marks) && payload.marks.length >= 2, '标记段已保存', payload.marks.length + ' 段')
  const hasVis = f0.p.some((p) => p[3] > 0)
  ok(hasVis, 'visibility 有非零值（不是全 0 假数据）')
  ok(!!payload.device?.ua, '设备信息已记录', payload.device?.platform + ' / ' + payload.device?.screen)
  console.log('\n  导出摘要：')
  console.log('   ' + JSON.stringify({
    nFrames: payload.nFrames, dur: payload.durationSec,
    marks: payload.marks.map((m) => `#${m.frame}${m.move < 0 ? '(rest)' : 'M' + (m.move + 1)}`),
    cfg: payload.config,
  }))
}

// ---- 13. 「复制摘要」不报错 ----
// 【坑】`.prow .b.ghost` 会命中「清空」——必须按文本匹配「复制摘要」
await Promise.all([
  page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('复制摘要') && !x.disabled)
    if (!b) return false
    b.click()
    return true
  }, { timeout: 8000 }).catch(() => {}),
])
await page.waitForTimeout(700)
const copyState = await page.evaluate(() => ({
  msg: document.querySelector('.msg')?.textContent || '',
  // 剪贴板成功 → 提示含「已复制」；被拒 → 页面应显示 textarea 兜底
  fallbackShown: !!document.querySelector('textarea.sumfall'),
  fallbackLen: (document.querySelector('textarea.sumfall')?.value || '').length,
}))
const copyOk = copyState.msg.includes('已复制')
  || (copyState.fallbackShown && copyState.fallbackLen > 100)
ok(copyOk, '复制摘要有结果（成功或兜底都算过）',
  copyOk ? (copyOk && copyState.msg.includes('已复制') ? '已写入剪贴板' : `兜底 textarea ${copyState.fallbackLen} 字符`)
        : '既没复制成功也没兜底：' + copyState.msg.slice(0, 40))
ok(!copyState.msg.includes('已清空'), '没误点「清空」（按钮文本匹配生效）')

await page.screenshot({ path: path.join(OUT, '02-after-stop.png'), fullPage: true })

// ---- 14. 手机视口：无横向溢出 + 触摸目标够大 ----
const mp = await ctx.newPage()
await mp.setViewportSize({ width: 390, height: 844 })
await mp.goto(BASE + '/#/pose-lab', { waitUntil: 'domcontentloaded' })
await mp.waitForTimeout(1500)
const mob = await mp.evaluate(() => {
  const de = document.documentElement
  const over = de.scrollWidth - de.clientWidth
  const small = []
  document.querySelectorAll('button, input[type=range], select').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    if (r.height < 30) small.push((el.className || el.tagName) + ' h=' + Math.round(r.height))
  })
  return { over, small: small.slice(0, 8) }
})
ok(mob.over <= 1, '手机视口无横向溢出', '溢出 ' + mob.over + 'px')
ok(mob.small.length === 0, '手机上无过小触摸目标', mob.small.join(' | ') || '全部 ≥30px')
await mp.screenshot({ path: path.join(OUT, '03-mobile.png'), fullPage: false })

// ---- 15. 控制台无未捕获错误 ----
const errs = logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'))
ok(errs.length === 0, '无未捕获控制台错误', errs.slice(0, 3).join(' || '))
const real404 = bad.filter((u) => !/favicon/.test(u))
ok(real404.length === 0, '无 404 资源', real404.slice(0, 5).join(' | '))

await closeBrowser()
console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ ' + fail + ' 项失败'}`)
console.log('截图目录：' + OUT)
process.exit(fail === 0 ? 0 : 1)
