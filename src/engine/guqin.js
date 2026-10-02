// 五声音阶古琴合成（Web Audio）—— 纯合成，无音频素材，离线可用
//
// 【为什么原版像西式钢琴】——四处根因，均已修正：
//   ① 分音用整数倍（1 / 2.01 / 3.02）→ 管风琴/钟琴感
//      改用「非谐波分音」：弦振动各分音之比并非整数，古琴尤甚
//   ② 起音用线性 ramp → 电子感、无拨弦动作
//      改用「拨弦瞬态」：2–5ms 冲到峰值，模拟指甲触弦的冲激
//   ③ 单段指数衰减 → 像敲钟
//      改用「双段衰减」：快初衰（拨弦后失能）+ 长尾音（弦体余振）
//   ④ 十二平均律含 4、7 半音 → 「西式感」的根本来源
//      改用五声定弦（宫商角徵羽），完全避开 F、B
//
// 【音阶设计】只用五声音阶，避免 4（F）与 7（B）半音。
//   弦1 C 宫 261.63 · 弦2 D 商 293.66 · 弦3 E 角 329.63
//   弦4 G 徵 392.00 · 弦5 A 羽 440.00
//   弦6 C' 宫' 523.25 · 弦7 D' 商' 587.33
// 收势用五声和弦（宫商角徵羽叠置），而非七弦齐奏 —— 更空灵、不浑浊。

export const PENTATONIC = [
  { note: 'C',  gong: '宫', freq: 261.63, role: '起势 · 唤醒' },
  { note: 'D',  shang: '商', freq: 293.66, role: '蓄力 · 沉肩' },
  { note: 'E',  jue:  '角', freq: 329.63, role: '伸展 · 抻筋' },
  { note: 'G',  zhi:  '徵', freq: 392.00, role: '运劲 · 发力' },
  { note: 'A',  yu:   '羽', freq: 440.00, role: '收势 · 归元' },
  { note: "C'", gong2: '宫', freq: 523.25, role: '进阶 · 变奏' },
  { note: "D'", shang2: '商', freq: 587.33, role: '完成 · 圆满' },
]

// 各弦的角色标签（UI 展示用）
export const STRING_ROLE = PENTATONIC.map((p) => p.role)
// 唱名（宫商角徵羽）
export const STRING_NAME = PENTATONIC.map((p) => p.gong || p.shang || p.jue || p.zhi || p.yu || p.gong2 || p.shang2)

// 收势五声和弦：宫商角徵羽（C E G A D）
const CHORD_FREQ = [261.63, 329.63, 392.00, 440.00, 587.33]

// 非谐波分音比：真实弦振动各分音不成整数倍，古琴的清越感正源于此
// [倍频, 增益, 衰减倍率] —— 高次分音衰减更快（真实弦的高次模态能量损耗大），
// 但基频必须留住长 sustain，那才是「余韵不绝」的来源
//
// 注意 5.12 的来历：原 5.40 × 261.63 = 1412.8Hz，而 F6 = 1396.9Hz，
// 只差 20 音分，实质落在 F 上，直接违反「频谱无 F/B 半音成分」的验收。
// 5.12 × 261.63 = 1339.1Hz，距 F6 有 73 音分，安全。
// 该值由 guqin-ks/render.mjs --partial=5.12 实测确认（F/B 禁区 ✅）。
const PARTIALS = [
  [1.00, 1.00, 1.00],   // 基频：全程 sustain
  [2.76, 0.34, 0.55],   // 八度上再加一点，弦的「金属感」
  [5.12, 0.15, 0.30],   // 高次泛音，快速衰减
  [8.93, 0.06, 0.18],   // 极高泛音，一闪即逝
]

let ctx = null
let master = null

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.85
    try {
      // 混响：古琴余韵靠空间感，卷积混响不可省
      const conv = ctx.createConvolver()
      const len = Math.floor(ctx.sampleRate * 2.6)   // 2.6s 尾音
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.55
      }
      conv.buffer = buf
      const wet = ctx.createGain()
      wet.gain.value = 0.34
      master.connect(conv); conv.connect(wet); wet.connect(ctx.destination)
      master.connect(ctx.destination)
    } catch {
      master.connect(ctx.destination)
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/**
 * 拨一根弦
 * @param {number} idx 1~7
 * @param {object} opt {gain, decay, delay, bright}
 */
export function pluck(idx, opt = {}) {
  const c = ensure()
  if (!idx || idx < 1 || idx > 7) return
  const f = PENTATONIC[idx - 1].freq
  const t0 = c.currentTime + (opt.delay || 0)
  const peak = (opt.gain ?? 1) * 0.32
  const decay = opt.decay ?? 4.2          // 尾音总长（秒），古琴余韵特征
  const bright = opt.bright ?? 1

  const out = c.createGain()
  out.gain.setValueAtTime(0, t0)
  out.gain.setValueAtTime(peak, t0 + 0.003)                      // ② 拨弦瞬态：3ms 冲到峰值
  out.gain.exponentialRampToValueAtTime(peak * 0.50, t0 + 0.25) // ③ 快初衰（拨弦后失能）
  out.gain.exponentialRampToValueAtTime(peak * 0.20, t0 + 1.20) // 中段缓降
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)      // 长尾音
  out.connect(master)

  // 低通：越往后越暗，模拟弦振动衰减时高频先失
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(Math.min(16000, f * 11 * bright), t0)
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.8), t0 + decay * 0.85)
  lp.connect(out)

  // ① 非谐波分音（各自独立的衰减倍率）
  for (const [mul, g, dcy] of PARTIALS) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * mul, t0)
    // 极轻微的音高漂移：真实弦有张力变化，纯粹不动反而像合成器
    o.frequency.linearRampToValueAtTime(f * mul * 0.997, t0 + decay)
    const og = c.createGain()
    og.gain.setValueAtTime(0, t0)
    og.gain.linearRampToValueAtTime(g * 0.8, t0 + 0.004)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * dcy)
    o.connect(og); og.connect(lp)
    o.start(t0); o.stop(t0 + decay + 0.1)
  }

  // ② 触弦噪声 burst（指甲/肉指擦弦的质感）
  const nLen = Math.floor(c.sampleRate * 0.035)
  const nBuf = c.createBuffer(1, nLen, c.sampleRate)
  const nd = nBuf.getChannelData(0)
  for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nLen, 4)
  const src = c.createBufferSource()
  src.buffer = nBuf
  const ng = c.createGain()
  ng.gain.value = 0.20
  const nf = c.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.value = f * 5
  nf.Q.value = 1.2
  src.connect(nf); nf.connect(ng); ng.connect(out)
  src.start(t0)
}

/** 收势：五声和弦（宫商角徵羽叠置），空灵不浑浊 */
export function chordAll(opt = {}) {
  CHORD_FREQ.forEach((f, i) => {
    // 直接用基频 + 微增益，和弦比单弦更柔
    const c = ensure()
    const t0 = c.currentTime + i * (opt.spread ?? 0.09)
    const peak = (opt.gain ?? 1) * 0.16
    const decay = opt.decay ?? 4.2
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f, t0)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.setValueAtTime(peak, t0 + 0.006)
    g.gain.exponentialRampToValueAtTime(peak * 0.34, t0 + 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
    o.connect(g); g.connect(master)
    o.start(t0); o.stop(t0 + decay + 0.1)
    // 每个音叠加一撮高频泛音，和弦才有「泛音层」
    pluckByFreq(f, t0, peak * 0.5, decay * 0.7)
  })
}

function pluckByFreq(f, t0, peak, decay) {
  const c = ctx
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(f * 2.76, t0)     // 用非谐波倍频
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.setValueAtTime(peak, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
  o.connect(g); g.connect(master)
  o.start(t0); o.stop(t0 + decay + 0.05)
}

/** 命中反馈音（比琴弦轻，用于 UI 提示） */
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
  o.connect(g); g.connect(master)
  o.start(t0); o.stop(t0 + 0.2)
}

export function unlockAudio() { ensure() }
export function isAudioReady() { return !!ctx && ctx.state === 'running' }
export { PENTATONIC as STRINGS }
