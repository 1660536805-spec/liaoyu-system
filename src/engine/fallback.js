// 兜底第一级：60 秒预录视频自动顶上（R2 现状：兜底就位率 0%，这里补接线）
//
// 场景：现场摄像头翻车 —— 授权被拒、设备被占、驱动挂起、人或画面出框、
// 模型加载超时……任何「识别不出东西」的情况，跟练页都必须在 3 秒内换成
// 预录视频，让演示不空场、计时与打卡不中断。
//
// 三件事：
//   1. frameAlive()  —— 这一帧到底算不算「有信号」（供跟练页判定）
//   2. FallbackSwitch —— 预录视频的加载 / 切入 / 退出状态机
//   3. FALLBACK_CFG   —— 触发参数，现场可调
//
// 设计约束（来自 S4 范围冻结）：
//   · 不新增功能，只做「识别失败 → 播预录」这一条兜底链路
//   · 不碰判定器（judge.js 一行不改），预录期间式号/计时/打卡照旧累加
//   · 视频源走本地 public/assets/，绝不给 CDN（断网可用是 P0 底线 D5）
//
// 用法（跟练页）：
//   const fb = new FallbackSwitch(videoEl, { onEnter, onExit })
//   fb.prepare()                       // 预热，不等
//   fb.enter('摄像头初始化失败')         // 触发切换
//   fb.exit()                          // 回到实时

/** 预录视频路径（本地资源，不走 CDN） */
export const FALLBACK_SRC = '/assets/fallback.mp4'

export const FALLBACK_CFG = {
  /**
   * 已见过人体后，连续这么久没有有效帧 → 切预录。
   * 【真机标定 2026-10-03】原为 4s，实测误伤：
   *   八段锦里有「低头弯腰」（式5/6）头会短暂离开画面，
   *   4 秒足够触发一次误切，用户正练着就被打断（真机反馈的实际问题）。
   * 改为 12s：够长覆盖「弯腰 3 秒 + 起身 2 秒 + 短暂遮挡」，
   * 仍能在摄像头真被拔掉（系统会持续无信号）时合理兜底。
   */
  noSignalMs: 12000,
  /** 从「引擎就绪」到「首次出现人体」的最长等待。原 8s 对上光/摆位偏紧，改 15s */
  firstFrameMs: 15000,
  /** 恢复实时前需要的连续有效帧数（防抖，别一闪而过就切回去） */
  recoverFrames: 30,
  /** 摄像头彻底挂掉后，后台重试的间隔 */
  retryMs: 8000,
  /** 预录模式下「下一式」自动推进的保险时长（防止演示卡死在某一式没人按） */
  autoAdvanceMs: 12000,
  /**
   * 单点可见度门槛。从 0.5 降到 0.35：
   * 真机实测手上有深色物体/运动模糊时腕点 visibility 只到 0.47，
   * 0.5 会把真实存在的身体判成「不可见」。
   */
  minVis: 0.35,
  /**
   * 判定「有信号」所需的最少有效点数（共 8 个候选点：肩/肘/腕/髋）。
   * 【真机标定 2026-10-03】原为 6/8，用两份真实采集数据（6040 + 8797 帧）实测：
   *   6/8 门槛 → 人在画面里仍有 0.58%~2.58% 的帧被判「无人」，
   *                连续 4s 累积必然触发误切（就是这次遇到的问题）。
   *   4/8 门槛 → 误判率降到 0.02%~0%（几乎不误伤），
   *                而人真走开时有效点会掉到 3 以下，仍能正确兜底。
   * 取 4/8：宁可多等 12 秒，也不在用户正练的时候切走。
   */
  minAlivePoints: 4,
}

// 判定器只认上半身，这 8 点够用（肩/肘/腕/髋）
const ALIVE_POINTS = [11, 12, 13, 14, 15, 16, 23, 24]

/**
 * 这一帧算不算「有信号」？
 * 【为什么是 6/8】真机实测（6039 帧）：近距离时膝/踝 visibility≈0.02，
 * 上半身 6 点 ≈1.0。取 6 点门槛既能容忍手腕短暂出框，又能在人真的走开时归零。
 * @param {Array|null} landmarks MediaPipe 33 点
 * @returns {boolean}
 */
export function frameAlive(landmarks, cfg = FALLBACK_CFG) {
  if (!landmarks || landmarks.length < 29) return false
  let n = 0
  for (const i of ALIVE_POINTS) {
    if ((landmarks[i]?.visibility ?? 0) >= cfg.minVis) n++
  }
  return n >= cfg.minAlivePoints
}

/**
 * 预录视频切换器（状态机）。
 * 只依赖一个「像 video 元素一样」的对象，便于在 node 里用假对象做自测。
 * 状态：idle → loading → ready | error → （enter）active → （exit）idle
 */
export class FallbackSwitch {
  constructor(el, { onEnter = () => {}, onExit = () => {}, onError = () => {}, now = () => performance.now() } = {}) {
    this.el = el
    this.onEnter = onEnter
    this.onExit = onExit
    this.onError = onError
    this.now = now
    this.state = 'idle'
    this.ready = false
    this.enteredAt = 0
    this.warmAt = 0        // prepare 完成的时刻，用于算「断识别 → 出视频」耗时
    this.reason = ''
  }

  /**
   * 预热：设好 src 并等它可播。不阻塞调用方（返回 Promise，针织不 await）。
   * 优先用 canplay（数据够播了），error 立刻判失败——**文件不存在必须马上炸出来**，
   * 否则现场会以为兜生效了，其实是静默不响。
   */
  prepare(timeoutMs = 8000) {
    const el = this.el
    if (!el) {
      this.state = 'error'
      this.onError(new Error('fallback: 没有预录视频元素'))
      return Promise.resolve(false)
    }
    el.loop = true
    el.muted = true
    el.playsInline = true
    el.preload = 'auto'
    el.src = FALLBACK_SRC
    this.state = 'loading'

    return new Promise((resolve) => {
      let settled = false
      // 超时器要先声明：下面「缓存命中直接 finish」会在 timer 初始化前同步调用 finish，
      // 写成 const timer = setTimeout(...) 放后面会踩 TDZ 直接抛错（真浏览器里每次
      // 命中缓存都必炸，所以这条必须先声明）。
      let timer = 0
      const finish = (state, val) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        el.removeEventListener('canplay', ok)
        el.removeEventListener('error', bad)
        this.state = state
        this.ready = state === 'ready'
        if (state === 'ready') this.warmAt = this.now()
        resolve(val)
      }
      const ok = () => finish('ready', true)
      const bad = () => {
        const e = new Error(`预录兜底未就绪：取不到 ${FALLBACK_SRC}（文件缺失或编码不受支持）`)
        console.error('[fallback]', e.message)
        this.onError(e)
        finish('error', false)
      }
      // 缓存命中时 readyState 已经够了，别干等事件
      if (el.readyState >= 3) { finish('ready', true); return }
      el.addEventListener('canplay', ok)
      el.addEventListener('error', bad)
      el.load()
      // 超时不算失败（大文件可能慢），但标记为不可靠，进 fallback 时会重试一次
      timer = setTimeout(() => {
        if (el.readyState >= 2) finish('ready', true)
        else if (el.readyState >= 1) finish('ready', true)
        else console.warn('[fallback] 预热超时，进入兜底时会再试一次')
      }, timeoutMs)
    })
  }

  /** 切到预录。返回是否真的播起来了。 */
  async enter(reason = '') {
    if (this.state === 'active') return true
    if (this.state === 'error') return false        // 文件根本不在，别反复打 404
    if (!this.ready) await this.prepare()
    try {
      await this.el.play()
    } catch (e) {
      // play() 被拦时多半是暂停策略；再试一次通常能起来
      try { await this.el.play() } catch (e2) {
        console.error('[fallback] 播放失败', e2?.message || e2)
        return false
      }
    }
    if (this.state === 'loading') { this.ready = true; this.state = 'ready' }
    this.state = 'active'
    this.reason = reason
    this.enteredAt = this.now()
    const dt = this.warmAt ? Math.round(this.enteredAt - this.warmAt) : 0
    console.info(`[fallback] 切预录：${reason}（预热已就绪，播放耗时 ${dt}ms）`)
    this.onEnter(reason)
    return true
  }

  /** 退出预录，回到实时画面 */
  exit() {
    if (this.state !== 'active') return
    try { this.el.pause() } catch { /* 元素可能已卸载 */ }
    this.state = 'idle'
    this.reason = ''
    console.info('[fallback] 回到实时画面')
    this.onExit()
  }

  get active() { return this.state === 'active' }
  get available() { return this.state === 'ready' || this.state === 'active' }
}
