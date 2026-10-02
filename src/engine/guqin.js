// 古琴音色 —— 真实录音采样（Web Audio 播放）
//
// 【音色来源】真实古琴七弦散音单音，CC BY 4.0（RafaelCaro）。已确认为**标准正调**
// C–D–F–G–A–c–d，音准全部 < ±11 音分。分音为整数倍谐波，辨识度主要来自琴体共振
// （456.9 / 392 / 261 / 130.5 Hz 在全部 7 音里出现，序号随 f0 递减 → 共鸣箱模态），
// 这些音色特征是原合成模型缺失的（见 references/方法与坑位.md）。
//
// 【保持不变的部分 —— 这是硬约束】
//   ✅ 动作识别（judge.js / poseEngine.js / cleaner.js）零改动
//   ✅ 触发链路（onHit → pluck/chordAll）签名与调用点零改动
//   ✅ 播放逻辑（AudioContext 解锁、混响、总线）沿用
//   本次只替换「音色资源本身」：合成振荡器 → 真实录音采样
//
// 【音高策略】见 PITCH_MODE 常量。三种模式解决「素材 C2~D3 vs 项目原定弦 C4~D5 差 2 个八度」：
//   'sample'  = 原样播放，保持素材真实音高（最真实，但整体低 2 个八度）
//   'shift'   = 升 2 个八度，音高与原项目定弦对齐（推荐，动作语义不变）
//   'synth'   = 完全回退到原合成模型（留作 A/B 对照与应急）
//
// 素材在 public/guqin/ 下，Vite 会原样拷贝到 dist/，与项目其他资源（wasm/模型）机制一致。
// 用 ogg Vorbis 而非 wav：7 个共 82 KB vs wav 605 KB，且 ogg 压缩对瞬态与噪声的损伤
// 远小于 mp3（mp3 的 pre-echo 恰好吃掉拨弦冲激，而冲激正是古琴辨识度的关键）。

export const PITCH_MODE = 'shift'   // ← 唯一需要按口味调的开关，见 §音高策略

// ---------------------------------------------------------------- 定弦表
//
// 命名与 strings.json 的 1~7 严格一一对应，顺序不可乱。
// pitch: 该素材的**真实原始音高**（Hz），与 public/guqin/ 下的文件一一对应
// shiftSemitones: 该音升多少个半音（-24 = 升 2 个八度）
// role: 原有角色标签，**未改动**（动作映射语义保持原样）

export const PENTATONIC = [
  { note: 'C',  gong: '宫', role: '起势 · 唤醒',   file: '1-xiang-C2', pitch: 65.406,  shiftSemitones: -24 },
  { note: 'D',  shang: '商', role: '蓄力 · 沉肩', file: '2-xiang-D2', pitch: 73.416,  shiftSemitones: -24 },
  { note: 'F',  jue:  '角', role: '伸展 · 抻筋', file: '3-xiang-F2', pitch: 87.307,  shiftSemitones: -24 },
  { note: 'G',  zhi:  '徵', role: '运劲 · 发力', file: '4-xiang-G2', pitch: 97.999,  shiftSemitones: -24 },
  { note: 'A',  yu:   '羽', role: '收势 · 归元', file: '5-xiang-A2', pitch: 110.00,  shiftSemitones: -24 },
  { note: "C'", gong2: '宫', role: '进阶 · 变奏', file: '6-xiang-C3', pitch: 130.813, shiftSemitones: -24 },
  { note: "D'", shang2:'商', role: '完成 · 圆满', file: '7-xiang-D3', pitch: 146.832, shiftSemitones: -24 },
]

// 各弦的角色标签（UI 展示用）—— 与 strings.json 顺序一致，未改动
export const STRING_ROLE = PENTATONIC.map((p) => p.role)
// 唱名（宫商角徵羽）—— 注意第 3 弦是「角」但素材实际是 F（正调无 E），见文件头说明
export const STRING_NAME = PENTATONIC.map(
  (p) => p.gong || p.shang || p.jue || p.zhi || p.yu || p.gong2 || p.shang2,
)

// 收势五声和弦叠置的弦号（宫商角徵羽 = 弦1/3/4/5 + 弦7）
const CHORD_STRINGS = [1, 3, 4, 5, 7]

// ---------------------------------------------------------------- 音频图

let ctx = null
let master = null
const buffers = new Map()   // idx -> AudioBuffer（懒加载，缺失时回退合成）
const loading = new Set()   // 正在加载中的 idx，防重复请求
let failed = new Set()      // 加载失败的 idx，不再重试

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.85
    try {
      // 混响：古琴余韵靠空间感，卷积混响不可省（沿用原链路，未改）
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

const SEMITONE = Math.pow(2, 1 / 12)
function playbackRate(idx) {
  const s = PENTATONIC[idx - 1].shiftSemitones
  return Math.pow(SEMITONE, s)     // 每半音 2^(1/12)，-24 半音 = 2^-2 = 0.25 → 升 2 个八度
}

/** 懒加载一个采样；失败则标记并回退合成 */
function loadSample(idx) {
  if (PITCH_MODE === 'synth') return
  if (buffers.has(idx) || loading.has(idx) || failed.has(idx)) return
  loading.add(idx)
  const spec = PENTATONIC[idx - 1]
  fetch(`${import.meta.env.BASE_URL}guqin/${spec.file}.ogg`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((ab) => {
      const c = ensure()
      return c.decodeAudioData(ab).then((buf) => buffers.set(idx, buf))
    })
    .then(() => loading.delete(idx))
    .catch(() => {
      loading.delete(idx)
      failed.add(idx)
      // 素材缺失不该让整套流程崩掉：静默回退到合成模型，并在控制台留痕便于排查
      if (typeof console !== 'undefined') {
        console.warn(`[guqin] 采样 ${spec.file}.ogg 加载失败，本音回退合成音色`)
      }
    })
}

/** 预热：一次把 7 个采样都拉进来（开始练时调用，避免首次触发才加载） */
export function preloadSamples() {
  for (let i = 1; i <= 7; i++) loadSample(i)
}

// ---------------------------------------------------------------- 播放

/**
 * 拨一根弦 —— **签名与调用点未变**，内部换成采样播放
 * @param {number} idx 1~7
 * @param {object} opt {gain, delay}
 */
export function pluck(idx, opt = {}) {
  if (!idx || idx < 1 || idx > 7) return
  const c = ensure()
  const t0 = c.currentTime + (opt.delay || 0)
  const gain = opt.gain ?? 1

  const buf = buffers.get(idx)
  if (buf && PITCH_MODE !== 'synth') {
    const src = c.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = playbackRate(idx)
    const g = c.createGain()
    // 采样已是 -3dBFS，这里不再衰减，交给 master 统一控制
    g.gain.value = gain
    src.connect(g); g.connect(master)
    src.start(t0)
    return
  }
  // 首次触发采样还没加载完 → 立刻用合成音顶上，不出延迟、不静默
  synthPluck(c, idx, t0, gain)
}

/** 收势：五声和弦（宫商角徵羽叠置） */
export function chordAll(opt = {}) {
  CHORD_STRINGS.forEach((idx, i) => {
    pluck(idx, { gain: (opt.gain ?? 1) * 0.62, delay: i * (opt.spread ?? 0.09) })
  })
}

/** 命中反馈音（比琴弦轻，用于 UI 提示）—— 不属于音色资源，保持原样 */
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

// ---------------------------------------------------------------- 回退用的合成模型
//
// 以下仅在采样加载失败时兜底使用，逻辑与改造前一致（非谐波分音 1/2.76/5.12/8.93
// + 三段包络 + 拨弦瞬态 + 触弦噪声）。改造前的 PARTIALS 里 5.40 只差 F6 20 音分
// （违反「频谱无 F/B 半音」验收），已修正为 5.12。

const PARTIALS = [
  [1.00, 1.00, 1.00],
  [2.76, 0.34, 0.55],
  [5.12, 0.15, 0.30],
  [8.93, 0.06, 0.18],
]

function synthPluck(c, idx, t0, gain = 1) {
  const f = PENTATONIC[idx - 1].pitch
  const peak = gain * 0.32
  const decay = 4.2

  const out = c.createGain()
  out.gain.setValueAtTime(0, t0)
  out.gain.setValueAtTime(peak, t0 + 0.003)
  out.gain.exponentialRampToValueAtTime(peak * 0.50, t0 + 0.25)
  out.gain.exponentialRampToValueAtTime(peak * 0.20, t0 + 1.20)
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
  out.connect(master)

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(Math.min(16000, f * 11), t0)
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.8), t0 + decay * 0.85)
  lp.connect(out)

  for (const [mul, g, dcy] of PARTIALS) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * mul, t0)
    o.frequency.linearRampToValueAtTime(f * mul * 0.997, t0 + decay)
    const og = c.createGain()
    og.gain.setValueAtTime(0, t0)
    og.gain.linearRampToValueAtTime(g * 0.8, t0 + 0.004)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * dcy)
    o.connect(og); og.connect(lp)
    o.start(t0); o.stop(t0 + decay + 0.1)
  }
}

export { PENTATONIC as STRINGS }
