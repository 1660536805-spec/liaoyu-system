import test from 'node:test'
import assert from 'node:assert/strict'
import { createCameraRequestGuard } from './cameraRequest.js'

test('a stream resolving after cancellation is stopped and cannot be adopted', async () => {
  const guard = createCameraRequestGuard()
  let resolveRequest
  const token = guard.begin()
  const pending = guard.acquire(token, new Promise((resolve) => { resolveRequest = resolve }), 1000)
  guard.cancel()
  let stopped = false
  const stream = { getTracks: () => [{ stop: () => { stopped = true } }] }
  resolveRequest(stream)
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(stopped, true)
})

test('dispose prevents future camera requests from starting', () => {
  const guard = createCameraRequestGuard()
  guard.dispose()
  assert.throws(() => guard.begin(), { name: 'AbortError' })
})
