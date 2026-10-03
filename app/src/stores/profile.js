const KEY = 'xianyang.profile.v1'
const DEFAULTS = Object.freeze({
  height: 165,
  weight: 55,
  age: 28,
  preferences: { goal: '舒缓肩颈', tone: 'gong', mode: 'guided' },
})

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
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return validate()
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? validate(parsed) : validate()
  } catch {
    return validate()
  }
}

export function saveProfile(value) {
  const normalized = validate(value)
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(normalized)) } catch { /* keep current session usable */ }
  return normalized
}

export const profile = { load: loadProfile, save: saveProfile }
