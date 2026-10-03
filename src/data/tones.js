// 五音基调 / 五行五脏 / 曲库 —— 解释层唯一数据源
//
// 【来源】全部抄自甲方交付包，以甲方为准：
//   · 五音 × 五脏 × 八段锦归属  ← 《弦养-五行五脏定制推荐逻辑.md》§1 与《弦养_音层设计总纲》§7
//   · 基调的 mel（短句音型）      ← 《弦养_五音短句工坊_v2.html》的 TONES
//   · 44 首曲库与置信度/来源      ← 《弦养_赏听轨.html》的 LIB
//
// 【铁律】（总纲 §1）对应关系**只活在解释层**，不活在播放层：
//   弦层永远走一至七弦的序号，不按脏腑映射。下面这张表只用于文案、点单、曲目推荐，
//   **不得**拿去改 pluck() 的弦号。
//
// 【UI 红线】（五行五脏 md §6.2）
//   · 界面只显示「想照顾哪里」「今天想练什么氛围」
//   · 「主音」「入脏」不直接出现在界面上
//   · 调式名（宫商角徵羽）只作为氛围标签出现，不作为医疗建议
//   · 合规：禁用 治疗/祛湿/根治/调理好，只用 舒缓/放松/适合久坐/有助于入睡

export const TONES = [
  {
    key: 'gong',
    name: '宫', organ: '脾', element: '土', mode: '宫调式', feel: '沉稳敦厚',
    tonic: 1,
    ds: '思虑重、坐不住的时候听这一档——不抢注意力，只把场子稳住。',
    mel: [[0, 1, 2], [2, 2, 1], [3, 3, 1], [4, 2, 2], [6, 1, 2]],
    pieces: [
      { title: '平沙落雁', dur: '6:43', cf: 2, src: '管平湖曲集 / 老八张', note: '有来源列角、也有来源列宫，两说并存，需自核煞音' },
      { title: '流水', dur: '7:26', cf: 1, src: '管平湖曲集 / 老八张', note: '' },
      { title: '高山', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '良宵引', dur: '3:06', cf: 0, src: '管平湖曲集', note: '最静的一首，适合收功后的静坐' },
      { title: '洞庭秋思', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '梧叶舞秋风', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '石上流泉', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '韦编三绝', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '静观吟', dur: '—', cf: 0, src: '老八张', note: '' },
    ],
  },
  {
    key: 'shang',
    name: '商', organ: '肺', element: '金', mode: '商调式', feel: '清越肃降',
    tonic: 2,
    ds: '胸口闷、叹气多的时候听这一档——比宫音更清、更透气。',
    mel: [[0, 2, 2], [2, 3, 1], [3, 5, 1], [4, 3, 2], [6, 2, 2]],
    pieces: [
      { title: '长清', dur: '6:43', cf: 2, src: '管平湖曲集', note: '嵇康《嵇氏四弄》之一，商音正曲' },
      { title: '白雪', dur: '5:15', cf: 2, src: '管平湖曲集', note: '同上，与《长清》同源' },
      { title: '楚歌', dur: '—', cf: 2, src: '老八张', note: '琴曲解题明写"全曲用的是商调式"，故又名"楚商调"' },
      { title: '阳关三叠', dur: '—', cf: 1, src: '需自找', note: '' },
      { title: '秋江夜泊', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '风雷引', dur: '3:50', cf: 1, src: '管平湖曲集', note: '有"正调商音"与"林钟调宫音"两版，注意取哪一版' },
      { title: '获麟操', dur: '4:12', cf: 0, src: '管平湖曲集', note: '曲目单作《获麟》' },
    ],
  },
  {
    key: 'jue',
    name: '角', organ: '肝', element: '木', mode: '角调式', feel: '条达生发',
    tonic: 3,
    ds: '绷着、舒展不开的时候听这一档——这一音最"活"。',
    mel: [[0, 3, 2], [2, 5, 2], [4, 6, 1], [5, 5, 1], [6, 3, 2]],
    pieces: [
      { title: '列子御风', dur: '—', cf: 2, src: '老八张', note: '济源日报：角音古琴曲' },
      { title: '庄周梦蝶', dur: '—', cf: 2, src: '需自找', note: '济源日报：角音古琴曲' },
      { title: '佩兰', dur: '—', cf: 1, src: '老八张', note: '《大还阁琴谱》后记"曲调细而不迫，徐而抑扬"；但《天闻阁琴谱》称"清羽之调"，归属存疑' },
      { title: '墨子悲丝', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '春晓吟', dur: '3:20', cf: 0, src: '管平湖曲集', note: '' },
      { title: '采茶调', dur: '—', cf: 0, src: '需自找', note: '民歌移植，角调式民歌里可参考' },
    ],
  },
  {
    key: 'zhi',
    name: '徵', organ: '心', element: '火', mode: '徵调式', feel: '明快开阔',
    tonic: 5,
    ds: '提不起劲、情绪低的时候听这一档——五音里最亮的一档。',
    mel: [[0, 5, 2], [2, 6, 1], [3, 5, 1], [4, 3, 2], [6, 5, 2]],
    pieces: [
      { title: '渔歌', dur: '—', cf: 2, src: '老八张 / 管平湖曲集', note: '琴曲解题明写：毛敏仲作《渔歌》以正调弹徵调式' },
      { title: '山居吟', dur: '—', cf: 2, src: '需自找', note: '济源日报：徵音古琴曲。《二香琴谱》称其"和平中正大方，为诸曲之冠"' },
      { title: '樵歌', dur: '—', cf: 0, src: '老八张 / 管平湖曲集', note: '' },
      { title: '醉渔唱晚', dur: '3:04', cf: 0, src: '★ 已就位（archive.org CC0）', note: '卫仲乐 1934 年上海百代——号称中国第一张古琴唱片', file: 'zuiyu.mp3' },
      { title: '岳阳三醉', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '酒狂', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '沧海龙吟', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '耕歌', dur: '—', cf: 2, src: '需自找', note: '琴曲简介明写"徵音，二十一段"' },
    ],
  },
  {
    key: 'yu',
    name: '羽', organ: '肾', element: '水', mode: '羽调式', feel: '幽深绵长',
    tonic: 6,
    ds: '睡不着、心里躁的时候听这一档——五音里最深、最远的一档。',
    mel: [[0, 6, 2], [2, 5, 2], [4, 6, 1], [5, 3, 1], [6, 6, 2]],
    pieces: [
      { title: '乌夜啼', dur: '8:28', cf: 2, src: '管平湖曲集 / 老八张', note: '济源日报：羽音古琴曲' },
      { title: '雉朝飞', dur: '—', cf: 2, src: '需自找', note: '济源日报：羽音古琴曲' },
      { title: '欸乃', dur: '12:30', cf: 2, src: '管平湖曲集 / 老八张', note: '琴曲解题明写：紧五弦弹羽调式，为与《渔歌》区别故名' },
      { title: '潇湘水云', dur: '10:17', cf: 1, src: '管平湖曲集 / 老八张', note: '蕤宾调（紧五弦）。名曲，但调式归属需自核' },
      { title: '长门怨', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '捣衣', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '离骚', dur: '10:19', cf: 0, src: '管平湖曲集 / 老八张', note: '' },
      { title: '胡笳十八拍', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '忆故人', dur: '—', cf: 0, src: '老八张', note: '' },
      { title: '关山月', dur: '—', cf: 0, src: '需自找', note: '' },
    ],
  },
]

/** 「练完了」综合档：结构大、跨度长，不适合按单脏点单，留给整套练完后的"落定"一曲 */
export const ALL_TONE = {
  key: 'all',
  name: '综合', organ: '收束', element: '—', mode: '—', feel: '收功 · 整体沉淀',
  tonic: 1,
  ds: '这些曲子结构大、跨度长，适合当作整套练完后的"落定"一曲。',
  mel: null,
  pieces: [
    { title: '梅花三弄', dur: '5:01', cf: 1, src: '★ 已就位', note: '已下载 CC BY 4.0 真录音，可直接播', file: 'meihua.mp3' },
    { title: '渔樵问答', dur: '—', cf: 0, src: '老八张 / 管平湖曲集', note: '' },
    { title: '幽兰', dur: '10:12', cf: 0, src: '管平湖曲集', note: '现存最古老的琴曲谱，唐代文字谱' },
    { title: '广陵散', dur: '22:22', cf: 0, src: '管平湖曲集', note: '篇幅最长的一首' },
    { title: '大胡笳', dur: '12:15', cf: 0, src: '老八张', note: '' },
  ],
}

export const TONE_LIST = [...TONES, ALL_TONE]

export function getTone(key) {
  return TONE_LIST.find((t) => t.key === key) || TONES[0]
}

export function resolveTone(preferred) {
  return getTone(preferred) ? getTone(preferred).key : TONES[0].key
}

/**
 * 八段锦八式 → 五音基调（甲方 md §1 / 总纲 §7）
 * 一、四、八为起势 / 中段 / 收势骨架，无专属音。
 * 【注意】这张表只服务文案与推荐，**不参与播放**：弦层仍按一至七弦序号走。
 */
export const MOVE_TONE = {
  2: 'shang',   // 左右开弓似射雕 → 商（肺）
  3: 'gong',    // 调理脾胃须单举 → 宫（脾）
  5: 'zhi',     // 摇头摆尾去心火 → 徵（心，取病位不取治法方向）
  6: 'yu',      // 两手攀足固肾腰 → 羽（肾）
  7: 'jue',     // 攒拳怒目增气力 → 角（肝，情志对应比动作姿势更硬）
}

/** 置信度徽标：2 已核 / 1 通行 / 0 待核 */
export const CF = {
  2: { cls: 'cf2', text: '已核' },
  1: { cls: 'cf1', text: '通行' },
  0: { cls: 'cf0', text: '待核' },
}

/**
 * 推荐文案（五行五脏 md §6.1 口径：不直接说"你肝不好，练角调"）
 * @param {object} tone
 */
export function toneCopy(tone) {
  if (!tone) return ''
  if (tone.key === 'all') return '整套练完，留一首作落定。'
  return `今晚给你配了一段「${tone.name}调」氛围，${tone.ds}`
}

/** 合规兜底：任何出现在界面上的文案都过一遍，禁词一律替换。
 *
 *  ⚠ 2026-10-04 修正：原词表只有医疗词，漏了《五行五脏定制推荐逻辑》§6.2
 *  明令禁止的两个界面词「主音」「入脏」，导致 WorkshopView / ArcView 的
 *  手写模板直接把它们渲染到了界面上（截图实测可见），safeCopy 形同虚设。
 *  这类红线**不能靠逐处改文案**——view 层的模板字符串有几十处，
 *  改漏一处就又漏出去了。唯一可靠的防线是词表 + 兜底函数。
 */
const BANNED = [
  // 医疗表述（甲方 §6.2）
  '治疗', '祛湿', '根治', '调理好', '治愈', '疗效',
  // 界面禁用词（甲方 §6.2「主音」「入脏」不直接出现在界面上）
  '主音', '入脏',
]

/** 界面用词替换表：机械替换会毁掉语义，这里给每个词一个说得通的替身。
 *  顺序敏感 —— 长词在前，避免「主音」先被替掉后「低音主音」变成「低舒缓」。 */
const REWRITE = [
  ['低音主音', '低音基音'],
  ['主音', '基音'],
  ['入脏', '对应'],
]

export function safeCopy(text) {
  let s = String(text || '')
  for (const [from, to] of REWRITE) s = s.split(from).join(to)
  for (const w of BANNED) s = s.split(w).join('舒缓')
  return s
}

/** 授权署名（CC BY 4.0 要求可触达处保留） */
export const CREDITS = [
  '古琴散音素材：RafaelCaro · CC BY 4.0',
  '《梅花三弄》真录音：RafaelCaro · CC BY 4.0',
  '《醉渔唱晚》：卫仲乐 1934 · archive.org CC0',
]
