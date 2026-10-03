// 身体数据 —— localStorage 持久化
//
// 【为什么抽成 store】原先 MeView / SummaryView 各自写死 `const hasBodyData = ref(false)`，
// 于是「在身体数据页填完保存」后回到「我的」仍显示「未填写」、总结页的定制食谱永远锁着。
// 状态只有一个来源（localStorage 的 xianyang.bodyData），任何页面 mount 时读一次即可，
// 不需要跨组件的响应式同步（各页面都是 onMounted 读，够用且不会漏更新）。

const KEY = 'xianyang.bodyData'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

/** 是否已填写身体数据（至少要有身高或体重之一，空表单不算） */
export function hasBodyData() {
  const o = read()
  if (!o) return false
  return !!(o.height || o.weight || (Array.isArray(o.injuries) && o.injuries.length))
}

export function getBodyData() {
  return read()
}

export function saveBodyData(form) {
  try {
    localStorage.setItem(KEY, JSON.stringify(form))
    return true
  } catch {
    // 隐私模式 / file:// 下不可写：仅内存态，不阻断流程
    return false
  }
}

export function clearBodyData() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}
