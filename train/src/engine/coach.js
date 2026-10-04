// 陪练教练状态机 —— 「教练示范 → 用户跟练 → 等你做完 → 进入下一式」
//
// 【它解决什么问题】
//   原跟练页只有「判定器」：没人告诉你下一式要干什么，标准骨架还在原地无限循环，
//   用户看不明白、也不知道该做什么；而且只要判定不命中，就会永远停在同一式。
//   这台状态机把每一式拆成「示范 / 跟练」两个阶段，并给等待加上**上限**，
//   于是既能「等用户做完再走」，又不会「一直卡在同一式循环等待」。
//
// 【状态图】（每一式都走一遍）
//     begin(idx)
//        │
//        ▼
//   ┌─ demo ────────── 教练示范（动画播一遍后停在结束姿态）
//   │    │ demoDone() / demoMaxMs 兜底
//   │    ▼
//   │  follow ──────── 用户跟练：判定器武装，等用户做到位
//   │    │  ├─ hit(idx) → done（用户完成）
//   │    │  └─ 未命中的处理，分两种「闸门」（cfg.gate）：
//   │    ▼
//   │  grace ───────── 宽限期：还可命中；点 extend() 可延长期限
//   │    │  ├─ hit(idx) → done
//   │    │  ├─ extend() → follow（重开一轮等待）
//   │    │  └─ graceMs  → advance(timeout)
//   │    ▼
//   │  done ── 极短庆祝（doneMs 后）→ advance(done) → 调用方推进到下一式并 begin()
//   └──────────────────────────────────────────────────────────
//
// 【两种闸门 cfg.gate —— 谁决定「什么时候进下一式」】
//
//   gate = 'time'   （旧行为）计时放行：
//       follow ─softWaitMs→ 重放一次示范 → follow ─hardWaitMs→ grace ─graceMs→ advance('timeout')
//       即使一直没做到位，也会在硬上界内自动进入下一式。适合「先过一遍流程」。
//
//   gate = 'judge'  （默认）判定闸门：**只有判定命中才进下一式**
//       follow ─hit(idx)→ done → advance
//             └─attemptMs→ nudge（重播一遍示范 + 轮次 +1，仍留在 follow，仍然接受命中）
//       没通关就永远停在这一式、示范循环陪练 —— 这是「一个动作没通关就一直练这个动作」的落地。
//       注意：它**不是**停死 —— ①每轮都会重播示范，画面一直在动；
//       ②调用方永远保留「跳过本式」手动出口；③轮次计数让用户看得见系统是活的。
//
// 【为什么把时间交给调用方 tick(dtMs)】
//   不在模块里开 setInterval / 读 performance.now()，状态机就是**纯函数**：
//   给定「过了多少毫秒」就能确定下一状态，于是可以在 node 里跑单测，
//   也能让调用方在「页面不可见 / 预录兜底 / 已结束」时暂停计时。
//
// 单测：node scripts/coach.test.mjs

export const PHASE = {
  IDLE: 'idle',
  DEMO: 'demo',
  FOLLOW: 'follow',
  GRACE: 'grace',
  DONE: 'done',
}

/**
 * 两档节奏。
 *   full  —— 完整模式（mode=full）：示范一遍 + 允许自动重放一次 + 较长等待
 *   short —— 精简模式（mode=short）：不重放 + 较短等待，快速过式
 * demoMaxMs 是「示范阶段」的保底时长：万一示范动画缺失/加载失败没派发 done，
 * 到点自动进入跟练，避免卡在 demo。
 *
 * gate:'judge' 时只有 attemptMs / demoMaxMs / doneMs 生效；
 * softWaitMs / hardWaitMs / graceMs / maxRedemo 只在 gate:'time' 下生效。
 */
export const COACH_PRESETS = {
  full: {
    gate: 'judge',       // 判定闸门：没通关不换式，示范循环陪练
    attemptMs: 15000,    // 跟练每 15s 重播一遍示范（仅 nudge，不影响判定与推进）
    softWaitMs: 10000,   // —— 以下四项仅在 gate:'time' 时使用 ——
    hardWaitMs: 25000,   // 跟练 25s 未完成 → 进入宽限
    graceMs: 8000,       // 宽限 8s 后自动放行下一式
    maxRedemo: 1,        // 最多自动重放 1 次示范
    demoMaxMs: 9000,     // 示范阶段保底 9s
    doneMs: 900,         // 「很好！」停留时长
  },
  short: {
    gate: 'judge',
    attemptMs: 10000,
    softWaitMs: 6000,
    hardWaitMs: 15000,
    graceMs: 6000,
    maxRedemo: 0,
    demoMaxMs: 5000,
    doneMs: 700,
  },
}

const clampNum = (v, d) => (Number.isFinite(v) && v > 0 ? v : d)

/**
 * @param {{level?:'full'|'short', overrides?:object}} opts
 *   overrides.gate      'judge'（默认）| 'time'
 *   overrides.attemptMs 判定闸门下，每隔多久重播一遍示范
 */
export function createCoach({ level = 'full', overrides = {} } = {}) {
  const base = COACH_PRESETS[level] || COACH_PRESETS.full
  const gate = overrides.gate === 'time' || overrides.gate === 'judge'
    ? overrides.gate
    : (base.gate || 'time')
  const cfg = {
    gate,
    attemptMs: clampNum(overrides.attemptMs, base.attemptMs ?? base.softWaitMs),
    softWaitMs: clampNum(overrides.softWaitMs, base.softWaitMs),
    hardWaitMs: clampNum(overrides.hardWaitMs, base.hardWaitMs),
    graceMs: clampNum(overrides.graceMs, base.graceMs),
    demoMaxMs: clampNum(overrides.demoMaxMs, base.demoMaxMs),
    doneMs: clampNum(overrides.doneMs, base.doneMs),
    maxRedemo: Number.isFinite(overrides.maxRedemo)
      ? Math.max(0, overrides.maxRedemo)
      : base.maxRedemo,
  }

  let phase = PHASE.IDLE
  let step = 0
  let elapsed = 0      // 当前阶段已过毫秒
  let redemo = 0       // 本式已自动重放次数（gate:'time' 用）
  let attempt = 0      // 本式「还没通关」已重播几轮（gate:'judge' 用）
  let allowHit = false // 当前是否接受「用户做到位」

  function to(next) {
    phase = next
    elapsed = 0
  }

  return {
    get phase() { return phase },
    get step() { return step },
    get elapsed() { return elapsed },
    get redemo() { return redemo },
    get attempt() { return attempt },
    get gate() { return cfg.gate },
    get cfg() { return cfg },
    /** 此刻是否处于「跟练 / 宽限」——判定命中才算完成 */
    get acceptingHit() { return allowHit },
    /** 是否在推进流程中（非 idle） */
    get active() { return phase !== PHASE.IDLE },

    /** 进入某一式的示范阶段。推进到新式、重开、切拳种都走这里。 */
    begin(idx, { reason = 'begin' } = {}) {
      step = Math.max(0, idx | 0)
      redemo = 0
      attempt = 0
      allowHit = false
      to(PHASE.DEMO)
      return { type: 'demo', step, reason }
    },

    /** 教练示范播完（由示范动画 done / 或保底计时触发）→ 进入跟练 */
    demoDone({ reason = 'demoEnd' } = {}) {
      if (phase !== PHASE.DEMO) return null
      allowHit = true
      to(PHASE.FOLLOW)
      return { type: 'follow', step, reason }
    },

    /** 用户做到位（判定器命中当前式） */
    hit(idx) {
      if (!allowHit || (idx | 0) !== step) return null
      allowHit = false
      to(PHASE.DONE)
      return { type: 'complete', step }
    },

    /** 手动重看示范（任何阶段都能按）→ 回到 demo */
    replay() {
      if (phase === PHASE.IDLE) return null
      allowHit = false
      to(PHASE.DEMO)
      return { type: 'demo', step, reason: 'replay' }
    },

    /** 宽限期内点「再练一会儿」→ 回到跟练，重新计一轮（重放额度也回满） */
    extend() {
      if (phase !== PHASE.GRACE) return null
      redemo = 0
      allowHit = true
      to(PHASE.FOLLOW)
      return { type: 'follow', step, reason: 'extend' }
    },

    /**
     * 推进时间。返回本帧产生的事件数组（可能为空）。
     * @param {number} dtMs 距上次 tick 的毫秒数
     * @returns {{type:'demo'|'follow'|'complete'|'grace'|'nudge'|'advance', step:number, reason?:string, attempt?:number}[]}
     */
    tick(dtMs) {
      const dt = Number.isFinite(dtMs) ? dtMs : 0
      if (dt <= 0 || phase === PHASE.IDLE) return []
      const out = []
      elapsed += dt

      if (phase === PHASE.DEMO) {
        // 示范动画缺失 / 未派发 done 的保底：到点强制进入跟练
        if (elapsed >= cfg.demoMaxMs) {
          allowHit = true
          to(PHASE.FOLLOW)
          out.push({ type: 'follow', step, reason: 'demoTimeout' })
        }
      } else if (phase === PHASE.FOLLOW) {
        if (cfg.gate === 'judge') {
          // 【判定闸门】没通关 → 不换式、不放行，只重播一遍示范继续等。
          // allowHit 保持 true：用户在重播途中做到位也算通关。
          if (elapsed >= cfg.attemptMs) {
            elapsed = 0
            attempt++
            out.push({ type: 'nudge', step, attempt })
          }
        } else if (redemo < cfg.maxRedemo && elapsed >= cfg.softWaitMs) {
          redemo++
          allowHit = false
          to(PHASE.DEMO)
          out.push({ type: 'demo', step, reason: 'redemo' })
        } else if (elapsed >= cfg.hardWaitMs) {
          allowHit = true          // 宽限期仍然接受命中
          to(PHASE.GRACE)
          out.push({ type: 'grace', step })
        }
      } else if (phase === PHASE.GRACE) {
        if (elapsed >= cfg.graceMs) {
          allowHit = false
          to(PHASE.IDLE)
          out.push({ type: 'advance', step, reason: 'timeout' })
        }
      } else if (phase === PHASE.DONE) {
        if (elapsed >= cfg.doneMs) {
          to(PHASE.IDLE)
          out.push({ type: 'advance', step, reason: 'done' })
        }
      }
      return out
    },

    /** 停用 / 退出（不再引导） */
    reset() {
      to(PHASE.IDLE)
      step = 0
      redemo = 0
      attempt = 0
      allowHit = false
    },
  }
}
