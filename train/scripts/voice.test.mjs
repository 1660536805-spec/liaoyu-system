// 语音播报自测 —— 验证时机、去重、冷却、降级、恢复
// 运行：npm run test:voice
//
// 说明：这里用 mock speaker（不真发声），只验证「什么时候该播」这个逻辑，
// 真发声与音质属浏览器/模型行为，不在此断言。
import { createAnnouncer } from '../src/engine/announcer.js'
import { buildSpeech, buildCompleteSpeech, getMoveSpeech, previewText } from '../src/data/speech.js'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 记录每次播报内容的 mock speaker */
function mockSpeaker(opts = {}) {
  const log = []
  const st = {
    enabled: opts.enabled !== false,
    engineMode: opts.engineMode || 'auto',
    volume: 0.9, rate: 1,
    kokoroStatus: opts.kokoroStatus || 'idle',
    kokoroError: '',
    webReady: opts.webReady !== false,
  }
  return {
    log, st,
    on(e, fn) { (this._l = this._l || {})[e] = fn; return this },
    prime() { (this._l && this._l.state) && this._l.state({ ...st }) },
    async preloadKokoro() { st.kokoroStatus = 'ready'; return true },
    async speak(text) {
      if (!st.enabled || !text) return ''
      log.push(text)
      ;(this._l && this._l.spoken) && this._l.spoken({ engine: 'mock', text })
      return 'webspeech'
    },
    stop() { (this._l && this._l.state) && this._l.state({ ...st }) },
    set(p) { Object.assign(st, p); (this._l && this._l.state) && this._l.state({ ...st }) },
    get enabled() { return st.enabled },
    get state() { return { ...st } },
    dispose() {},
  }
}

console.log('\n=== 1. 播报文案生成（多拳种）===')
{
  // 八段锦
  const t1 = buildSpeech('baduanjin', 1, 'full')
  okc(t1.includes('第1式'), `八段锦式1 全档含序号：「${t1}」`)
  okc(t1.includes('双手托天'), '含口语简称')
  okc(t1.includes('双臂向上举过头顶'), '含动作要领')
  okc(buildSpeech('baduanjin', 1, 'short') === '双手托天', 'short 档只留简称')
  okc(buildSpeech('baduanjin', 1, 'name') === '', 'name 档返回空（无可用引擎时静默）')

  // 五禽戏 —— 用户反馈的核心：进五禽戏第一式要播报
  const h1 = buildSpeech('wuqinxi', 1, 'full')
  okc(h1.includes('第1式') && h1.includes('虎举'), `五禽戏式1 播报：「${h1}」`)
  okc(h1.includes('虎爪'), '五禽戏式1 含要领（虎爪）')
  const names = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => getMoveSpeech('wuqinxi', i)?.voice)
  // 五禽戏按国家体育总局《健身气功 · 五禽戏》十式取式（虎戏 1-2 / 鹿戏 3-4 / 熊戏 5-6 /
  // 猿戏 7-8 / 鸟戏 9-10）。第 4 式旧名「猿攀」（那是「攀援引体」）于 2026-10-10 纠正。
  okc(JSON.stringify(names) === JSON.stringify(['虎举', '虎扑', '鹿抵', '鹿奔', '熊运', '熊晃', '猿提', '猿摘', '鸟伸', '鸟飞']),
    `五禽戏十式齐全且顺序正确：${names.join('/')}`)
  const wqShort = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => buildSpeech('wuqinxi', i, 'short'))
  okc(wqShort.every((t) => t && t.length <= 4), `五禽戏简称均 ≤4 字：${wqShort.join('、')}`)
  okc(buildCompleteSpeech('wuqinxi', 'short') === '十式练毕', '五禽戏完成语定制')
  okc(buildCompleteSpeech('baduanjin', 'short') === '八式练毕', '八段锦完成语定制')

  // 太极 —— 二十四式全部落地
  const tj1 = buildSpeech('taiji', 1, 'full')
  okc(tj1.includes('起势'), `太极式1 播报：「${tj1}」`)
  const TJ = Array.from({ length: 24 }, (_, k) => k + 1)
  const tjVoices = TJ.map((i) => getMoveSpeech('taiji', i)?.voice)
  okc(tjVoices.every((v) => typeof v === 'string' && v.length > 0),
    `太极二十四式播报齐全（缺 ${tjVoices.filter((v) => !v).length} 条）`)
  okc(tjVoices[4] === '手挥琵琶' && tjVoices[8] === '单鞭' && tjVoices[23] === '收势',
    `太极关键式名正确：5=${tjVoices[4]} / 9=${tjVoices[8]} / 24=${tjVoices[23]}`)
  // 第 18 式必须与 styles.js 的式名一致（简化二十四式标准名「左右穿梭」，勿用老架名「玉女穿梭」）
  okc(tjVoices[17] === '左右穿梭',
    `太极式18 与 styles.js 对齐：18=${tjVoices[17]}`)
  okc(buildSpeech('taiji', 25, 'full') === '', '太极式25（越界）返回空，不误播')
  okc(buildCompleteSpeech('taiji', 'short') === '廿四式练毕', '太极完成语定制')
  okc(buildSpeech('nonexistent', 1, 'full') === '', '未知拳种返回空')

  // 各式简称长度（节奏考虑）
  const allShort = [
    ...[1,2,3,4,5,6,7,8].map((i) => getMoveSpeech('baduanjin', i)?.voice || ''),
    ...[1,2,3,4,5,6,7,8,9,10].map((i) => getMoveSpeech('wuqinxi', i)?.voice || ''),
    ...TJ.map((i) => getMoveSpeech('taiji', i)?.voice || ''),
  ]
  okc(allShort.every((s) => s.length <= 5), `全部简称 ≤5 字：${allShort.join('、')}`)
  okc(previewText('wuqinxi', 1).includes('虎举'), 'previewText 可供 UI 预览')
}

console.log('\n=== 2. 正常流程：动作切换才播 ===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  await an.onMove(1, 8); okc(sp.log.length === 1, `进入式1 播 1 次（共 ${sp.log.length}）`)
  await sleep(700)
  await an.onMove(2, 8); okc(sp.log.length === 2, `切到式2 播第 2 次（共 ${sp.log.length}）`)
  await sleep(700)
  await an.onMove(3, 8); okc(sp.log.length === 3, `切到式3 播第 3 次（共 ${sp.log.length}）`)
  okc(sp.log[2].includes('第3式'), `播的是新动作而非旧动作：「${sp.log[2]}」`)
}

console.log('\n=== 3. 边界①重复进入同一动作（去重）===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  await an.onMove(1, 8)
  await sleep(200)
  await an.onMove(1, 8)      // 同一动作
  okc(sp.log.length === 1, `同一动作重复进入不重播（${sp.log.length} 次）`)
  await an.onMove(1, 8, { force: true })
  okc(sp.log.length === 2, `force=true 时强制重播（${sp.log.length} 次）`)
}

console.log('\n=== 4. 边界②连续快速切换（冷却）===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  // 不 sleep，连点 5 次
  await an.onMove(1, 8)
  await an.onMove(2, 8)      // 冷却期内 → 不播
  await an.onMove(3, 8)      // 冷却期内 → 不播
  await an.onMove(4, 8)
  okc(sp.log.length === 1, `快速连点只播 1 次（${sp.log.length}），避免语音堆叠`)
  await sleep(700)
  await an.onMove(5, 8)      // 冷却已过 → 播
  okc(sp.log.length === 2, `冷却结束后新动作才播（${sp.log.length} 次）`)
}

console.log('\n=== 5. 边界③关闭开关后不播 ===')
{
  const sp = mockSpeaker({ enabled: false })
  const an = createAnnouncer(sp)
  await an.onMove(1, 8)
  okc(sp.log.length === 0, `关闭时不播（${sp.log.length}）`)
  sp.set({ enabled: true })
  an.reset()                    // 清掉上一段留下的冷却/去重状态
  await an.onMove(1, 8)
  okc(sp.log.length === 1, '开启后可播')
}

console.log('\n=== 6. 边界④无可用语音 → 静默不报错 ===')
{
  const sp = mockSpeaker({ webReady: false, kokoroStatus: 'failed' })
  const an = createAnnouncer(sp)
  let threw = false
  try { await an.onMove(1, 8); await an.onMove(4, 8) } catch (e) { threw = true }
  okc(!threw, '无任何引擎时不抛异常')
  okc(sp.log.length === 0, `无引擎时不产出播报（${sp.log.length}）`)
  // 降级档：Kokoro 加载中 + 无系统中文音色 → 走 short 档（只要简称）
  const sp2 = mockSpeaker({ webReady: false, kokoroStatus: 'loading' })
  const an2 = createAnnouncer(sp2)
  await an2.onMove(1, 8)
  okc(sp2.log.length === 1 && sp2.log[0] === '双手托天',
    `Kokoro 加载中降级为 short 档（只报简称）：「${sp2.log[0] || '无'}」`)
// 完全不可用时连 short 都不播（静默）
  const sp3 = mockSpeaker({ webReady: false, kokoroStatus: 'failed' })
  const an3 = createAnnouncer(sp3)
  await an3.onMove(1, 8)
  okc(sp3.log.length === 0, '两引擎都不可用时静默（连 short 也不播）')
}

console.log('\n=== 7. 边界⑤页面刷新/中断后恢复 ===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  await an.onMove(1, 8)
  await sleep(700)
  an.stop()                       // 中断（如退出页面）
  okc(an.busy === false, 'stop 后 busy 复位，不会卡在「正在播」')
  okc(an.currentId === null, 'stop 后清空当前动作')
  await sleep(700)
  await an.onMove(1, 8)            // 恢复后应能重播第 1 式
  okc(sp.log.length === 2, `恢复后能重播（${sp.log.length} 次）`)
  // 重新开始整套 → 去重清空
  an.reset()
  await an.onMove(1, 8)
  okc(sp.log.length === 3, `reset() 后第 1 式可再次播报（${sp.log.length} 次）`)
}

console.log('\n=== 8. 边界⑥完成语 ===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  await an.onComplete(8)
  okc(sp.log.length === 1, '整套完成时播报完成语')
  okc(sp.log[0].includes('八式练毕'), `完成语文案正确：「${sp.log[0]}」`)
  okc(buildCompleteSpeech('baduanjin', 'short') === '八式练毕', 'short 档完成语也可用')
}

console.log('\n=== 9. 边界⑦重复点击试听 ===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  await an.repeat(1, 8); await an.repeat(1, 8); await an.repeat(1, 8)
  okc(sp.log.length >= 1, `试听可反复触发（${sp.log.length} 次）`)
  okc(sp.log.every((t) => t.includes('第1式')), '每次都是当前动作的内容')
}

console.log('\n=== 10. 边界⑧空值与非法输入 ===')
{
  const sp = mockSpeaker()
  const an = createAnnouncer(sp)
  await an.onMove(null, 8)        // 清空
  await an.onMove(undefined, 8)
  await an.onMove(99, 8)           // 不存在的 id
  okc(sp.log.length === 0, 'null / undefined / 非法 id 都不播也不报错')
  await an.onComplete(8)
  sp.set({ enabled: false })
  await an.onMove(1, 8)
  okc(sp.log.length === 1, '关闭后完成语也不播')
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
