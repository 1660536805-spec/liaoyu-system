export function createTrainingSession({
  moves = [],
  engineFactory,
  judgeFactory,
  audio = {},
  recordStore,
  clock = () => Date.now(),
  tone = '',
  guided = true,
}) {
  if (!Array.isArray(moves) || !moves.length) throw new TypeError('moves must be a non-empty array')
  if (typeof engineFactory !== 'function') throw new TypeError('engineFactory is required')
  if (!recordStore?.save) throw new TypeError('recordStore.save is required')

  const listeners = new Map()
  const completed = new Map()
  let engine = null
  let judge = null
  let stage = 'idle'
  let stepIndex = 0
  let startedAt = null
  let stoppedAt = null
  let paused = false
  let stopped = false
  let saved = false
  let loadToken = 0
  let deviceId = null
  let error = null

  function emit(type, extra = {}) {
    const event = {
      type,
      stage,
      moveId: extra.moveId ?? null,
      source: extra.source ?? null,
      completedMoveIds: [...completed.keys()],
      error: extra.error ?? error,
      ...extra,
    }
    listeners.get(type)?.forEach((fn) => fn(event))
    listeners.get('*')?.forEach((fn) => fn(event))
    return event
  }

  function setStage(next, detail = '') {
    if (stage === next) return
    stage = next
    emit('stage', { stage: next, detail })
  }

  function saveOnce() {
    if (saved || startedAt === null) return null
    saved = true
    stoppedAt = clock()
    return recordStore.save({
      moveIds: [...completed.keys()],
      sources: [...completed.values()],
      names: [...completed.keys()].map((id) => moves.find((move) => move.id === id)?.name).filter(Boolean),
      startedAt,
      endedAt: stoppedAt,
      tone,
    })
  }

  function finish() {
    if (stopped) return
    stopped = true
    paused = false
    setStage('completed')
    try { engine?.stop?.() } catch (e) { console.error('[session] engine stop failed', e) }
    const record = saveOnce()
    emit('completed', { record })
  }

  function recordHit(moveId, source = 'detected') {
    if (stopped || paused) return false
    // Keep the fallback/manual recovery actions usable if camera/model setup failed
    // or is still stalled. Pose-detected hits remain gated on a ready engine.
    if (source === 'detected' && stage !== 'ready') return false
    if (source !== 'detected' && !['ready', 'loading', 'camera-error'].includes(stage)) return false
    const move = moves.find((item) => item.id === moveId)
    if (!move || completed.has(moveId)) return false
    completed.set(moveId, source)
    if (move.chord) audio.chordAll?.()
    else audio.pluck?.(move.stringIndex)
    emit('move-hit', { moveId, source })
    if (guided) {
      const idx = moves.findIndex((item) => item.id === moveId)
      if (idx >= stepIndex) stepIndex = Math.min(moves.length - 1, idx + 1)
    }
    if (completed.size === moves.length) finish()
    return true
  }

  function attachEngine(instance, token) {
    engine = instance
    instance.on?.('status', ({ stage: next, detail }) => {
      if (token !== loadToken || stopped) return
      setStage(next, detail)
      if (next === 'ready') error = null
    })
    instance.on?.('result', (...frame) => {
      if (token === loadToken && !stopped) emit('frame', { frame })
    })
    instance.on?.('error', (e) => {
      if (token !== loadToken || stopped) return
      error = e
      emit('error', { error: e })
    })
  }

  async function start({ mode = 'guided', deviceId: nextDeviceId = null, video, width, height, ...options } = {}) {
    if (stage === 'completed' || stopped) return null
    if (engine) {
      try { engine.dispose?.() } catch { /* allow retry with a fresh engine */ }
      engine = null
    }
    const token = ++loadToken
    paused = false
    error = null
    deviceId = nextDeviceId
    guided = mode !== 'free'
    if (startedAt === null) startedAt = clock()
    setStage('loading')
    try {
      const instance = await engineFactory()
      if (token !== loadToken || stopped) {
        instance?.dispose?.()
        return null
      }
      attachEngine(instance, token)
      const info = await instance.start(video, { ...options, deviceId, width, height })
      if (token !== loadToken || stopped) {
        instance.dispose?.()
        return null
      }
      deviceId = info?.deviceId ?? deviceId
      setStage('ready')
      return info
    } catch (e) {
      if (token !== loadToken || stopped) return null
      error = e
      setStage('camera-error')
      emit('camera-error', { error: e })
      throw e
    }
  }

  function pause() {
    if (stage !== 'ready' || paused || stopped) return
    paused = true
    stage = 'paused'
    emit('paused')
  }

  function resume() {
    if (!paused || stopped) return
    paused = false
    stage = 'ready'
    emit('resumed')
  }

  function stop({ reason = 'stopped' } = {}) {
    if (stopped) return null
    stopped = true
    paused = false
    ++loadToken
    try { engine?.stop?.() } catch (e) { console.error('[session] engine stop failed', e) }
    const record = saveOnce()
    setStage('stopped')
    emit('stopped', { reason, record })
    return record
  }

  function dispose() {
    stop({ reason: 'dispose' })
    try { engine?.dispose?.() } catch (e) { console.error('[session] engine dispose failed', e) }
    engine = null
    listeners.clear()
  }

  function stopCamera() {
    try { engine?.stop?.() } catch (e) { console.error('[session] camera stop failed', e) }
  }

  function disposeEngine() {
    try { engine?.dispose?.() } catch (e) { console.error('[session] engine dispose failed', e) }
    engine = null
  }

  function switchDevice(video, nextDeviceId, options = {}) {
    if (!engine?.switchDevice) return Promise.reject(new Error('camera is not ready'))
    return engine.switchDevice(video, nextDeviceId, options)
  }

  function setResolution(video, width, height) {
    if (!engine?.setResolution) return Promise.resolve(null)
    return engine.setResolution(video, width, height)
  }

  return {
    on(type, listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function')
      const group = listeners.get(type) || new Set()
      group.add(listener)
      listeners.set(type, group)
      return () => group.delete(listener)
    },
    start,
    pause,
    resume,
    hit: recordHit,
    stop,
    dispose,
    stopCamera,
    disposeEngine,
    switchDevice,
    setResolution,
    isRunning: () => Boolean(engine?.isRunning),
    setMode: (mode) => { guided = mode !== 'free' },
    createJudge(index, options) {
      if (typeof judgeFactory !== 'function') return null
      judge = judgeFactory(index, options)
      return judge
    },
    snapshot() {
      return { stage, stepIndex, moveId: moves[stepIndex]?.id ?? null, completedMoveIds: [...completed.keys()], deviceId, paused, stopped, error }
    },
  }
}
