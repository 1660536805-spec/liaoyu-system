// 兜底第一级自测：预录视频切换状态机 + 信号健康检查
// 目的：Done 判定「断识别 → 出视频 ≤3s / 切过去式号计时打卡连续」在 node 里先证一遍，
//       真机再掐表复核一次。
// 运行：node scripts/fallback.test.mjs
import { FallbackSwitch, frameAlive, FALLBACK_SRC, FALLBACK_CFG } from '../src/engine/fallback.js'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

// 造一帧假骨架：满有效 / 部分有效 / 无 / 数组太短
const pt = (v, x = 0.5, y = 0.5) => ({ x, y, z: 0, visibility: v })
const frame = (visOf) => {
  const a = new Array(33)
  for (let i = 0; i < 33; i++) a[i] = pt(typeof visOf === 'function' ? visOf(i) : visOf)
  return a
}

console.log('\n=== 1. frameAlive 信号健康检查 ===')
{
  const full = frame(0.9)
  okc(frameAlive(full) === true, '满有效帧（33 点全 0.9）判为有信号')

  // 6/8 门槛：把髋（23/24）打没，还剩 6 点
  const noHip = frame((i) => (i === 23 || i === 24 ? 0.02 : 0.9))
  okc(frameAlive(noHip) === true, '少了髋（23/24）仍算有信号（6/8 门槛）')

  const onlyHip = frame((i) => (i === 23 || i === 24 ? 0.9 : 0.02))
  okc(frameAlive(onlyHip) === false, '只有髋有效 → 判为无信号（不会误踩兜底）')

  okc(frameAlive(null) === false, 'null 帧 → 无信号')
  okc(frameAlive([]) === false, '空数组 → 无信号')
  okc(frameAlive(frame(0.1)) === false, '全都低于可见度门槛 → 无信号')
}

console.log('\n=== 2. 假 video 元素：文件缺失时必须立刻炸出来 ===')
{
  const fake = {
    readyState: 0, loop: false, muted: false, playsInline: false, preload: '', src: '',
    playCalls: 0,
    _fire(type) { this._ls.filter((f) => f.t === type).forEach((f) => f.fn()) },
    _ls: [],
    addEventListener(t, fn) { this._ls.push({ t, fn }) },
    removeEventListener(t, fn) { this._ls = this._ls.filter((x) => !(x.t === t && x.fn === fn)) },
    load() {},
    play() { this.playCalls++; this.readyState = 4; return Promise.resolve() },
    pause() {},
  }
  const errors = []
  const fb = new FallbackSwitch(fake, { onError: (e) => errors.push(e) })

  okc(fb.state === 'idle', '初始状态 idle')
  const p = fb.prepare()                 // 同步挂好监听后再点火
  fake._fire('error')
  await p
  okc(fb.state === 'error', '取不到视频 → error（不静默，现场一眼看得见）')
  okc(errors.length === 1, 'onError 上报了一次')
  okc(String(errors[0].message).includes(FALLBACK_SRC), `报错点名了 ${FALLBACK_SRC}`)
  okc(await fb.enter('测试') === false, '视频缺席 → enter() 返回 false')
  okc(errors.length === 1, 'enter 不再重复打 404（error 态直接短路）')
}

console.log('\n=== 3. 假 video 元素：热启动切换 ≤3s（Done 硬指标）===')
{
  const fake = {
    readyState: 4, loop: false, muted: false, playsInline: false, preload: '', src: '',
    playCalls: 0, _ls: [],
    addEventListener(t, fn) { this._ls.push({ t, fn }); if (t === 'canplay' && this.readyState >= 3) fn() },
    removeEventListener() {},
    load() {},
    play() { this.playCalls++; return Promise.resolve() },
    pause() {},
  }
  const entered = []
  const exited = []
  let t = 0
  const fb = new FallbackSwitch(fake, {
    onEnter: (r) => entered.push(r),
    onExit: () => exited.push(1),
    now: () => t,
  })

  await fb.prepare()
  okc(fb.state === 'ready', '预热后 ready')
  okc(fake.loop === true && fake.muted === true && fake.playsInline === true, 'loop/muted/playsInline 都设上了')
  okc(fake.src === FALLBACK_SRC, `src 指向 ${FALLBACK_SRC}（本地资源，不是 CDN）`)

  t = 1000
  const okd = await fb.enter('识别中断')
  okc(okd === true, 'enter() 成功')
  okc(fake.playCalls === 1, '调了一次 play()')
  okc(fb.enteredAt - fb.warmAt < 3000, `切换耗时 ${fb.enteredAt - fb.warmAt}ms < 3000ms（Done 硬指标）`)
  okc(entered.length === 1 && entered[0] === '识别中断', 'onEnter 带上了原因')

  fb.exit()
  okc(fb.state === 'idle', 'exit() 回到 idle')
  okc(exited.length === 1, 'onExit 触发一次')
  okc(fb.active === false, 'active 为 false')
  okc(await fb.enter('再切一次') === true, '退出后还能再切回去')
}

console.log('\n=== 4. play() 被拒时要重试一次，而不是直接放弃 ===')
{
  let calls = 0
  const fake = {
    readyState: 4, src: '', _ls: [],
    addEventListener(t, fn) { this._ls.push({ t, fn }) }, removeEventListener() {}, load() {},
    play() { calls++; if (calls === 1) return Promise.reject(new Error('AbortError')); return Promise.resolve() },
    pause() {},
  }
  const fb = new FallbackSwitch(fake, {})
  await fb.prepare()
  okc(await fb.enter('x') === true, '第一次 play 被拦，重试后成功')
  okc(calls === 2, `play() 共调了 ${calls} 次`)
}

console.log('\n=== 5. 触发参数在合理区间 ===')
{
  okc(FALLBACK_CFG.noSignalMs > 0 && FALLBACK_CFG.noSignalMs <= 5000,
    `noSignalMs=${FALLBACK_CFG.noSignalMs}（断识别后切预录，上限 5s）`)
  okc(FALLBACK_CFG.firstFrameMs >= FALLBACK_CFG.noSignalMs,
    `firstFrameMs=${FALLBACK_CFG.firstFrameMs} ≥ noSignalMs（没人入镜的容忍比断流更久）`)
  okc(FALLBACK_CFG.recoverFrames >= 20, `recoverFrames=${FALLBACK_CFG.recoverFrames}（回实时要连续有效帧防抖）`)
  okc(!('autoAdvanceMs' in FALLBACK_CFG), '预录演示不再自动推进或记为动作完成')
  okc(/^\/assets\/fallback\.mp4$/.test(FALLBACK_SRC), '视频源是本地路径')
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
