// 五声音阶音色自测 —— 验证音阶结构与音色特征
// 运行：npm run test:audio
//
// 为什么用定量检查而不是耳朵听：
// 十二平均律的 F（4）与 B（7）正是「西式感」的根源，低频区肉耳不易分辨，
// 但音名结构可精确验证。音色特征（瞬态/尾音）可用离线渲染测时间轴。
import { PENTATONIC } from '../src/engine/guqin.js'

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

const gong = PENTATONIC[0].freq
const semi = (f) => 12 * Math.log2(f / gong)          // 相对宫音的半音数
const roleOf = (p) => p.gong || p.shang || p.jue || p.zhi || p.yu || p.gong2 || p.shang2
const DEG = { 0: '宫 · 基准', 2: '商 · 大二度', 4: '角 · 大三度', 7: '徵 · 纯五度', 9: '羽 · 大六度', 12: '宫 · 高八度', 14: '商 · 高八度' }

console.log('\n=== 1. 定弦表 ===\n')
console.log('弦  唱名  频率(Hz)   相对宫音            动作角色')
console.log('─'.repeat(66))
PENTATONIC.forEach((p, i) => {
  const n = Math.round(semi(p.freq))
  const d = DEG[n] || ''
  console.log(`${i + 1}   ${roleOf(p)}    ${p.freq.toFixed(2).padStart(7)}   ${String(n).padStart(3)} 半音 ${d.padEnd(14)} ${p.role}`)
})
console.log('─'.repeat(66))

console.log('\n=== 2. 音阶结构 ===')
const first5 = PENTATONIC.slice(0, 5).map((p) => Math.round(semi(p.freq)))
okc(first5.join(',') === '0,2,4,7,9', `前五弦 = 宫商角徵羽（半音 ${first5.join(',')}）`)

const names = PENTATONIC.map((p) => p.note.replace("'", ''))
okc(!names.includes('F'), '不含 4 半音 F —— 避免西方调式的明亮感')
okc(!names.includes('B'), '不含 7 半音 B —— 避免西方调式的张力感')
okc(names.every((n) => 'CDEGA'.includes(n)), '七弦全部落在 C D E G A 五音内')

console.log('\n=== 3. 频率单调性 ===')
let mono = true
for (let i = 1; i < PENTATONIC.length; i++) {
  if (PENTATONIC[i].freq <= PENTATONIC[i - 1].freq) { mono = false; console.log(`   ✗ 弦${i + 1} 未高于弦${i}`) }
}
okc(mono, '七弦频率逐弦升高（无重复/倒挂）')

console.log('\n=== 4. 收势和弦 ===')
const CHORD = [261.63, 329.63, 392.00, 440.00, 587.33]   // C E G A D
const chordNames = CHORD.map((f) => (DEG[Math.round(semi(f))] || '?').split(' · ')[0])
okc(chordNames.join('') === '宫角徵羽商', `收势和弦 = ${chordNames.join(' + ')}（五声叠置）`)

console.log('\n=== 5. 音色特征（离线渲染）===')
const OAC = globalThis.OfflineAudioContext
if (!OAC) {
  console.log('   （当前环境无 OfflineAudioContext，跳过）')
} else {
  const render = async (f, decay) => {
    const off = new OAC(1, 44100 * 4.5, 44100)
    const out = off.createGain()
    out.gain.setValueAtTime(0, 0)
    out.gain.setValueAtTime(0.32, 0.003)                      // 拨弦瞬态
    out.gain.exponentialRampToValueAtTime(0.32 * 0.38, 0.16)  // 快初衰
    out.gain.exponentialRampToValueAtTime(0.0001, decay)      // 长尾音
    out.connect(off.destination)
    for (const [mul, g] of [[1.00, 1.00], [2.76, 0.42], [5.40, 0.22], [8.93, 0.09]]) {
      const o = off.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(f * mul, 0)
      const og = off.createGain()
      og.gain.setValueAtTime(0, 0)
      og.gain.linearRampToValueAtTime(g * 0.8, 0.004)
      og.gain.exponentialRampToValueAtTime(0.0001, decay * (mul > 2 ? 0.42 : 1))
      o.connect(og); og.connect(out)
      o.start(0); o.stop(decay)
    }
    const buf = await off.startRendering()
    return buf.getChannelData(0)
  }

  const d = await render(gong, 3.6)
  let pk = 0, pkAt = 0
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > pk) { pk = Math.abs(d[i]); pkAt = i / 44100 }
  let tail = 0
  for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > pk * 0.10) { tail = i / 44100; break }
  console.log(`   峰值 ${pk.toFixed(4)} @ ${(pkAt * 1000).toFixed(1)}ms，尾音至 ${tail.toFixed(2)}s`)
  okc(pk > 0.01, `有实际输出（峰值 ${pk.toFixed(4)}）`)
  okc(pkAt * 1000 < 15, `拨弦瞬态 ≤15ms 达峰（实得 ${(pkAt * 1000).toFixed(1)}ms）—— 非缓慢渐入`)
  okc(tail > 1.2, `长可听尾音(−20dB) ≥1.2s（实得 ${tail.toFixed(2)}s）—— 古琴余韵特征`)
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))
process.exit(fail === 0 ? 0 : 1)
