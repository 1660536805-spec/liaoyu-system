/* 校验：主壳结束页（?screen=done）是否显示「真实结果」。
 *
 * 三种状态必须都对：
 *   A 全新用户（无 xy-last-session / 无 xy-records） → 一律「—」，且文案明说没有记录
 *   B 真实跟练过、但没做动作识别（scores 为空）     → 真实时长/完成式数，评分显示「—」
 *   C 真实跟练 + 有识别分数                        → 平均分、逐式完成度进琴谱点阵
 * 改前这页是写死的 89 分 / 12 分钟 / 146·162 与 seed=7 伪随机点阵。
 *
 * 用法：node outputs/pm-review/probe-done.cjs [port]
 */
const { chromium } = require('playwright-core')
const PORT = Number(process.argv[2]) || 5400
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  →  ' + extra : '')) }
}

const CASES = [
  {
    id: 'A 全新用户（无任何记录）',
    session: null,
    expect: (v) => {
      ok('标题为「动作预览完成」', v.h1 === '动作预览完成', v.h1)
      ok('说明文字写明「还没有跟练记录」', /还没有跟练记录/.test(v.note), v.note)
      ok('大分数显示「—」', v.score.replace(/\s/g, '') === '—', JSON.stringify(v.score))
      ok('评分为「未评估」', v.grade === '未评估', v.grade)
      ok('练习时长「—」', v.min.replace(/\s/g, '') === '—', JSON.stringify(v.min))
      ok('完成动作「—」', v.move.replace(/\s/g, '') === '—', JSON.stringify(v.move))
      ok('连续打卡「—」', v.sk.replace(/\s/g, '') === '—', JSON.stringify(v.sk))
      ok('环形进度为空环（dashoffset=295）', Math.round(v.off) === 295, String(v.off))
      ok('图例写「暂无跟练记录」', /暂无跟练记录/.test(v.legend), v.legend)
      ok('点阵全部为空白色', v.dots.every((c) => c === v.empty), [...new Set(v.dots)].join(','))
      ok('反馈卡不再指名「右手按弦手腕略高」', !/手腕略高/.test(v.fb), v.fb)
      ok('明日目标指向具体式名', /「.+」/.test(v.goal), v.goal)
    },
  },
  {
    id: 'B 真实跟练 · 未做动作识别',
    session: { at: '2026-10-10T05:00:00.000Z', day: '2026-10-10', moves: 5, total: 8, names: [], tone: 'gong', seconds: 372, scores: [], source: 's4' },
    records: [{ d: '2026-10-10', at: '2026-10-10T05:00:00.000Z', poses: 5, sec: 372 }],
    expect: (v) => {
      ok('标题切到「跟练完成」', v.h1 === '跟练完成', v.h1)
      ok('说明写明「未启用动作识别」', /未启用动作识别/.test(v.note), v.note)
      ok('评分仍显示「—」（不编分）', v.score.replace(/\s/g, '') === '—', JSON.stringify(v.score))
      ok('环形进度仍为空环', Math.round(v.off) === 295, String(v.off))
      ok('练习时长为真实 6 分钟', /6/.test(v.min) && /分钟/.test(v.min), v.min)
      ok('完成动作为真实 5 / 8', v.move.replace(/\s/g, '') === '5/8', JSON.stringify(v.move))
      ok('小字写「未做动作识别」', /未做动作识别/.test(v.moveSmall), v.moveSmall)
      ok('卡片标注「完成动作」而非「命中数」', v.moveLabel === '完成动作', v.moveLabel)
      ok('连续打卡来自真实记录（1 天）', v.sk.replace(/\s/g, '') === '1天', JSON.stringify(v.sk))
      ok('图例写「本次未做动作识别」', /本次未做动作识别/.test(v.legend), v.legend)
      ok('点阵全部为空白色', v.dots.every((c) => c === v.empty), [...new Set(v.dots)].join(','))
      ok('曲目卡显示真实完成式数与调式', /5 \/ 8 式已完成/.test(v.trackSub) && /宫调/.test(v.trackSub), v.trackSub)
    },
  },
  {
    id: 'C 真实跟练 · 有识别分数',
    session: {
      at: '2026-10-10T05:00:00.000Z', day: '2026-10-10', moves: 8, total: 8,
      names: [], tone: 'yu', seconds: 800,
      scores: [92, 88, 80, 74, 66, 58, 90, 84], source: 's4',
    },
    records: [{ d: '2026-10-10', at: '2026-10-10T05:00:00.000Z', poses: 8, sec: 800 }],
    expect: (v) => {
      ok('大分数为真实平均分 79', v.score.replace(/\D/g, '') === '79', JSON.stringify(v.score))
      ok('评级为「尚可」', v.grade === '尚可', v.grade)
      ok('环形进度 = 真实比例（约 62）', Math.abs(v.off - 61.95) < 0.6, String(v.off))
      ok('练习时长为真实 13 分钟', /13/.test(v.min) && /分钟/.test(v.min), v.min)
      ok('完成动作 8 / 8', v.move.replace(/\s/g, '') === '8/8', JSON.stringify(v.move))
      ok('小字写真实平均完成度', /平均完成度 79%/.test(v.moveSmall), v.moveSmall)
      ok('图例恢复三色', /准确/.test(v.legend) && /偏差/.test(v.legend) && /未命中/.test(v.legend), v.legend)
      ok('点阵无空白色（颜色全部由分数决定）', v.dots.every((c) => c !== v.empty), [...new Set(v.dots)].join(','))
      ok('点阵只用了绿/琥珀两色（本轮分数区间）', new Set(v.dots).size === 2, [...new Set(v.dots)].join(','))
      ok('曲目卡显示羽调真实调式', /羽调/.test(v.trackSub), v.trackSub)
      ok('说明文字写明来自真实记录', /真实记录/.test(v.note), v.note)
      ok('详细分析浮层给出逐式完成度', /完成度 \d+%/.test(v.analysis), v.analysis.slice(0, 90))
    },
  },
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const allErrs = []

  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 })
    if (c.session) {
      await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch (_) {} },
        ['xy-last-session', JSON.stringify(c.session)])
    }
    if (c.records) {
      await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch (_) {} },
        ['xy-records', JSON.stringify(c.records)])
    }
    const page = await ctx.newPage()
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

    await page.goto(BASE + '/?screen=done', { waitUntil: 'load' })
    await page.waitForTimeout(800)

    const v = await page.evaluate(() => {
      const txt = (s) => { const e = document.querySelector(s); return e ? e.innerText.trim() : '' }
      const raw = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : '' }
      const dots = [...document.querySelectorAll('.fret .nd')].map((e) => getComputedStyle(e).backgroundColor)
      return {
        h1: raw('h1.done-h'), note: raw('h1.done-h + .sec-note'),
        score: txt('.score-card .ring .in b'), grade: txt('.score-card .ring .in span'),
        off: (document.querySelector('.score-card .ring svg circle:nth-child(2)') || {}).getAttribute?.('stroke-dashoffset'),
        min: txt('.statrow .st:nth-child(1) .v'), move: txt('.statrow .st:nth-child(2) .v'),
        moveLabel: txt('.statrow .st:nth-child(2) .lb'), moveSmall: txt('.statrow .st:nth-child(2) small'),
        sk: txt('.statrow .st:nth-child(3) .v'), legend: txt('.fret .legend'),
        dots, empty: 'rgb(231, 220, 198)', trackSub: txt('.trackcard .tx span'),
        fb: txt('.fb-grid .fb:nth-child(1) p'), goal: txt('.fb-grid .fb:nth-child(3) p'),
        dotCount: dots.length,
      }
    })
    v.analysis = await page.evaluate(() => {
      document.querySelector('[data-a="analysis"]')?.click()
      return document.querySelector('.xs-b')?.innerText || ''
    })
    await page.waitForTimeout(200)

    console.log('\n' + c.id)
    ok('琴谱点阵仍是 7×7 = 49 点（布局未动）', v.dotCount === 49, String(v.dotCount))
    c.expect(v)
    ok('无控制台报错', errs.length === 0, errs.join(' | '))
    allErrs.push(...errs)
    await ctx.close()
  }

  await browser.close()
  console.log('\n' + (fail === 0 ? '✅ 结束页真实结果全项通过' : '❌ 有 ' + fail + ' 项未通过') + `  （${pass} 通过 / ${fail} 失败）`)
  process.exit(fail === 0 ? 0 : 1)
})()
