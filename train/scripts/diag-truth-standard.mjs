// 真值标准度诊断：为什么真值喂进 judge 得 0 分？
// 用法：node scripts/diag-truth-standard.mjs <truth.json> [...]
// 输出：① 每个关键帧「单帧独立打分」 ② 时间轴密采样最高分 ③ 肩宽一致性 ④ t 基准
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MoveJudge, THRESHOLD } from '../src/engine/judge.js'

const NAMES = ['双手托天理三焦', '左右开弓似射雕', '调理脾胃须单举', '五劳七伤往后瞧',
  '摇头摆尾去心火', '两手攀足固肾腰', '攒拳怒目增气力', '背后七颠百病消']

const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)))

const toLm = (pts) => pts.map((p) => ({ x: p[0], y: p[1], z: p[2] || 0, visibility: p[3] ?? 1 }))

/** offset=0：按脚本原样（tt 直接用）；offset=1：按 keys[0].t 平移（绝对秒数也能对齐） */
function sampleTruth(keys, tt, useOffset) {
  const base = useOffset ? keys[0].t : 0
  const T = base + tt
  let i = 0
  while (i < keys.length - 2 && T >= keys[i + 1].t) i++
  const a = keys[i], b = keys[i + 1] || keys[i]
  const span = Math.max(0.001, b.t - a.t)
  const k = ease((T - a.t) / span)
  const fa = a.pts || [], fb = b.pts || fa
  return new Array(33).fill(0).map((_, j) => {
    const p = fa[j] || [0.5, 0.5, 0, 0], q = fb[j] || p
    return { x: p[0] + ((q[0] ?? 0.5) - p[0]) * k, y: p[1] + ((q[1] ?? 0.5) - p[1]) * k,
      z: p[2] || 0, visibility: p[3] ?? 1 }
  })
}

const shoW = (lm) => Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y)

function run(file, useOffset) {
  const d = JSON.parse(readFileSync(resolve(file), 'utf8'))
  console.log(`\n${'='.repeat(78)}\n真值：${file}   取样基准：${useOffset ? 'keys[0].t 平移（绝对秒数对齐）' : '原样 0 基'}\n${'='.repeat(78)}`)
  const rows = []
  for (let m = 0; m < 8; m++) {
    const mv = d.moves.find((x) => x.move === `baduanjin-${m + 1}`)
    if (!mv) { console.log(`${m + 1} 无数据`); continue }
    const keys = mv.keys
    const ts = keys.map((k) => k.t)
    const step = (ts[1] - ts[0]).toFixed(2)
    const even = ts.every((t, i) => i === 0 || Math.abs((t - ts[0]) / (ts[ts.length - 1] - ts[0]) - i / (ts.length - 1)) < 0.02)
    const widths = keys.map((k) => shoW(toLm(k.pts)))
    const wMin = Math.min(...widths), wMax = Math.max(...widths)

    // ① 单帧独立打分（时间序动作会因 __ready 直接判 0，属预期）
    const perKey = keys.map((k) => {
      const j = new MoveJudge({ order: null })
      return +j.scores(toLm(k.pts))[m].toFixed(2)
    })
    // ② 时间轴密采样（连续喂，让时序窗口备好）
    const j2 = new MoveJudge({ order: null })
    const N = Math.max(12, Math.round(mv.dur * 30))
    let mx = 0, crossMax = new Array(8).fill(0)
    for (let f = 0; f < N; f++) {
      const lm = sampleTruth(keys, (f / N) * mv.dur, useOffset)
      const sc = j2.scores(lm)
      mx = Math.max(mx, sc[m] || 0)
      for (let i = 0; i < 8; i++) crossMax[i] = Math.max(crossMax[i], sc[i] || 0)
    }
    const cross = crossMax.map((vv, i) => ({ vv, i })).filter((o) => o.i !== m && o.vv > 0.7)
    rows.push({ m, mx, perKey, wMin, wMax })
    console.log(`${m + 1} ${NAMES[m].padEnd(7, '　')} dur=${String(mv.dur).padStart(5)} 窗口=${mv.range[0]}~${mv.range[1]} 帧距=${step}s${even ? '(等距!)' : ''}`)
    console.log(`   单帧逐帧分 ${JSON.stringify(perKey)}   密采样最高=${mx.toFixed(2)}  肩宽 ${wMin.toFixed(3)}~${wMax.toFixed(3)}${(wMax / Math.max(1e-6, wMin) > 3) ? '  ⚠肩宽不稳' : ''}`)
    if (cross.length) console.log(`   串扰>0.7：` + cross.map((o) => `式${o.i + 1}(${o.vv.toFixed(2)})`).join(' '))
  }
  const best = rows.map((r) => r.mx)
  console.log(`\n→ 8 式密采样最高分：${best.map((x) => x.toFixed(2)).join(' / ')}`)
  console.log(`→ ≥${THRESHOLD} 的式数：${best.filter((x) => x >= THRESHOLD).length}/8   ≥0.90 的：${best.filter((x) => x >= 0.9).length}/8`)
}

const files = process.argv.slice(2)
if (!files.length) { console.error('用法: node scripts/diag-truth-standard.mjs <truth.json>'); process.exit(1) }
for (const f of files) { run(f, false); run(f, true) }
