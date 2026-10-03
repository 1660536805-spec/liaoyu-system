// 五声短句循环 —— 阶段二「线」的素材台
//
// 【来源】调度方式与音频图抄自甲方《弦养_五音短句工坊_v2.html（句尾呼吸版）》：
//   · 每圈 8 拍出声；开「句尾呼吸」后前 8 拍出声、后 2 拍不起新音，只让余韵散掉
//   · 低音散音落点随呼吸走：开 [0,5] 拍，关 [0,4] 拍
//   · 旋律按 TONES[].mel 的 [拍号, 度数, 时值] 排程
//   · 实时播放与离线导出共用同一条链路（buildGraph / pluck / scheduleBar），
//     所以导出的 WAV 与你此刻听到的完全一致
//   · 氛围音固定开启、不给开关（总纲决策 4「阶段一零选择」），电平 0.033（§9.2 阶段二降级到 60%）
//
// 【注意】mel 里的 deg 是三分损益度数（宫1 商2 角3 徵5 羽6），不是弦号——
//   短句属于音层，可以落在任何音上；弦层（一至七弦）只用于动作反馈。
//
// 【改动记录】
//   2026-10-03 v2：补上句尾呼吸开关、BPM、混响湿度、离线导出 WAV（原版只有实时循环）。

import { fdeg, unlockAudio } from './guqin.js'

/** 每圈出声拍数（甲方 SOUND_BEATS） */
export const PHRASE_SOUND_BEATS = 8
/** 句尾留白拍数（甲方 REST_BEATS） */
export const PHRASE_REST_BEATS = 2
/** 阶段二氛围电力平（总纲 §9.2：阶段一 0.055，阶段二降级到 60% → 0.033） */
export const PHRASE_DRONE_LEVEL = 0.033

const LOOK = 0.25        // 前瞻窗口（秒）
const TICK_MS = 40       // 排程检查间隔
const EXP_SR = 44100     // 导出采样率
const TAIL_SEC = 3.5     // 末圈之后留给余韵与混响散尽的尾巴

/** 一圈总拍数：开呼吸 = 8 出声 + 2 留白；关呼吸 = 8 拍连续 */
export function phraseBarLen(breath) { return breath ? PHRASE_SOUND_BEATS + PHRASE_REST_BEATS : PHRASE_SOUND_BEATS }

/** 低音散音的落点（拍序号，0 起） */
export function phraseBassBeats(breath) { return breath ? [0, 5] : [0, 4] }

/** 程序生成混响脉冲（甲方 makeIR） */
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

/** AudioBuffer → WAV Blob（44.1kHz / 16bit 立体声） */
export function audioBufferToWav(buf) {
  const ch = buf.numberOfChannels
  const len = buf.length
  const sr = buf.sampleRate
  const blockAlign = ch * 2
  const dataSize = len * blockAlign
  const ab = new ArrayBuffer(44 + dataSize)
  const v = new DataView(ab)
  let p = 0
  const str = (s) => { for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i)) }
  const u32 = (x) => { v.setUint32(p, x, true); p += 4 }
  const u16 = (x) => { v.setUint16(p, x, true); p += 2 }
  str('RIFF'); u32(36 + dataSize); str('WAVE')
  str('fmt '); u32(16); u16(1); u16(ch); u32(sr); u32(sr * blockAlign); u16(blockAlign); u16(16)
  str('data'); u32(dataSize)
  const d = []
  for (let c = 0; c < ch; c++) d.push(buf.getChannelData(c))
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < ch; j++) {
      let s = d[j][i]
      s = s < -1 ? -1 : (s > 1 ? 1 : s)
      v.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      p += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

/**
 * 五音短句播放器
 * @param {object} opts
 * @param {number} opts.bpm   速度，默认 48（甲方默认值）
 * @param {number} opts.wet   混响湿度 0~1，默认 0.30
 * @param {boolean} opts.breath 句尾呼吸，默认 true
 */
export function createPhrasePlayer({ bpm = 48, wet = 0.30, breath = true } = {}) {
  let ctx = null
  // conv（混响 convolver）必须声明：ES module 是严格模式，
  // 少了这行会在 initAudio 里赋值隐式全局并抛 ReferenceError，整段实时播放哑掉
  let bus = null, wetGain = null, master = null, conv = null
  let droneNodes = null
  let cur = null
  let playing = false
  let timer = null
  let loopStart = 0
  const live = []

  let bpmV = bpm
  let wetAmt = wet
  let breathOn = breath

  const spb = () => 60 / bpmV
  const bar = () => phraseBarLen(breathOn) * spb()

  /** 建音频图：实时播放与离线渲染共用同一套链路 */
  function buildGraph(c, wet, initialGain) {
    const mg = c.createGain()
    mg.gain.value = initialGain

    const warm = c.createBiquadFilter()
    warm.type = 'lowpass'; warm.frequency.value = 3400; warm.Q.value = 0.4

    const comp = c.createDynamicsCompressor()
    // 注意：ratio / threshold / knee / attack / release 都是 AudioParam，只能 .value 赋值，
    // 直接 comp.ratio = 3 会在真浏览器里抛 "has only a getter" 并断掉整条音频链路
    comp.threshold.value = -22; comp.knee.value = 26; comp.ratio.value = 3
    comp.attack.value = 0.012; comp.release.value = 0.3

    const b = c.createGain(); b.gain.value = 1
    const wg = c.createGain(); wg.gain.value = wet
    const conv = c.createConvolver(); conv.buffer = makeIR(c, 2.8, 3.2)

    b.connect(warm)
    b.connect(conv); conv.connect(wg); wg.connect(warm)
    warm.connect(comp); comp.connect(mg); mg.connect(c.destination)

    // 氛围音：主音低八度 + 同音各一路，经 420Hz 低通，不衰减
    const droneGain = c.createGain(); droneGain.gain.value = PHRASE_DRONE_LEVEL
    const dLo = c.createOscillator(); dLo.type = 'sine'
    const dHi = c.createOscillator(); dHi.type = 'sine'
    const dHiG = c.createGain(); dHiG.gain.value = 0.22
    const dLp = c.createBiquadFilter(); dLp.type = 'lowpass'; dLp.frequency.value = 420
    dLo.connect(droneGain); dHi.connect(dHiG); dHiG.connect(droneGain)
    droneGain.connect(dLp); dLp.connect(b)
    dLo.start(0); dHi.start(0)

    return { bus: b, master: mg, wetGain: wg, conv, drone: [dLo, dHi] }
  }

  /** 氛围音跟着当前选中的音走，落在它的主音上（切换音色不重建节点，所以不爆音） */
  function setDrone(tone, c, nodes) {
    if (!nodes || nodes.length < 2 || !tone) return
    const lo = fdeg(tone.tonic, -1)
    const hi = fdeg(tone.tonic, 0)
    if (c && c.state) {
      nodes[0].frequency.setTargetAtTime(lo, c.currentTime, 0.25)
      nodes[1].frequency.setTargetAtTime(hi, c.currentTime, 0.25)
    } else {
      nodes[0].frequency.value = lo
      nodes[1].frequency.value = hi
    }
  }

  /** Karplus–Strong 拨弦 */
  function pluck(c, dest, liveArr, deg, low, when, dur, gain, loss) {
    const sr = c.sampleRate
    const f = fdeg(deg, low ? -1 : 0)
    const N = Math.max(2, Math.round(sr / f))
    const len = Math.max(N * 4, Math.ceil(sr * dur))
    const buf = c.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    let prev = 0
    for (let i = 0; i < N; i++) {
      const n = Math.random() * 2 - 1
      prev = prev * 0.62 + n * 0.38   // 激励偏暗，像指甲触弦
      d[i] = prev
    }
    for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N + 1]) * 0.5 * loss
    const tail = Math.min(len, Math.round(sr * 0.30))
    for (let i = 0; i < tail; i++) d[len - 1 - i] *= i / tail

    const src = c.createBufferSource(); src.buffer = buf
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + 0.006)
    src.connect(g); g.connect(dest)
    src.start(when)
    if (liveArr) {
      liveArr.push(src)
      while (liveArr.length > 48) liveArr.shift()
    }
  }

  /** 排一圈 */
  function scheduleBar(c, dest, liveArr, tone, t0, sp, bass) {
    for (let i = 0; i < bass.length; i++) {
      pluck(c, dest, liveArr, tone.tonic, true, t0 + bass[i] * sp, 5.2 * sp, 0.30, 0.9965)
    }
    for (let k = 0; k < tone.mel.length; k++) {
      const m = tone.mel[k]
      pluck(c, dest, liveArr, m[1], false, t0 + m[0] * sp, Math.max(1.0, m[2] * sp * 1.7), 0.23, 0.9972)
    }
  }

  function initAudio() {
    if (ctx) return
    unlockAudio?.()
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    const g = buildGraph(ctx, wetAmt, 0.0001)
    bus = g.bus; master = g.master; wetGain = g.wetGain; conv = g.conv
    droneNodes = g.drone
    setDrone(cur, ctx, droneNodes)
  }

  function tick() {
    if (!playing || !cur || !cur.mel) return
    const s = spb()
    const b = bar()
    if (!cur.mel) return
    if (loopStart < ctx.currentTime) loopStart = ctx.currentTime + 0.05
    while (loopStart < ctx.currentTime + LOOK) {
      scheduleBar(ctx, bus, live, cur, loopStart, s, phraseBassBeats(breathOn))
      loopStart += b
    }
  }

  function start() {
    initAudio()
    if (ctx.state === 'suspended') ctx.resume()
    setDrone(cur, ctx, droneNodes)
    playing = true
    loopStart = ctx.currentTime + 0.08
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
    master.gain.linearRampToValueAtTime(0.75, now + 0.35)
    clearInterval(timer)
    tick()
    timer = setInterval(tick, TICK_MS)
  }

  function stop() {
    playing = false
    clearInterval(timer); timer = null
    if (ctx) {
      const now = ctx.currentTime
      const cut = now + 0.34
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
      master.gain.linearRampToValueAtTime(0.0001, now + 0.3)
      for (const s of live) { try { s.stop(cut) } catch (e) { /* 已结束 */ } }
      live.length = 0
    }
  }

  return {
    /** @param {object} tone TONES 里的一项；有 mel 才循环，综合档（mel=null）只列曲目 */
    start(tone) {
      cur = tone || cur
      if (!cur) return
      if (!cur.mel) { stop(); return }   // 综合档不自产，只列曲目
      stop()
      setDrone(cur, ctx, droneNodes)
      playing = false
      start()
    },
    stop,
    restart() { const was = playing; stop(); if (was) setTimeout(start, 340) },
    /** 换音（会停/restart，保持甲方 switchTo 的行为） */
    switchTo(tone) {
      const was = playing
      stop()
      cur = tone
      if (was) setTimeout(() => this.start(tone), 340)
      else this.start(tone)
    },
    setBpm(v) { bpmV = v },
    setWet(v) {
      wetAmt = v
      if (wetGain && ctx) wetGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
    },
    setBreath(v) {
      const was = playing
      breathOn = v
      if (was) { stop(); setTimeout(start, 340) }
    },
    /**
     * 离线渲染一段并导出 WAV（不占实时播放）
     * @param {object} tone
     * @param {number} targetSec 期望时长（会按整数圈取整）
     * @returns {Promise<{blob:Blob, name:string, bars:number, sec:number, mb:string}>}
     */
    async exportWav(tone, targetSec = 120) {
      const t = tone || cur
      const s = spb()
      const b = bar()
      const bars = Math.max(1, Math.round(targetSec / b))
      const total = bars * b + TAIL_SEC
      const oc = new OfflineAudioContext(2, Math.ceil(total * EXP_SR), EXP_SR)
      const g = buildGraph(oc, wetAmt, 0.75)
      setDrone(t, null, g.drone)
      for (let k = 0; k < bars; k++) {
        scheduleBar(oc, g.bus, null, t, 0.05 + k * b, s, phraseBassBeats(breathOn))
      }
      const rendered = await oc.startRendering()
      const fade = Math.ceil(0.35 * EXP_SR)
      for (let c = 0; c < rendered.numberOfChannels; c++) {
        const dd = rendered.getChannelData(c)
        for (let i = 0; i < fade; i++) dd[dd.length - 1 - i] *= i / fade
      }
      const name = `弦养_五音短句_${t.name || t.g}音_${t.mode || ''}_${bars}圈_${Math.round(rendered.duration)}秒.wav`
      const mb = (rendered.length * rendered.numberOfChannels * 2 / 1048576).toFixed(1)
      return { blob: audioBufferToWav(rendered), name, bars, sec: rendered.duration, mb }
    },
    get playing() { return playing },
    get tone() { return cur },
    get bpm() { return bpmV },
    get wet() { return wetAmt },
    get breath() { return breathOn },
  }
}
