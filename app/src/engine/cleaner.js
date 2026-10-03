// 关键点净化 —— 真机实测驱动的稳定性处理
//
// 【为什么需要】实测 8797 帧（2.2m 退后取景）证明：
//   抖动与 visibility 强相关 —— 右腕在 vis>0.85 时抖动 0.069，vis<0.3 时抖动 0.202（3 倍）。
//   且 MediaPipe 对「画面外 / 遮挡」的点不是返回无数据，而是给一个**猜测坐标**
//   （例：踝 y 跑到 1.55，画面外 55%），这些坐标数学上连续、物理上无意义，
//   会让「手到脚距离」这类判定算出乱七八糟的值。
//
// 【三道处理】
//   ① 越界剔除：x/y 超出 [0,1] 的点直接判无效（visibility 置 0）
//   ② 低置信剔除：visibility < LOW_VIS 的点判无效
//   ③ 坐标冻结：无效点的坐标沿用上一帧有效值，避免几何量突变
//   被剔除的点由判定器已有的 need() 门槛拦住 → 宁可不判，不误判
//
// 【不做什么】不做时序平滑。实测证明滤波会同时削弱真实动作：
//   中值5+EMA0.5 抖动↓42% 但真实动作速度仅保留 52%，判定会明显迟钝。

const LOW_VIS = 0.30        // 低于此值视为不可信（实测 vis<0.3 时抖动为可信帧的 3 倍）
const EDGE = 0.005          // 允许的边界溢出：MediaPipe 边缘点会略微越界
const FREEZE_KEYS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

const isOut = (p) =>
  !p || p.x < -EDGE || p.x > 1 + EDGE || p.y < -EDGE || p.y > 1 + EDGE

/**
 * 创建净化器（状态：每点的上一帧有效坐标）
 */
export function createLandmarkCleaner() {
  let last = new Map()      // idx -> {x,y}
  let rejected = 0
  let total = 0

  return {
    /**
     * @param {Array} landmarks MediaPipe 输出的 33 点
     * @returns {Array} 净化后的 landmarks（原对象被就地修改）
     */
    clean(landmarks) {
      if (!landmarks || landmarks.length < 29) return landmarks
      total++
      let bad = 0

      for (const i of FREEZE_KEYS) {
        const p = landmarks[i]
        if (!p) continue
        const vis = p.visibility ?? 1
        const outOfFrame = isOut(p)
        const lowConf = vis < LOW_VIS

        if (outOfFrame || lowConf) {
          bad++
          // ① 标记为不可信，让判定器的 need() 拦住
          p.visibility = 0
          // ② 坐标冻结：用上一帧有效值，避免几何量突变
          const prev = last.get(i)
          if (prev) { p.x = prev.x; p.y = prev.y }
        } else {
          // ③ 记录为有效值，供下一帧冻结用
          last.set(i, { x: p.x, y: p.y })
        }
      }
      if (bad) rejected += bad

      // 整帧无任何有效点时返回 null，让上层直接跳过判定
      const anyValid = FREEZE_KEYS.some((i) => (landmarks[i]?.visibility ?? 0) >= LOW_VIS)
      return anyValid ? landmarks : null
    },

    get stats() {
      return {
        frames: total,
        rejected,
        rate: total ? rejected / (total * FREEZE_KEYS.length) : 0,
      }
    },

    reset() { last = new Map(); rejected = 0; total = 0 },
  }
}

export { LOW_VIS, FREEZE_KEYS }
