// 弦养 · 文化内核层 —— 传统学说的数据与规则
// ============================================================================
// 【这一层是什么】
//   把「五音疗愈 / 子午流注 / 节气食养 / 体质功法 / 和香」五套传统学说
//   数字化成**同一形状的数据结构**（表 + 规则 + 检索函数），
//   让上层（处方引擎 / API / 页面）只面对一种输入：{ 体质, 时辰, 目标, 强度 }。
//
// 【这一层不是什么】
//   不是医疗建议。所有产物文案只给「舒缓 / 放松 / 适合久坐 / 有助于入睡」这类
//   非疗效表述；词表见 ../data/tones.js 的 safeCopy()，界面文案必须过一遍。
//
// 【架构铁律】
//   本文件不 import 任何 .vue，不碰 DOM、不碰 Web Audio —— 纯数据与纯函数，
//   所以能在 node 里直接 import 跑几千次处方编排做回归。
// ============================================================================

/* ------------------------------------------------------------------ *
 * 1. 五音疗愈：宫商角徵羽 × 五脏 × 五行
 *    数据来自 ../data/tones.js（甲方口径唯一数据源），这里只加**规则**。
 * ------------------------------------------------------------------ */
import { TONES, MOVE_TONE, safeCopy } from '../data/tones.js'

const TONE_BY_KEY = Object.fromEntries(TONES.map((t) => [t.key, t]))

/** 目标 → 五音偏好。传统用法：提神取明亮一档（徵），安神取幽深一档（羽）。 */
export const GOAL_TONE = {
  wake: 'zhi',      // 提神    → 徵（火，明快开阔）
  soothe: 'gong',   // 舒缓    → 宫（土，沉稳敦厚）
  mood: 'jue',      // 舒展情绪 → 角（木，条达生发）
  sleep: 'yu',      // 助眠    → 羽（水，幽深绵长）
  breathe: 'shang', // 透气    → 商（金，清越肃降）
}

/** 把时辰的五行属性折成五音：木→角 火→徵 土→宫 金→商 水→羽 */
const ELEMENT_TONE = { 木: 'jue', 火: 'zhi', 土: 'gong', 金: 'shang', 水: 'yu' }

export function toneOfElement(element) {
  return TONE_BY_KEY[ELEMENT_TONE[element]] || TONES[0]
}

export function toneOfKey(key) {
  return TONE_BY_KEY[key] || TONES[0]
}

/* ------------------------------------------------------------------ *
 * 2. 子午流注：十二时辰 × 经络 × 宜忌
 *    传统「十二时辰气血流注」顺序：胆→肝→肺→大肠→胃→脾→心→小肠→膀胱→肾→心包→三焦
 * ------------------------------------------------------------------ */
export const SHIZHEN = [
  { key: 'zi',  name: '子时', range: '23–01', zang: '胆',   element: '木', jing: '足少阳胆经',   yi: '安卧，收一整天的决断',   ji: '不宜劳神用脑', scene: '睡前收心' },
  { key: 'chou',name: '丑时', range: '01–03', zang: '肝',   element: '木', jing: '足厥阴肝经',   yi: '深眠，血液归肝',         ji: '忌熬夜、忌酒',       scene: '深睡段' },
  { key: 'yin', name: '寅时', range: '03–05', zang: '肺',   element: '金', jing: '手太阴肺经',   yi: '深度睡眠，呼吸最慢',     ji: '忌大声说话',         scene: '深睡段' },
  { key: 'mao', name: '卯时', range: '05–07', zang: '大肠', element: '金', jing: '手阳明大肠经', yi: '起床、喝温水、排便',     ji: '忌久卧',             scene: '晨起' },
  { key: 'chen',name: '辰时', range: '07–09', zang: '胃',   element: '土', jing: '足阳明胃经',   yi: '吃早餐，谷物为主',       ji: '忌空腹喝冰',         scene: '早餐' },
  { key: 'si',  name: '巳时', range: '09–11', zang: '脾',   element: '土', jing: '足太阴脾经',   yi: '工作学习，当令最旺',    ji: '忌久坐不动',         scene: '上午' },
  { key: 'wu',  name: '午时', range: '11–13', zang: '心',   element: '火', jing: '手少阴心经',   yi: '小憩片刻，午餐宜简',     ji: '忌暴饮暴食',         scene: '午休' },
  { key: 'wei', name: '未时', range: '13–15', zang: '小肠', element: '火', jing: '手太阳小肠经', yi: '喝水、适量走动',         ji: '忌久坐',             scene: '下午' },
  { key: 'shen',name: '申时', range: '15–17', zang: '膀胱', element: '水', jing: '足太阳膀胱经', yi: '运动、记忆类学习',       ji: '忌憋尿',             scene: '傍晚运动' },
  { key: 'you', name: '酉时', range: '17–19', zang: '肾',   element: '水', jing: '足少阴肾经',   yi: '收敛、少剧烈运动',       ji: '忌同房、忌劳累',     scene: '日落' },
  { key: 'xu',  name: '戌时', range: '19–21', zang: '心包', element: '火', jing: '手厥阴心包经', yi: '散步、静心、和家人说话', ji: '忌剧烈争论',         scene: '黄昏散步' },
  { key: 'hai', name: '亥时', range: '21–23', zang: '三焦', element: '火', jing: '手少阳三焦经', yi: '安卧准备，热水泡脚',     ji: '忌看惊险内容',       scene: '睡前' },
]

const SHIZHEN_BY_KEY = Object.fromEntries(SHIZHEN.map((s) => [s.key, s]))

/** 时辰环序：子→丑→…→亥，索引 0 = 子（数组顺序即环序） */
const SHICHEN_ORD = SHIZHEN.map((s) => s.key)

/**
 * 任意时刻 → 时辰对象。未给 Date 时用当前时间。
 * 口径：子时跨 23:00–01:00，所以 00:30 与 23:30 **都算子时**。
 * 换算：以「子」为环首，每小时折 0.5 个时辰 → idx = floor((h + 1) / 2) % 12
 *   h=0 → 0 子 ✓   h=1 → 1 丑 ✓   h=15 → 8 申 ✓   h=23 → 12%12 = 0 子 ✓
 */
export function shichenOf(date) {
  const d = date ? new Date(date) : new Date()
  const h = d.getHours()
  const idx = Math.floor((h + 1) / 2) % 12
  return SHIZHEN_BY_KEY[SHICHEN_ORD[idx]]
}

/** 时辰 → 该时辰主流注的经络五音（传统相生：木→角，火→徵，土→宫，金→商，水→羽） */
export function toneOfShichen(shichen) {
  return toneOfElement(shichen ? shichen.element : '土')
}

/* ------------------------------------------------------------------ *
 * 3. 节气食养：二十四节气内容库
 *    yi=宜 ji=忌 food=当令食材
 * ------------------------------------------------------------------ */
export const JIEQI = [
  { name: '立春', span: '2/3–2/5', yi: '食辛甘以助生发，多走户外', ji: '忌大补、忌封坛', food: ['春笋', '荠菜', '豆芽'] },
  { name: '雨水', span: '2/18–2/20', yi: '健运脾胃，少咸多酸', ji: '忌生冷', food: ['山药', '薏米', '红枣'] },
  { name: '惊蛰', span: '3/5–3/7', yi: '顺肝之性，助阳升发', ji: '忌恼怒', food: ['菠菜', '芹菜', '梨'] },
  { name: '春分', span: '3/20–3/22', yi: '昼夜均，寒热平，宜均衡', ji: '忌大寒大热', food: ['韭菜', '荠菜', '鸡蛋'] },
  { name: '清明', span: '4/4–4/6', yi: '疏肝理气，踏青远眺', ji: '忌久视屏幕', food: ['青团', '艾草', '螺'] },
  { name: '谷雨', span: '4/19–4/21', yi: '雨生百谷，化湿健脾', ji: '忌外出久淋', food: ['香椿', '蚕豆', '茯苓'] },
  { name: '立夏', span: '5/5–5/7', yi: '养心为主，晚睡早起', ji: '忌贪凉', food: ['樱桃', '青梅', '莲子'] },
  { name: '小满', span: '5/20–5/22', yi: '防热防湿，少吃油腻', ji: '忌闷热久处', food: ['苦菜', '黄瓜', '冬瓜'] },
  { name: '芒种', span: '6/5–6/7', yi: '午休补心，宜清淡', ji: '忌过汗', food: ['豌豆', '苋菜', '绿豆'] },
  { name: '夏至', span: '6/21–6/22', yi: '一阴生，宜静心纳凉', ji: '忌冷水冲头', food: ['小麦', '鸭肉', '莲藕'] },
  { name: '小暑', span: '7/6–7/8', yi: '温水泡脚，少动多静', ji: '忌暴晒', food: ['黄鳝', '绿豆', '荷叶'] },
  { name: '大暑', span: '7/22–7/24', yi: '宜补水，宜午歇', ji: '忌久吹空调', food: ['冬瓜', '薏米', '薏苡仁'] },
  { name: '立秋', span: '8/7–8/9', yi: '润燥养肺，开始收敛', ji: '忌过食辛辣', food: ['秋梨', '百合', '莲藕'] },
  { name: '处暑', span: '8/22–8/24', yi: '处暑宜润，早卧早起', ji: '忌贪凉', food: ['鸭肉', '银耳', '蜂蜜'] },
  { name: '白露', span: '9/7–9/9', yi: '白露渐凉，润养肺气', ji: '忌露宿', food: ['龙眼', '山药', '糯米'] },
  { name: '秋分', span: '9/22–9/24', yi: '阴阳再平衡，重在润', ji: '忌大汗', food: ['柚子', '板栗', '芝麻'] },
  { name: '寒露', span: '10/8–10/9', yi: '保暖足，润燥', ji: '忌赤脚', food: ['柿子', '核桃', '红薯'] },
  { name: '霜降', span: '10/23–10/24', yi: '防燥防冻，宜温补', ji: '忌生冷', food: ['牛肉', '柚子', '白萝卜'] },
  { name: '立冬', span: '11/7–11/8', yi: '养藏，早卧晚起', ji: '忌大汗耗阳', food: ['羊肉', '黑豆', '核桃'] },
  { name: '小雪', span: '11/22–11/23', yi: '内敛保暖，宜温饮', ji: '忌受寒', food: ['猪肉', '栗子', '燕麦'] },
  { name: '大雪', span: '12/6–12/8', yi: '闭藏，护腰足', ji: '忌过劳', food: ['牛肉', '生姜', '黑芝麻'] },
  { name: '冬至', span: '12/21–12/23', yi: '一阳来复，宜静养', ji: '忌房劳、忌大寒', food: ['饺子', '羊肉', '桂圆'] },
  { name: '小寒', span: '1/5–1/7', yi: '三九补一冬，宜温食', ji: '忌贪凉', food: ['糯米', '芥菜', '胡椒'] },
  { name: '大寒', span: '1/20–1/21', yi: '岁末收尾，忌猛补', ji: '忌油腻积滞', food: ['萝卜', '豆腐', '陈皮'] },
]

/** 二十四节气里查（按日期近似落点：用月日区间简单匹配，够演示用） */
export function jieqiOf(date) {
  const d = date ? new Date(date) : new Date()
  const md = (d.getMonth() + 1) * 100 + d.getDate()
  // 每个节气以「大致起始日」为锚（MMDD 数字），往前找最近的一个。
  // ⚠ 顺序必须按自然年递增（小寒 → 大寒 → 立春 … → 冬至）后再绕回小寒：
  //   早先把 1 月的两个节气排在数组末尾，跨年比较时会把 10 月判成「大寒」（实测截图发现）。
  const anchors = [
    ['小寒', 105], ['大寒', 120], ['立春', 203], ['雨水', 218],
    ['惊蛰', 305], ['春分', 320], ['清明', 404], ['谷雨', 419],
    ['立夏', 505], ['小满', 520], ['芒种', 605], ['夏至', 621],
    ['小暑', 706], ['大暑', 722], ['立秋', 807], ['处暑', 822],
    ['白露', 907], ['秋分', 922], ['寒露', 1008], ['霜降', 1023],
    ['立冬', 1107], ['小雪', 1122], ['大雪', 1207], ['冬至', 1221],
  ]
  // 元旦到小寒前（md < 105）仍属上一年的冬至尾
  let best = ['冬至', 1221]
  for (const a of anchors) {
    if (md >= a[1]) best = a
  }
  return JIEQI.find((j) => j.name === best[0]) || JIEQI[0]
}

/* ------------------------------------------------------------------ *
 * 4. 分体质阶梯功法：九种体质 → 八段锦式序列（入门 / 进阶 / 强化）
 *    八式编号 1–8，1 起势 4 中段的骨架位不单独给，只在强化段里出现
 * ------------------------------------------------------------------ */
export const CONSTITUTION = [
  { key: 'pinghe', name: '平和质', tag: '底子稳',   core: '维持为主', ladder: [[2, 3, 5], [3, 5, 7], [5, 7, 8]] },
  { key: 'qixu',   name: '气虚质', tag: '容易累',   core: '缓起、少重复', ladder: [[1, 3], [2, 3, 5], [3, 5, 6]] },
  { key: 'yangxu', name: '阳虚质', tag: '怕冷',     core: '配晒背、偏舒展', ladder: [[1, 2], [2, 5, 7], [2, 5, 7, 8]] },
  { key: 'yinxu',  name: '阴虚质', tag: '口干、燥', core: '慢、少出汗', ladder: [[1, 6], [6, 7, 8], [1, 6, 8]] },
  { key: 'tanshi', name: '痰湿质', tag: '身沉、苔腻', core: '加有氧、多转腰', ladder: [[2, 3], [2, 5, 7], [2, 3, 5, 7]] },
  { key: 'shire',  name: '湿热质', tag: '油、易上火', core: '透气、别捂', ladder: [[2, 5], [2, 5, 7], [5, 7, 8]] },
  { key: 'xueyu',  name: '血瘀质', tag: '晦暗、痛固定处', core: '舒展开络', ladder: [[1, 2, 7], [2, 7, 8], [5, 7, 8]] },
  { key: 'qiyu',   name: '气郁质', tag: '闷、爱叹气', core: '疏肝、偏角音', ladder: [[1, 7], [7, 8], [2, 7, 8]] },
  { key: 'tebing', name: '特禀质', tag: '过敏体质', core: '轻、避风避花粉', ladder: [[1, 8], [1, 6, 8], [1, 8]] },
]

const CONST_BY_KEY = Object.fromEntries(CONSTITUTION.map((c) => [c.key, c]))

export function constitutionOf(key) {
  return CONST_BY_KEY[key] || CONSTITUTION[0]
}

/** 阶梯等级 → 该级功法序列（strength: 1 入门 / 2 进阶 / 3 强化） */
export function ladderOf(con, strength) {
  const lv = Math.max(1, Math.min(3, Number(strength) || 1))
  return con.ladder[lv - 1]
}

/* ------------------------------------------------------------------ *
 * 5. 和香配方库：香材比例 + 适配时辰/五音 + 香薰机档位
 *    档位 0–3 对应雾化强度（0 关 / 1 淡 / 2 中 / 3 浓）
 * ------------------------------------------------------------------ */
export const XIANG = [
  { key: 'chenxiang', name: '沉香单方', mate: [['沉香', 100]], layer: '沉稳微苦，尾调回甘', fit: ['zi', 'hai', 'you'], tone: 'yu', level: 1 },
  { key: 'tanxiang',  name: '檀香安神', mate: [['檀香', 70], ['乳香', 30]], layer: '奶香托底，气息绵长', fit: ['xu', 'hai'], tone: 'gong', level: 1 },
  { key: 'heding',    name: '和香定志', mate: [['沉香', 40], ['檀香', 30], ['降真香', 20], ['藁本', 10]], layer: '头清尾沉，层次分明', fit: ['chou', 'xu', 'si'], tone: 'jue', level: 2 },
  { key: 'huasan',    name: '花香醒神', mate: [['茉莉', 50], ['陈皮', 30], ['薄荷', 20]], layer: '前调清扬，适合上午', fit: ['mao', 'chen', 'si'], tone: 'zhi', level: 2 },
  { key: 'yulin',     name: '雨雪润燥', mate: [['百合', 50], ['蜂蜜蜡', 30], ['丁香', 20]], layer: '甜润贴肤，秋冬用', fit: ['you', 'xu', 'hai'], tone: 'shang', level: 1 },
]

const XIANG_BY_KEY = Object.fromEntries(XIANG.map((x) => [x.key, x]))

export function xiangOf(key) {
  return XIANG_BY_KEY[key] || XIANG[0]
}

/** 按时辰挑最贴的香方（时辰在 fit 里优先，其次看五音） */
export function xiangOfShichen(shichen, toneKey) {
  const sc = shichen ? shichen.key : ''
  const byTime = XIANG.filter((x) => (x.fit || []).includes(sc))
  if (byTime.length) return byTime[0]
  return XIANG.find((x) => x.tone === (toneKey || 'gong')) || XIANG[0]
}

/* ------------------------------------------------------------------ *
 * 6. 处方编排：把上面五张表合成一张「今日可执行的方案」
 *    输入 { constitution, shichen(可 Date), goal, strength }
 *    输出：音疗 / 功法 / 香事 / 食养 / 一句话导引
 * ------------------------------------------------------------------ */
export const GOALS = [
  { key: 'wake', name: '提神' },
  { key: 'soothe', name: '舒缓' },
  { key: 'mood', name: '舒展情绪' },
  { key: 'sleep', name: '助眠' },
  { key: 'breathe', name: '透气' },
]

/**
 * @param {object} input
 * @param {string} input.constitution  体质 key
 * @param {Date|string} [input.date]   用于定「时辰 + 节气」，缺省用当前时间
 * @param {string} [input.goal]        目标 key
 * @param {number} [input.strength]    1 入门 / 2 进阶 / 3 强化
 * @param {boolean} [input.skipXiang]  跳过和香（无香薰硬件时）
 */
export function prescribe(input = {}) {
  const con = constitutionOf(input.constitution)
  const sc = shichenOf(input.date)
  const goal = GOAL_TONE[input.goal] ? input.goal : 'soothe'
  const strength = Math.max(1, Math.min(3, Number(input.strength) || 1))
  const jq = jieqiOf(input.date)

  // ① 音疗：目标定基调，时辰定偏（传统「因时制宜」：当下时辰主流注的经络优先）
  const goalTone = toneOfKey(GOAL_TONE[goal])
  const shichenTone = toneOfShichen(sc)
  const chosen = sc.element === goalTone.element ? goalTone : shichenTone
  // 时辰与目标的五行不同时，说明这一练「跨了场」——文案里给出解释而不是简单二选一
  const crossed = sc.element !== goalTone.element

  // ② 功法：体质给式序列，阶梯给强度
  const moves = ladderOf(con, strength)

  // ③ 香事：时辰挑方，再被基调校正
  const xiang = input.skipXiang ? null : xiangOfShichen(sc, chosen.key)

  // ④ 食养：节气给宜忌
  const food = { yi: jq.yi, ji: jq.ji, food: jq.food }

  // ⑤ 一句话导引（合规：只给舒缓/放松/适合久坐/有助于入睡这类非疗效表述）
  const lead = safeCopy(
    `${sc.name}（${sc.range} 点，${sc.zang}·${sc.jing}当令）。` +
    `以「${chosen.name}调」作底，${sc.yi}。`
  )

  return {
    generatedAt: new Date().toISOString(),
    input: {
      constitution: con.key, constitutionName: con.name,
      shichen: sc.key, shichenName: sc.name,
      goal, goalName: (GOALS.find((g) => g.key === goal) || {}).name,
      strength, date: input.date ? String(input.date) : 'now',
    },
    tone: {
      key: chosen.key, name: chosen.name, feel: chosen.feel,
      element: chosen.element, organ: chosen.organ,
      crossed, note: crossed
        ? safeCopy(`这一档与当下时辰不同场：目标偏「${goalTone.name}」，时辰偏「${shichenTone.name}」；取当下可执行的那一档。`)
        : safeCopy(`目标与时辰同场，直接取「${chosen.name}调」。`),
    },
    moves: {
      level: ['入门', '进阶', '强化'][strength - 1],
      sequence: moves,
      core: con.core,
      count: moves.length,
    },
    xiang: xiang ? { key: xiang.key, name: xiang.name, mate: xiang.mate, layer: xiang.layer, level: xiang.level } : null,
    food,
    jieqi: { name: jq.name, span: jq.span },
    lead,
  }
}

/** 同一体质不同时辰的对比（演示「时辰化」用） */
export function compareByShichen(conKey, goals = ['wake', 'soothe', 'sleep']) {
  return SHIZHEN.map((s) => {
    const p = prescribe({ constitution: conKey, date: `2026-01-01T${s.range.split('–')[0].padStart(2, '0')}:00:00`, goal: goals[0] })
    return {
      shichen: s.name, zang: s.zang,
      tone: p.tone.name, moves: p.moves.sequence.join('·'),
      xiang: p.xiang ? p.xiang.name : '—',
    }
  })
}

/** 内核自检：纯函数，node 里可直接跑 */
export function __selfTest() {
  const out = []
  const p = prescribe({ constitution: 'qixu', goal: 'sleep', strength: 2 })
  out.push(['处方结构完整', !!(p.tone && p.moves && p.xiang && p.food)])
  out.push(['十二时辰齐全', SHIZHEN.length === 12])
  out.push(['二十四节气齐全', JIEQI.length === 24])
  out.push(['九种体质齐全', CONSTITUTION.length === 9])
  out.push(['时辰换算：15:30 → 申时', shichenOf(new Date(2026, 0, 1, 15, 30)).key === 'shen'])
  out.push(['时辰换算：00:30 → 子时（子时跨 23–01）', shichenOf(new Date(2026, 0, 1, 0, 30)).key === 'zi'])
  out.push(['时辰换算：23:30 → 子时', shichenOf(new Date(2026, 0, 1, 23, 30)).key === 'zi'])
  out.push(['时辰换算：01:30 → 丑时', shichenOf(new Date(2026, 0, 1, 1, 30)).key === 'chou'])
  out.push(['时辰换算：03:30 → 寅时', shichenOf(new Date(2026, 0, 1, 3, 30)).key === 'yin'])
  out.push(['阶梯强度分层', ladderOf(constitutionOf('qixu'), 1).length <= ladderOf(constitutionOf('qixu'), 3).length])
  // 节气的区间是「上一个节气后一天 → 本节气当天」：秋分 9/23 起、寒露 10/8 才换，所以 10/4 仍是秋分
  out.push(['节气换算：10/04 → 秋分（秋分区间 9/23–10/8）', jieqiOf(new Date(2026, 9, 4)).name === '秋分'])
  out.push(['节气换算：10/10 → 寒露', jieqiOf(new Date(2026, 9, 10)).name === '寒露'])
  out.push(['节气换算：01/10 → 小寒', jieqiOf(new Date(2026, 0, 10)).name === '小寒'])
  out.push(['节气换算：01/01 → 冬至（上一年尾）', jieqiOf(new Date(2026, 0, 1)).name === '冬至'])
  out.push(['节气换算：06/15 → 芒种与夏至之间取芒种', jieqiOf(new Date(2026, 5, 15)).name === '芒种'])
  out.push(['节气换算：12/30 → 冬至', jieqiOf(new Date(2026, 11, 30)).name === '冬至'])
  out.push(['合规：处方无禁词', !/治疗|祛湿|根治|调理好|主音|入脏/.test(JSON.stringify(p))])
  return out
}
