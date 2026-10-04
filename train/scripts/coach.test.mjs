// 陪练教练状态机单测：node scripts/coach.test.mjs
//
// 状态机有**两种闸门**（cfg.gate），决定「什么时候进下一式」：
//
//   gate:'time'（旧行为，计时放行）—— 断言：
//     ① 示范阶段不接受命中（必须先看完教练示范）
//     ② 跟练命中 → 完成 → 自动进入下一式
//     ③ 跟练迟迟不完成 → 先自动重看一次示范（有次数上限），再进入宽限
//     ④ 宽限超时 → 自动放行下一式（不停死在同一式）
//     ⑤ 宽限期内点「再练一会儿」能续命，且续命后仍有权重放示范
//
//   gate:'judge'（默认，判定闸门）—— 断言：
//     ⑥ 没通关就**永远不 advance**，一直停在那一式
//     ⑦ 每 attemptMs 发一次 nudge（重播示范 + 轮次 +1），phase 仍是 follow
//     ⑧ nudge 期间仍然接受命中（重播途中做到位也算通关）
//     ⑨ 只有命中才 done → advance；且永不进入 grace
import assert from 'node:assert/strict'
import { createCoach, PHASE, COACH_PRESETS } from '../src/engine/coach.js'

let pass = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ✓', name) }
  catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1 }
}

// 用一个「按毫秒步进」的驱动，模拟真实 rAF 推进
function drive(coach, ms, stepMs = 100) {
  const evs = []
  let left = ms
  while (left > 0) {
    const dt = Math.min(stepMs, left)
    evs.push(...coach.tick(dt))
    left -= dt
  }
  return evs
}

/** 计时放行档（旧行为），专测软等待/硬等待/宽限/兜底放行 */
const createTimeCoach = (overrides = {}) =>
  createCoach({ overrides: { gate: 'time', ...overrides } })
/** 判定闸门档（默认），专测「没通关不换式」 */
const createJudgeCoach = (overrides = {}) =>
  createCoach({ overrides: { gate: 'judge', ...overrides } })

console.log('\n=== 陪练教练 · 状态机 ===')

t('初始为 idle，不激活', () => {
  const c = createCoach()
  assert.equal(c.phase, PHASE.IDLE)
  assert.equal(c.active, false)
})

t('begin → 进入示范阶段，且此时不接受命中', () => {
  const c = createCoach()
  const ev = c.begin(0)
  assert.equal(ev.type, 'demo')
  assert.equal(c.phase, PHASE.DEMO)
  assert.equal(c.acceptingHit, false, '示范阶段必须不接受命中（要先看完示范）')
})

t('示范阶段命中被忽略（用户还没看到示范）', () => {
  const c = createCoach()
  c.begin(0)
  assert.equal(c.hit(0), null)
  assert.equal(c.phase, PHASE.DEMO)
})

t('demoDone → 进入跟练，开始接受命中', () => {
  const c = createCoach()
  c.begin(0)
  assert.equal(c.demoDone().type, 'follow')
  assert.equal(c.phase, PHASE.FOLLOW)
  assert.equal(c.acceptingHit, true)
})

t('示范动画缺失时由 demoMaxMs 保底进入跟练（不会卡在 demo）', () => {
  const c = createCoach({ level: 'short' })   // demoMaxMs = 5000
  c.begin(0)
  const evs = drive(c, COACH_PRESETS.short.demoMaxMs + 200)
  const follow = evs.find((e) => e.type === 'follow')
  assert.ok(follow, '必须产生 follow 事件')
  assert.equal(follow.reason, 'demoTimeout')
  assert.equal(c.phase, PHASE.FOLLOW)
})

t('跟练命中 → done；再 doneMs 后 advance(done)', () => {
  const c = createCoach()
  c.begin(3)
  c.demoDone()
  assert.equal(c.hit(3).type, 'complete')
  assert.equal(c.phase, PHASE.DONE)
  assert.equal(c.hit(3), null, 'done 阶段不接受重复命中')
  const evs = drive(c, COACH_PRESETS.full.doneMs + 200)
  const adv = evs.find((e) => e.type === 'advance')
  assert.ok(adv)
  assert.equal(adv.reason, 'done')
  assert.equal(adv.step, 3)
  assert.equal(c.phase, PHASE.IDLE)
})

t('命中「别的式」不算数（严格按当前式）', () => {
  const c = createCoach()
  c.begin(2)
  c.demoDone()
  assert.equal(c.hit(5), null)
  assert.equal(c.phase, PHASE.FOLLOW)
})

t('[time] 跟练软等待到点 → 自动重放一次示范（redemo）', () => {
  const c = createTimeCoach()
  c.begin(0)
  c.demoDone()
  const evs = drive(c, COACH_PRESETS.full.softWaitMs + 200)
  const re = evs.find((e) => e.type === 'demo' && e.reason === 'redemo')
  assert.ok(re, '软等待必须触发一次重放')
  assert.equal(c.phase, PHASE.DEMO)
  assert.equal(c.redemo, 1)
})

t('[time] 重放额度用尽 → 不再重放，继续等到硬等待进入宽限', () => {
  const c = createTimeCoach()
  c.begin(0)
  c.demoDone()
  drive(c, COACH_PRESETS.full.softWaitMs + 200)      // 第 1 次重放
  assert.equal(c.redemo, 1)
  c.demoDone()                                        // 重放看完，回到跟练
  const evs = drive(c, COACH_PRESETS.full.hardWaitMs + 300)
  assert.ok(!evs.some((e) => e.type === 'demo'), '额度用尽后不得再重放')
  const g = evs.find((e) => e.type === 'grace')
  assert.ok(g, '硬等待必须进入宽限')
  assert.equal(c.phase, PHASE.GRACE)
  assert.equal(c.acceptingHit, true, '宽限期仍应接受命中')
})

t('[time]【核心】宽限超时 → 自动放行下一式，绝不停死', () => {
  // 关掉自动重放，让「跟练 → 宽限」一步到位，专测宽限本身
  const c = createTimeCoach({ maxRedemo: 0 })
  c.begin(0)
  c.demoDone()
  drive(c, COACH_PRESETS.full.hardWaitMs + 300)       // → grace
  assert.equal(c.phase, PHASE.GRACE)
  const evs = drive(c, COACH_PRESETS.full.graceMs + 300)
  const adv = evs.find((e) => e.type === 'advance')
  assert.ok(adv, '宽限超时必须放行')
  assert.equal(adv.reason, 'timeout')
  assert.equal(c.phase, PHASE.IDLE)
})

t('[time] 完整档：重放看完回到跟练，再等到硬等待才进宽限（长流程串起来）', () => {
  const c = createTimeCoach()
  c.begin(0)
  c.demoDone()
  drive(c, COACH_PRESETS.full.softWaitMs + 200)       // → 自动重放
  assert.equal(c.redemo, 1)
  c.demoDone()                                        // 重放看完 → 跟练
  assert.equal(c.phase, PHASE.FOLLOW)
  const evs = drive(c, COACH_PRESETS.full.hardWaitMs + 300)
  assert.ok(evs.some((e) => e.type === 'grace'), '硬等待到点须进入宽限')
})

t('[time]【核心】任意一轮等待都有上界：不会无限停在同一式', () => {
  const c = createTimeCoach()
  const t0 = Date.now()
  let guard = 0
  c.begin(0)
  c.demoDone()
  // 全程不命中，持续推进；必须在一个有限时间内拿到 advance
  let advanced = false
  while (guard++ < 5000 && !advanced) {
    const evs = drive(c, 200)
    if (evs.some((e) => e.type === 'advance')) advanced = true
    // 重放会回到 demo，需重新进入跟练
    if (c.phase === PHASE.DEMO && c.redemo >= c.cfg.maxRedemo) c.demoDone()
  }
  assert.ok(advanced, '不命中也必须能走到 advance（否则就是停死）')
  const worst = COACH_PRESETS.full
  const bound = worst.softWaitMs + worst.demoMaxMs + worst.hardWaitMs + worst.graceMs
  assert.ok(bound < 60_000, `单式最坏耗时 ${bound}ms 应 < 60s`)
  void t0
})

t('[time] 宽限期点「再练一会儿」→ 回到跟练且重放额度回满', () => {
  const c = createTimeCoach({ maxRedemo: 0 })
  c.begin(0)
  c.demoDone()
  drive(c, COACH_PRESETS.full.hardWaitMs + 300)
  assert.equal(c.phase, PHASE.GRACE)
  assert.equal(c.extend().type, 'follow')
  assert.equal(c.phase, PHASE.FOLLOW)
  assert.equal(c.redemo, 0)
  assert.equal(c.acceptingHit, true)
  // extend() 把 redemo 归零，但档位上限仍是 0（本档不自动重放）；
  // 这里改用默认档验证「续命后重放能力恢复」
  const d = createTimeCoach()
  d.begin(0)
  d.demoDone()
  drive(d, COACH_PRESETS.full.softWaitMs + 200)   // 用掉唯一一次重放
  d.demoDone()
  drive(d, COACH_PRESETS.full.hardWaitMs + 300)   // → grace
  assert.equal(d.phase, PHASE.GRACE)
  d.extend()
  const evs = drive(d, COACH_PRESETS.full.softWaitMs + 200)
  assert.ok(evs.some((e) => e.type === 'demo' && e.reason === 'redemo'), '续命后应恢复重放能力')
})

t('replay()：任何阶段都能手动重看示范', () => {
  const c = createCoach()
  c.begin(1)
  c.demoDone()
  assert.equal(c.replay().reason, 'replay')
  assert.equal(c.phase, PHASE.DEMO)
  assert.equal(c.acceptingHit, false)
})

t('[time] 精简档：不自动重放，等待上限更短', () => {
  const c = createCoach({ level: 'short', overrides: { gate: 'time' } })
  assert.equal(c.cfg.maxRedemo, 0)
  c.begin(0)
  c.demoDone()
  const evs = drive(c, COACH_PRESETS.short.hardWaitMs + 300)
  assert.ok(!evs.some((e) => e.type === 'demo'), '精简档不得自动重放')
  assert.ok(evs.some((e) => e.type === 'grace'))
  assert.ok(COACH_PRESETS.short.hardWaitMs < COACH_PRESETS.full.hardWaitMs)
})

t('reset() → 回到 idle 且不再产生事件', () => {
  const c = createCoach()
  c.begin(0)
  c.demoDone()
  c.reset()
  assert.equal(c.phase, PHASE.IDLE)
  assert.deepEqual(c.tick(99999), [])
})

t('idle 下 begin 可重入（推进到新式时反复调用不残留旧定时）', () => {
  const c = createCoach()
  c.begin(0)
  c.demoDone()
  drive(c, 3000)
  c.begin(1)                       // 比如手动「下一个式」打断当前等待
  assert.equal(c.phase, PHASE.DEMO)
  assert.equal(c.step, 1)
  assert.equal(c.elapsed, 0, 'elapsed 必须清零，否则新式会一进去就触发等待')
})

// ============================================================
//  判定闸门 gate:'judge' —— 「没通关就一直练这个动作，通关才进下一式」
// ============================================================

t('默认档就是判定闸门（不显式传 gate）', () => {
  const c = createCoach()
  assert.equal(c.gate, 'judge')
  assert.equal(COACH_PRESETS.full.gate, 'judge')
})

t('[judge]【核心】长时间不命中 → 永不 advance，一直停在那一式', () => {
  const c = createJudgeCoach()
  c.begin(2)                        // 第 3 式
  c.demoDone()                      // → follow
  const evs = drive(c, 10 * 60 * 1000)   // 模拟「10 分钟一直没做到位」
  assert.ok(!evs.some((e) => e.type === 'advance'),
    '判定闸门下没通关绝不能自动放行（否则就违背了「没通关一直循环」）')
  assert.equal(c.phase, PHASE.FOLLOW, '应一直停在跟练阶段')
  assert.equal(c.step, 2, '式号绝不能自己往前走')
})

t('[judge] 每隔 attemptMs 发一次 nudge：重播示范 + 轮次 +1，但阶段仍是 follow', () => {
  const c = createJudgeCoach({ attemptMs: 15000 })
  c.begin(0)
  c.demoDone()
  const evs = drive(c, 15000 * 3)
  const nudges = evs.filter((e) => e.type === 'nudge')
  assert.equal(nudges.length, 3, '每 15s 应发一次 nudge')
  assert.equal(c.attempt, 3)
  assert.equal(c.phase, PHASE.FOLLOW, 'nudge 不得改变阶段（改了就等于把用户踢回示范、白等一遍）')
  assert.equal(nudges[0].step, 0)
  assert.equal(nudges[1].attempt, 2)
})

t('[judge] nudge 期间仍然接受命中（重播途中做到位也算通关）', () => {
  const c = createJudgeCoach({ attemptMs: 5000 })
  c.begin(0)
  c.demoDone()
  drive(c, 5000 * 3)                 // 已经 nudge 3 轮
  assert.equal(c.acceptingHit, true, '判定闸门下跟练全程都该接受命中')
  assert.equal(c.attempt, 3)
  assert.equal(c.hit(0)?.type, 'complete', '第 4 轮做到位必须能通关')
})

t('[judge] 通关 → done → advance(done)，式号才往前走', () => {
  const c = createJudgeCoach()
  c.begin(4)
  c.demoDone()
  drive(c, 1000)
  assert.equal(c.hit(4)?.type, 'complete')
  assert.equal(c.phase, PHASE.DONE)
  const evs = drive(c, c.cfg.doneMs + 200)
  const adv = evs.find((e) => e.type === 'advance')
  assert.ok(adv, '通关后必须产生 advance')
  assert.equal(adv.reason, 'done')
  assert.equal(adv.step, 4)
})

t('[judge] 判定闸门下永不进入宽限（grace 只属于计时放行档）', () => {
  const c = createJudgeCoach()
  c.begin(0)
  c.demoDone()
  const evs = drive(c, 20 * 60 * 1000)
  assert.ok(!evs.some((e) => e.type === 'grace'), '判定闸门不该出现宽限期')
  assert.ok(!evs.some((e) => e.type === 'advance'), '也不该自动放行')
})

t('[judge] 换式时轮次与额度都归零（begin 可重入）', () => {
  const c = createJudgeCoach()
  c.begin(0)
  c.demoDone()
  drive(c, 15000 * 2)
  assert.equal(c.attempt, 2)
  c.begin(1)
  assert.equal(c.attempt, 0)
  assert.equal(c.phase, PHASE.DEMO)
  assert.equal(c.acceptingHit, false, '新式的示范阶段不接受命中')
})

t('[judge] 手动「重看示范」后判定接力不断（demo → follow → 命中）', () => {
  const c = createJudgeCoach()
  c.begin(1)
  c.demoDone()
  drive(c, 3000)
  assert.equal(c.replay()?.reason, 'replay')
  assert.equal(c.phase, PHASE.DEMO)
  assert.equal(c.hit(1), null, '示范阶段不该接受命中')
  c.demoDone()
  assert.equal(c.phase, PHASE.FOLLOW)
  assert.equal(c.hit(1)?.type, 'complete')
})

t('[judge] 示范动画缺失也能保底进跟练，之后照样只在命中时才推进', () => {
  const c = createJudgeCoach({ demoMaxMs: 3000 })
  c.begin(0)                         // 故意不调 demoDone()
  const evs = drive(c, 3000 + 300)
  assert.ok(evs.some((e) => e.type === 'follow' && e.reason === 'demoTimeout'))
  const evs2 = drive(c, 5 * 60 * 1000)
  assert.ok(!evs2.some((e) => e.type === 'advance'), '保底进跟练后同样不得自动换式')
})

console.log(`\n${process.exitCode ? '✗ 有失败' : '✓ 全部通过'}（${pass} 项）\n`)
