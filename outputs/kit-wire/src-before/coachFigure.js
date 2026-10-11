// 教练小窗形象的「房间版式号」映射 —— 只有八段锦有对应的房间版小人。
//
// 【为什么单独一个文件、不放进 roomMoves.js】
//   roomMoves.js 由 outputs/extract-room-figure.py 从 outputs/room-baduanjin/room.js
//   逐行抽取生成，手改会在下次重跑生成器时被覆盖。这个映射是「按拳种分流」的业务逻辑，
//   不属于房间版动作库本身，所以独立成模块。
//
// 【背景】房间版动作库是「起势 + 应用的 8 式 + 收势」，名称逐条对齐八段锦，
//   所以应用第 i 式(0-based) → 房间版 i+1。五禽戏 / 太极没有房间版小人，
//   若沿用「按式号映射」会错画成八段锦的动作（如五禽戏「虎举」画成「两手托天」）——
//   返回 null，由 DemoAnimation 拦截、干脆不画小人。
import { roomIndexForAppStep } from './roomMoves.js'

/** 八段锦的拳种 id（与 styles.js 的 BADUANJIN.id 一致） */
const FIGURED_STYLE = 'baduanjin'

/**
 * @param {string} styleId 拳种 id
 * @param {number} stepIdx 应用内第几式（0-based）
 * @returns {number|null} 房间版式号；该拳种没有形象时返回 null
 */
export function roomFigureIdxFor(styleId, stepIdx) {
  if (styleId !== FIGURED_STYLE) return null
  return roomIndexForAppStep(stepIdx)
}
