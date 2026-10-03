import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecords, saveSession, recordStore, getRecordStorageStatus, clearRecords } from './records.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}
function useStorage(storage) { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage }) }

test('session records keep stable IDs and legacy move indexes with source and duration', () => {
  useStorage(memoryStorage())
  clearRecords()
  const record = saveSession({ moveIds: [1, 3], sources: ['detected', 'manual'], names: ['式1', '式3'], startedAt: 1000, endedAt: 121000, tone: 'gong' })
  assert.deepEqual(record.moveIds, [1, 3])
  assert.deepEqual(record.moves, [0, 2])
  assert.deepEqual(record.sources, ['detected', 'manual'])
  assert.equal(record.doneCount, 2)
  assert.equal(record.complete, false)
  assert.equal(record.minutes, 2)
  assert.equal(recordStore.list()[0].ts, record.ts)
})

test('malformed or unavailable localStorage never crashes record reads or writes', () => {
  const storage = memoryStorage()
  useStorage(storage)
  clearRecords()
  storage.setItem('xianyang.records.v1', '{bad json')
  assert.deepEqual(getRecords(), [])
  const saved = saveSession({ moveIds: [2] })
  assert.equal(saved.moveIds[0], 2)
  assert.equal(recordStore.list()[0].moveIds[0], 2)
  assert.equal(getRecordStorageStatus().persistent, false)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
  assert.equal(getRecords()[0].moveIds[0], 2)
  const next = saveSession({ moveIds: [3] })
  assert.equal(next.moveIds[0], 3)
  assert.equal(recordStore.list().length, 2)
})

test('invalid record entries are ignored and signal recovery without breaking sort or save', () => {
  useStorage(memoryStorage({ 'xianyang.records.v1': JSON.stringify([null, { ts: 1 }, { ts: 1700000000000, moveIds: [1], sources: ['manual'] }]) }))
  assert.deepEqual(getRecords().map((record) => record.moveIds), [[1]])
  assert.equal(getRecordStorageStatus().recovered, true)
  assert.doesNotThrow(() => saveSession({ moveIds: [2] }))
})

test('same session ID updates its partial record instead of duplicating it', () => {
  useStorage(memoryStorage())
  clearRecords()
  saveSession({ sessionId: 'stable-session', moveIds: [1], sources: ['manual'], startedAt: 100, endedAt: 200 })
  saveSession({ sessionId: 'stable-session', moveIds: [1, 2], sources: ['manual', 'detected'], startedAt: 100, endedAt: 300 })
  assert.equal(recordStore.list().length, 1)
  assert.deepEqual(recordStore.list()[0].moveIds, [1, 2])
})

test('records saved after quota failure stay visible even while stale storage remains readable', () => {
  const storage = memoryStorage()
  useStorage(storage)
  clearRecords()
  storage.setItem = () => { throw new Error('quota exceeded') }
  saveSession({ sessionId: 'memory-session', moveIds: [4], sources: ['manual'] })
  assert.deepEqual(recordStore.list().map((record) => record.moveIds), [[4]])
  assert.equal(getRecordStorageStatus().persistent, false)
})
