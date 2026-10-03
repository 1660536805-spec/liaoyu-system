// 本机练习记录。内存态始终可用，持久化失败时界面可以明确告知用户。
const KEY = 'xianyang.records.v1'
let memoryRecords = []
let storageStatus = { persistent: true, recovered: false }

function normalizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!Array.isArray(value.moves) && !Array.isArray(value.moveIds)) return null
  const ts = Number(value.ts)
  if (!Number.isFinite(ts) || ts <= 0) return null
  const moves = Array.isArray(value.moves) ? value.moves.filter((n) => Number.isInteger(n) && n >= 0 && n < 32) : []
  const moveIds = Array.isArray(value.moveIds)
    ? [...new Set(value.moveIds.filter((n) => Number.isInteger(n) && n > 0 && n <= 32))]
    : moves.map((n) => n + 1)
  const sources = Array.isArray(value.sources)
    ? moveIds.map((_, i) => ['detected', 'manual', 'fallback'].includes(value.sources[i]) ? value.sources[i] : 'detected')
    : []
  const doneCount = Number.isInteger(value.doneCount) && value.doneCount >= 0 ? value.doneCount : Math.max(moveIds.length, moves.length)
  return {
    ...value,
    ts,
    day: typeof value.day === 'string' ? value.day : '',
    date: typeof value.date === 'string' ? value.date : '',
    doneCount,
    complete: typeof value.complete === 'boolean' ? value.complete : doneCount >= 8,
    moves,
    moveIds,
    sources,
    names: Array.isArray(value.names) ? value.names.filter((name) => typeof name === 'string').slice(0, 32) : [],
    tone: typeof value.tone === 'string' ? value.tone : '',
    minutes: Number.isFinite(value.minutes) && value.minutes >= 0 ? value.minutes : 0,
  }
}

function localStorageOrNull() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

function read() {
  const storage = localStorageOrNull()
  if (!storage) {
    storageStatus = { ...storageStatus, persistent: false }
    return memoryRecords
  }
  let raw
  try { raw = storage.getItem(KEY) } catch {
    storageStatus = { ...storageStatus, persistent: false }
    return memoryRecords
  }
  if (raw === null) {
    if (!storageStatus.persistent && memoryRecords.length && !storageStatus.recovered) {
      write(memoryRecords)
      return memoryRecords
    }
    memoryRecords = []
    storageStatus = { persistent: true, recovered: false }
    return memoryRecords
  }
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('records must be an array')
    const normalized = parsed.map(normalizeRecord)
    const recovered = normalized.some((item) => item === null)
    const stored = normalized.filter(Boolean)
    if (recovered) {
      memoryRecords = stored
      storageStatus = { persistent: false, recovered: true }
      return memoryRecords
    }
    if (!storageStatus.persistent && memoryRecords.length) {
      const merged = new Map()
      for (const item of [...stored, ...memoryRecords]) merged.set(item.sessionId || `ts:${item.ts}`, item)
      write([...merged.values()])
      return memoryRecords
    }
    memoryRecords = stored
    storageStatus = { persistent: true, recovered: false }
    return memoryRecords
  } catch {
    // Keep the original corrupt value intact; new work can continue in memory.
    storageStatus = { persistent: false, recovered: true }
    return memoryRecords
  }
}

function write(list) {
  memoryRecords = list.map(normalizeRecord).filter(Boolean).slice(-60)
  const storage = localStorageOrNull()
  try {
    if (!storage) throw new Error('local storage unavailable')
    if (storageStatus.recovered) throw new Error('record storage needs recovery')
    storage.setItem(KEY, JSON.stringify(memoryRecords))
    storageStatus = { ...storageStatus, persistent: true }
  } catch {
    storageStatus = { ...storageStatus, persistent: false }
  }
}

export function getRecordStorageStatus() { return { ...storageStatus } }
export function getRecords() { return read().slice().sort((a, b) => b.ts - a.ts) }
export function lastRecord() { return getRecords()[0] || null }

const pad2 = (n) => String(n).padStart(2, '0')

function makeRecord({ moveIds = null, sources = [], moves = [], names = [], tone = '', startedAt = null, endedAt = null, minutes = null, sessionId = null } = {}) {
  const d = new Date(Number.isFinite(endedAt) ? endedAt : Date.now())
  const ids = Array.isArray(moveIds) ? [...new Set(moveIds.filter((id) => Number.isInteger(id) && id > 0))] : []
  const legacyMoves = ids.length
    ? ids.map((id) => id - 1)
    : moves.filter((index) => Number.isInteger(index) && index >= 0)
  const duration = Number.isFinite(minutes) ? minutes : Number.isFinite(startedAt) && Number.isFinite(endedAt)
    ? Math.max(0, Math.floor((endedAt - startedAt) / 60000)) : 0
  return normalizeRecord({
    sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    ts: d.getTime(),
    day: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    doneCount: Math.max(ids.length, legacyMoves.length),
    complete: Math.max(ids.length, legacyMoves.length) >= 8,
    moveIds: ids.length ? ids : legacyMoves.map((index) => index + 1),
    sources: ids.length ? ids.map((_, i) => ['detected', 'manual', 'fallback'].includes(sources[i]) ? sources[i] : 'detected') : [],
    moves: legacyMoves,
    names,
    tone,
    minutes: duration,
    startedAt,
    endedAt,
  })
}

export function saveRecord(options = {}) {
  const rec = makeRecord(options)
  write([...read(), rec])
  return rec
}

export function saveSession(options = {}) {
  const rec = makeRecord(options)
  const list = read()
  const index = rec.sessionId ? list.findIndex((item) => item.sessionId === rec.sessionId) : -1
  if (index >= 0) list[index] = rec
  else list.push(rec)
  write(list)
  return rec
}

export const recordStore = { save: saveSession, list: getRecords, storageStatus: getRecordStorageStatus }

export function clearRecords() {
  memoryRecords = []
  write([])
}
