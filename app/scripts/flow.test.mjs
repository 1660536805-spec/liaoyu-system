import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { profile } from '../src/stores/profile.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}

test('legacy entry flow routes to real Vue screens and retains validated profile data', async () => {
  globalThis.localStorage = memoryStorage()
  const main = await readFile(resolve(root, 'src/main.js'), 'utf8')
  const app = await readFile(resolve(root, 'src/App.vue'), 'utf8')
  const required = [
    ['/splash', 'LegacySplashView.vue'], ['/questions', 'LegacyQuestionsView.vue'],
    ["'/'", 'LegacyHomeView.vue'], ['/sound', 'LegacySoundView.vue'],
    ['/intro', 'LegacyIntroView.vue'], ['/train', 'TrainView.vue'],
    ['/finish', 'LegacyFinishView.vue'], ['/me', 'LegacyProfileView.vue'],
    ['/me/body-data', 'LegacyBodyView.vue'],
  ]
  for (const [path, component] of required) {
    assert(main.includes(path), `missing route ${path}`)
    assert(main.includes(component), `missing screen ${component}`)
  }
  assert.match(app, /showAppTab/)

  const saved = profile.save({ height: 168, weight: 62, age: 35, preferences: { goal: 'relax', sleep: 'better' } })
  assert.equal(saved.height, 168)
  assert.equal(profile.load().preferences.goal, 'relax')
  assert.equal(profile.save({ height: 'NaN', weight: -4, age: 300 }).height, 165)
  assert.equal(profile.load().weight, 30)
  const finish = await readFile(resolve(root, 'src/views/LegacyFinishView.vue'), 'utf8')
  const me = await readFile(resolve(root, 'src/views/LegacyProfileView.vue'), 'utf8')
  assert.match(finish, /recordStore\.list\(\)/)
  assert.match(me, /recordStore\.list\(\)/)
  assert.match(finish, /sources|manual/)
  assert.match(me, /sources|manual/)
})
