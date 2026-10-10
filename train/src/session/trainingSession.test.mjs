import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrainingSession } from './trainingSession.js'

function harness({ engineFactory, recordStore, moveCount = 2, tone = 'gong' } = {}) {
  const events = []
  const records = []
  const played = []
  const moves = Array.from({ length: moveCount }, (_, i) => ({ id: i + 1, name: `式${i + 1}`, stringIndex: i + 1, chord: i === moveCount - 1 }))
  const session = createTrainingSession({
    moves,
    tone,
    engineFactory: engineFactory || (async () => makeEngine()),
    judgeFactory: (index) => ({ index }),
    audio: { pluck: (i) => played.push(['pluck', i]), chordAll: () => played.push(['chord']) },
    recordStore: recordStore || { save: (record) => { records.push(record); return record }, list: () => records },
    clock: (() => { let t = 100; return () => ++t })(),
  })
  session.on('*', (event) => events.push(event))
  return { session, events, records, played, moves }
}

function makeEngine() {
  const listeners = {}
  return {
    on(type, fn) { (listeners[type] ||= []).push(fn); return this },
    async start() { listeners.status?.forEach((fn) => fn({ stage: 'wasm' })); listeners.status?.forEach((fn) => fn({ stage: 'ready' })); return { deviceId: 'cam-1' } },
    emit(type, ...args) { listeners[type]?.forEach((fn) => fn(...args)) },
    stop() { this.stopped = true },
    dispose() { this.disposed = true },
  }
}

test('start emits ordered loading and ready stages, and two move hits complete once', async () => {
  const engine = makeEngine()
  const { session, events, records, played } = harness({ engineFactory: async () => engine })
  await session.start({ mode: 'guided', deviceId: 'cam-1' })
  assert.deepEqual(events.filter((e) => e.type === 'stage').map((e) => e.stage), ['loading', 'wasm', 'ready'])
  assert.equal(session.snapshot().stage, 'ready')
  session.hit(1, 'detected')
  session.hit(2, 'detected')
  session.hit(2, 'detected')
  assert.deepEqual(played, [['pluck', 1], ['chord']])
  assert.equal(events.filter((e) => e.type === 'move-hit').length, 2)
  assert.equal(events.filter((e) => e.type === 'completed').length, 1)
  assert.equal(records.length, 1)
  assert.deepEqual(records[0].moveIds, [1, 2])
  assert.equal(records[0].tone, 'gong')
  assert.equal(engine.stopped, true)
})

test('pause suppresses detected hits until resume', async () => {
  const { session, events, records } = harness()
  await session.start()
  session.pause()
  session.hit(1, 'detected')
  session.resume()
  session.hit(1, 'detected')
  assert.deepEqual(session.snapshot().completedMoveIds, [1])
  assert.equal(events.filter((e) => e.type === 'paused').length, 1)
  assert.equal(records.length, 0)
})

test('camera permission rejection emits a recoverable camera-error', async () => {
  const error = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
  const { session, events } = harness({ engineFactory: async () => { const engine = makeEngine(); engine.start = async () => { throw error }; return engine } })
  await assert.rejects(session.start(), /denied/)
  assert.equal(events.at(-1).type, 'camera-error')
  assert.equal(session.snapshot().stage, 'camera-error')
})

test('explicit manual hit remains available after the camera fails; fallback cannot fabricate a hit', async () => {
  const error = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
  const { session, records, played } = harness({ engineFactory: async () => {
    const engine = makeEngine()
    engine.start = async () => { throw error }
    return engine
  } })
  await assert.rejects(session.start(), /denied/)
  assert.equal(session.hit(1, 'manual'), true)
  assert.equal(session.hit(2, 'fallback'), false)
  session.stop({ reason: '检查部分记录' })
  assert.equal(records.length, 1)
  assert.deepEqual(played, [['pluck', 1]])
})

test('manual practice can start without creating an engine or requesting a camera', () => {
  let engineCalls = 0
  const { session, played } = harness({ engineFactory: async () => { engineCalls++; return makeEngine() } })
  session.enableManual()
  assert.equal(session.snapshot().stage, 'ready')
  assert.equal(session.hit(1, 'manual'), true)
  assert.equal(engineCalls, 0)
  assert.deepEqual(played, [['pluck', 1]])
})

test('stop while engine is loading disposes the late engine without starting its camera', async () => {
  let resolveFactory
  const engine = makeEngine()
  engine.start = async () => { engine.started = true }
  const { session } = harness({ engineFactory: () => new Promise((resolve) => { resolveFactory = resolve }) })
  const starting = session.start()
  await Promise.resolve()
  session.stop({ reason: '退出跟练' })
  resolveFactory(engine)
  await starting
  assert.equal(engine.started, undefined)
  assert.equal(engine.disposed, true)
})

test('route exit while the camera is loading releases the engine once and ignores its late completion', async () => {
  let resolveStart
  let disposeCalls = 0
  const engine = makeEngine()
  engine.start = () => new Promise((resolve) => { resolveStart = resolve })
  engine.dispose = () => { disposeCalls++ }
  const { session, events } = harness({ engineFactory: async () => engine })
  const starting = session.start()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(typeof resolveStart, 'function')
  session.dispose()
  assert.equal(disposeCalls, 1)
  resolveStart({ deviceId: 'late-camera' })
  await starting
  assert.equal(disposeCalls, 1)
  assert.equal(session.snapshot().stage, 'stopped')
  assert.equal(events.some((event) => event.type === 'frame'), false)
})

test('explicit exit saves one partial record and dispose releases the engine', async () => {
  const engine = makeEngine()
  const { session, records } = harness({ engineFactory: async () => engine })
  await session.start()
  session.hit(1, 'manual')
  session.stop({ reason: '退出' })
  session.stop({ reason: '重复退出' })
  session.dispose()
  assert.equal(records.length, 1)
  assert.deepEqual(records[0].moveIds, [1])
  assert.deepEqual(records[0].sources, ['manual'])
  assert.match(records[0].sessionId, /^session-|^[\da-f-]{36}$/)
  assert.equal(engine.disposed, true)
})

test('page-exit stop writes one idempotent partial checkpoint', async () => {
  const { session, records } = harness()
  await session.start()
  session.hit(1, 'manual')
  session.stop({ reason: 'pagehide' })
  session.stop({ reason: 'unmount' })
  session.dispose()
  assert.equal(records.length, 1)
  assert.deepEqual(records[0].moveIds, [1])
})

test('leaving before a move is completed does not create an empty record', async () => {
  const { session, records } = harness()
  await session.start()
  session.stop({ reason: 'pagehide' })
  assert.equal(records.length, 0)
})
