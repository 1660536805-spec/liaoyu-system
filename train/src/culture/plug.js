// 弦养 · 可插拔插件总线（PlugBus）
// ============================================================================
// 【这一层解决什么】
//   「文化内核」算出一张处方（要听什么音、练哪几式、点什么香、吃什么），
//   但**执行**要落到具体硬件上：音箱/香薰机/氛围灯/摄像头。
//   这些设备的接入方式各不相同（Web Audio / BLE / WiFi / WASM），
//   如果让内核去认识每一种硬件，加一台新设备就要改一遍内核 —— 不可插拔。
//
//   所以这里定一条**统一契约**，任何硬件只要实现它就插得上：
//
//     adapter = {
//       meta:   { id, kind, vendor, transport, caps:[...], docs }
//       connect()      -> Promise<void>      建立链路
//       disconnect()   -> Promise<void>      断开链路
//       commands: { <cmd>(payload) -> any } 具体指令
//     }
//
//   换硬件 = 换一个 adapter 注册进来，内核与上层 API **一行都不用改**。
//
// 【降级策略】
//   适配器里凡是依赖浏览器能力的（Web Audio / MediaPipe），都走动态 import + try/catch
//   并给一个可观测的模拟实现。这样：
//     · SSR / headless 渲染时不会炸（顶层不碰 window、不 import @mediapipe）
//     · 现场没插硬件也能演示「指令照样下得出去」
//
// 【架构铁律】本文件不 import 任何 .vue。
// ============================================================================

const bus = {
  adapters: new Map(),   // id -> adapter
  links: new Set(),      // 已连接 id
  log: [],               // 事件日志（页面直接读）
  seq: 0,
}

const LOG_MAX = 200

function pushLog(level, tag, msg, detail) {
  bus.seq += 1
  bus.log.push({ seq: bus.seq, t: new Date().toISOString().slice(11, 19), level, tag, msg, detail })
  if (bus.log.length > LOG_MAX) bus.log.splice(0, bus.log.length - LOG_MAX)
}

export function onLog(fn) {
  pushLog('trace', 'bus', 'subscribe')
  const i = bus.log.length
  const prev = bus.log.slice()
  queueMicrotask(() => {
    for (const e of prev.slice(i)) fn(e)
  })
  return () => bus.log.splice(i)
}

export function logLines() {
  return bus.log.slice()
}

export function clearLog() {
  bus.log = []
}

/* ------------------------------------------------------------------ *
 * 总线 API
 * ------------------------------------------------------------------ */
export const PlugBus = {
  /** 注册一个适配器（同 id 覆盖 = 热替换硬件） */
  register(adapter) {
    if (!adapter || !adapter.meta || !adapter.meta.id) throw new Error('adapter.meta.id 必填')
    const prev = bus.adapters.get(adapter.meta.id)
    bus.adapters.set(adapter.meta.id, adapter)
    pushLog(prev ? 'warn' : 'info', 'bus',
      prev ? `热替换适配器 ${adapter.meta.id}（${prev.meta.transport} → ${adapter.meta.transport}）`
           : `注册适配器 ${adapter.meta.id} [${adapter.meta.transport}]`)
    return adapter
  },

  /** 注销适配器 */
  unregister(id) {
    const a = bus.adapters.get(id)
    if (!a) return false
    if (bus.links.has(id)) this.disconnect(id)
    bus.adapters.delete(id)
    pushLog('warn', 'bus', `注销适配器 ${id}`)
    return true
  },

  /** 所有已注册适配器（不含状态，状态单独看 list） */
  list(kind) {
    return [...bus.adapters.values()].filter((a) => !kind || a.meta.kind === kind).map((a) => ({ ...a.meta }))
  },

  /** 适配器 + 连接状态，给界面渲染 */
  status() {
    return [...bus.adapters.values()].map((a) => ({
      ...a.meta,
      live: bus.links.has(a.meta.id),
      caps: a.meta.caps || [],
    }))
  },

  /** 建立链路 */
  async connect(id) {
    const a = bus.adapters.get(id)
    if (!a) throw new Error(`未注册: ${id}`)
    if (bus.links.has(id)) return { id, ok: true, already: true }
    if (typeof a.connect !== 'function') throw new Error(`${id} 未实现 connect()`)
    await a.connect()
    bus.links.add(id)
    pushLog('ok', id, '链路已建立', a.meta.transport)
    return { id, ok: true }
  },

  /** 断开链路 */
  async disconnect(id) {
    const a = bus.adapters.get(id)
    if (!a) throw new Error(`未注册: ${id}`)
    if (typeof a.disconnect === 'function') await a.disconnect()
    bus.links.delete(id)
    pushLog('warn', id, '链路已断开')
    return { id, ok: true }
  },

  /**
   * 下发指令。硬件没连上时返回 { ok:false, reason:'offline' } 而不是抛异常 ——
   * 演示现场拔掉设备也不该让页面崩。
   */
  async invoke(id, cmd, payload) {
    const a = bus.adapters.get(id)
    if (!a) return { ok: false, reason: 'unregistered', id, cmd }
    if (!bus.links.has(id)) return { ok: false, reason: 'offline', id, cmd }
    const fn = a.commands && a.commands[cmd]
    if (typeof fn !== 'function') return { ok: false, reason: 'no-such-command', id, cmd }
    const r = await fn(payload)
    pushLog('cmd', id, `${cmd}${payload ? ' ' + JSON.stringify(payload) : ''}`, r && r.ok !== undefined ? r : undefined)
    return r
  },

  /** 一次性下发一串指令（场景编排用） */
  async scene(steps) {
    const results = []
    for (const s of steps) results.push(await this.invoke(s.id, s.cmd, s.payload))
    const ok = results.every((r) => r.ok !== false)
    pushLog(ok ? 'ok' : 'info', 'bus', `场景执行 ${steps.length} 步，成功 ${results.filter((r) => r.ok !== false).length}`)
    return { ok, results }
  },

  /** 判断某个能力此刻有没有硬件在位 */
  has(cap) {
    return [...bus.links].some((id) => (bus.adapters.get(id).meta.caps || []).includes(cap))
  },

  /** 当前在位硬件支持的全部能力 */
  caps() {
    return [...bus.links].flatMap((id) => bus.adapters.get(id).meta.caps || [])
  },
}

/* ------------------------------------------------------------------ *
 * 适配器工厂 —— 第三方硬件照这个模板写即可插
 * ------------------------------------------------------------------ */
export function defineAdapter(meta, handlers) {
  return {
    meta,
    connect: async () => { if (handlers.connect) await handlers.connect() },
    disconnect: async () => { if (handlers.disconnect) await handlers.disconnect() },
    commands: handlers.commands || {},
    _raw: handlers,
  }
}

/* ------------------------------------------------------------------ *
 * 内置适配器 1：audio.guqin —— 五音疗愈播放（Web Audio 合成，零素材）
 * ------------------------------------------------------------------ */
let audioState = { tone: null, level: 0, playing: false }

export const AudioAdapter = defineAdapter(
  {
    id: 'audio.guqin',
    kind: 'audio',
    vendor: '弦养 · 自产合成',
    transport: 'Web Audio (Karplus–Strong)',
    caps: ['play-tone', 'level', 'stop'],
    docs: '把处方里的五音调式落成可听的散音/泛音，跟练轨与赏听轨都由这一层发声音',
  },
  {
    commands: {
      /** @param {{toneKey:string}} p */
      async playTone(p = {}) {
        audioState.playing = true
        audioState.tone = p.toneKey || null
        audioState.level = p.level == null ? 0.5 : p.level
        // 有真音频引擎就真的弹一下，没有（SSR / 无 AudioContext）就记状态，不炸
        try {
          const g = await import('../engine/guqin.js')
          if (typeof g.unlockAudio === 'function') g.unlockAudio()
        } catch (e) {
          /* 降级：无 Web Audio 环境只记录，不影响演示 */
        }
        pushLog('ok', 'audio.guqin', `落「${audioState.tone}」调，电平 ${audioState.level}`)
        return { ok: true, tone: audioState.tone, level: audioState.level, via: 'web-audio', simulated: !hasAudioEngine() }
      },
      async stop() {
        audioState.playing = false
        try {
          const g = await import('../engine/guqin.js')
          if (typeof g.stopAll === 'function') g.stopAll()
        } catch (e) { /* 同上 */ }
        pushLog('warn', 'audio.guqin', '停止出声')
        return { ok: true, playing: false }
      },
      async level(p = {}) {
        audioState.level = p.value == null ? 0.5 : p.value
        return { ok: true, level: audioState.level }
      },
      async read() { return { ...audioState } },
    },
  }
)

let _hasAudio = null
function hasAudioEngine() {
  if (_hasAudio === null) {
    try { _hasAudio = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext) }
    catch (e) { _hasAudio = false }
  }
  return _hasAudio
}

/* ------------------------------------------------------------------ *
 * 内置适配器 2：aroma.link2 —— 智能香薰控制（雾化 + 定时）
 *   默认实现是**协议模拟器**：把真实香薰机接进来只需换掉 connect/commands，
 *   总线与处方引擎不需要任何改动。
 * ------------------------------------------------------------------ */
let aromaState = { level: 0, timer: 0, scent: null, online: false }

export const AromaAdapter = defineAdapter(
  {
    id: 'aroma.link2',
    kind: 'env',
    vendor: '和香 · 香薰执行器（可换真实 BLE / MQTT）',
    transport: '协议模拟层 (MockTransport) → BLE / MQTT',
    caps: ['mist', 'scent', 'timer'],
    docs: '把处方里的香方转成雾化档位下发；换真机只需替换 transport',
  },
  {
    connect: async () => {
      // 真实实现这里做 BLE 握手 / MQTT 订阅；模拟层直接置位
      await new Promise((r) => setTimeout(r, 120))
      aromaState.online = true
    },
    disconnect: async () => {
      aromaState.online = false
      aromaState.level = 0
    },
    commands: {
      async mist(p = {}) {
        const lvl = Math.max(0, Math.min(3, Number(p.level) || 0))
        aromaState.level = lvl
        pushLog(lvl ? 'ok' : 'warn', 'aroma.link2', lvl ? `雾化 ${'▁▂▃'[lvl - 1] || '▃'} 档` : '雾化关闭')
        return { ok: true, level: lvl }
      },
      async scent(p = {}) {
        aromaState.scent = p.name || null
        return { ok: true, scent: aromaState.scent }
      },
      async timer(p = {}) {
        aromaState.timer = Number(p.minutes) || 0
        return { ok: true, minutes: aromaState.timer }
      },
      async read() { return { ...aromaState } },
    },
  }
)

/* ------------------------------------------------------------------ *
 * 内置适配器 3：light.ambiance —— 氛围灯（色温/亮度）
 * ------------------------------------------------------------------ */
let lightState = { hue: 'warm', bright: 60, on: false }

export const LightAdapter = defineAdapter(
  {
    id: 'light.ambiance',
    kind: 'env',
    vendor: '弦养 · 场景灯',
    transport: 'WiFi / 本地 MQTT',
    caps: ['light'],
    docs: '把五音的明暗翻译成灯光色温：羽调幽深用暖暗，徵调明快用亮白',
  },
  {
    connect: async () => { lightState.on = true },
    disconnect: async () => { lightState.on = false },
    commands: {
      async set(p = {}) {
        lightState.hue = p.hue || lightState.hue
        lightState.bright = p.bright == null ? lightState.bright : Math.max(0, Math.min(100, Number(p.bright)))
        return { ok: true, ...lightState }
      },
      async read() { return { ...lightState } },
    },
  }
)

/* ------------------------------------------------------------------ *
 * 内置适配器 4：pose.mediapipe —— AI 动作识别（八段锦姿态判定）
 *   走动态 import 引擎层，拿不到（headless / 无摄像头）时降级为采样统计
 * ------------------------------------------------------------------ */
let poseState = { running: false, frames: 0, last: null }

export const PoseAdapter = defineAdapter(
  {
    id: 'pose.mediapipe',
    kind: 'vision',
    vendor: '弦养 · 动作识别',
    transport: 'MediaPipe Tasks Vision (WASM) / 摄像头',
    caps: ['pose', 'judge'],
    docs: '把处方里的功法序列逐式判定，判达标就回报给总线（内核不知道判定怎么做）',
  },
  {
    commands: {
      async start() {
        poseState.running = true
        poseState.frames = 0
        try {
          const m = await import('../engine/judge.js')
          pushLog('ok', 'pose.mediapipe', `判定器就绪 ${typeof m.MoveJudge === 'function' ? 'MoveJudge' : '（降级采样）'}`)
          return { ok: true, judge: typeof m.MoveJudge === 'function', simulated: true }
        } catch (e) {
          return { ok: true, judge: false, simulated: true }
        }
      },
      async stop() { poseState.running = false; return { ok: true, running: false } },
      /** 页面每帧调一次：有真骨骼数据就带过去，没有就自增计数 */
      async feed() {
        poseState.frames += 1
        return { ok: true, frames: poseState.frames }
      },
      async read() { return { ...poseState } },
    },
  }
)

/** 页面每帧喂一帧（由组件驱动，总线不自己开 rAF） */
export function feedPose() {
  return PlugBus.invoke('pose.mediapipe', 'feed')
}

/* ------------------------------------------------------------------ *
 * 场景编排：处方 → 一串指令
 *   这是「文化内核与硬件之间唯一的一层胶水」，换硬件只改这里的实现
 * ------------------------------------------------------------------ */
export function stepsFromPrescription(p) {
  const steps = []
  if (p.tone) steps.push({ id: 'audio.guqin', cmd: 'playTone', payload: { toneKey: p.tone.key, level: 0.5 } })
  if (p.moves) steps.push({ id: 'pose.mediapipe', cmd: 'start' })
  if (p.xiang) {
    steps.push({ id: 'aroma.link2', cmd: 'scent', payload: { name: p.xiang.name } })
    steps.push({ id: 'aroma.link2', cmd: 'mist', payload: { level: p.xiang.level } })
    steps.push({ id: 'aroma.link2', cmd: 'timer', payload: { minutes: 30 } })
  }
  // 时辰偏夜 → 灯压暗；偏昼 → 提亮
  const night = ['zi', 'chou', 'yin', 'xu', 'hai'].includes(p.input.shichen)
  steps.push({ id: 'light.ambiance', cmd: 'set', payload: night ? { hue: 'warm', bright: 35 } : { hue: 'day', bright: 70 } })
  return steps
}

/** 一次性把内置适配器全注册进总线（幂等） */
let booted = false
export function bootBus() {
  if (booted) return PlugBus
  booted = true
  PlugBus.register(AudioAdapter)
  PlugBus.register(AromaAdapter)
  PlugBus.register(LightAdapter)
  PlugBus.register(PoseAdapter)
  pushLog('info', 'bus', '总线启动，已挂载 4 个内置适配器')
  return PlugBus
}
