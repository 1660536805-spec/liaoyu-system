// 古琴音层 —— 按甲方《弦养_音层设计总纲》重写（2026-10-03）
//
// 【本次重写的依据 —— 全部来自甲方交付包，以甲方为准】
//   1. 定弦＝**产品定弦 · 弦名直读**（总纲 §3，明写「接口契约，直接抄」）
//      宫 = F3 174.614 Hz，三分损益律（宫1 → 徵3/2 → 商9/8 → 羽27/16 → 角81/64）
//      一~七弦 = 宫 商 角 徵 羽 宫(高) 商(高) = 174.61 / 196.44 / 220.89 / 261.92 / 294.66 / 349.23 / 392.88
//      不继承古琴传统正调散声（传统一弦弦名"宫"却响"徵"，总纲明确选择不继承）
//   2. 跟练轨＝**自产合成**（总纲 §5：跟练必须跟动作强度对齐，只能自产；赏听轨才用真录音）
//      故默认 TONE_ENGINE='synth'，音色来自甲方原型的 Karplus–Strong 拨弦模型
//   3. 氛围音固定开启（总纲 决策 8 / §9.2），阶段一电平 0.055
//   4. 六、七弦微调（总纲 §9.1）：loss +0.0006、音量 ×0.88
//   5. 第 8 式＝**七弦齐鸣**（总纲 §3 / §5.1）
//
// 【保留但不默认启用的能力】
//   TONE_ENGINE='sample' 可切回真实古琴散音采样（public/guqin/*.ogg）。
//   采样是标准正调 C-D-F-G-A-c-d，与产品定弦不同，故每条都带
//   file / pitch / shiftSemitones 做逐弦映射（shift 为正 = 升八度，方向已修正）。

export const TONE_ENGINE = 'synth'   // 'synth' = 甲方跟练轨口径（默认） | 'sample' = 真实散音采样

// ---------------------------------------------------------------- 定弦表
//
// deg/oct：三分损益律的度数与八度，交给 fdeg() 算频率（与甲方原型 fdeg() 同式）
// freq   ：总纲 §3 的目标频率，注释与调试对照用
// file/pitch/shiftSemitones：TONE_ENGINE='sample' 时才用的逐弦映射

const BASE = 174.614                                            // 宫 = F3
const R3 = { 1: 1, 2: 9 / 8, 3: 81 / 64, 5: 3 / 2, 6: 27 / 16 }  // 三分损益律

/** 度数 → 频率（与甲方原型 fdeg() 同式） */
export function fdeg(deg, oct) {
  return BASE * (R3[deg] || 1) * Math.pow(2, oct || 0)
}

export const PENTATONIC = [
  { i: 1, name: '宫',     short: '一弦', deg: 1, oct: 0, freq: 174.61, role: '起势 · 唤醒', file: '3-xiang-F2', pitch: 87.307,  shiftSemitones: 12 },
  { i: 2, name: '商',     short: '二弦', deg: 2, oct: 0, freq: 196.44, role: '蓄力 · 沉肩', file: '4-xiang-G2', pitch: 97.999,  shiftSemitones: 12 },
  { i: 3, name: '角',     short: '三弦', deg: 3, oct: 0, freq: 220.89, role: '伸展 · 抻筋', file: '5-xiang-A2', pitch: 110.00,  shiftSemitones: 12 },
  { i: 4, name: '徵',     short: '四弦', deg: 5, oct: 0, freq: 261.92, role: '运劲 · 发力', file: '6-xiang-C3', pitch: 130.813, shiftSemitones: 12 },
  { i: 5, name: '羽',     short: '五弦', deg: 6, oct: 0, freq: 294.66, role: '收势 · 归元', file: '7-xiang-D3', pitch: 146.832, shiftSemitones: 12 },
  { i: 6, name: '宫(高)', short: '六弦', deg: 1, oct: 1, freq: 349.23, role: '进阶 · 变奏', file: '3-xiang-F2', pitch: 87.307,  shiftSemitones: 24 },
  { i: 7, name: '商(高)', short: '七弦', deg: 2, oct: 1, freq: 392.88, role: '完成 · 圆满', file: '4-xiang-G2', pitch: 97.999,  shiftSemitones: 24 },
]

/** 弦名（宫商角徵羽）—— 听到的＝看到的（总纲 决策 7） */
export const STRING_NAME = PENTATONIC.map((p) => p.name)
/** 弦序名（一弦…七弦） */
export const STRING_SHORT = PENTATONIC.map((p) => p.short)
/** 各弦角色标签 */
export const STRING_ROLE = PENTATONIC.map((p) => p.role)

// 六、七弦微调（总纲 §9.1）：高音弦余韵天然更短，提一点 loss；音量压到 0.88
const strLoss = (base, i) => (i >= 5 ? Math.min(0.9992, base + 0.0006) : base)
const strGain = (g, i) => g * (i >= 5 ? 0.88 : 1)

// ---------------------------------------------------------------- 音频图

let ctx = null
let master = null
let bus = null
let wetGain = null
let droneGain = null
let droneOsc = null
let droneOsc2 = null
const live = []                       // 正在响的源，便于停止时统一收尾
const buffers = new Map()             // TONE_ENGINE='sample' 时的采样缓存

/** 氛围音电平（总纲 §9.2：阶段一 0.055，阶段二 0.033，阶段三撤掉） */
export const DRONE_LEVEL_STAGE1 = 0.055
export const DRONE_LEVEL_STAGE2 = 0.033

/** 程序生成混响脉冲响应（甲方原型 makeIR，零音频文件） */
function makeIR(c, sec, decay) {
  const sr = c.sampleRate
  const len = Math.ceil(sr * sec)
  const buf = c.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const n = Math.random() * 2 - 1
      lp = lp * 0.72 + n * 0.28
      d[i] = lp * Math.pow(1 - i / len, decay) * 0.55
    }
  }
  return buf
}

function track(src, endAt) {
  src.__end = endAt
  live.push(src)
  if (live.length > 260) {
    const now = ctx.currentTime
    const k = []
    for (let i = 0; i < live.length; i++) if (live[i].__end > now) k.push(live[i])
    live.length = 0
    for (const s of k) live.push(s)
  }
}

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()

    master = ctx.createGain()
    master.gain.value = 0.0001

    const warm = ctx.createBiquadFilter()
    warm.type = 'lowpass'; warm.frequency.value = 3300; warm.Q.value = 0.4

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -20; comp.knee.value = 28; comp.ratio.value = 3
    comp.attack.value = 0.012; comp.release.value = 0.35

    bus = ctx.createGain(); bus.gain.value = 1
    wetGain = ctx.createGain(); wetGain.gain.value = 0.34
    const conv = ctx.createConvolver(); conv.buffer = makeIR(ctx, 3.4, 3.0)

    bus.connect(warm)
    bus.connect(conv); conv.connect(wetGain); wetGain.connect(warm)
    warm.connect(comp); comp.connect(master); master.connect(ctx.destination)

    // 氛围音：主音低八度 + 同音各一路，经 420Hz 低通（甲方原型结构）
    droneGain = ctx.createGain()
    droneGain.gain.value = DRONE_LEVEL_STAGE1
    droneOsc = ctx.createOscillator(); droneOsc.type = 'sine'
    droneOsc2 = ctx.createOscillator(); droneOsc2.type = 'sine'
    const g2 = ctx.createGain(); g2.gain.value = 0.22
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 420
    droneOsc.connect(droneGain); droneOsc2.connect(g2); g2.connect(droneGain)
    droneGain.connect(dlp); dlp.connect(bus)
    droneOsc.start(); droneOsc2.start()
    setDrone(1)
  }
  if (ctx.state === 'suspended') ctx.resume()
  // 解锁后把 master 拉起来（避免开场爆音）
  if (master.gain.value < 0.5) {
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
    master.gain.linearRampToValueAtTime(0.9, now + 0.4)
  }
  return ctx
}

/**
 * 把氛围音跟到某个主音上（工坊 v2 的 setDrone：低八度 + 同音）
 * @param {number} deg 三损损益度数：宫1 商2 角3 徵5 羽6
 */
export function setDrone(deg) {
  if (!ctx || !droneOsc) return
  const f = fdeg(deg, 0)
  const t = ctx.currentTime
  try {
    droneOsc.frequency.setTargetAtTime(f / 2, t, 0.25)
    droneOsc2.frequency.setTargetAtTime(f, t, 0.25)
  } catch {
    droneOsc.frequency.value = f / 2
    droneOsc2.frequency.value = f
  }
}

/** 氛围音电平（阶段一 0.055 / 阶段二 0.033 / 阶段三 0） */
export function setDroneLevel(level) {
  if (!ctx || !droneGain) return
  try { droneGain.gain.setTargetAtTime(level, ctx.currentTime, 0.2) } catch { droneGain.gain.value = level }
}

// ---------------------------------------------------------------- 采样（可选路径）

const SEMITONE = Math.pow(2, 1 / 12)
function playbackRate(idx) {
  const s = PENTATONIC[idx - 1].shiftSemitones   // 正 = 升八度（方向已修正）
  return Math.pow(SEMITONE, s)
}

function loadSample(idx) {
  if (buffers.has(idx)) return
  const spec = PENTATONIC[idx - 1]
  fetch(`${import.meta.env.BASE_URL}guqin/${spec.file}.ogg`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((ab) => ensure().decodeAudioData(ab).then((buf) => buffers.set(idx, buf)))
    .catch(() => { /* 采样缺失不该让流程崩：静默回退合成 */ })
}

/** 预热（合成模式下无副作用，保留以兼容原调用点） */
export function preloadSamples() {
  if (TONE_ENGINE === 'sample') for (let i = 1; i <= 7; i++) loadSample(i)
}

// ---------------------------------------------------------------- 播放

/**
 * Karplus–Strong 拨弦本体（甲方原型 pluck 的生成部分）
 * @param {AudioContext} c
 * @param {number} f      基频 Hz
 * @param {number} t0     起始时刻（AudioContext 时间轴）
 * @param {number} gain   峰值增益
 * @param {number} dur    余韵秒数
 * @param {number} loss   每次反馈的损耗（越接近 1 余韵越长）
 * @param {number} [glide] 起振上滑量（甲方说这是"像古琴"的关键之一）
 */
function ksPluck(c, f, t0, gain, dur, loss, glide = 0.008, vib = null) {
  const sr = c.sampleRate
  const d = Math.min(dur, 10)
  const N = Math.max(2, Math.round(sr / f))
  const len = Math.max(N * 4, Math.ceil(sr * d))
  const buf = c.createBuffer(1, len, sr)
  const ch = buf.getChannelData(0)
  let prev = 0
  for (let i = 0; i < N; i++) {
    const n = Math.random() * 2 - 1
    prev = prev * 0.62 + n * 0.38
    ch[i] = prev
  }
  for (let i = N; i < len; i++) ch[i] = (ch[i - N] + ch[i - N + 1]) * 0.5 * loss
  const tail = Math.min(len, Math.round(sr * 0.30))
  for (let i = 0; i < tail; i++) ch[len - 1 - i] *= i / tail

  const src = c.createBufferSource()
  src.buffer = buf
  const pr = src.playbackRate
  pr.setValueAtTime(1 - glide, t0)
  pr.linearRampToValueAtTime(1, t0 + 0.45)
  // 极缓吟猱（阶段三弧线的低音主音会用更慢、更浅的一档，见总纲 §9.1 / 甲方弧线原型）
  const lfo = c.createOscillator(); lfo.type = 'sine'
  lfo.frequency.value = vib ? vib.rate : 4.6
  const lg = c.createGain(); lg.gain.value = vib ? vib.depth : 0.0016
  lfo.connect(lg); lg.connect(pr)
  lfo.start(t0 + 0.45); lfo.stop(t0 + Math.min(d, 8) + 0.5)

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.007)
  src.connect(g); g.connect(bus)
  src.start(t0)
  track(src, t0 + d + 0.4)
}

/**
 * 按三损损益度数拨弦 —— 旋律 / 短句用。
 * 七弦之外的音（如主音的低八度）也支持，故不局限 1~7。
 * @param {number} deg 宫1 商2 角3 徵5 羽6
 * @param {number} oct 八度（0 = 基准，-1 = 低八度，1 = 高八度）
 * @param {object} opt {gain, delay, dur, loss, glide, vib:{rate,depth}}
 */
export function pluckDeg(deg, oct = 0, opt = {}) {
  const c = ensure()
  const t0 = opt.when ?? c.currentTime + (opt.delay || 0)
  const k = PENTATONIC.findIndex((p) => p.deg === deg && p.oct === oct)
  if (k >= 0 && TONE_ENGINE === 'sample' && buffers.has(PENTATONIC[k].i)) {
    return pluck(PENTATONIC[k].i, opt)
  }
  ksPluck(c, fdeg(deg, oct), t0, (opt.gain ?? 1) * 0.34, opt.dur ?? 7.5, opt.loss ?? 0.9978, opt.glide ?? 0.008, opt.vib || null)
}

/**
 * 拨一根弦（按弦号）—— Karplus–Strong（甲方原型）
 * @param {number} idx 1~7
 * @param {object} opt {gain, delay, dur}
 */
export function pluck(idx, opt = {}) {
  if (!idx || idx < 1 || idx > 7) return
  const c = ensure()
  const t0 = c.currentTime + (opt.delay || 0)
  const k = idx - 1
  const s = PENTATONIC[k]
  const gain = opt.gain ?? 1

  if (TONE_ENGINE === 'sample') {
    const buf = buffers.get(idx)
    if (buf) {
      const src = c.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = playbackRate(idx)
      const g = c.createGain()
      g.gain.value = strGain(0.34 * gain, k)
      src.connect(g); g.connect(bus)
      src.start(t0); track(src, t0 + 3)
      return
    }
  }

  // ---- 合成：Karplus–Strong 拨弦（甲方原型）
  // 六、七弦 loss +0.0006、音量 ×0.88（总纲 §9.1）
  ksPluck(c, fdeg(s.deg, s.oct), t0, strGain(0.34, k) * gain, opt.dur ?? 7.5, strLoss(0.9978, k))
}

/** 泛音：清灵、一触即散（甲方原型 hvoice，用于浮层与点缀） */
export function hvoice(deg, oct, when, gain = 0.16) {
  const c = ensure()
  const t0 = when ?? c.currentTime
  const f = fdeg(deg, oct)
  const life = 2.6
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + life)
  const parts = [[1, 1], [2, 0.44], [3, 0.17], [4, 0.07]]
  let last = null
  for (const [mul, amp] of parts) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul
    const pg = c.createGain(); pg.gain.value = amp
    o.connect(pg); pg.connect(g); o.start(t0); o.stop(t0 + life + 0.12)
    last = o
  }
  g.connect(bus)
  if (last) track(last, t0 + life + 0.4)
}

/** 第 8 式 · 七弦齐鸣（总纲 §3 / §5.1；甲方原型 choir：七弦依次、间隔 32ms） */
export function chordAll(opt = {}) {
  const base = opt.gain ?? 1
  for (let k = 0; k < 7; k++) {
    const s = PENTATONIC[k]
    pluck(s.i, {
      gain: ((0.20 - k * 0.011) * base) / 0.34,
      delay: (opt.delay || 0) + k * 0.032,
      dur: 9,
    })
  }
}

/** 命中反馈音（比琴弦轻，用于 UI 提示）—— 保留原样 */
export function tick() {
  const c = ensure()
  const t0 = c.currentTime
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(880, t0)
  o.frequency.exponentialRampToValueAtTime(1320, t0 + 0.08)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
  o.connect(g); g.connect(bus)
  o.start(t0); o.stop(t0 + 0.2)
}

/** 停掉所有还在响的源（切页面/停止试听时用） */
export function stopAll() {
  if (!ctx) return
  const now = ctx.currentTime
  // 氛围音是常驻底衬（不经过 live 队列），只压 master 它会继续响 —— 必须单独关掉
  if (droneGain) {
    try {
      droneGain.gain.cancelScheduledValues(now)
      droneGain.gain.setValueAtTime(Math.max(0.0001, droneGain.gain.value), now)
      droneGain.gain.linearRampToValueAtTime(0.0001, now + 0.3)
    } catch { /* 忽略 */ }
  }
  try {
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
    master.gain.linearRampToValueAtTime(0.0001, now + 0.3)
    setTimeout(() => {
      if (!ctx) return
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(0.0001, t)
      master.gain.linearRampToValueAtTime(0.9, t + 0.25)
    }, 340)
  } catch { /* 忽略 */ }
  for (const s of live) { try { s.stop(now + 0.34) } catch { /* 已停 */ } }
  live.length = 0
}

export function unlockAudio() { ensure() }
export function isAudioReady() { return !!ctx && ctx.state === 'running' }
export function audioCtx() { return ensure() }

export { PENTATONIC as STRINGS }
