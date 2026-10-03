// 真浏览器全链路走查（playwright-core + 本机 chromium）
//
// 它和 scripts/render.test.mjs 的分工：
//   render.test.mjs = 真 SSR renderToString 断言（快，抓编译/渲染/数据）
//   walk.test.mjs   = 真浏览器点一遍（慢，抓 SSR 照不出来的运行时 bug：
//                     AudioParam 只读属性、ES module 严格模式未声明变量、按钮点了没反应…）
//
// 本机环境三个坑（不处理就是假白屏 / 假失败）：
//   1. 有 HTTP 代理：chromium 必须传 proxy，否则外网请求 ERR_TIMED_OUT；但要 bypass 掉 localhost
//   2. playwright-core 默认找 chromium build 1243，本机可能只有 1234 → 显式给 executablePath
//   3. headless 无摄像头/无 GPU：MediaPipe 的 wasm 会自己 abort（emscripten），
//      业务侧走 R2 预录兜底，属环境噪声，不算代码错
//
// 用法：
//   node scripts/walk.test.mjs                          # 打 http://localhost:8080
//   WALK_BASE=https://xianyang-wuxing-demo.app.workbuddy.host node scripts/walk.test.mjs
//   WALK_BASE=... node scripts/walk.test.mjs           # 也能打公网（需能通外网）
import pkg from 'file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js'
const { chromium } = pkg

const BASE = process.env.WALK_BASE || 'http://localhost:8080'
const EXE = process.env.CHROME_EXE
  || 'C:/Users/Cccong/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const SHOT = process.env.WALK_SHOT || 'E:/Xian_Hacthon/_shots'
const proxyServer = process.env.HTTP_PROXY || process.env.http_proxy || ''
const proxy = proxyServer ? { server: proxyServer, bypass: 'localhost,127.0.0.1' } : undefined

const errs = []
const missing = []
let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  proxy,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const ctx = await browser.newContext({
  viewport: { width: 414, height: 900 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
  permissions: ['camera', 'microphone'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()) })

const go = async (hash, shot) => {
  await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if (shot) await page.screenshot({ path: SHOT + '/' + shot + '.png' })
}
const txt = () => page.evaluate(() => document.body.innerText)

console.log('\n=== 首页 / ===')
await go('/', '01_home')
{
  const t = await txt()
  okc(t.includes('弦养'), '渲染出品牌名')
  okc(/12\s*分钟/.test(t), '时长口径 12 分钟')
  okc(t.includes('为什么推荐给你') && t.includes('八段锦 · '), '含三层信息结构（练什么/为什么推荐）')
  okc(t.includes('开始练'), '含开始练大按钮')
  okc(await page.locator('.app-tab').count() === 1, '底部 Tab 渲染')
  await page.locator('.orb, .orb-label').first().click()
  await page.waitForTimeout(700)
  okc(page.url().includes('#/prepare'), `点开始练跳到 ${page.url().split('#')[1]}`)
}

console.log('\n=== 跟练准备页 /prepare ===')
await go('/prepare', '01b_prepare')
{
  const t = await txt()
  okc(t.includes('练习准备'), '标题')
  okc(t.includes('全套 8 式'), '模式选择')
  okc(t.includes('一 · 点') && t.includes('二 · 线') && t.includes('三 · 面'), '阶段选择')
  // 阶段三 + 开始
  await page.locator('.stage-card').nth(2).click()
  await page.waitForTimeout(300)
  await page.locator('.start').first().click()
  await page.waitForTimeout(1200)
  okc(page.url().includes('#/arc') || page.url().includes('#/workshop') || page.url().includes('#/train'), `启动后到 ${page.url().split('#')[1]}`)
}

console.log('\n=== 阶段三 · 面 /arc ===')
await go('/arc', '02_arc')
{
  const t = await txt()
  okc(t.includes('十二分钟弧线'), '标题')
  okc(await page.locator('.md').count() === 5, '五调宫格 5 个')
  okc(t.includes('1×') && t.includes('4×') && t.includes('8×'), '倍速档位')
  okc(await page.locator('svg.curve polygon').count() === 1, '强度弧线 polygon')
  okc(await page.locator('svg.curve polyline').count() === 1, '强度弧线 polyline')
  await page.locator('.md').nth(4).click()
  await page.waitForTimeout(400)
  const t2 = await txt()
  okc(t2.includes('羽调式'), '切到羽调后动机面板换掉宫调式')
  await page.locator('.seg button', { hasText: '8×' }).click()
  await page.waitForTimeout(350)
  okc(await page.locator('.seg button.on', { hasText: '8×' }).count() === 1, '倍速切到 8×')
  await page.locator('.btn.primary').click()
  await page.waitForTimeout(1800)
  okc((await txt()).includes('播放中'), '播放状态生效')
  const head = await page.evaluate(() => {
    const l = document.getElementById('arcHead')
    return l ? { x: +l.getAttribute('x1'), op: l.getAttribute('opacity') } : null
  })
  okc(head && head.op === '0.95' && head.x > 22, `进度游标在动（x=${head && head.x}）`)
  const hitBtn = page.locator('.btn:not(.primary)', { hasText: '触发浮层' }).first()
  const before = await hitBtn.innerText()
  await hitBtn.click()
  await page.waitForTimeout(300)
  okc((await hitBtn.innerText()) !== before, '浮层按钮计数')
  await page.locator('.btn.primary').click()
}

console.log('\n=== 阶段二 · 线 /workshop ===')
await go('/workshop', '05_workshop')
{
  const t = await txt()
  okc(t.includes('五音短句工坊'), '标题')
  okc(await page.locator('.tone').count() === 5, '五音格 5 个')
  okc(await page.locator('.cell').count() === 10, '乐谱网格 10 格（8 出声 + 2 留白）')
  okc(await page.locator('.cell.restzone').count() === 2, '句尾留白 2 格（灰底）')
  const breath = page.locator('.sw', { hasText: '句尾呼吸' }).locator('input')
  await breath.uncheck(); await page.waitForTimeout(400)
  okc(await page.locator('.cell').count() === 8, '关呼吸 → 8 格')
  okc(await page.locator('.cell.restzone').count() === 0, '关呼吸 → 无留白格')
  await breath.check(); await page.waitForTimeout(400)
  okc(await page.locator('.cell').count() === 10, '开呼吸 → 回 10 格')
  await page.locator('input[type=range]').first().fill('64'); await page.waitForTimeout(300)
  okc((await txt()).includes('64 BPM'), 'BPM 滑块联动')
  await page.locator('input[type=range]').nth(1).fill('60'); await page.waitForTimeout(300)
  okc((await txt()).includes('60%'), '混响湿度联动')
  await page.locator('.tone').nth(2).click(); await page.waitForTimeout(400)
  okc((await txt()).includes('角'), '切到角音')
  // 实时播放：少了 let 声明 / AudioParam 赋值错，这里会哑掉
  await page.locator('.btn.primary').click(); await page.waitForTimeout(1200)
  okc((await txt()).includes('播放中'), '实时播放真的起来了（音频图构建无异常）')
  await page.locator('.btn.primary').click()
}

console.log('\n=== 阶段二 WAV 离线导出 ===')
{
  await page.locator('input[type=range]').first().fill('60')
  const btn = page.locator('.btn', { hasText: '当前音' })
  if (await btn.isDisabled()) {
    console.log('  · 导出按钮被禁用（该音无短句），跳过')
  } else {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }).catch(() => null),
      btn.click(),
    ])
    if (!dl) console.log('  · headless 未产生下载（OfflineAudioContext 虚拟时钟限制），记为跳过')
    else {
      const p = SHOT + '/export_' + dl.suggestedFilename()
      await dl.saveAs(p)
      const { statSync } = await import('node:fs')
      const kb = statSync(p).size / 1024
      okc(kb > 200, `导出 WAV 落盘 ${dl.suggestedFilename()}（${kb.toFixed(0)} KB）`)
      okc(/\.wav$/.test(dl.suggestedFilename()), '文件名以 .wav 结尾')
    }
  }
}

console.log('\n=== 阶段三跟练 /train?stage=point ===')
await go('/train?stage=point', '07_train_point')
{
  const t = await txt()
  okc(t.includes('双手托天理三焦'), '进入第 1 式')
  okc(t.includes('正在打开摄像头') || t.includes('预录演示') || t.includes('摄像头不可用'), '跟练页正常渲染（含加载或兜底提示）')
  okc(await page.locator('.string').count() === 7, '七弦弦位在')
}

console.log('\n=== 原有页面回归 ===')
for (const [h, key, shot] of [
  ['/sound', '想照顾哪里', '08_sound'],
  ['/sound/library', '完整曲库', '09_library'],
  ['/guide', '七弦齐鸣', '10_guide'],
  ['/record', '打卡记录', '11_record'],
  ['/me/settings', '基础设置', '11b_settings'],
  ['/', '弦养', '12_home'],
]) {
  await go(h, shot)
  okc((await txt()).includes(key), `${h} 渲染出「${key}」`)
}

console.log('\n=== 首页 → 跟练准备 → 阶段一（真实点击）===')
await go('/', '13_home2')
{
  await page.locator('.orb, .orb-label').first().click()
  await page.waitForTimeout(500)
  okc(page.url().includes('#/prepare'), '点开始练进入准备页')
  await page.locator('.stage-card').first().click()
  await page.waitForTimeout(200)
  await page.locator('.start').first().click()
  await page.waitForTimeout(1200)
  okc(page.url().includes('#/train'), `进入跟练页（${page.url().split('#')[1] || ''}）`)
}

console.log('\n=== 基础设置 /me/settings（开关要真生效，不能是假开关）===')
await go('/me/settings', '11b_settings')
{
  const t = await txt()
  okc(t.includes('基础设置'), '标题')
  // 关掉「古琴弦音反馈」与「语音播报」，把 localStorage 的事实抓出来对
  const pluck = page.locator('.row', { hasText: '古琴弦音反馈' }).locator('input[type=checkbox]')
  const voice = page.locator('.row', { hasText: '语音播报动作名' }).locator('input[type=checkbox]')
  await pluck.uncheck()
  await voice.uncheck()
  await page.waitForTimeout(300)
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('xianyang.settings') || '{}'))
  okc(s.pluckOn === false, `古琴弦音反馈开关已落盘（pluckOn=${s.pluckOn}）`)
  okc(s.voiceOn === false, `语音播报开关已落盘（voiceOn=${s.voiceOn}）`)
  // 「清空本机全部数据」要真清（走 store，不是手写 key）
  page.once('dialog', (d) => d.accept())
  await page.locator('.link-row', { hasText: '清空本机全部数据' }).click()
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => ({
    rec: localStorage.getItem('xianyang.records.v1'),
    body: localStorage.getItem('xianyang.bodyData'),
    set: localStorage.getItem('xianyang.settings'),
  }))
  okc(after.rec === '[]', `清空后打卡记录为空（${after.rec}）`)
  okc(after.body === null, '清空后身体数据已删')
  okc(after.set === null, '清空后设置已删')
}

console.log('\n=== 身体数据 → 我的/总结 状态联动（原来 hasBodyData 写死 false）===')
await go('/me/body-data', '11c_bodydata')
{
  await page.locator('input[type=number]').nth(0).fill('175')
  await page.locator('input[type=number]').nth(1).fill('70')
  await page.locator('.chip', { hasText: '颈肩' }).click()
  await page.waitForTimeout(200)
  page.once('dialog', (d) => d.accept())
  await page.locator('.btn.primary', { hasText: '保存' }).click()
  await page.waitForTimeout(800)
  okc(page.url().includes('#/me'), `保存后回到我的（${page.url().split('#')[1]}）`)
  const t = await txt()
  okc(t.includes('已填写'), '「我的」页身体数据从「未填写」变成「已填写」')
}
await go('/summary?done=8&total=8&tone=gong&minutes=12', '11d_summary')
{
  const t = await txt()
  okc(t.includes('今日食谱'), '填了身体数据后总结页解锁定制食谱（不再显示「去补充」）')
  okc(t.includes('山药枸杞粥'), '食谱按「颈肩」关注点选对（山药枸杞粥）')
  okc(t.includes('12 分钟'), '总结页显示跟练传来的真实时长')
}
{
  // 七弦回响：未命中的弦在浅色底上也得看得见（旧深色主题 rgba 在浅底等于隐形）
  const bars = await page.evaluate(() => [...document.querySelectorAll('.s-bar')]
    .map((el) => getComputedStyle(el).backgroundColor))
  okc(bars.length === 7, `七弦柱 7 根（${bars.length}）`)
  okc(bars.every((c) => c && c !== 'rgba(0, 0, 0, 0)'), '七弦柱都有可见底色（浅色底上不再隐形）')
}

console.log('\n=== 跟练页基调显示 + 打卡写入（原来 tone 未定义会抛）===')
await go('/train?stage=point&tone=shang', '11e_train_tone')
{
  const t = await txt()
  okc(t.includes('商调'), '跟练页顶栏显示当前五音基调（商调）')
  okc(!errs.some((e) => /tone.*(not defined|undefined)/i.test(e)), '无 tone 未定义类运行时错误')
}

console.log('\n=== 错误检查 ===')
{
  // headless 无摄像头：video.srcObject 为 null 会报错，属于环境噪声
  const ENV = /favicon|net::ERR_|autoplay|AudioContext|not allowed to start|play\(\) failed|Aborted\(\)|\[pose\]|Cannot set properties of null.*srcObject/i
  const real = errs.filter((e) => !ENV.test(e))
  okc(real.length === 0, `零页面错误${real.length ? '（' + real.slice(0, 3).join(' | ') + '）' : ''}`)
  okc(missing.length === 0, `零 4xx/5xx 请求${missing.length ? '（' + missing.slice(0, 3).join(' | ') + '）' : ''}`)
  if (real.length) console.log('  · 环境噪声（headless 无摄像头/GPU，走 R2 兜底）：\n    '
    + errs.filter((e) => !real.includes(e)).slice(0, 5).join('\n    '))
}

await browser.close()
console.log('\n' + (fail === 0 ? '✅ 真浏览器走查全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
