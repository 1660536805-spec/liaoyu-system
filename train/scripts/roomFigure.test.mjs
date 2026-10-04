// 房间版小人（教练小窗形象）自检 —— 纯函数，不需要浏览器
//   node scripts/roomFigure.test.mjs
//
// 【为什么值得单测】`roomMoves.js` 是从 outputs/room-baduanjin/room.js 逐行抽出来的，
//   一旦以后再重跑抽取脚本、或改了关键帧，最容易静默坏掉的三件事是：
//     1) 式号映射错位 → 第 3 式演的是第 4 式的动作（画面看着「能动」，但全是错的）
//     2) 姿态里冒出 NaN    → SVG 属性变成 "NaN NaN"，小人直接消失，控制台还不一定报错
//     3) 关键帧之间跳变     → 循环回卷时画面「抽一下」
//   这三条都在这里钉住。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ROOM_MOVES, ROOM_VIEWBOX, roomIndexForAppStep, roomPose,
} from '../src/data/roomMoves.js'

let pass = 0, fail = 0
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? '  (' + detail + ')' : ''}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  (' + detail + ')' : ''}`) }
}

const VB = ROOM_VIEWBOX.split(/\s+/).map(Number)   // [x, y, w, h]

console.log('=== 房间版式号映射 ===')
{
  const app = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/baduanjin-8.json', import.meta.url)), 'utf8'))
  const appNames = app.moves.map((m) => m.name)
  ok(ROOM_MOVES.length === 10, '房间版共 10 式（起势 + 8 式 + 收势）', `${ROOM_MOVES.length}`)
  ok(ROOM_MOVES[0].name === '起势' && ROOM_MOVES[9].name === '收势',
    '首尾是起势/收势', `${ROOM_MOVES[0].name} … ${ROOM_MOVES[9].name}`)
  const mid = ROOM_MOVES.slice(1, 9).map((m) => m.name)
  // 唯一一处用字差异：房间版写「**两**手托天理三焦」，应用写「**双**手托天理三焦」。
  //   八段锦通行写法是「两手」，两边指同一式，所以比对时归一化，不为此改任何一侧的名字
  //   （教练条上显示的名字取自应用的 baduanjin-8.json，跟这里无关）。
  const norm = (s) => s.replace(/两/g, '双')
  ok(JSON.stringify(mid.map(norm)) === JSON.stringify(appNames.map(norm)),
    '中间 8 式与应用 baduanjin-8.json 逐条同名（映射才成立）',
    mid.join(' / '))
  const mapped = appNames.map((_, i) => roomIndexForAppStep(i) )
  ok(JSON.stringify(mapped) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
    'roomIndexForAppStep：应用第 i 式 → 房间版 i+1', mapped.join(','))
  ok(roomIndexForAppStep(99) === 9, '越界夹到最后一式（不返回 undefined）', `${roomIndexForAppStep(99)}`)
}

console.log('\n=== 全周期姿态扫描（10 式 × 300 帧）===')
{
  const SAMP = 300
  let nan = 0, out = 0, badHeight = 0
  let worstJump = 0, worstJumpAt = ''
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }

  for (let idx = 0; idx < ROOM_MOVES.length; idx++) {
    let prev = null
    for (let k = 0; k <= SAMP; k++) {
      const u = k / SAMP
      const q = roomPose(idx, u)
      const pts = [[q.px, q.py], q.hL, q.hR, q.feet[0], q.feet[1]]
      for (const p of pts) {
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) { nan++; continue }
        bounds.minX = Math.min(bounds.minX, p[0]); bounds.maxX = Math.max(bounds.maxX, p[0])
        bounds.minY = Math.min(bounds.minY, p[1]); bounds.maxY = Math.max(bounds.maxY, p[1])
        // 视口裁剪检查：outside 才算问题（留 2 单位容差）
        if (p[0] < VB[0] + 2 || p[0] > VB[0] + VB[2] - 2 || p[1] < VB[1] + 2 || p[1] > VB[1] + VB[3] - 2) out++
      }
      // 帧间跳变：以「肩宽 ~40 单位」为尺度，单帧位移 > 6 单位就算抽帧
      if (prev) {
        const d = Math.max(
          Math.hypot(q.hL[0] - prev.hL[0], q.hL[1] - prev.hL[1]),
          Math.hypot(q.hR[0] - prev.hR[0], q.hR[1] - prev.hR[1]),
          Math.hypot(q.px - prev.px, q.py - prev.py),
        )
        if (d > worstJump) { worstJump = d; worstJumpAt = `${ROOM_MOVES[idx].name}@u=${u.toFixed(3)}` }
      }
      // 骨盆高度：必须在脚之上、头之下（脚 y 更大 = 更低）
      if (q.py > q.feet[0][1] + 2 || q.py < q.feet[0][1] - 200) badHeight++
      prev = q
    }
  }

  ok(nan === 0, '全周期无 NaN 坐标（否则 SVG 会直接画不出来）', `NaN 命中 ${nan}`)
  ok(out === 0, '所有关键点都落在 ROOM_VIEWBOX 内（不会被裁掉手脚）',
    `越界 ${out}；实测 x[${bounds.minX.toFixed(0)},${bounds.maxX.toFixed(0)}] y[${bounds.minY.toFixed(0)},${bounds.maxY.toFixed(0)}] / 视口 ${ROOM_VIEWBOX}`)
  ok(worstJump < 6, '帧间无跳变（相邻 1/300 帧的最大位移 < 6 单位）',
    `最大 ${worstJump.toFixed(2)} 单位 @ ${worstJumpAt}`)
  ok(badHeight === 0, '骨盆始终在脚之上（姿态没翻过来）', `异常 ${badHeight}`)
}

console.log('\n=== 首尾闭合（循环回卷不跳）===')
{
  // 每一式都是 BALL0 → … → BALL0（第 8 式背后七颠用 f()，也以 BALL0 起收），
  // 所以 u=0 与 u=1 的姿态应几乎重合 —— 这是 keepLooping 回卷时「不抽一下」的前提。
  let worst = 0, worstName = ''
  for (let idx = 1; idx <= 8; idx++) {
    const a = roomPose(idx, 0), b = roomPose(idx, 1)
    const d = Math.hypot(a.hL[0] - b.hL[0], a.hL[1] - b.hL[1])
    if (d > worst) { worst = d; worstName = ROOM_MOVES[idx].name }
  }
  ok(worst < 1.5, '应用 8 式首尾姿态闭合（循环回卷不跳）', `最大差 ${worst.toFixed(3)} 单位 @ ${worstName}`)
}

console.log(`\n${fail === 0 ? '✓ 全部通过' : '❌ ' + fail + ' 项失败'}（${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
