const fs = require('fs')
const path = require('path')
const { chromium } = require('/Users/leo/WorkBuddy/疗愈/node_modules/playwright-core')

const BASE = 'http://127.0.0.1:5173/'
const OUT = path.join(__dirname, '..', 'outputs')
const widths = [320, 375, 470, 768, 1440]
const screens = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'profile', 'body']
const lines = []
let failures = 0

function check(name, condition, detail = '') {
  const line = `${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -> ${detail}` : ''}`
  lines.push(line)
  if (!condition) failures += 1
}

async function text(page) {
  return page.locator('body').innerText()
}

async function click(page, selector) {
  await page.locator(selector).first().click()
  await page.waitForTimeout(35)
}

async function verifyViewport(page, width, label) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    badImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src')),
  }))
  check(`${label} ${width}px 无水平溢出`, overflow.width <= width + 1 && overflow.bodyWidth <= width + 1, `${overflow.width}/${overflow.bodyWidth}`)
  check(`${label} ${width}px 图片完整`, overflow.badImages.length === 0, overflow.badImages.join(', '))
  if (await page.locator('.nav').count()) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const layout = await page.evaluate(() => {
      const nav = document.querySelector('.nav').getBoundingClientRect()
      const main = document.querySelector('main')
      const last = main.children[main.children.length - 2].getBoundingClientRect()
      return { bottom: nav.bottom, top: nav.top, lastBottom: last.bottom, height: innerHeight }
    })
    check(`${label} ${width}px 导航固定在视口底部`, Math.abs(layout.bottom - layout.height) < 2)
    check(`${label} ${width}px 末尾内容不被导航遮挡`, layout.lastBottom <= layout.top + 1)
    await page.evaluate(() => window.scrollTo(0, 0))
  }
}

async function pageErrors(page, label) {
  const errors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
  page.on('requestfailed', request => errors.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
  return { errors, label }
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--disable-gpu', '--no-sandbox'],
  })
  const context = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const runtime = await pageErrors(page, '主流程')

  await page.goto(`${BASE}?first=1`, { waitUntil: 'networkidle' })
  check('加载页显示品牌与进入按钮', (await text(page)).includes('进入弦养'))
  await verifyViewport(page, 470, '加载页')

  await click(page, '[data-a="load-enter"]')
  check('首次进入问答页', (await text(page)).includes('你最近哪里容易不舒服'))
  await click(page, '[data-a="q-next"]')
  check('问答未选择时阻止下一步', (await text(page)).includes('请选择一项后再继续'))
  await click(page, '[data-a="qsel"][data-i="3"]')
  await click(page, '[data-a="q-next"]')
  await click(page, '[data-a="q-prev"]')
  check('问答上一步恢复已选答案', await page.locator('[data-a="qsel"][data-i="3"]').evaluate(el => el.classList.contains('sel')))
  await click(page, '[data-a="q-next"]')
  for (let i = 1; i < 7; i += 1) {
    await click(page, `[data-a="qsel"][data-i="${i % 6}"]`)
    await click(page, '[data-a="q-next"]')
  }
  check('完成七步问答进入首页', (await text(page)).includes('今日推荐'))

  await click(page, '[data-a="nav-audio"]')
  check('底部导航进入音疗页', (await text(page)).includes('今天想照顾哪里'))
  check('播放器诚实显示预览状态', (await text(page)).includes('曲目预览') && !(await text(page)).includes('正在播放'))
  await click(page, '[data-a="play"][data-i="0"]')
  check('无音源播放有真实限制反馈', (await text(page)).includes('未提供该曲音源'))
  await click(page, '[data-a="nav-intro"]')
  check('nav-intro 可进入练习入口', (await text(page)).includes('选择练习模式'))

  await click(page, '[data-a="imode"][data-i="1"]')
  await click(page, '[data-a="start-practice"]')
  check('3式模式进入动作预览页', (await text(page)).includes('动作预览'))
  check('3式模式显示三个进度点', await page.locator('.pdots .d').count() === 3)
  await click(page, '[data-a="next-step"]')
  await click(page, '[data-a="next-step"]')
  await click(page, '[data-a="next-step"]')
  check('3式完成后进入结束页', (await text(page)).includes('动作预览完成'))

  await click(page, '[data-a="back"]')
  await click(page, '[data-a="nav-intro"]')
  await click(page, '[data-a="imode"][data-i="0"]')
  await click(page, '[data-a="start-practice"]')
  check('8式模式显示八个进度点', await page.locator('.pdots .d').count() === 8)
  await click(page, '[data-a="exit-practice"]')
  await click(page, '[data-a="nav-profile"]')
  check('我的页显示身体数据入口', (await text(page)).includes('身体数据'))
  await click(page, '[data-a="go-body"]')
  check('进入身体数据页', (await text(page)).includes('解锁定制推荐'))

  const height = page.locator('[data-a="stp"][data-k="h"][data-d="1"]')
  for (let i = 0; i < 100; i += 1) await height.click()
  check('身高上限被限制', await page.locator('.stp').first().locator('b').innerText() === '230')
  const weight = page.locator('[data-a="stp"][data-k="w"][data-d="-1"]')
  for (let i = 0; i < 100; i += 1) await weight.click()
  check('体重下限被限制', await page.locator('.stp').nth(1).locator('b').innerText() === '20')
  await click(page, '[data-a="chip"][data-name="inj"][data-v="无"]')
  await click(page, '[data-a="chip"][data-name="inj"][data-v="颈肩"]')
  check('损伤无与其他选项互斥', await page.locator('[data-a="chip"][data-name="inj"].sel').count() === 1 && await page.locator('[data-a="chip"][data-name="inj"][data-v="颈肩"]').evaluate(el => el.classList.contains('sel')))
  await click(page, '[data-a="chip"][data-name="inj"][data-v="颈肩"]')
  check('互斥芯片取消后恢复无', await page.locator('[data-a="chip"][data-name="inj"][data-v="无"]').evaluate(el => el.classList.contains('sel')))
  const beforeToggle = await page.locator('[data-a="tog"]').getAttribute('aria-checked')
  await click(page, '[data-a="tog"]')
  check('食谱开关状态可切换', await page.locator('[data-a="tog"]').getAttribute('aria-checked') !== beforeToggle)
  const savedHeight = await page.locator('.stp').first().locator('b').innerText()
  const savedToggle = await page.locator('[data-a="tog"]').getAttribute('aria-checked')
  await click(page, '[data-a="save-body"]')
  check('保存身体设置有反馈', (await text(page)).includes('身体设置已保存'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(`${BASE}?screen=body`, { waitUntil: 'networkidle' })
  check('刷新后身体数值持久化', await page.locator('.stp').first().locator('b').innerText() === savedHeight)
  check('刷新后食谱开关持久化', await page.locator('[data-a="tog"]').getAttribute('aria-checked') === savedToggle)
  check('主流程无运行时错误', runtime.errors.length === 0, runtime.errors.slice(0, 3).join(' | '))

  await page.goto(`${BASE}?screen=home`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(OUT, 'bugfix-home.png'), fullPage: true })
  await page.goto(`${BASE}?screen=body`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(OUT, 'body.png'), fullPage: true })

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    for (const screen of screens) {
      await page.goto(`${BASE}?screen=${screen}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(50)
      await verifyViewport(page, width, screen)
      check(`${screen} ${width}px 有主内容`, await page.locator('#app main').count() === 1)
    }
  }

  const focusable = await page.locator('button, [role="button"]').evaluateAll(elements => elements.filter(el => {
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled
  }).every(el => el.getAttribute('aria-label') || el.textContent.trim()))
  check('可见交互控件具备可访问名称', focusable)
  check('全尺寸回归无新增运行时错误', runtime.errors.length === 0, runtime.errors.slice(-3).join(' | '))

  const report = [
    '弦养整体 bug 修复回归报告',
    `时间: ${new Date().toISOString()}`,
    `服务器: ${BASE}（脚本未停止或重启）`,
    `结果: ${lines.filter(line => line.startsWith('PASS')).length}/${lines.length} 通过，${failures} 项失败`,
    '',
    ...lines,
    '',
    '真实限制:',
    '- 当前 dist 为静态 vanilla SPA，未接入真实摄像头、MediaPipe/AI 动作识别、音频播放后端或系统分享能力。',
    '- 音疗页将曲目明确标为“预览 · 未提供音源”，点击播放只给出限制反馈，不伪造播放状态。',
    '- 练习页为静态动作与呼吸动画预览，评分和反馈为示例数据，结束页已明确提示。',
    '- 本地存储不可用时，身体设置仅在当前访问周期保留。',
  ].join('\n')
  fs.writeFileSync(path.join(OUT, 'bugfix-results.txt'), report + '\n')
  console.log(report)
  await browser.close()
  process.exit(failures ? 1 : 0)
})().catch(error => {
  console.error(error.stack || error.message)
  process.exit(1)
})
