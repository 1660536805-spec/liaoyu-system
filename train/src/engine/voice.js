// 语音播报引擎 —— 双通道 + 自动降级
//
// 【为什么双通道】
//   ① Web Speech API（speechSynthesis）：系统内置、零下载、秒开，
//      但**依赖设备是否有中文音色** —— iOS/Android 都可能有，桌面 Linux 常没有。
//   ② Kokoro（kokoro-js）：Apache-2.0 可商用、82M 参数、中文专用版、
//      浏览器本地推理、离线可用；缺点是首次要下 ~80MB 模型。
//   现场可能断网（项目 R3 风险），所以 Kokoro 模型要能落盘缓存；
//   而缓存没就绪时用 Web Speech 顶上，绝不能因为「模型没下好」就完全不播报。
//
// 【降级链】Kokoro(已缓存) → Kokoro(现下载) → Web Speech(有中文音色) → 静音
//
// 【自动播放策略】浏览器要求用户手势后才能播音频。
//   解法：首次用户点击「开始练」时调 prime() 预热一个空语音，
//         之后所有播报都在手势上下文内，不会被拦。

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const KOKORO_DTYPE = 'q8'
// 中文音色 ID（Kokoro-82M-v1.1-zh 的 z 系列）
const KOKORO_VOICE = 'zf_001'

/** 中文播报专用的字符清洗：去掉标点中 TTS 容易读错的 */
function clean(text) {
  return text.replace(/[（）()【】\[\]]/g, '').replace(/\s+/g, ' ').trim()
}

// ---------------- 模块级预热 ----------------
/**
 * 在用户手势内预热语音通道。
 * 浏览器自动播放策略要求：音频必须由用户手势触发过一次，之后才可自由播放。
 * 跟练页的 speaker 实例是页面级创建的，手势发生在首页，
 * 故这里用一个共享的 AudioContext / speechSynthesis 做全局预热。
 */
let sharedCtx = null
export function primeVoice() {
try {
  if (typeof window === 'undefined') return
  // 1) 唤醒 AudioContext（Kokoro 播放需要）
  const AC = window.AudioContext || window.webkitAudioContext
  if (AC) {
    if (!sharedCtx) sharedCtx = new AC()
    if (sharedCtx.state === 'suspended') sharedCtx.resume()
  }
  // 2) 用极短无声内容解锁 speechSynthesis
  const synth = window.speechSynthesis
  if (synth) {
    synth.resume()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    try { synth.speak(u) } catch { /* ignore */ }
  }
} catch (e) {
  console.warn('[voice] 预热失败：', e)
}
}

/** 供实例复用共享 AudioContext */
export function getSharedAudioCtx() {
if (typeof window === 'undefined') return null
const AC = window.AudioContext || window.webkitAudioContext
if (!AC) return null
if (!sharedCtx) sharedCtx = new AC()
if (sharedCtx.state === 'suspended') sharedCtx.resume()
return sharedCtx
}


export function createSpeaker() {
  let enabled = false
  let volume = 0.9
  let rate = 1.0
  let engineMode = 'auto'      // auto | webspeech | kokoro | off
  let currentUtter = null
  let kokoro = null
  let kokoroStatus = 'idle'    // idle | loading | ready | failed | unsupported
  let kokoroError = ''
  let voicesCache = null
  const listeners = { state: [], spoken: [] }
  const emit = (e, ...a) => (listeners[e] || []).forEach((f) => { try { f(...a) } catch (err) { console.error(err) } })
  const pushState = () => emit('state', { enabled, engineMode, volume, rate, kokoroStatus, kokoroError, webReady: hasWebSpeech() })

  // ---------------- Web Speech ----------------
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  function hasWebSpeech() { return !!synth }

  function pickChineseVoice() {
    if (!synth) return null
    if (!voicesCache || voicesCache.length === 0) voicesCache = synth.getVoices() || []
    const vs = voicesCache
    if (!vs.length) return null
    // 优先本地中文音色（离线可用）
    const zh = vs.filter((v) => /^zh|^cmn|^yue/i.test(v.lang || ''))
    return zh.find((v) => v.localService) || zh[0] || null
  }

  function webSpeechSpeak(text) {
    if (!synth || !text) return false
    const u = new SpeechSynthesisUtterance(clean(text))
    u.lang = 'zh-CN'
    u.rate = Math.max(0.5, Math.min(2, rate))
    u.volume = Math.max(0, Math.min(1, volume))
    const v = pickChineseVoice()
    if (v) { u.voice = v; u.lang = v.lang }
    u.onend = () => { currentUtter = null; emit('spoken', { engine: 'webspeech', text }) }
    u.onerror = (e) => {
      currentUtter = null
      // not-allowed = 被自动播放策略拦；此时静默失败，交给上层降级
      if (e.error && e.error !== 'not-allowed' && e.error !== 'interrupted') {
        console.warn('[voice] Web Speech 出错：', e.error)
      }
    }
    currentUtter = u
    try {
      synth.cancel()          // 打断上一条，避免堆积
      synth.speak(u)
      return true
    } catch (e) {
      console.warn('[voice] Web Speech 调用失败：', e)
      return false
    }
  }

  // ---------------- Kokoro（本地离线）----------------
  async function loadKokoro(onProgress) {
    if (kokoro) return kokoro
    if (kokoroStatus === 'loading') return null
    if (typeof window === 'undefined') return null
    kokoroStatus = 'loading'; kokoroError = ''; pushState()
    try {
      const { KokoroTTS } = await import('kokoro-js')
      kokoro = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
        dtype: KOKORO_DTYPE,
        device: 'wasm',                 // 不用 WebGPU：部分设备不支持，且 wasm 更稳
        progress_callback: (p) => {
          onProgress && onProgress(Math.round((p.progress || 0) * 100))
        },
      })
      kokoroStatus = 'ready'
      pushState()
      return kokoro
    } catch (e) {
      console.warn('[voice] Kokoro 加载失败：', e)
      kokoroStatus = 'failed'
      kokoroError = (e && e.message) || String(e)
      pushState()
      return null
    }
  }

  function ensureAudioCtx() {
    return getSharedAudioCtx()
  }

  async function kokoroSpeak(text) {
    if (!kokoro) return false
    try {
      const audio = await kokoro.generate(clean(text), { voice: KOKORO_VOICE, speed: Math.max(0.5, Math.min(2, rate)) })
      if (!audio) return false
      const ctx = ensureAudioCtx()
      if (!ctx) return false
      // Kokoro 输出 Float32Array PCM 24kHz，转成 AudioBuffer 播放
      const buf = ctx.createBuffer(1, audio.length, 24000)
      buf.copyToChannel(audio, 0)
      const src = ctx.createBufferSource()
      const g = ctx.createGain()
      g.gain.value = Math.max(0, Math.min(1, volume))
      src.buffer = buf
      src.connect(g); g.connect(ctx.destination)
      currentUtter = src
      src.onended = () => { currentUtter = null; emit('spoken', { engine: 'kokoro', text }) }
      src.start()
      return true
    } catch (e) {
      console.warn('[voice] Kokoro 合成失败：', e)
      return false
    }
  }

// ---------------- 对外 API ----------------
  return {
    on(e, fn) { (listeners[e] = listeners[e] || []).push(fn); return this },
    get state() {
      return { enabled, engineMode, volume, rate, kokoroStatus, kokoroError, webReady: hasWebSpeech() }
    },

    /**
     * 预热 —— 必须在用户手势里调一次，否则后续播报会被自动播放策略拦。
     * 做法：让 Web Speech 念一个空串，把 AudioContext 也唤醒。
     */
    prime() {
      if (!enabled) return
      if (synth) { try { synth.resume() } catch { /* ignore */ } }
      ensureAudioCtx()
      if (hasWebSpeech()) {
        // 用极短的无声内容解锁
        const u = new SpeechSynthesisUtterance(' ')
        u.volume = 0
        try { synth.speak(u) } catch { /* ignore */ }
      }
      pushState()
    },

    /** 预载 Kokoro 模型（可选，用户点了「加载离线语音」才做） */
    async preloadKokoro(onProgress) { return !!(await loadKokoro(onProgress)) },

    /**
     * 播报一句话。内部按降级链选引擎。
     * @param {string} text
     * @param {object} opt { forceEngine }
     * @returns {Promise<string>} 实际使用的引擎名；空串表示未播出
     */
    async speak(text, opt = {}) {
      if (!enabled || !text) return ''
      const t = clean(text)
      if (!t) return ''
      const force = opt.forceEngine

      if (engineMode === 'off') return ''

      // 1) 强制或 auto 且 Kokoro 已就绪 → Kokoro
      if ((force === 'kokoro') || (force !== 'webspeech' && kokoroStatus === 'ready')) {
        if (kokoroStatus === 'idle' && force !== 'webspeech') await loadKokoro()
        if (kokoroStatus === 'ready') {
          if (await kokoroSpeak(t)) return 'kokoro'
        }
      }

      // 2) Web Speech
      if (force !== 'kokoro' && hasWebSpeech()) {
        if (webSpeechSpeak(t)) return 'webspeech'
      }

      // 3) 明确选了 kokoro 但不可用 → 不静默，回报失败
      if (force === 'kokoro') return ''
      return ''
    },

    /** 立即停止当前播报 */
    stop() {
      try { synth && synth.cancel() } catch { /* ignore */ }
      try { currentUtter && currentUtter.stop && currentUtter.stop() } catch { /* ignore */ }
      currentUtter = null
    },

    /** 设置 */
    set(patch) {
      if (patch.enabled !== undefined) {
        enabled = !!patch.enabled
        if (!enabled) this.stop()
      }
      if (patch.volume !== undefined) volume = Math.max(0, Math.min(1, Number(patch.volume)))
      if (patch.rate !== undefined) rate = Math.max(0.5, Math.min(2, Number(patch.rate)))
      if (patch.engineMode !== undefined) {
        engineMode = ['auto', 'webspeech', 'kokoro', 'off'].includes(patch.engineMode) ? patch.engineMode : 'auto'
        if (engineMode === 'off') this.stop()
      }
      pushState()
    },

    get enabled() { return enabled },

    /** 销毁 */
    dispose() { this.stop(); listeners.state = []; listeners.spoken = []; kokoro = null },
  }
}
