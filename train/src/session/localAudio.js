const AUDIO_ROOT = '/audio/'

export function createLocalAudioPlayer({ audioFactory = () => new Audio(), onState = () => {} } = {}) {
  let audio = null
  let source = ''
  let state = 'idle'
  let error = ''

  function publish(next, message = '') {
    state = next
    error = message
    onState({ state, source, error })
  }

  function releaseCurrent() {
    if (!audio) return
    try { audio.pause() } catch { /* route teardown is best-effort */ }
    try { audio.currentTime = 0 } catch { /* detached media may reject seeks */ }
    try { audio.removeAttribute?.('src') } catch { /* browser-specific */ }
    try { audio.src = '' } catch { /* browser-specific */ }
    try { audio.load?.() } catch { /* browser-specific */ }
    audio = null
    source = ''
  }

  async function play(file) {
    if (state === 'disposed') return false
    if (typeof file !== 'string' || !/^[-\w]+\.(?:mp3|ogg|wav)$/i.test(file)) {
      publish('error', '这首曲目暂时无法播放。')
      return false
    }
    const nextSource = `${AUDIO_ROOT}${file}`
    if (source !== nextSource) {
      releaseCurrent()
      try {
        audio = audioFactory()
        source = nextSource
        audio.src = source
        audio.preload = 'none'
        audio.addEventListener?.('ended', () => publish('ended'))
      } catch {
        releaseCurrent()
        publish('error', '无法初始化本地音频，请刷新后重试。')
        return false
      }
    }
    publish('loading')
    try {
      await audio.play()
      publish('playing')
      return true
    } catch (cause) {
      const blocked = cause?.name === 'NotAllowedError'
      publish(blocked ? 'blocked' : 'error', blocked
        ? '播放被浏览器拦截，请点击播放重试。'
        : `播放失败：${cause?.message || '请检查本地音频文件。'}`)
      return false
    }
  }

  function pause() {
    if (!audio || state === 'disposed') return
    try { audio.pause() } catch { /* ignore detached media */ }
    publish('paused')
  }

  function stop() {
    if (state === 'disposed') return
    releaseCurrent()
    publish('idle')
  }

  function dispose() {
    if (state === 'disposed') return
    releaseCurrent()
    publish('disposed')
  }

  return {
    play,
    pause,
    stop,
    dispose,
    snapshot: () => ({ state, source, error }),
  }
}
