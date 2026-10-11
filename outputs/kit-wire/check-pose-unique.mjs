// 完整姿态序列指纹唯一性：直接从 ESM 产物 roomMovesExtra.js / roomMoves.js 算
// 用于证明「不同式 → 不同动画」，并解释同名式为何合理重复
import { pathToFileURL } from 'node:url'

const base = 'file:///Users/leo/WorkBuddy/疗愈/train/src/data/'
const extra = await import(base + 'roomMovesExtra.js')
const bdj = await import(base + 'roomMoves.js')

const US = []
for (let i = 1; i <= 19; i++) US.push(i / 20)

function fp(st) {
  const n = x => (Math.round(x * 100) / 100).toFixed(2)
  return [
    n(st.px), n(st.py),
    n(st.hL[0]), n(st.hL[1]), n(st.hR[0]), n(st.hR[1]),
    n(st.feet[0][0]), n(st.feet[0][1]), n(st.feet[1][0]), n(st.feet[1][1]),
    n(st.lean), n(st.fold), n(st.headOff),
  ].join(',')
}

function seqOf(getPose, n, label) {
  const out = []
  for (let i = 0; i < n; i++) {
    const parts = []
    for (const u of US) {
      const st = getPose(i, u)
      parts.push(st ? fp(st) : 'NULL')
    }
    out.push({ i: i + 1, label: label(i) || ('#' + (i + 1)), sig: parts.join('|') })
  }
  return out
}

function report(title, seq) {
  console.log('='.repeat(72))
  console.log(title)
  const bySig = {}
  seq.forEach(s => { (bySig[s.sig] = bySig[s.sig] || []).push(s) })
  const groups = Object.values(bySig)
  const dups = groups.filter(g => g.length > 1)
  const nulls = seq.filter(s => s.sig.startsWith('NULL'))
  console.log(`  式数=${seq.length}  唯一姿态序列=${groups.length}  重复组=${dups.length}  空姿态=${nulls.length}`)
  for (const g of dups) console.log(`  [dup] ${g.map(x => `${x.i}.${x.label}`).join('  ==  ')}`)
  return { uniq: groups.length, dups, nulls: nulls.length }
}

// 太极
const TAIJI_NAMES = ['起势','左右野马分鬃','白鹤亮翅','左右搂膝拗步','手挥琵琶','左右倒卷肱','左揽雀尾','右揽雀尾','单鞭','云手','单鞭','高探马','右蹬脚','双峰贯耳','转身左蹬脚','左下势独立','右下势独立','左右穿梭','海底针','闪通臂','转身搬拦捶','如封似闭','十字手','收势']
const tSeq = seqOf((i, u) => extra.roomPoseExtra('taiji', i, u), 24, i => TAIJI_NAMES[i])
report('TAIJI (24 式)', tSeq)

// 五禽戏（10 式）
const WQ_NAMES = ['虎举','虎扑','鹿抵','鹿奔','熊运','熊晃','猿提','猿摘','鸟伸','鸟飞']
const wSeq = seqOf((i, u) => extra.roomPoseExtra('wuqinxi', i, u), 10, i => WQ_NAMES[i])
report('WUQINXI (10 式)', wSeq)

// 五禽戏「产品 5 式」= 下标 [0,2,4,6,9]
console.log('='.repeat(72))
console.log('五禽戏 产品5式 映射 WUQINXI_APP_TO_LIB =', JSON.stringify(extra.WUQINXI_APP_TO_LIB))
extra.WUQINXI_APP_TO_LIB.forEach((libIdx, appIdx) => {
  console.log(`  产品第${appIdx + 1}式 → 库第${libIdx + 1}式 ${WQ_NAMES[libIdx]}  (${extra.ROOM_EXTRA_MOVES.wuqinxi[libIdx].name})`)
})

// 八段锦（未改动，作对照）：原文 roomPose vs 现状
console.log('='.repeat(72))
console.log('八段锦 roomIdxForStyle 应返回 null（不走 extra 分支）:', extra.roomIdxForStyle('baduanjin', 0))
console.log('baduanjin roomIndexForAppStep(0..9):', Array.from({ length: 10 }, (_, i) => bdj.roomIndexForAppStep(i)).join(','))
