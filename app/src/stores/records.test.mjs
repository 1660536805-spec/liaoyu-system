import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecords, saveSession, recordStore } from './records.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}

test('session records keep stable IDs and legacy move indexes with source and duration', () => {
  globalThis.localStorage = memoryStorage()
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
  globalThis.localStorage = memoryStorage({ 'xianyang.records.v1': '{bad json' })
  assert.deepEqual(getRecords(), [])
  assert.doesNotThrow(() => saveSession({ moveIds: [2] }))
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
  assert.deepEqual(getRecords(), [])
  assert.doesNotThrow(() => saveSession({ moveIds: [2] }))
})
