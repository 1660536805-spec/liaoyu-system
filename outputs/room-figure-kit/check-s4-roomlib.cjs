/* ============================================================================
 * 漂移闸门：train/src/data/roomMovesExtra.js（ESM，接进 s4）必须与
 *           outputs/room-figure-kit/roomFigureKit.js（UMD，kit 真源）逐点一致。
 *
 * 跑法： node outputs/room-figure-kit/check-s4-roomlib.cjs
 * 退出码：0 = 一致；1 = 有不一致（生成器会据此中止）
 * ========================================================================== */
'use strict'
const path = require('path')

const KIT = path.join(__dirname)
const ESM = path.join(__dirname, '..', '..', 'train', 'src', 'data', 'roomMovesExtra.js')

global.window = global
global.RoomFigureKit = require(path.join(KIT, 'roomFigureKit.js'))
require(path.join(KIT, 'moves-taiji.js'))
require(path.join(KIT, 'moves-wuqinxi.js'))
const K = global.RoomFigureKit

const N = 97          // 每式采样点数（质数，避开关键帧边界）
const TOL = 1e-12

;(async () => {
  const mod = await import('file://' + ESM)
  const { roomPoseExtra, roomIdxForStyle, ROOM_EXTRA_MOVES, WUQINXI_APP_TO_LIB } = mod

  let worst = 0, checks = 0, bad = 0
  const lines = []

  for (const styleId of ['taiji', 'wuqinxi']) {
    const lib = K.moves(styleId)
    const esmMeta = ROOM_EXTRA_MOVES[styleId]
    if (!lib.length) { console.error('kit 缺少题库 ' + styleId); process.exit(1) }
    if (lib.length !== esmMeta.length) {
      console.error(`${styleId} 式数不一致：kit=${lib.length} ESM=${esmMeta.length}`); process.exit(1)
    }
    // 元数据（名称/时长）也要一致
    lib.forEach((m, i) => {
      if (m.name !== esmMeta[i].name || m.dur !== esmMeta[i].dur) {
        console.error(`${styleId}[${i}] 元数据不一致：kit=${m.name}/${m.dur} ESM=${esmMeta[i].name}/${esmMeta[i].dur}`)
        process.exit(1)
      }
    })
    let styleWorst = 0
    lib.forEach((mv, idx) => {
      for (let s = 0; s <= N; s++) {
        const u = s / N
        const a = K.toDrawPose(K.moveState(mv, u))
        const b = roomPoseExtra(styleId, idx, u)
        const vals = [
          [a.px, b.px], [a.py, b.py],
          [a.hL[0], b.hL[0]], [a.hL[1], b.hL[1]],
          [a.hR[0], b.hR[0]], [a.hR[1], b.hR[1]],
          [a.feet[0][0], b.feet[0][0]], [a.feet[0][1], b.feet[0][1]],
          [a.feet[1][0], b.feet[1][0]], [a.feet[1][1], b.feet[1][1]],
          [a.lean, b.lean], [a.fold, b.fold], [a.headOff, b.headOff],
        ]
        for (const [x, y] of vals) {
          checks++
          const d = Math.abs(x - y)
          if (!(d <= TOL)) { bad++; if (bad < 6) console.error(`  ✗ ${styleId}[${idx}] u=${u.toFixed(4)} ${x} vs ${y}`) }
          if (d > worst) worst = d
          if (d > styleWorst) styleWorst = d
        }
      }
    })
    lines.push(`  ${styleId.padEnd(8)} ${String(lib.length).padStart(2)} 式 × ${N + 1} 采样 × 13 量 → 最大差 ${styleWorst.toExponential(2)}`)
  }

  // 式号映射
  const mapCases = [
    ['taiji', 0, 0], ['taiji', 23, 23], ['taiji', 24, null],
    ['wuqinxi', 0, 0], ['wuqinxi', 1, 1], ['wuqinxi', 9, 9], ['wuqinxi', 10, null],
    ['baduanjin', 0, null],
  ]
  const mapBad = []
  for (const [sid, inp, exp] of mapCases) {
    const got = roomIdxForStyle(sid, inp)
    if (got !== exp) mapBad.push(`${sid}[${inp}] 期望 ${exp} 得到 ${got}`)
  }

  console.log('漂移闸门 —— ESM(roomMovesExtra.js) vs UMD(roomFigureKit.js)')
  lines.forEach(l => console.log(l))
  console.log(`  采样比对：${checks} 项，最大差 ${worst.toExponential(2)}（容差 ${TOL.toExponential(0)}）`)
  console.log(`  式号映射：${mapCases.length} 例，${mapBad.length ? '✗ ' + mapBad.join('；') : '全部符合 ✓'}`)
  console.log(`  五禽戏映射表：${JSON.stringify(WUQINXI_APP_TO_LIB)} → ${WUQINXI_APP_TO_LIB.map(i => K.moves('wuqinxi')[i].name).join('/')}`)

  if (bad || mapBad.length) { console.error(`\n✗ 闸门未通过（${bad} 项超差）`); process.exit(1) }
  console.log('\n✓ 闸门通过：ESM 产物与 kit 真源逐点一致')
})()
