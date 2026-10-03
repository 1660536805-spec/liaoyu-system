// 播报调度器 —— 决定「什么时候说」
//
// 【核心原则】播报时机必须由**动作状态**驱动，不能由屏幕渲染驱动。
//   屏幕会因为 HMR、刷新、动效中断而重置，动作状态不会。
//
// 【边界情况处理】
//   ① 连续快速切换动作 → 冷却期(600ms) + 打断上一条
//      否则用户连点 3 次会听到 3 条重叠语音
//   ② 重复进入同一动作 → 去重：同一 id 在会话内只播一次
//      （重新开始整套练习时 reset() 清空）
//   ③ 页面刷新 → 状态在内存，刷新后自然重来（localStorage 记住开关设置）
//   ④ 中断后恢复 → 引擎 stop() 后重置「正在播报」标记，避免卡在 busy
//   ⑤ 自动播放策略 → speaker.prime() 必须在用户手势里调（见 voice.js）
//   ⑥ 无可用语音 → 静默降级，不报错、不阻塞判定

import { buildSpeech, buildCompleteSpeech } from '../data/speech.js'

const COOLDOWN = 600        // 冷却期 ms：太快的切换只播最后一条
const REPEAT_GUARD = 1500   // 同一动作在此窗口内不重复播

export function createAnnouncer(speaker, opts = {}) {
  let currentId = null
  let lastSpokenAt = 0
  let lastId = null
  let lastIdAt = 0
  let busy = false
  let level = 'full'         // 冗余档：full | short | name
  let styleId = 'baduanjin'  // 当前拳种（决定播报文案）
  const onState = opts.onState || (() => {})

  // 引擎可用性 → 自动挑冗余档
  function pickLevel() {
    const st = speaker.state
    if (st.kokoroStatus === 'ready') return 'full'
    if (st.webReady) return 'full'       // Web Speech 有中文音色时也能读全句
    if (st.kokoroStatus === 'idle' || st.kokoroStatus === 'loading') return 'short'
    return 'name'                       // 都不行 → 只留原名（其实也读不了，静默）
  }

  async function say(text) {
    if (busy) { speaker.stop() }        // 打断上一条
    busy = true
    onState({ speaking: true })
    try {
      return await speaker.speak(text)
    } finally {
      busy = false
      onState({ speaking: false })
    }
  }

  return {
    /** 切换拳种：文案随之切换，并清空去重（避免新拳种第一式被吞） */
    setStyle(id) {
      if (id && id !== styleId) {
        styleId = id
        this.reset()
      }
    },
    get style() { return styleId },

    /** 用户手势里调一次，解锁音频 */
    prime() { speaker.prime() },

    /**
     * 动作切换时调用（由业务状态驱动，非屏幕驱动）
     * @param {number|null} id 动作 id；null 表示清空/结束
     * @param {number} total
     * @param {{force?:boolean}} opt force=true 时忽略去重（用于「重播」按钮）
     * @returns {Promise<string>} 实际播报的引擎
     */
    async onMove(id, total, opt = {}) {
      if (id === currentId && !opt.force) return ''
      currentId = id

      if (!speaker.enabled) return ''
      if (id === null || id === undefined) return ''

      const now = Date.now()
      // ① 冷却：快速连点只播最后一个
      if (now - lastSpokenAt < COOLDOWN && !opt.force) return ''
      // ② 去重：同一动作短期内不重复
      if (id === lastId && now - lastIdAt < REPEAT_GUARD && !opt.force) return ''

      lastSpokenAt = now
      lastId = id
      lastIdAt = now

      level = pickLevel()
      if (level === 'name') {
        // 没有任何引擎可用 → 静默
        return ''
      }
      const text = buildSpeech(styleId, id, level)
      if (!text) return ''
      return say(text)
    },

    /** 整套练完 */
    async onComplete(total) {
      if (!speaker.enabled) return ''
      currentId = null
      level = pickLevel()
      if (level === 'name') return ''
      return say(buildCompleteSpeech(styleId, level))
    },

    /** 重播当前动作（设置面板的「试听」按钮用） */
    async repeat(id, total) {
      if (!speaker.enabled) return ''
      level = pickLevel()
      const text = buildSpeech(styleId, id, level === 'name' ? 'short' : level)
      if (!text) return ''
      return say(text)
    },

    /** 引擎状态变化时刷新冗余档 */
    refresh() { level = pickLevel() },

    /** 整套重新开始：清空去重记录 */
    reset() { currentId = null; lastId = null; lastIdAt = 0; lastSpokenAt = 0; speaker.stop() },

    /**
     * 停止（退出跟练页 / 中断恢复）
     * 【关键】冷却与去重记录都要清：
     *   - lastSpokenAt：不清的话 stop() 后立刻重来，首播会被冷却静默吞掉
     *   - lastId/lastIdAt：不清的话恢复后 1.5s 内重播同一动作会被去重吞掉
     * 语义上「stop = 这一轮结束」，下一轮应从头完整播报。
     */
    stop() {
      speaker.stop()
      busy = false
      currentId = null
      lastId = null
      lastIdAt = 0
      lastSpokenAt = 0
    },

    get busy() { return busy },
    get currentId() { return currentId },
  }
}
