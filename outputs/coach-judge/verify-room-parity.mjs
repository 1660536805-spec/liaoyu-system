/* 搬运保真度校验：证明 train/src/data/roomMoves.js（从 room.js 抽出来的）
 * 与房间版页面**运行时**的姿态解算是同一个函数 —— 否则「形象一致」只是看着像。
 *
 * 做法：房间版在 URL 带 debug 时会挂出 window.__tj（含 roomPose）。
 *   直接在页面里跑 roomPose(idx,u)，再把结果和 Node 侧 import 的同一函数比对。
 *
 * 用法：node outputs/coach-judge/verify-room-parity.cjs [port]
 */
import { chromium } from 'playwright-core'
import { roomPose, ROOM_MOVES } from '../../train/src/data/roomMoves.js'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.argv[2]) || 5400
const URL_ROOM = `http://127.0.0.1:${PORT}/outputs/room-baduanjin/preview.html#debug`

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(URL_ROOM, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__tj, { timeout: 20000 })

  const idxs = Array.from({ length: ROOM_MOVES.length }, (_, i) => i)
  const us = Array.from({ length: 21 }, (_, i) => i / 20)

  const theirs = await page.evaluate(({ idxs, us }) => {
    const out = {}
    for (const i of idxs) for (const u of us) out[i + '|' + u] = window.__tj.roomPose(i, u)
    return out
  }, { idxs, us })

  let n = 0, bad = 0
  let worst = { d: 0, key: '' }
  const flat = (q) => [q.px, q.py, q.hL[0], q.hL[1], q.hR[0], q.hR[1],
    q.feet[0][0], q.feet[0][1], q.feet[1][0], q.feet[1][1], q.lean, q.fold, q.headOff]

  for (const i of idxs) {
    for (const u of us) {
      const key = i + '|' + u
      const a = flat(roomPose(i, u))      // 应用侧（抽取件）
      const b = flat(theirs[key])         // 房间版页面运行时
      if (a.length !== b.length) { bad++; continue }
      for (let k = 0; k < a.length; k++) {
        const d = Math.abs(a[k] - b[k])
        n++
        if (d > worst.d) worst = { d, key: `${ROOM_MOVES[i].name}@u=${u} 第${k}项` }
        if (!(d < 1e-9)) bad++
      }
    }
  }

  console.log(`对比样本：${n} 个数值（${idxs.length} 式 × ${us.length} 帧 × 13 分量）`)
  console.log(`不一致：${bad}`)
  console.log(`最大偏差：${worst.d}` + (worst.key ? `  (${worst.key})` : ''))
  console.log(bad === 0 ? '\n✓ 抽取件与房间版运行时逐点完全一致' : '\n❌ 存在偏差，抽取需要复核')

  await browser.close()
  process.exit(bad === 0 ? 0 : 1)
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
