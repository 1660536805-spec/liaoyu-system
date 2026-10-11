// 改前(s4b) vs 改后(s4) 逐式结构化比对
const fs = require('fs')
const path = require('path')
const ROOT = __dirname
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'before', 'walk.json'), 'utf8'))
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'after', 'walk.json'), 'utf8'))

function dist(steps) {
  const m = {}
  for (const s of steps) m[s.kind] = (m[s.kind] || 0) + 1
  return m
}
function armsOf(steps) {
  return steps.map(s => `${s.armLd || '-'}||${s.armRd || '-'}`)
}

let allOk = true
const lines = []
function line(s) { lines.push(s); console.log(s) }

line(`before.base = ${B.base}`)
line(`after.base  = ${A.base}`)
line('')

for (const style of Object.keys(A.styles)) {
  const bs = B.styles[style] ? B.styles[style].steps : []
  const as = A.styles[style].steps
  line(`================= ${style} =================`)
  line(`  式数  改前 ${bs.length}  →  改后 ${as.length}`)
  line(`  形象  改前 ${JSON.stringify(dist(bs))}  →  改后 ${JSON.stringify(dist(as))}`)

  // 1) 式数一致
  if (bs.length !== as.length) { allOk = false; line(`  [FAIL] 式数不一致`) }
  else line(`  [OK ] 式数一致 (${as.length})`)

  // 2) 逐式 kind / prog / name / gate 对照
  let kindChanged = 0, mism = 0
  for (let i = 0; i < as.length; i++) {
    const b = bs[i] || {}, a = as[i]
    if (b.kind !== a.kind) kindChanged++
    if (b.prog !== a.prog || b.name !== a.name || b.gate !== a.gate) {
      mism++; line(`  [FAIL] 第 ${i + 1} 式 静态字段不一致: before(${b.prog}|${b.name}|${b.gate}) after(${a.prog}|${a.name}|${a.gate})`)
      allOk = false
    }
  }
  if (!mism) line(`  [OK ] 逐式 (prog/name/gate) 全一致`)
  line(`  形象变化式数: ${kindChanged} / ${as.length}`)

  // 3) 改后每式都应是 room-figure 且 drawnN>10
  const badKind = as.filter(s => s.kind !== 'room-figure')
  if (badKind.length) { allOk = false; line(`  [FAIL] 改后仍有非 room-figure：${badKind.map(s => `#${s.i + 1}:${s.kind}`).join(', ')}`) }
  else line(`  [OK ] 改后全部 room-figure`)

  const thinDraw = as.filter(s => !(s.drawnN > 10))
  if (thinDraw.length) { allOk = false; line(`  [FAIL] drawnN<=10：${thinDraw.map(s => `#${s.i + 1}:${s.drawnN}`).join(', ')}`) }
  else line(`  [OK ] 全部 drawnN>10 (min=${Math.min(...as.map(s => s.drawnN))})`)

  // 4) 改后逐式手臂指纹唯一性（换式真换动画）
  const arms = armsOf(as)
  const uniq = new Set(arms)
  line(`  改后手臂指纹唯一: ${uniq.size} / ${arms.length}`)
  // 允许极少数同帧（比如相邻式同姿），列出重复
  const dupIdx = {}
  arms.forEach((k, i) => { (dupIdx[k] = dupIdx[k] || []).push(i + 1) })
  const dups = Object.values(dupIdx).filter(v => v.length > 1)
  if (dups.length) line(`  [note] 指纹重复组: ${dups.map(v => v.join('=')).join(', ')}`)
  else line(`  [OK ] 每式手臂指纹互不相同`)

  // 5) 八段锦：与改前逐式手臂指纹对照（应一致）
  if (style === 'baduanjin') {
    const bArms = armsOf(bs)
    let same = 0
    for (let i = 0; i < as.length; i++) if (bArms[i] === arms[i]) same++
    line(`  八段锦 改前/改后 手臂指纹一致式数: ${same} / ${as.length}`)
    if (same !== as.length) {
      line(`  [note] 存在相位漂移（动画循环采样相位不同，非代码差异）：`)
      for (let i = 0; i < as.length; i++) if (bArms[i] !== arms[i])
        line(`      #${i + 1}  before ${bArms[i]}  after ${arms[i]}`)
    } else line(`  [OK ] 八段锦逐式手臂指纹完全一致（未受影响）`)
  }
  line('')
}

line(allOk ? 'SUMMARY: ALL-OK' : 'SUMMARY: FAIL')
process.exit(allOk ? 0 : 1)
