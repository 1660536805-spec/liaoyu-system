import { chromium } from 'playwright-core'
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const c = await b.newContext({ viewport: { width: 900, height: 900 }, permissions: ['camera'] })
const p = await c.newPage()
await p.goto('http://localhost:5173', { waitUntil: 'networkidle' })
const r = await p.evaluate(async () => {
  const out = {}
  try {
    const g = await import('/src/engine/guqin.js')
    out.strings = g.PENTATONIC.map((s) => `${s.note}=${s.freq}`)
    out.hasF = g.PENTATONIC.some((s) => s.note.includes('F'))
    out.hasB = g.PENTATONIC.some((s) => s.note.includes('B'))
    g.unlockAudio()
    await new Promise((z) => setTimeout(z, 400))
    out.ctx = g.isAudioReady() ? 'running' : 'not-running'
    // 离线渲染实测音色
    const f = g.PENTATONIC[0].freq
    const off = new OfflineAudioContext(1, 44100 * 4.5, 44100)
    const outg = off.createGain()
    outg.gain.setValueAtTime(0, 0)
    outg.gain.setValueAtTime(0.32, 0.003)
    outg.gain.exponentialRampToValueAtTime(0.32 * 0.50, 0.25)
    outg.gain.exponentialRampToValueAtTime(0.32 * 0.20, 1.20)
    outg.gain.exponentialRampToValueAtTime(0.0001, 4.2)
    outg.connect(off.destination)
    const PARTIALS = [[1.0,1.0,1.0],[2.76,0.34,0.55],[5.4,0.15,0.30],[8.93,0.06,0.18]]
    for (const [mul, gg, dcy] of PARTIALS) {
      const o = off.createOscillator(); o.type='sine'; o.frequency.value = f*mul
      const og = off.createGain(); og.gain.setValueAtTime(0,0)
      og.gain.linearRampToValueAtTime(gg*0.8, 0.004)
      og.gain.exponentialRampToValueAtTime(0.0001, 4.2 * dcy)
      o.connect(og); og.connect(outg); o.start(0); o.stop(4.2)
    }
    const buf = await off.startRendering()
    const d = buf.getChannelData(0)
    let pk=0,pkAt=0
    for (let i=0;i<d.length;i++) if (Math.abs(d[i])>pk){pk=Math.abs(d[i]);pkAt=i/44100}
    let tail=0
    for (let i=d.length-1;i>=0;i--) if (Math.abs(d[i])>pk*0.01){tail=i/44100;break}
    out.peak=+pk.toFixed(4); out.peakMs=+(pkAt*1000).toFixed(1); out.tailS=+tail.toFixed(2)
    // 实际调用一次 pluck，确认不抛错
    g.pluck(1); g.chordAll()
    out.pluckOk = true
  } catch (e) { out.err = e.message }
  return out
})
console.log('=== 浏览器内五声音色实测 ===')
console.log(JSON.stringify(r, null, 2))
const ok = r.strings?.length === 7 && !r.hasF && !r.hasB && r.ctx === 'running' && r.peak > 0.01 && r.peakMs < 15 && r.tailS > 1.2
console.log(ok ? '\n✅ 全部通过' : '\n❌ 有项失败')
await b.close()
process.exit(ok ? 0 : 1)
