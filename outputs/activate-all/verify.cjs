/**
 * 主壳「所有可点击项已激活 + 音乐真接入」核验
 *
 * 用法：NODE_PATH=<repo>/node_modules node outputs/activate-all/verify.cjs [baseUrl]
 *
 * 断言分十组：
 *  A 无死按钮：9 屏里 #app [data-a="unavailable"] == 0，且没有未打标的 button
 *  B 逐项点击：每屏每个 [data-a] 单独点一次，必须 0 console error、0 未接入类提示
 *  C 浮层：14 个入口逐个打开，标题非空、面板可见、内部可点项无报错
 *  D 曲目真的在播：点 ▶ 后 <audio> 不 paused 且 currentTime>0，进度条 >0
 *  E 七弦单音可点出声
 *  F 设置里「七弦试音」真的依次拨弦
 *  G 完成打卡写入本机记录，我的页随之变化
 *  H 分享图真的生成（canvas → data:image/png 且 naturalWidth>0）
 *  I 跟练页「保持 3 秒」真倒计时 / 音疗页呼吸引导真跑
 *  J 主壳 → s4 真跟练页的入口仍通
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = (process.argv[2] || 'http://127.0.0.1:5411').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

const SCREENS = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']
/** 这些点击会整页跳走（进 s4 真跟练页 / 切屏），单独测 */
const NAVIGATES = { 'start-practice': 1, 'goto-s4': 1, 'go-body': 1 }
/** 浮层内部：这些点了会把浮层关掉或整页跳走，不在 C 组里连带点 */
const INNER_SKIP = { 'goto-s4': 1, 'go-body': 1 }

const BAD_TOAST = /暂未接入|尚未接入|未提供音源|未提供该曲|无法播放|仅为界面示例|未生成真实|未提供更多音源/
const fails = []
const gains = []
function ok(cond, msg) { (cond ? gains : fails).push((cond ? '  ✓ ' : '  ✗ ') + msg) }
function head(t) { console.log('\n── ' + t) }

/** 浮层入口：[屏, 打开选择器, 名字] */
const SHEETS = [
  ['practice', '[data-a="settings"]', '设置'],
  ['practice', '[data-a="side"][data-i="2"]', '动作要点'],
  ['practice', '[data-a="side"][data-i="3"]', '常见问题'],
  ['intro', '[data-a="help"]', '练习帮助'],
  ['home', '[data-a="mode"][data-i="1"]', '五禽戏说明'],
  ['done', '[data-a="analysis"]', '详细分析'],
  ['done', '[data-a="recipe"]', '今日食养'],
  ['done', '[data-a="share-sheet"]', '分享琴谱'],
  ['profile', '[data-a="notices"]', '通知'],
  ['profile', '[data-a="settings"]', '设置(我的)'],
  ['profile', '[data-a="set-basic"]', '基础设置'],
  ['profile', '[data-a="set-help"]', '帮助与反馈'],
  ['profile', '[data-a="set-about"]', '版本信息'],
  ['profile', '[data-a="records"]', '历史数据'],
  ['profile', '[data-a="stage"]', '阶段进度'],
]

;(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 470, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ text: m.text(), url: ((m.location() || {}).url) || '' }) })
  page.on('pageerror', (e) => consoleErrors.push({ text: 'pageerror: ' + e.message, url: '' }))
  page.on('filechooser', (fc) => fc.setFiles([]).catch(() => {}))

  const url = (s) => BASE + '/?screen=' + s
  const toast = () => page.evaluate(() => { const t = document.querySelector('.toast'); return t && t.classList.contains('show') ? t.textContent : '' })
  /** 音频偏好（音量/循环/音效）会持久化到本机；核验各段落前先复位，保证每段从默认值出发 */
  const resetAudioPrefs = () => page.evaluate(() => { try { localStorage.removeItem('xy-audio') } catch (e) {} })
  const waitTrue = (fn, timeout = 3000) => page.waitForFunction(fn, null, { timeout }).then(() => true).catch(() => false)

  // ───────── A 无死按钮 ─────────
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await resetAudioPrefs()
  head('A 无死按钮（每屏 [data-a="unavailable"] 必须为 0）')
  for (const s of SCREENS) {
    await page.goto(url(s), { waitUntil: 'load' })
    await page.waitForTimeout(200)
    const dead = await page.$$eval('#app [data-a="unavailable"]', (els) => els.map((e) => e.dataset.label || e.getAttribute('aria-label') || e.textContent.trim().slice(0, 12)))
    const nolabel = await page.$$eval('#app button', (els) => els.filter((b) => !b.dataset.a).length)
    ok(dead.length === 0, `${s}: 未接入按钮 ${dead.length}${dead.length ? ' → ' + JSON.stringify(dead) : ''}`)
    ok(nolabel === 0, `${s}: 未打标 button ${nolabel}`)
    await page.screenshot({ path: path.join(OUT, `A-${s}.png`) })
  }

  // ───────── B 逐项点击 ─────────
  head('B 逐项点击（每屏每个 [data-a] 单独点一次）')
  let clicked = 0
  for (const s of SCREENS) {
    await page.goto(url(s), { waitUntil: 'load' })
    const items = await page.$$eval('#app [data-a]', (els) => els.map((e) => ({ a: e.dataset.a, i: e.dataset.i || '' })))
    const bad = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (NAVIGATES[it.a]) continue
      if (it.a === 'side' && it.i === '1') continue
      await page.goto(url(s), { waitUntil: 'load' })
      const els = await page.$$('#app [data-a]')
      if (!els[i]) { bad.push(it.a + ' #' + i + ' 元素消失'); continue }
      const before = consoleErrors.length
      try { await els[i].click({ timeout: 2500 }) } catch (e) { bad.push(it.a + ' 点击失败 ' + e.message.split('\n')[0]); continue }
      await page.waitForTimeout(180)
      clicked++
      const tt = await toast()
      if (BAD_TOAST.test(tt)) bad.push(`${it.a}${it.i ? '#' + it.i : ''} → 「${tt}」`)
      if (consoleErrors.length > before) bad.push(`${it.a} 触发 console error`)
    }
    ok(bad.length === 0, `${s}: ${items.length} 个可点项全部激活${bad.length ? ' — 问题 ' + JSON.stringify(bad, null, 0) : ''}`)
  }
  console.log(`  （本轮共真实点击 ${clicked} 次）`)

  // ───────── C 浮层 ─────────
  head('C 浮层（14 个入口）')
  for (const [s, sel, name] of SHEETS) {
    await page.goto(url(s), { waitUntil: 'load' })
    let bad = ''
    try {
      await page.click(sel, { timeout: 2500 })
      await page.waitForTimeout(420)
      const st = await page.evaluate(() => {
        const el = document.querySelector('.xs')
        if (!el || !el.classList.contains('show')) return null
        const title = el.querySelector('.xs-h b').textContent.trim()
        const text = el.querySelector('.xs-b').textContent.trim()
        return { title, len: text.length, inner: [...el.querySelectorAll('.xs-b [data-a]')].map((e) => e.dataset.a) }
      })
      if (!st) bad = '浮层未出现'
      else if (!st.title) bad = '标题为空'
      else if (st.len < 20) bad = '正文过短'
      else {
        const inner = st.inner.filter((a) => !INNER_SKIP[a])
        for (const a of inner) {
          // 每次重开浮层再点：某些内部操作（清空记录 / 二次确认）会把浮层换掉
          await page.goto(url(s), { waitUntil: 'load' })
          await page.click(sel, { timeout: 2500 }).catch(() => {})
          await page.waitForTimeout(200)
          const b0 = consoleErrors.length
          await page.click(`.xs-b [data-a="${a}"]`, { timeout: 2000 }).catch(() => { bad += ` 内部[${a}]点不动` })
          await page.waitForTimeout(180)
          if (consoleErrors.length > b0) bad += ` 内部[${a}]报错`
        }
        await page.goto(url(s), { waitUntil: 'load' })
        await page.click(sel, { timeout: 2500 }).catch(() => {})
        await page.waitForTimeout(220)
        await page.click('.xs-h [data-a="sheet-close"]', { timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(260)
        const closed = await page.evaluate(() => !document.querySelector('.xs.show'))
        if (!closed) bad += ' 关不掉'
      }
      await page.screenshot({ path: path.join(OUT, `C-${name}.png`) })
    } catch (e) { bad = '打开失败 ' + e.message.split('\n')[0] }
    ok(!bad, `浮层「${name}」(${s})${bad ? ' — ' + bad : ''}`)
  }
  await resetAudioPrefs()   // C 组点过「七弦音效 / 循环」开关，复位后再验播放

  // ───────── D 曲目真的在播 ─────────
  head('D 曲目真的在播')
  await page.goto(url('audio'), { waitUntil: 'load' })
  await page.click('[data-a="play"][data-i="0"]')
  await page.waitForTimeout(1600)
  let d = await page.evaluate(() => {
    const a = window.__xy.AUDIO.mus
    const bar = document.querySelector('.player .pbar i')
    const ts = [...document.querySelectorAll('.player .times span')].map((s) => s.textContent)
    return { src: a.currentSrc || a.src, paused: a.paused, t: a.currentTime, dur: a.duration, vol: a.volume, bar: bar ? bar.style.width : '', ts }
  })
  ok(/meihua-sannong\.mp3/.test(d.src), `点 ▶ 加载的是《梅花三弄》真录音（${d.src.split('/').pop()}）`)
  ok(!d.paused && d.t > 0.3, `真的在播：paused=${d.paused} currentTime=${d.t.toFixed(2)}s`)
  ok(/^\d+(\.\d+)?%$/.test(d.bar) && parseFloat(d.bar) > 0, `进度条在走：width=${d.bar}`)
  ok(d.ts[0] !== '00:00' && /6:2\d/.test(d.ts[1]), `时间显示：${d.ts[0]} / ${d.ts[1]}`)
  await page.screenshot({ path: path.join(OUT, 'D-播放中.png') })

  await page.click('[data-a="play"][data-i="0"]')   // 再点 → 暂停
  await page.waitForTimeout(350)
  d = await page.evaluate(() => ({ paused: window.__xy.AUDIO.mus.paused, icon: !!document.querySelector('.player .pc svg path[d^="M8 5.5"]') }))
  ok(d.paused, '再点同一个 ▶ → 暂停')
  ok(d.icon, '图标从暂停切回播放三角')

  await page.click('[data-a="play"][data-i="1"]')   // 切第二首
  await page.waitForTimeout(1400)
  d = await page.evaluate(() => ({ src: window.__xy.AUDIO.mus.currentSrc || window.__xy.AUDIO.mus.src, t: window.__xy.AUDIO.mus.currentTime, title: document.querySelector('.player .tt').textContent.trim() }))
  ok(/zuiyu-changwan\.mp3/.test(d.src) && d.t > 0.2, `切到《醉渔唱晚》并在播（${d.t.toFixed(2)}s）`)
  ok(/醉渔唱晚/.test(d.title), `播放器曲名同步为「${d.title}」`)

  // 循环开关（相对判定：从当前值翻转）
  const lb0 = await page.evaluate(() => window.__xy.AUDIO.loop)
  await page.click('.pctrl [data-a="loop"]'); await page.waitForTimeout(240)
  const lp = await page.evaluate(() => ({
    loop: window.__xy.AUDIO.loop, a: window.__xy.AUDIO.mus.loop,
    sn: (document.querySelector('.sec-note[data-a="loop"]') || {}).textContent.trim(),
    sw: !!document.querySelector('.pctrl [data-a="loop"] .on, .pctrl [data-a="loop"].on'),
  }))
  ok(lp.loop === !lb0 && lp.a === lp.loop, `循环开关翻转并落到 <audio>.loop（${lb0} → ${lp.loop}）`)
  ok(/循环中|循环播放/.test(lp.sn) && lp.sn === (lp.loop ? '循环中' : '循环播放'), `「为你推荐」右侧循环开关文案同步（「${lp.sn}」）`)
  await page.click('.pctrl [data-a="loop"]'); await page.waitForTimeout(220)

  // 「练完了 · 听一首完整的」与「随便听听」
  await page.click('[data-a="random-track"]'); await page.waitForTimeout(1100)
  const rt = await page.evaluate(() => ({ t: window.__xy.AUDIO.mus.currentTime, title: document.querySelector('.player .tt').textContent.trim() }))
  ok(rt.t > 0.1, `「随便听听」真的开播（${rt.title} · ${rt.t.toFixed(2)}s）`)
  await page.click('[data-a="play"][data-i="0"]'); await page.waitForTimeout(900)
  const full = await page.evaluate(() => /meihua/.test(window.__xy.AUDIO.mus.currentSrc || window.__xy.AUDIO.mus.src) && window.__xy.AUDIO.mus.currentTime > 0.1)
  ok(full, '「练完了 · 听一首完整的」播的是综合档《梅花三弄》')

  // ───────── E 七弦单音 ─────────
  head('E 七弦散音可点出声')
  await page.goto(url('practice'), { waitUntil: 'load' })
  await page.waitForTimeout(200)
  await page.click('.strings [data-a="pluck"][data-i="2"]')
  await page.waitForTimeout(150)
  const pulse = await page.evaluate(() => !!document.querySelector('.strings .plucked'))
  ok(pulse, '点弦有视觉反馈（.plucked，320ms 脉冲）')
  const rang = await waitTrue(() => { const a = window.__xy.AUDIO.pool['s2']; return !!a && !a.paused && a.currentTime > 0.3 })
  const pl = await page.evaluate(() => { const a = window.__xy.AUDIO.pool['s2']; return a ? { src: a.currentSrc || a.src, paused: a.paused, t: a.currentTime } : null })
  ok(rang, `点第三弦出声（${pl ? (pl.src.split('/').pop() + ' ' + pl.t.toFixed(2) + 's') : '无对象'}）`)
  // 进入跟练页时「动作 → 琴弦」自动拨弦
  await page.goto(url('practice'), { waitUntil: 'load' })
  await page.click('[data-a="next-step"]')
  const autoOk = await waitTrue(() => { const a = window.__xy.AUDIO.pool['s1']; return !!a && a.currentTime > 0.3 })
  const auto = await page.evaluate(() => { const a = window.__xy.AUDIO.pool['s1']; return a ? a.currentTime : -1 })
  ok(autoOk, `到第 2 式自动拨第 2 弦（t=${auto.toFixed(2)}s）`)

  // 回归：收势「背后七颠」= 七弦齐鸣（曾因 IIFE 传参错误只响第一根）
  await page.goto(url('practice'), { waitUntil: 'load' })
  for (let k = 0; k < 7; k++) { await page.click('[data-a="next-step"]'); await page.waitForTimeout(140) }
  const chordOk = await waitTrue(() => Object.keys(window.__xy.AUDIO.pool).filter((k) => window.__xy.AUDIO.pool[k].currentTime > 0).length === 7)
  const chordN = await page.evaluate(() => Object.keys(window.__xy.AUDIO.pool).filter((k) => window.__xy.AUDIO.pool[k].currentTime > 0).length)
  ok(chordOk, `收势「背后七颠」七弦齐鸣（${chordN}/7 根在响）`)
  await page.screenshot({ path: path.join(OUT, 'E-跟练页.png') })

  // ───────── F 七弦试音 ─────────
  head('F 设置里「七弦试音」依次拨弦')
  await page.goto(url('practice'), { waitUntil: 'load' })
  await page.click('[data-a="settings"]'); await page.waitForTimeout(420)
  await page.click('.xs-b [data-a="try-strings"]')
  await waitTrue(() => Object.keys(window.__xy.AUDIO.pool).length >= 7, 3200)
  const tryS = await page.evaluate(() => Object.keys(window.__xy.AUDIO.pool).map((k) => [k, +window.__xy.AUDIO.pool[k].currentTime.toFixed(2)]))
  ok(tryS.length >= 7, `一次点出 ${tryS.length} 根弦（${JSON.stringify(tryS)}）`)
  await page.click('.xs-b [data-a="sound"]'); await page.waitForTimeout(150)
  const soundOff = await page.evaluate(() => window.__xy.AUDIO.sound)
  // 等上一轮琶音自然结束（320ms 间隔 → 第 7 根 1.92s 才起）
  const idleAll = await waitTrue(() => { const ks = Object.keys(window.__xy.AUDIO.pool); return ks.length > 0 && ks.every((k) => window.__xy.AUDIO.pool[k].paused) }, 4000)
  await page.click('.xs-b [data-a="try-strings"]')
  const forced = await waitTrue(() => Object.keys(window.__xy.AUDIO.pool).filter((k) => !window.__xy.AUDIO.pool[k].paused).length >= 2, 2500)
  ok(soundOff === false && idleAll && forced, `关掉音效后主动试音仍发声（sound=${soundOff}、静默前已全部停止=${idleAll}）`)
  await page.click('.xs-b [data-a="sound"]'); await page.waitForTimeout(150)   // 还原
  const volSet = await page.evaluate(async () => {
    const r = document.querySelector('.xs-b [data-a="vol"]')
    r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true }))
    return window.__xy.AUDIO.vol
  })
  ok(Math.abs(volSet - 0.3) < 0.001, `音量滑块生效（AUDIO.vol=${volSet}）`)
  await page.screenshot({ path: path.join(OUT, 'F-设置.png') })

  // ───────── G 打卡 ─────────
  head('G 完成打卡 → 本机记录 → 我的页联动')
  await ctx.clearCookies()
  await page.goto(BASE + '/?first=1&screen=profile', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.removeItem('xy-records'))
  await page.goto(url('profile'), { waitUntil: 'load' })
  const before = await page.evaluate(() => ({ xp: document.querySelector('.xprow span').textContent.trim(), pill: document.querySelector('.stagepill').textContent.trim() }))
  ok(before.xp === '360 / 600' && /中级阶段/.test(before.pill), `无记录时保持设计稿默认（XP ${before.xp} · ${before.pill}）`)

  await page.goto(url('intro'), { waitUntil: 'load' })
  await page.goto(url('done'), { waitUntil: 'load' })
  await page.click('[data-a="finish"]'); await page.waitForTimeout(500)
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('xy-records') || '[]'))
  ok(rec.length === 1 && typeof rec[0].d === 'string' && rec[0].poses > 0, `打卡写入本机：${JSON.stringify(rec)}`)

  await page.goto(url('profile'), { waitUntil: 'load' })
  const after = await page.evaluate(() => ({ xp: document.querySelector('.xprow span').textContent.trim(), pill: document.querySelector('.stagepill').textContent.trim(), desc: document.querySelector('.half p').textContent.trim() }))
  ok(after.xp === '420 / 600', `我的页 XP 变真实（${after.xp}）`)
  ok(/已练 1 天/.test(after.pill), `我的页显示真实打卡（${after.pill}）`)
  ok(/已打卡 1 次/.test(after.desc), `历史数据卡变真实（${after.desc}）`)
  await page.screenshot({ path: path.join(OUT, 'G-我的页-打卡后.png') })

  // ───────── H 分享图 ─────────
  head('H 分享图真的生成')
  await page.goto(url('done'), { waitUntil: 'load' })
  await page.click('[data-a="share-sheet"]'); await page.waitForTimeout(600)
  const shot = await page.evaluate(() => { const im = document.querySelector('.xs-shot'); return { src: (im.src || '').slice(0, 21), w: im.naturalWidth, h: im.naturalHeight, dl: !!document.querySelector('.xs-b a[download]') } })
  ok(shot.src === 'data:image/png;base64', `生成 PNG dataURL（${shot.src}…）`)
  ok(shot.w === 750 && shot.h > 900, `尺寸 ${shot.w}×${shot.h}`)
  ok(shot.dl, '提供下载按钮')
  await page.screenshot({ path: path.join(OUT, 'H-分享图.png') })

  // ───────── I 倒计时 / 呼吸引导 ─────────
  head('I 「保持 3 秒」与呼吸引导真的跑')
  await page.goto(url('practice'), { waitUntil: 'load' })
  await page.click('[data-a="hold"]')
  await page.waitForTimeout(1300)
  const holdTxt = await page.evaluate(() => { const b = document.querySelector('.pill[data-a="hold"] b'); return b ? b.textContent.trim() : '' })
  ok(/^[12]$/.test(holdTxt), `「保持」在倒计时（当前 ${holdTxt}）`)
  const doneOk = await page.waitForFunction(() => {
    const b = document.querySelector('.pill[data-a="hold"] b')
    return !!b && b.textContent.trim() === '完成'
  }, null, { timeout: 3000 }).then(() => true).catch(() => false)
  ok(doneOk, '倒计时走完显示「完成」')
  await page.screenshot({ path: path.join(OUT, 'I-保持完成.png') })

  await page.goto(url('audio'), { waitUntil: 'load' })
  await page.click('.breath-row[data-a="breath"]'); await page.waitForTimeout(1300)
  const br = await page.evaluate(() => { const s = document.querySelector('.bstep.on'); return { on: !!s, txt: s ? s.querySelector('b').textContent.trim() : '' } })
  ok(br.on && /秒/.test(br.txt), `呼吸引导在跑（「${br.txt}」高亮）`)
  await page.click('.breath-row[data-a="breath"]'); await page.waitForTimeout(400)
  const brOff = await page.evaluate(() => !document.querySelector('.bstep.on'))
  ok(brOff, '再点一次停掉呼吸引导并复原')

  // ───────── J 主壳 → s4 ─────────
  head('J 主壳 → s4 真跟练页入口仍通')
  await page.goto(url('intro'), { waitUntil: 'load' })
  await page.click('[data-a="start-practice"]'); await page.waitForTimeout(1200)
  ok(/\/s4\/#\/train/.test(page.url()), `「开始动作预览」→ ${page.url().replace(BASE, '')}`)
  await page.goto(url('practice'), { waitUntil: 'load' })
  await page.click('[data-a="side"][data-i="1"]'); await page.waitForTimeout(1200)
  ok(/\/s4\/#\/train/.test(page.url()), `跟练页「动作示范」→ ${page.url().replace(BASE, '')}`)
  await page.goto(url('home'), { waitUntil: 'load' })
  await page.click('[data-a="mode"][data-i="1"]'); await page.waitForTimeout(400)
  await page.click('.xs-b [data-a="goto-s4"]'); await page.waitForTimeout(1200)
  ok(/\/s4\/#\/train/.test(page.url()), `「五禽戏」说明页里的按钮 → ${page.url().replace(BASE, '')}`)

  // ───────── 汇总 ─────────
  head('汇总')
  console.log(gains.join('\n'))
  if (fails.length) console.log('\n失败：\n' + fails.join('\n'))
  // s4 子应用在无头浏览器里申请摄像头会被拒（NotAllowedError）——这是 s4 既有行为（本机演示无摄像头），
  // 主壳只负责跳转；把这类「来源在 /s4/、且是权限被拒」的报错单独列出，不计入主壳失败。
  const s4Perm = consoleErrors.filter((e) => /\/s4\//.test(e.url) && /NotAllowedError|Permission denied/i.test(e.text))
  const mine = consoleErrors.filter((e) => !s4Perm.includes(e))
  const uniq = (arr) => [...new Set(arr.map((e) => e.text + (e.url ? ' @ ' + e.url : '')))]
  console.log(`\nconsole error：主壳 ${mine.length} · s4 摄像头权限被拒（预期）${s4Perm.length}`)
  if (mine.length) console.log('主壳报错：\n' + uniq(mine).slice(0, 10).join('\n'))
  if (s4Perm.length) console.log('s4 报错（不计入）：' + uniq(s4Perm).length + ' 种 —— ' + uniq(s4Perm)[0])
  console.log(`\n结果：${gains.length} 通过 / ${fails.length} 失败 · 截图在 ${OUT}`)
  await browser.close()
  process.exit(fails.length || mine.length ? 1 : 0)
})().catch((e) => { console.error('脚本异常', e); process.exit(2) })
