// 端到端交互验证：加载 → 问答 → 首页 → 音疗 → 入口 → 跟练 → 结束 → 我的 → 身体数据
const { chromium } = require('/Users/leo/.workbuddy/binaries/node/workspace/node_modules/playwright-core')

const BASE = 'http://127.0.0.1:5173/'
const steps = []
let fail = 0

function ok(name, cond, extra) {
  steps.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`)
  if (!cond) fail++
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  })
  const page = await browser.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  const txt = () => page.textContent('.phone')
  const has = async s => (await txt()).includes(s)

  await page.goto(BASE, { waitUntil: 'networkidle' })
  ok('加载页显示品牌与进入按钮', await has('进入弦养'))

  await page.click('[data-a="start"]')
  ok('首次进入进入问答页', await has('你最近哪里容易不舒服'))

  await page.click('[data-area="睡眠"]')
  ok('问题卡可多选', await page.getAttribute('[data-area="睡眠"]', 'style').then(s => s.includes('orange')))

  await page.click('[data-a="q-next"]')
  await page.click('[data-a="q-next"]')
  await page.click('[data-a="q-next"]')
  await page.click('[data-a="q-next"]')
  await page.click('[data-a="q-skip"]')
  ok('跳过后进入首页', await has('今日推荐'))

  await page.click('.tabbar [data-tab="audio"]')
  ok('底部导航切到音疗页', await has('今天想照顾哪里'))

  await page.click('[data-organ="肾"]')
  ok('五脏可选中', await page.getAttribute('[data-organ="肾"]', 'class').then(c => c.includes('on')))

  await page.click('.tabbar [data-tab="home"]')
  await page.click('[data-a="intro"]')
  ok('首页圆形按钮进入八段锦页', await has('八段锦 × 古琴音疗'))

  await page.click('[data-a="start-practice"]')
  ok('开始练习进入跟练页', await has('呼吸共鸣'))

  for (let i = 0; i < 8; i++) {
    await page.click('[data-a="p-run"]')
    await page.click('[data-a="p-step"]')
  }
  ok('完成八式后进入结束页', await has('今日练习完成'))

  await page.click('[data-a="finish"]')
  ok('完成打卡有反馈', await has('已完成打卡'))

  await page.click('[data-a="back"]')
  ok('结束页返回可达首页', await has('今日推荐') || await has('开始练'))
  await page.click('.tabbar [data-tab="profile"]')
  ok('我的页显示进度与指标', await has('清弦月') && await has('身体数据'))

  await page.click('[data-a="body"]')
  ok('进入身体数据页', await has('解锁定制推荐'))

  const before = await page.textContent('[data-ns="h"] b')
  await page.click('[data-a="inc-h"]')
  const after = await page.textContent('[data-ns="h"] b')
  ok('身高步进器可增减', before !== after, `${before} → ${after}`)

  await page.click('[data-grp="diet"][data-v="素食"]')
  ok('饮食偏好芯片可切换', await page.getAttribute('[data-grp="diet"][data-v="素食"]', 'class').then(c => c.includes('on')))

  await page.click('[data-a="diet-sw"]')
  ok('食谱开关可切换', !(await page.getAttribute('[data-a="diet-sw"]', 'class')).includes('on'))

  await page.click('[data-a="save-body"]')
  ok('保存身体数据有反馈', await has('已生成定制方案'))

  // 刷新后状态保持
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(BASE + '?screen=body', { waitUntil: 'networkidle' })
  ok('刷新后数据持久化', (await page.textContent('[data-ns="h"] b')) === after)

  ok('无 JS 运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '))

  console.log(steps.join('\n'))
  console.log(`\n${steps.length - fail}/${steps.length} 通过`)
  await browser.close()
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('运行失败:', e.message); process.exit(1) })
