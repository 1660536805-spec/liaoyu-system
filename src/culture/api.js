// 弦养 · 对外 API / SDK 门面（Culture API）
// ============================================================================
// 【这一层是什么】
//   页面、外部脚本、演示工具**只需要认识这一个文件**，不直接碰内核与总线。
//   API = 内核（算什么）+ 总线（怎么执行）之间的一层薄门面：
//     · prescribe()  输入体质/时辰/目标 → 一张可执行的方案（纯 JSON，无副作用）
//     · query()      查五张知识表（只读）
//     · control()    往硬件下发指令（结构化返回，绝不抛异常）
//     · apply()      处方一键落到硬件（内核不知道有哪些硬件）
//
// 【为什么要有这一层】
//   ① 上层换 UI（H5 / 小程序 / 大屏）时，只要 API 形状不变，内核零改动
//   ② 接口文档可以直接从这里的 meta 生成，不会出现「文档写的和代码对不上」
//   ③ 演示时可以把它当成真实 HTTP 接口来调（见 docs/接口文档.md 的等价请求示例）
//
// 【架构铁律】不 import 任何 .vue；不碰 DOM。
// ============================================================================

import {
  prescribe as kernelPrescribe, compareByShichen, __selfTest,
  GOALS, CONSTITUTION, SHIZHEN, JIEQI, XIANG,
  jieqiOf, shichenOf,
} from './knowledge.js'
import { TONES, safeCopy } from '../data/tones.js'
import { PlugBus, bootBus, stepsFromPrescription } from './plug.js'

export const VERSION = '1.0.0'

/** 接口清单 —— 同时是文档里「接口一览」的来源，改接口记得改这里 */
export const ENDPOINTS = [
  { name: 'prescribe', method: 'POST', args: ['{constitution, date?, goal?, strength?}'], ret: 'Prescription', side: 'none', desc: '按时辰+体质+目标生成一套可执行的音疗/功法/香事/食养方案' },
  { name: 'query', method: 'GET', args: ['kind', 'params?'], ret: 'Array|Object', side: 'none', desc: '查内核知识表：tones / shichen / jieqi / constitution / xiang / goals；「今天」类用 jieqi-today / shichen-today（返回当天那一条，不是整张表）' },
  { name: 'control', method: 'POST', args: ['adapterId', 'cmd', 'payload?'], ret: '{ok, ...}', side: 'device', desc: '往指定适配器下发一条指令，离线返回 {ok:false,reason:"offline"}' },
  { name: 'scene', method: 'POST', args: ['steps[]'], ret: '{ok, results[]}', side: 'device', desc: '一次性编排一串指令（场景落地）' },
  { name: 'apply', method: 'POST', args: ['prescription'], ret: '{ok, results[]}', side: 'device', desc: '把一张处方自动翻译成场景指令并下发' },
  { name: 'status', method: 'GET', args: [], ret: 'AdapterStatus[]', side: 'none', desc: '当前已注册/已连接的适配器与能力' },
  { name: 'compare', method: 'GET', args: ['constitution'], ret: 'Row[]', side: 'none', desc: '同一体质在一日十二时辰下的方案对比' },
  { name: 'selfTest', method: 'GET', args: [], ret: '[[name,pass]]', side: 'none', desc: '内核自检（node 与浏览器都可跑）' },
]

/* ------------------------------------------------------------------ *
 * 1. 处方
 * ------------------------------------------------------------------ */
export function prescribe(input = {}) {
  const p = kernelPrescribe(input)
  return p
}

/* ------------------------------------------------------------------ *
 * 2. 知识表查询
 * ------------------------------------------------------------------ */
export function query(kind, params = {}) {
  switch (kind) {
    case 'tones':
      return TONES.map((t) => ({ key: t.key, name: t.name, organ: t.organ, element: t.element, feel: t.feel, ds: safeCopy(t.ds) }))
    case 'shichen':
      return SHIZHEN
    case 'jieqi':
      return JIEQI
    // 「今天」类查询：给的是当天那一条，不是整张表。
    // ⚠ 早先这里只有 jieqi → 返回 JIEQI 全表，调用方拿 .name 会拿到「小寒」而不是当天节气。
    case 'jieqi-today':
      return jieqiOf()
    case 'shichen-today':
      return shichenOf()
    case 'constitution':
      return CONSTITUTION
    case 'xiang':
      return XIANG
    case 'goals':
      return GOALS
    case 'preset': {
      const p = prescribe(params)
      return [p]
    }
    default:
      return []
  }
}

/* ------------------------------------------------------------------ *
 * 3. 硬件控制
 * ------------------------------------------------------------------ */
export async function control(adapterId, cmd, payload) {
  return PlugBus.invoke(adapterId, cmd, payload)
}

export async function scene(steps) {
  return PlugBus.scene(steps)
}

export async function connect(adapterId) {
  return PlugBus.connect(adapterId)
}

export async function disconnect(adapterId) {
  return PlugBus.disconnect(adapterId)
}

/**
 * 把一张处方落到硬件上。
 * `autoConnect: true` 时自动把需要的适配器连上（演示现场省事）。
 */
export async function apply(prescription, opt = {}) {
  const steps = stepsFromPrescription(prescription)
  if (opt.autoConnect !== false) {
    for (const s of steps) {
      try {
        if (!PlugBus.status().find((a) => a.id === s.id && a.live)) await PlugBus.connect(s.id)
      } catch (e) { /* 单个连不上不影响整体 */ }
    }
  }
  return PlugBus.scene(steps)
}

/* ------------------------------------------------------------------ *
 * 4. 状态 / 能力
 * ------------------------------------------------------------------ */
export function status() {
  bootBus()
  return PlugBus.status()
}

export function caps() {
  bootBus()
  return PlugBus.caps()
}

export function compare(constitution) {
  return compareByShichen(constitution)
}

export function selfTest() {
  return __selfTest()
}

/** 一次性把 boot 挂上（避免调用方记顺序） */
bootBus()

/** 浏览器里挂到 window（可选，方便现场在控制台里调） */
if (typeof window !== 'undefined') {
  try {
    window.XianYangCulture = {
      prescribe, query, control, scene, apply, status, caps, compare, selfTest, ENDPOINTS, VERSION,
    }
  } catch (e) { /* 非浏览器环境忽略 */ }
}
