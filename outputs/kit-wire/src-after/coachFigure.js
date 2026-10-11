// 教练小窗形象的「房间版式号」映射 + 姿态分流 —— 八段锦 / 太极 / 五禽戏 都有房间版小人。
//
// 【为什么单独一个文件、不放进 roomMoves.js】
//   roomMoves.js 由 outputs/extract-room-figure.py 从 outputs/room-baduanjin/room.js
//   逐行抽取生成，手改会在下次重跑生成器时被覆盖。这个映射是「按拳种分流」的业务逻辑，
//   不属于房间版动作库本身，所以独立成模块。
//
// 【三套库与应用的对应关系】
//   baduanjin  roomMoves.js       10 式 = 起势 + 应用 8 式 + 收势 ⇒ 应用第 i 式 → i+1
//   taiji      roomMovesExtra.js  24 式，与应用 styles.js 的 TAIJI_MOVES 同名同次序 ⇒ 1:1
//   wuqinxi    roomMovesExtra.js  10 式，应用只上 5 式 ⇒ 查 WUQINXI_APP_TO_LIB
//   其余拳种没有房间版形象 ⇒ 返回 null，由 DemoAnimation 拦截、干脆不画小人
//   （而不是沿用「按式号映射」错画成八段锦的动作，如五禽戏「虎举」画成「两手托天」）。
import { ROOM_MOVES, roomIndexForAppStep, roomPose } from './roomMoves.js'
import { ROOM_EXTRA_MOVES, roomIdxForStyle, roomPoseExtra } from './roomMovesExtra.js'

const BADUANJIN = 'baduanjin'

/**
 * 教练小窗用的「房间版式号」。
 * @param {string} styleId 拳种 id（styles.js）
 * @param {number} stepIdx 应用内第几式（0-based）
 * @returns {number|null} 房间版式号；该拳种没有形象时返回 null
 */
export function roomFigureIdxFor(styleId, stepIdx) {
  if (styleId === BADUANJIN) return roomIndexForAppStep(stepIdx)
  return roomIdxForStyle(styleId, stepIdx)
}

/**
 * 该式的「房间版作者时长」（秒）。DemoAnimation 用它当教练小窗的整段时长，
 * 让进度 u 的推进速度与房间版逐帧一致（否则各式的节奏会被 demoAnim 的时长拉长/压短）。
 * @returns {number|null}
 */
export function roomFigureDurFor(styleId, idx) {
  if (idx == null) return null
  if (styleId === BADUANJIN) return ROOM_MOVES[idx]?.dur ?? null
  return ROOM_EXTRA_MOVES[styleId]?.[idx]?.dur ?? null
}

/**
 * 统一姿态入口：按拳种分流到对应的房间版动作库（三套库共用同一套几何）。
 * 八段锦仍直接走 roomMoves.js 的 roomPose —— 保持与接入前**完全一致**的调用路径。
 * @returns {{px:number,py:number,hL:number[],hR:number[],feet:number[][],lean:number,fold:number,headOff:number}|null}
 */
export function roomPoseFor(styleId, idx, u) {
  if (idx == null) return null
  if (styleId === BADUANJIN) return roomPose(idx, u)
  return ROOM_EXTRA_MOVES[styleId] ? roomPoseExtra(styleId, idx, u) : null
}
