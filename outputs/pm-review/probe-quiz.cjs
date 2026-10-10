/* 校验问诊 7 步（P1-1）：
 *   A. 7 步题面/选项必须两两不同（原先 7 步全是同一道题，实测见 git 历史）
 *   B. 答案真的驱动推荐：音疗方向 / 今日调式 / 练哪一套 / 从哪个阶段起
 *   C. 答完存本机（localStorage['xy-quiz']），刷新后仍在并继续生效
 *   D. 全程 0 控制台报错
 * 用法：node outputs/pm-review/probe-quiz.cjs [port]
 */
const { chromium } = require('playwright-core')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

// 两套「人设」，用来验映射是不是真的按答案走
// pick[i] = 第 i 题选第几个选项（0 起）
const CASES = [
  { name: '睡眠差 · 晚上才累 · 12 分钟以上 · 无限制 · 想活动开',
    pick: [3, 0, 2, 3, 2, 3, 2], expect: { rec: 2, imode: 0, istage: 2 } },
  { name: '颈肩不适 · 只有 5 分钟 · 膝盖需避让 · 想轻柔',
    pick: [0, 2, 2, 0, 0, 2, 0], expect: { rec: 1, imode: 1, istage: 0 } },
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(800)

  for (const cs of CASES) {
    console.log('\n=== 用例：' + cs.name + ' ===')
    await page.evaluate(() => { try { localStorage.removeItem('xy-quiz') } catch (e) {} })
    await page.goto(BASE + '/?screen=question', { waitUntil: 'load' })
    await page.waitForTimeout(500)

    const steps = []
    for (let i = 0; i < 7; i++) {
      const q = await page.evaluate(() => {
        const titleEl = [...document.querySelectorAll('.sc .center')]
          .find((e) => (e.getAttribute('style') || '').includes('font-family'))
        return {
          title: (titleEl ? titleEl.textContent : '').trim(),
          cards: [...document.querySelectorAll('.qcard h4')].map((e) => e.textContent.trim()).join('|'),
          step: (document.querySelector('.stepper .num') || {}).textContent.trim(),
          next: (document.querySelector('[data-a="q-next"]') || {}).textContent.trim(),
        }
      })
      steps.push(q)
      await page.locator('.qcard').nth(cs.pick[i]).click()
      await page.click('[data-a="q-next"]')
      await page.waitForTimeout(360)
    }

    const titles = [...new Set(steps.map((s) => s.title))]
    const cardSets = [...new Set(steps.map((s) => s.cards))]
    console.log('  每步：')
    steps.forEach((s, i) => console.log(`    ${s.step} → ${s.title}   ［${s.cards}］  按钮=${s.next}`))
    okc(titles.length === 7, `7 步题面两两不同（实得 ${titles.length} 种）`)
    okc(cardSets.length >= 5, `选项组基本不重复（实得 ${cardSets.length} 种 / 7 步）`)
    okc(/看推荐/.test(steps[6].next), `第 7 步按钮变成「看推荐」（实得「${steps[6].next}」）`)
    okc(!/看推荐/.test(steps[0].next), `第 1 步仍是「下一步」（实得「${steps[0].next}」）`)

    // 落盘 + 生效
    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('xy-quiz') || 'null') } catch (e) { return null }
    })
    okc(!!saved, '问诊结果已写入 localStorage[\'xy-quiz\']')
    okc(saved && saved.answers.filter((x) => typeof x === 'number').length === 7, '存下了 7 个答案')
    okc(saved && saved.rec === cs.expect.rec, `今日调式 = ${cs.expect.rec}（实得 ${saved && saved.rec}）`)
    okc(saved && saved.imode === cs.expect.imode, `练哪一套 = ${cs.expect.imode === 0 ? '全套 8 式' : '招牌 3 式'}（实得 ${saved && saved.imode}）`)
    okc(saved && saved.istage === cs.expect.istage, `起始阶段 = ${cs.expect.istage}（实得 ${saved && saved.istage}）`)
    okc(saved && Array.isArray(saved.tags) && saved.tags.length === 7, `短标签 7 条（实得 ${saved && saved.tags && saved.tags.length}）`)

    // 结算提示（答完第 7 题当场弹的那句）
    const toastTxt = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')
    console.log('     结算提示：' + toastTxt)
    okc(/已按你的回答定制/.test(toastTxt), '结算提示出现')
    okc(/全套 8 式|招牌 3 式/.test(toastTxt), '结算提示里写明练哪一套')
    okc(/音疗方向「[心肝脾肺肾]」/.test(toastTxt), '结算提示里写明音疗方向')

    // 界面是否真的跟着变
    await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const home = await page.evaluate(() => ({
      why: (document.querySelector('.rec-cols .r p') || {}).textContent || '',
      rec: (document.querySelector('.rec-cols .l h4') || {}).textContent || '',
      toast: (document.querySelector('.toast') || {}).textContent || '',
    }))
    okc(/按你的回答/.test(home.why), `首页「为什么推荐给你」带上用户答案：${home.why.slice(0, 34)}…`)
    console.log('     （当前推荐曲调：' + home.rec + '）')
    console.log('     （结算提示：' + home.toast + '）')

    await page.goto(BASE + '/?screen=audio', { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const organSel = await page.evaluate(() => {
      const list = [...document.querySelectorAll('.organ')]
      return list.findIndex((e) => e.classList.contains('sel'))
    })
    okc(organSel === saved.organ, `音疗页选中的脏腑方向 = ${saved.organ}（实得 ${organSel}）`)

    await page.goto(BASE + '/?screen=intro', { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const intro = await page.evaluate(() => ({
      mode: [...document.querySelectorAll('.modecard')].findIndex((e) => e.classList.contains('sel')),
      stage: [...document.querySelectorAll('.stagecard')].findIndex((e) => e.classList.contains('sel')),
    }))
    okc(intro.mode === saved.imode, `练习准备页选中模式 = ${saved.imode}（实得 ${intro.mode}）`)
    okc(intro.stage === saved.istage, `练习准备页选中阶段 = ${saved.istage}（实得 ${intro.stage}）`)

    // 刷新（整页重载，走 init() → loadQuiz）后仍在
    await page.goto(BASE + '/?screen=home', { waitUntil: 'load' })
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => (document.querySelector('.rec-cols .r p') || {}).textContent || '')
    okc(/按你的回答/.test(after), '刷新后问诊结论仍然生效（不是一次性的）')
  }

  console.log('\n=== 控制台 ===')
  okc(errs.length === 0, `0 个报错（实得 ${errs.length}）`)
  errs.slice(0, 5).forEach((e) => console.log('     ' + e))
  await browser.close()
  console.log('\n' + (fail === 0 ? '✅ 问诊全项通过' : `❌ ${fail} 项失败`))
  process.exit(fail === 0 ? 0 : 1)
})()
