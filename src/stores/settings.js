// 基础设置 —— localStorage 持久化
//
// 【为什么要有这个 store】设置页原来只往 localStorage 写，从没人读：
// 关掉「古琴弦音反馈」「语音播报」在实际使用里没有任何效果（假开关）。
// 现在统一从这里读，各消费方在动作发生的那一刻查一次 —— 不做响应式订阅，
// 因为设置改完本来就要切页面才看得到效果，订阅反而引入不必要的耦合。

const KEY = 'xianyang.settings'

const DEFAULTS = {
  audioOn: true,     // 进页时初始化音频（关掉则不自动 unlock，等用户首次交互）
  pluckOn: true,     // 做到位时拨弦
  voiceOn: true,     // 语音播报动作名
  defStyle: 'baduanjin',
  defStage: 'point',
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const o = JSON.parse(raw)
    return { ...DEFAULTS, ...(o && typeof o === 'object' ? o : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function getSettings() {
  return read()
}

/** 单项读取，如 getSetting('pluckOn') */
export function getSetting(k) {
  return read()[k]
}

export function saveSettings(patch) {
  const next = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 隐私模式 / file:// 下不可写：仅内存态，不阻断流程
  }
  return next
}

export function clearSettings() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}
