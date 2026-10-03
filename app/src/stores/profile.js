const KEY = 'xianyang.profile.v1'
const ONBOARDING_KEY = 'xianyang.onboardingComplete.v1'
const DEFAULTS = Object.freeze({
  height: 165,
  weight: 55,
  age: 28,
  preferences: { goal: '舒缓肩颈', tone: 'gong', mode: 'guided' },
})
let memoryProfile = null
let onboardingCompleteInMemory = false
let storageStatus = { persistent: true, recovered: false }
let onboardingPersistent = true

function storageOrNull() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

function bounded(value, fallback, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(Math.max(min, Math.min(max, number))) : fallback
}

function validate(value = {}) {
  const preferences = value?.preferences && typeof value.preferences === 'object' && !Array.isArray(value.preferences)
    ? value.preferences : {}
  const tones = ['gong', 'shang', 'jue', 'zhi', 'yu']
  return {
    height: bounded(value?.height, DEFAULTS.height, 120, 220),
    weight: bounded(value?.weight, DEFAULTS.weight, 30, 200),
    age: bounded(value?.age, DEFAULTS.age, 12, 120),
    preferences: {
      goal: typeof preferences.goal === 'string' ? preferences.goal.slice(0, 40) : DEFAULTS.preferences.goal,
      tone: tones.includes(preferences.tone) ? preferences.tone : DEFAULTS.preferences.tone,
      mode: ['guided', 'free'].includes(preferences.mode) ? preferences.mode : DEFAULTS.preferences.mode,
    },
  }
}

export function loadProfile() {
  const storage = storageOrNull()
  if (!storage) {
    storageStatus = { ...storageStatus, persistent: false }
    return validate(memoryProfile || DEFAULTS)
  }
  if (memoryProfile && !storageStatus.persistent && !storageStatus.recovered) {
    try {
      storage.setItem(KEY, JSON.stringify(memoryProfile))
      storageStatus = { persistent: true, recovered: false }
    } catch { storageStatus = { ...storageStatus, persistent: false } }
    return validate(memoryProfile)
  }
  try {
    const raw = storage.getItem(KEY)
    if (!raw) { storageStatus = { persistent: true, recovered: false }; return validate(memoryProfile || DEFAULTS) }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid profile')
    memoryProfile = validate(parsed)
    storageStatus = { persistent: true, recovered: false }
    return validate(memoryProfile)
  } catch {
    storageStatus = { persistent: false, recovered: true }
    return validate(memoryProfile || DEFAULTS)
  }
}

export function saveProfile(value) {
  const normalized = validate(value)
  memoryProfile = normalized
  const storage = storageOrNull()
  try {
    if (!storage) throw new Error('local storage unavailable')
    storage.setItem(KEY, JSON.stringify(normalized))
    storageStatus = { persistent: true, recovered: false }
  } catch { storageStatus = { ...storageStatus, persistent: false } }
  return normalized
}

export function getProfileStorageStatus() { return { ...storageStatus, persistent: storageStatus.persistent && onboardingPersistent } }

export function isOnboardingComplete() {
  const storage = storageOrNull()
  if (!storage) { onboardingPersistent = false; return onboardingCompleteInMemory }
  try {
    const saved = storage.getItem(ONBOARDING_KEY)
    onboardingPersistent = true
    onboardingCompleteInMemory = saved === '1' || onboardingCompleteInMemory
    return onboardingCompleteInMemory
  } catch {
    onboardingPersistent = false
    return onboardingCompleteInMemory
  }
}

export function completeOnboarding() {
  onboardingCompleteInMemory = true
  const storage = storageOrNull()
  try {
    if (!storage) throw new Error('local storage unavailable')
    storage.setItem(ONBOARDING_KEY, '1')
    onboardingPersistent = true
  } catch { onboardingPersistent = false }
}

export const profile = { load: loadProfile, save: saveProfile }
