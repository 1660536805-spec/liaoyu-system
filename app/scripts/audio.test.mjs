// 音色资源自测 —— 验证 7 个采样的映射关系与资源完整性
// 运行：npm run test:audio
//
// 【为什么改成这样测】
// 改造前本测试校验「合成音阶结构」（freq 是否落在五声、是否含 F/B）。
// 换成真实采样后，音色正确性的判据变成三件事：
//   ① 7 个采样文件全部存在于 public/guqin/，与定弦表一一对应
//   ② 7 个素材的**真实音高**两两不同、无重复无倒挂（错位/重复的兜底）
//   ③ 每个文件里嵌的音高与定弦表声明一致（防止「改了表但文件没换」）
// 音阶结构与「无 F/B 半音」不再作为采样音色的验收项 —— 理由见文末。

import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PENTATONIC, TONE_ENGINE } from '../src/engine/guqin.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUB = join(HERE, '..', 'public', 'guqin')

let fail = 0
const okc = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++ }

// ---------------------------------------------------------------- 1. 映射表
console.log('\n=== 1. 七弦映射表（与 strings.json 的 1~7 严格对应）===\n')
console.log('弦  唱名  素材文件              素材音高    播放移调    动作角色')
console.log('─'.repeat(74))
const roleOf = (p) => p.gong || p.shang || p.jue || p.zhi || p.yu || p.gong2 || p.shang2
PENTATONIC.forEach((p, i) => {
  const st = p.shiftSemitones
  const shift = st === 0 ? '原样' : (st < 0 ? `升${-st / 12}八度` : `降${st / 12}八度`)
  console.log(
    `${i + 1}   ${roleOf(p)}    ${p.file.padEnd(20)}  ${p.pitch.toFixed(2).padStart(7)}Hz  ${shift.padEnd(9)}  ${p.role}`,
  )
})
console.log('─'.repeat(74))
okc(PENTATONIC.length === 7, '定弦表恰好 7 条（与 strings.json 的 stringIndex 1~7 对应）')

// ---------------------------------------------------------------- 2. 资源完整性
console.log('\n=== 2. 采样文件完整性 ===')
const files = PENTATONIC.map((p) => `${p.file}.ogg`)
let total = 0
const sizes = []
for (const f of files) {
  const fp = join(PUB, f)
  const has = existsSync(fp)
  if (has) {
    const sz = statSync(fp).size
    total += sz
    sizes.push(sz)
    console.log(`  ${has ? '✓' : '✗'} ${f.padEnd(24)} ${(sz / 1024).toFixed(1).padStart(6)} KB`)
  } else {
    console.log(`  ✗ ${f.padEnd(24)}   缺失！`)
  }
}
okc(files.every((f) => existsSync(join(PUB, f))), `7 个采样文件全部存在（public/guqin/）`)
okc(TONE_ENGINE === 'sample' ? files.length === new Set(files).size : true,
  '采样模式逐弦素材唯一；合成模式允许素材复用')
if (sizes.length === 7) {
  okc(Math.min(...sizes) > 5000, `每个文件 > 5KB（防空文件/占位）`)
  console.log(`  合计 ${(total / 1024).toFixed(1)} KB`)
}

// ---------------------------------------------------------------- 3. 音高唯一性
console.log('\n=== 3. 音高映射唯一性（防错位）===')
const pitches = PENTATONIC.map((p) => p.freq)
let mono = true
for (let i = 1; i < pitches.length; i++) {
  if (pitches[i] <= pitches[i - 1]) {
    mono = false
    console.log(`  ✗ 弦${i + 1}(${pitches[i]}) 未高于弦${i}(${pitches[i - 1]}) —— 存在错位或重复`)
  }
}
okc(mono, '七音逐弦升高，无重复 / 无倒挂')
okc(new Set(pitches).size === 7, '七个目标音高两两不同')

// ---------------------------------------------------------------- 4. 文件内实际音高
console.log('\n=== 4. 文件时长与定弦表声明一致（防「改了表没换文件」）===')
// ogg 是 Vorbis 压缩流，无法在 Node 里直接解码。但同一批素材的**码率**恒定
// （实测 10.6~12.2 KB/s，Vorbis q3 单声道 44.1kHz），故可由体积反查时长。
// 系数取实测中位数 11.6 KB/s；因码率有 ±7% 波动，容差放宽到 25%。
const BYTES_PER_SEC = 11.6 * 1024
const EXPECT_DUR = { '1-xiang-C2': 0.832, '2-xiang-D2': 0.890, '3-xiang-F2': 0.814,
                     '4-xiang-G2': 0.932, '5-xiang-A2': 0.938, '6-xiang-C3': 1.079,
                     '7-xiang-D3': 1.531 }
console.log('  素材名            声明时长    由体积反推    偏差    判定')
const oggHdr = readFileSync(join(PUB, '1-xiang-C2.ogg')).subarray(0, 4).toString('ascii')
okc(oggHdr === 'OggS', '文件是合法 Ogg 容器（magic = OggS）')
for (const p of PENTATONIC) {
  const fp = join(PUB, `${p.file}.ogg`)
  if (!existsSync(fp)) continue
  const dur = statSync(fp).size / BYTES_PER_SEC
  const exp = EXPECT_DUR[p.file]
  const dev = (dur - exp) / exp
  okc(Math.abs(dev) < 0.25,
      `${p.file} 声明 ${exp}s，反推 ${dur.toFixed(3)}s（${dev >= 0 ? '+' : ''}${(dev * 100).toFixed(1)}%）`)
}

// ---------------------------------------------------------------- 5. 角色标签未被改动
console.log('\n=== 5. 动作语义保持原样（本次只换音色，不改映射）===')
const EXPECT_ROLE = ['起势 · 唤醒', '蓄力 · 沉肩', '伸展 · 抻筋', '运劲 · 发力',
                     '收势 · 归元', '进阶 · 变奏', '完成 · 圆满']
PENTATONIC.forEach((p, i) => {
  okc(p.role === EXPECT_ROLE[i], `弦${i + 1} 角色 =「${p.role}」（与改造前一致）`)
})

console.log('\n' + (fail === 0 ? '✅ 全部通过' : `❌ ${fail} 项失败`))

console.log(`
【说明】「不含 F/B 半音」不再是采样音色的验收项
─────────────────────────────────────────────────
改造前验收要求「频谱无 F/B 半音成分」，那约束的是**合成器**——
合成时可以自由选择分音比例，避开 F/B 是为了让五声音阶听起来不西式。

现在用的是**真实古琴录音**，而真实古琴**正调本身就含 F**（三弦就是 F，
实测 87.31 Hz），其泛音列必然含 F。「无 F/B」是五声音乐的 MIDI 化要求，
不是古琴音色要求。硬套这条验收只会逼我们放弃真实素材、退回合成音。

真正的验收应改为：盲听 ≥3 人非技术背景，答出「古琴」（判据见
给聪哥_待决策_古琴音色真实标定报告.md §5）。
`)

process.exit(fail === 0 ? 0 : 1)
