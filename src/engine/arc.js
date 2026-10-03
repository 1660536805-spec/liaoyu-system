// 阶段三「面」——12 分钟连续弧线（跟练轨）
//
// 【来源】整段结构和调度抄自甲方《弦养_十二分钟弧线_五调.html》，字段一个没改：
//   · MODES：五调各带 A/B/E/D/C/C2/P/Z 七条动机，落音不同、结构相同（同宫系统）
//   · SECTIONS：九段（起势 → 收功），五调共用，一个字都不改
//   · ONSET / CHOIRS / CHORD / CHOCT：甲方的事件进入点与七弦齐鸣时刻
//   · scheduleCycle / scheduleBass / scheduleChoir / fill：甲方的前瞻调度
// 波的形状（强度 i0→i1、密度 cyc、音区 oct、明暗 bright、力度 den、峰点 peak）全部沿用。
//
// 【总纲对齐】
//   §5.1  五个调式共用同一条九段结构，只换「动机落音」和「低音主音」
//   §3    第 8 式 = 七弦齐鸣，属于弦层，与调式无关 → CHORD 固定不变
//   §9.2  阶段三撤掉氛围音（弧线自己每 4 拍一次主音低八度散音，不再叠）
//   §9.1  六、七弦（宫高/商高）余韵 +0.0006、音量 ×0.88 → 走 guqin.js 的 strLoss/strGain
//   §4    onHit(stringIndex) 契约：1–7 走弦，8 走七弦齐鸣

import { pluckDeg, hvoice, chordAll, audioCtx, stopAll, STRING_NAME } from './guqin.js'

/** 12 分钟 = 720 秒 */
export const ARC_TOTAL = 720

/* ---------- 五个调式（甲方 MODES，原样搬运） ----------
   同宫系统：音高集合永远是 F G A C D（简谱 1 2 3 5 6），只换谁当家。 */
export const ARC_MODES = {
  gong: { g: '宫', o: '脾', mode: '宫调式', tonic: 1,
    M: { A: [5, 6, 5, 3, 2, 1], B: [3, 5, 6, 5, 3, 5], E: [6, 5, 3, 5, 6, 5], D: [2, 3, 5, 6, 5, 3],
         C: [1, 3, 2, 3], C2: [2, 1, 2], P: [1, 3, 5, 6, 5, 1], Z: [1] } },
  shang: { g: '商', o: '肺', mode: '商调式', tonic: 2,
    M: { A: [6, 1, 6, 5, 3, 2], B: [3, 5, 6, 5, 3, 6], E: [1, 6, 5, 6, 1, 6], D: [3, 5, 1, 6, 5, 1],
         C: [3, 1, 2, 1], C2: [1, 2, 1], P: [2, 3, 5, 6, 5, 2], Z: [2] } },
  jiao: { g: '角', o: '肝', mode: '角调式', tonic: 3,
    M: { A: [1, 2, 1, 6, 5, 3], B: [5, 6, 5, 3, 2, 6], E: [2, 1, 6, 1, 2, 6], D: [5, 6, 2, 1, 6, 2],
         C: [1, 3, 1, 2], C2: [2, 3, 2], P: [3, 5, 6, 1, 6, 3], Z: [3] } },
  zhi: { g: '徵', o: '心', mode: '徵调式', tonic: 5,
    M: { A: [6, 1, 6, 5, 3, 5], B: [1, 2, 1, 6, 5, 2], E: [2, 1, 6, 5, 3, 2], D: [1, 2, 6, 5, 3, 6],
         C: [2, 3, 2, 1], C2: [2, 1, 2], P: [5, 6, 1, 2, 1, 5], Z: [5] } },
  yu: { g: '羽', o: '肾', mode: '羽调式', tonic: 6,
    M: { A: [1, 2, 1, 6, 5, 6], B: [2, 3, 2, 1, 6, 3], E: [3, 2, 1, 6, 5, 3], D: [2, 3, 1, 6, 5, 1],
         C: [3, 2, 3, 1], C2: [3, 1, 3], P: [6, 1, 2, 3, 2, 6], Z: [6] } },
}

export const ARC_ORDER = ['gong', 'shang', 'jiao', 'zhi', 'yu']

/* ---------- 九段结构（五调通用，一个字都不改） ---------- */
export const ARC_SECTIONS = [
  { n: 1, name: '起势 · 双手托天理三焦', t: 0,   dur: 90, i0: 0.25, i1: 0.40, cyc: 20, oct: 0, bright: 1, motif: 'A',  bass: 10, den: 1.00 },
  { n: 2, name: '左右开弓似射雕',       t: 90,  dur: 90, i0: 0.40, i1: 0.50, cyc: 18, oct: 0, bright: 1, motif: 'D',  bass: 10, den: 1.10 },
  { n: 3, name: '调理脾胃须单举',       t: 180, dur: 90, i0: 0.50, i1: 0.52, cyc: 16, oct: 0, bright: 1, motif: 'B',  bass: 9,  den: 1.10 },
  { n: 4, name: '五劳七伤往后瞧',       t: 270, dur: 90, i0: 0.50, i1: 0.45, cyc: 16, oct: 0, bright: 1, motif: 'E',  bass: 9,  den: 1.00 },
  { n: 5, name: '摇头摆尾去心火',       t: 360, dur: 90, i0: 0.42, i1: 0.32, cyc: 22, oct: -1, bright: 0, motif: 'C',  bass: 12, den: 0.70 },
  { n: 6, name: '两手攀足固肾腰',       t: 450, dur: 90, i0: 0.30, i1: 0.25, cyc: 26, oct: -1, bright: 0, motif: 'C2', bass: 14, den: 0.58 },
  { n: 7, name: '攒拳怒目增气力',       t: 540, dur: 90, i0: 0.40, i1: 0.90, cyc: 12, oct: 0, bright: 1, motif: 'P',  bass: 6,  den: 1.50, peak: 1 },
  { n: 8, name: '背后七颠百病消',       t: 630, dur: 60, i0: 0.75, i1: 0.30, cyc: 20, oct: 0, bright: 1, motif: 'A',  bass: 10, den: 0.80 },
  { n: 9, name: '收功',                 t: 690, dur: 30, i0: 0.30, i1: 0.05, cyc: 30, oct: -1, bright: 0, motif: 'Z',  bass: 15, den: 0.40 },
]

/** 音符进入点（按该圈的音符数取） */
const ONSET = { 1: [0], 3: [0, 0.34, 0.68], 4: [0, 0.24, 0.50, 0.76], 6: [0, 0.14, 0.30, 0.44, 0.62, 0.80] }
/** 七弦齐鸣的时刻（秒，总弧线时间轴）——固定不变，与调式无关 */
export const ARC_CHOIRS = [630, 712]
/** 七弦齐鸣：一至七弦（甲方 CHORD / CHOCT） */
export const ARC_CHORD = [1, 2, 3, 5, 6, 1, 2]
export const ARC_CHOCT = [-1, -1, -1, -1, -1, 0, 0]

const LOOK = 2.0     // 前瞻窗口（弧线秒）
const TICK_MS = 130  // 排程检查间隔

/** 强度随段内进度 u(0~1) 线性变化 */
export function arcIAt(sec, u) {
  return sec.i0 + (sec.i1 - sec.i0) * Math.max(0, Math.min(1, u))
}

/** 找 t 秒所在的段 */
export function arcSecAt(t) {
  for (const s of ARC_SECTIONS) if (t >= s.t && t < s.t + s.dur) return s
  return null
}

/** 该段实际用哪几条音（下沉段只走音阶最低三音，主音若在外面要保留，否则丢调性） */
export function arcNotesOf(sec, modeKey) {
  const m = ARC_MODES[modeKey]
  let ns = m.M[sec.motif].slice()
  if (!sec.bright) ns = ns.filter((d) => d < 5 || d === m.tonic)
  return ns
}

const LANDING = { 1: '宫', 2: '商', 3: '角', 5: '徵', 6: '羽' }

/** 动机落音（供界面文案用） */
export function arcLanding(sec, modeKey) {
  const m = ARC_MODES[modeKey]
  const ns = arcNotesOf(sec, modeKey)
  const last = ns[ns.length - 1]
  return (LANDING[last] || last) + (last === m.tonic ? '（主音）' : '')
}

/**
 * 弧线播放器
 * @param {object} opts
 * @param {string} opts.mode  五调 key：gong|shang|jiao|zhi|yu
 * @param {number} opts.speed 倍速：1/2/4/8（只压缩时间轴，弧线形状与比例不变）
 * @param {Function} [opts.onTick] 每帧回调，回传 {t, sec}
 */
export function createArcPlayer({ mode = 'gong', speed = 4, onTick } = {}) {
  let modeKey = mode
  let sp = speed
  let playing = false
  let timer = null
  let t0 = 0
  let cycList = [], bassList = [], ci = 0, bi = 0, chi = 0
  let hitIdx = 0

  const M = () => ARC_MODES[modeKey]
  const rnd = () => Math.random()

  /** 事件表：把九段展开成「一圈一次」和「每 N 秒一次」两张表 */
  function buildLists() {
    cycList = []; bassList = []
    for (const sec of ARC_SECTIONS) {
      let k = 0, t
      for (t = sec.t; t < sec.t + sec.dur; t += sec.cyc) {
        const rem = sec.t + sec.dur - t
        const len = Math.min(sec.cyc, rem)
        if (len < sec.cyc * 0.45 && t > sec.t) continue
        cycList.push({ sec, t, k, len })
        k++
      }
      for (t = sec.t; t < sec.t + sec.dur; t += sec.bass) bassList.push({ sec, t, i: (t - sec.t) / sec.dur })
    }
  }

  /** 排一圈旋律 */
  function scheduleCycle(ev) {
    const sec = ev.sec
    const notes = arcNotesOf(sec, modeKey)
    if (!notes.length) return
    const off = ONSET[notes.length] || ONSET[6]
    const CL = ev.len || sec.cyc
    const noteDur = CL * (sec.oct < 0 ? 0.52 : 0.36)
    const base = sec.t + ev.k * sec.cyc

    for (let i = 0; i < notes.length; i++) {
      let deg = notes[i]
      const u = i / (notes.length - 1 || 1)
      const pi = arcIAt(sec, u)
      let gain = 0.060 + pi * 0.105
      if (ev.k > 0) {
        if (i > 0 && i < notes.length - 1 && rnd() < 0.20) continue
        if (sec.bright && rnd() < 0.22) deg = deg === M().tonic ? 5 : deg
      }
      let oct = sec.oct
      if (sec.peak && rnd() < 0.30) oct = 0
      const gl = rnd() < 0.45 ? 0.006 + rnd() * 0.008 : 0
      const when = t0 + (base + off[i] * CL) / sp
      pluckDeg(deg, oct, { when, dur: noteDur * 1.6, gain: gain * sec.den / 0.34, loss: 0.9973, glide: gl })
      if (sec.peak && rnd() < 0.32) hvoice(deg, 1, when + 0.02, 0.035)
      if (ev.k > 0 && rnd() < 0.05 + pi * 0.30) hvoice(M().tonic, rnd() < 0.35 ? 1 : 0, when + 0.28 + rnd() * 0.55, 0.022)
    }
  }

  /** 排一次低音主音（每 6~15 秒一次，随段而变） */
  function scheduleBass(ev) {
    const sec = ev.sec
    const pi = arcIAt(sec, ev.i)
    const when = t0 + ev.t / sp
    const gain = 0.13 + pi * 0.10
    pluckDeg(M().tonic, -1, {
      when, dur: sec.bass * 1.8, gain: gain * sec.den / 0.34, loss: 0.9984, glide: 0,
      vib: { rate: 0.5 + rnd() * 0.45, depth: 0.0022 },
    })
    if (sec.peak) pluckDeg(M().tonic, 0, {
      when, dur: sec.bass * 1.4, gain: gain * 0.55 / 0.34, loss: 0.9980, glide: 0,
      vib: { rate: 0.6 + rnd() * 0.4, depth: 0.0018 },
    })
  }

  /** 七弦齐鸣（阶段三两处：第七式峰点 630s、收功 712s） */
  function scheduleChoir(tp) {
    for (let i = 0; i < ARC_CHORD.length; i++) {
      pluckDeg(ARC_CHORD[i], ARC_CHOCT[i], {
        when: t0 + (tp + i * 0.035) / sp, dur: 9,
        gain: (0.115 - i * 0.006) / 0.34, loss: i >= 5 ? 0.9992 : 0.9988,
      })
    }
  }

  function fill() {
    if (!playing) return
    const c = audioCtx()
    const horizon = (c.currentTime + LOOK - t0) * sp
    while (ci < cycList.length && cycList[ci].t < horizon) scheduleCycle(cycList[ci++])
    while (bi < bassList.length && bassList[bi].t < horizon) scheduleBass(bassList[bi++])
    while (chi < ARC_CHOIRS.length && ARC_CHOIRS[chi] < horizon) { scheduleChoir(ARC_CHOIRS[chi]); chi++ }

    const done = (c.currentTime - t0) * sp
    if (done >= ARC_TOTAL + 6) { stop(); return }
    if (onTick) onTick(Math.max(0, Math.min(ARC_TOTAL, done)))
  }

  function start() {
    stopAll()
    buildLists(); ci = 0; bi = 0; chi = 0; hitIdx = 0
    const c = audioCtx()
    if (c.state === 'suspended') c.resume()
    playing = true
    t0 = c.currentTime + 0.25
    fill()
    clearInterval(timer)
    timer = setInterval(fill, TICK_MS)
  }

  function stop() {
    playing = false
    clearInterval(timer); timer = null
  }

  /**
   * 浮层：做到位 → 一声泛音点缀（总纲 §4 onHit 契约）
   * @param {number} idx 1–7 走一至七弦；8 走七弦齐鸣
   */
  function hit(idx) {
    const c = audioCtx()
    if (c.state === 'suspended') c.resume()
    const i = (idx ?? hitIdx) % 7
    hitIdx = i + 1
    const seq = [1, 2, 3, 5, 6, 1, 2]
    const octs = [0, 0, 0, 0, 0, 1, 1]
    hvoice(seq[i], octs[i], c.currentTime + 0.02, 0.10)
  }

  return {
    start, stop, hit,
    get playing() { return playing },
    get mode() { return modeKey },
    get speed() { return sp },
    setMode(k) { if (ARC_MODES[k]) modeKey = k },
    setSpeed(v) { sp = v },
    /** 当前弧线时间（秒），未播放时返回 0 */
    time() {
      if (!playing) return 0
      return Math.max(0, Math.min(ARC_TOTAL, (audioCtx().currentTime - t0) * sp))
    },
    /** 弦名直读（界面用，听到＝看到） */
    stringName: STRING_NAME,
  }
}
