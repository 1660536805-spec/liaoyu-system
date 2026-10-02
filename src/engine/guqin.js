// 七弦古琴合成（Web Audio）—— 不依赖任何音频素材，纯合成，离线可用
// 对应交付文档 2.3：7 音可听 + 第 8 式收势七弦和声
//
// 音色方案：Karplus-Strong 感知的「 pluck 合成」
//   1) 短噪声 burst 模拟指甲触弦
//   2) 两个失谐正弦（基频 + 2.01 倍频）模拟弦体共振
//   3) 低通滤波 + 指数衰减包络模拟弦的衰减
//   4) 轻微失谐叠加泛音，接近古琴的「泛音清越」

// 古琴正调七弦（C D E F G A B），按八度降两轮，落在舒适听音区
const STRING_FREQ = [196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 392.0] // G3 A3 B3 C4 D4 E4 G4
const STRING_NAME = ['徵', '羽', '宫', '商', '角', '徵', '羽'] // 五声标注（装饰用）

let ctx = null
let master = null

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.9
    // 轻微混响（用卷积模拟古琴的余韵），失败也不影响主流程
    try {
      const conv = ctx.createConvolver()
      const len = Math.floor(ctx.sampleRate * 1.6)
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.5
      }
      conv.buffer = buf
      const wet = ctx.createGain()
      wet.gain.value = 0.22
      master.connect(conv)
      conv.connect(wet)
      wet.connect(ctx.destination)
      master.connect(ctx.destination)
    } catch {
      master.connect(ctx.destination)
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** 拨一根弦
 *  @param {number} idx 0~6；第 8 式和声传 [0..6]
 *  @param {object} opt {gain, decay, delay}
 */
export function pluck(idx, opt = {}) {
  const c = ensure()
  if (!idx || idx < 1 || idx > 7) return
  const i = idx - 1
  const f = STRING_FREQ[i]
  const t0 = c.currentTime + (opt.delay || 0)
  const gain = (opt.gain ?? 1) * 0.30
  const decay = opt.decay ?? 2.4

  const out = c.createGain()
  out.gain.setValueAtTime(0, t0)
  out.gain.linearRampToValueAtTime(gain, t0 + 0.006)   // 起音
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
  out.connect(master)

  // 低通：越往后越暗，模拟弦振动衰减
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(f * 9, t0)
  lp.frequency.exponentialRampToValueAtTime(f * 2.2, t0 + decay * 0.8)
  lp.connect(out)

  // 基频 + 失谐倍频
  for (const [mul, g] of [[1, 0.75], [2.01, 0.22], [3.02, 0.08]]) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * mul, t0)
    // 极轻微的音高漂移，让声音不那么电子
    o.frequency.linearRampToValueAtTime(f * mul * 0.998, t0 + decay)
    const og = c.createGain()
    og.gain.value = g
    o.connect(og); og.connect(lp)
    o.start(t0); o.stop(t0 + decay + 0.1)
  }

  // 触弦噪声 burst
  const nLen = Math.floor(c.sampleRate * 0.02)
  const nBuf = c.createBuffer(1, nLen, c.sampleRate)
  const nd = nBuf.getChannelData(0)
  for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nLen, 5)
  const src = c.createBufferSource()
  src.buffer = nBuf
  const ng = c.createGain()
  ng.gain.value = 0.16
  const nf = c.createBiquadFilter()
  nf.type = 'bandpass'; nf.frequency.value = f * 4
  src.connect(nf); nf.connect(ng); ng.connect(out)
  src.start(t0)
}

/** 收势：七弦齐鸣（和声琶音 → 全弦同时延持） */
export function chordAll(opt = {}) {
  for (let i = 1; i <= 7; i++) {
    pluck(i, { gain: (opt.gain ?? 1) * (0.55 + i * 0.045), delay: (opt.spread ?? 0.075) * (i - 1), decay: opt.decay ?? 3.6 })
  }
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
  g.gain.exponentialRampToValueAtTime(0.10, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
  o.connect(g); g.connect(master)
  o.start(t0); o.stop(t0 + 0.2)
}

export function unlockAudio() { ensure() }
export function isAudioReady() { return !!ctx && ctx.state === 'running' }
export { STRING_FREQ, STRING_NAME }
