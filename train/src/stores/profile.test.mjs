import test from 'node:test'
import assert from 'node:assert/strict'
import { profile, completeOnboarding, isOnboardingComplete, getProfileStorageStatus } from './profile.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}

test('profile preserves edits after quota failure and unavailable storage', () => {
  const values = new Map([['xianyang.profile.v1', JSON.stringify({ height: 160, weight: 50, age: 28 })]])
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: () => { throw new Error('quota exceeded') } }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage })
  assert.equal(profile.load().height, 160)
  const saved = profile.save({ height: 188, weight: 70, age: 35, preferences: { goal: '放松腰背' } })
  assert.equal(saved.height, 188)
  assert.equal(profile.load().height, 188)
  assert.equal(getProfileStorageStatus().persistent, false)

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
  profile.save({ height: 180, preferences: { goal: '放松腰背' } })
  assert.equal(profile.load().height, 180)
  assert.equal(getProfileStorageStatus().persistent, false)
})

test('onboarding marker survives reload through local storage and works in memory when blocked', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: memoryStorage() })
  assert.equal(isOnboardingComplete(), false)
  completeOnboarding()
  assert.equal(isOnboardingComplete(), true)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })
  assert.equal(isOnboardingComplete(), true)
})
