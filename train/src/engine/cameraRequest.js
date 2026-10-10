function stopStream(stream) {
  try { stream?.getTracks?.().forEach((track) => track.stop()) } catch { /* best effort */ }
}

function abortError() {
  return Object.assign(new Error('camera request was cancelled'), { name: 'AbortError' })
}

/** Owns the generation of camera requests so late permission results cannot revive a stopped engine. */
export function createCameraRequestGuard() {
  let generation = 0
  let disposed = false
  return {
    begin() {
      if (disposed) throw abortError()
      generation += 1
      return generation
    },
    isCurrent(token) { return !disposed && token === generation },
    cancel() { generation += 1 },
    dispose() { disposed = true; generation += 1 },
    async acquire(token, request, timeoutMs = 15000, label = '摄像头打开') {
      const guarded = Promise.resolve(request).then((stream) => {
        if (!this.isCurrent(token)) {
          stopStream(stream)
          throw abortError()
        }
        return stream
      })
      let timer
      try {
        return await Promise.race([
          guarded,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} 超时 ${timeoutMs}ms`)), timeoutMs) }),
        ])
      } catch (error) {
        if (this.isCurrent(token)) this.cancel()
        throw error
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
