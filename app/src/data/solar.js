// 二十四节气 · 简化版（近似日期，仅用于首页节气展示与推荐文案）
// 每项：起始（月,日）+ 节气名 + 主调（一个字）+ 一句意象文案

const TERMS = [
  { m: 1, d: 5,  name: '小寒', vibe: '藏', txt: '寒意正浓，主藏养' },
  { m: 1, d: 20, name: '大寒', vibe: '藏', txt: '岁末寒极，主敛藏' },
  { m: 2, d: 4,  name: '立春', vibe: '生', txt: '春气始生，主生发' },
  { m: 2, d: 19, name: '雨水', vibe: '润', txt: '草木萌动，主润养' },
  { m: 3, d: 5,  name: '惊蛰', vibe: '动', txt: '万物苏醒，主疏通' },
  { m: 3, d: 20, name: '春分', vibe: '衡', txt: '昼夜均分，主平衡' },
  { m: 4, d: 4,  name: '清明', vibe: '清', txt: '天朗气清，主清畅' },
  { m: 4, d: 20, name: '谷雨', vibe: '生', txt: '雨生百谷，主生发' },
  { m: 5, d: 5,  name: '立夏', vibe: '长', txt: '万物并秀，主舒展' },
  { m: 5, d: 21, name: '小满', vibe: '盈', txt: '小得盈满，主从容' },
  { m: 6, d: 5,  name: '芒种', vibe: '畅', txt: '忙而不乱，主调畅' },
  { m: 6, d: 21, name: '夏至', vibe: '盛', txt: '阳极而长，主静养' },
  { m: 7, d: 7,  name: '小暑', vibe: '宁', txt: '暑气渐盛，主清宁' },
  { m: 7, d: 23, name: '大暑', vibe: '静', txt: '湿热交蒸，主静缓' },
  { m: 8, d: 7,  name: '立秋', vibe: '收', txt: '秋气始收，主收敛' },
  { m: 8, d: 23, name: '处暑', vibe: '收', txt: '暑气渐退，主收缓' },
  { m: 9, d: 7,  name: '白露', vibe: '润', txt: '露从今夜白，主润养' },
  { m: 9, d: 23, name: '秋分', vibe: '衡', txt: '阴阳相半，主平和' },
  { m: 10, d: 8,  name: '寒露', vibe: '收', txt: '露气渐寒，主收敛' },
  { m: 10, d: 23, name: '霜降', vibe: '收', txt: '露结为霜，万物内敛' },
  { m: 11, d: 7,  name: '立冬', vibe: '藏', txt: '万物收藏，主静养' },
  { m: 11, d: 22, name: '小雪', vibe: '藏', txt: '闭塞成冬，主潜藏' },
  { m: 12, d: 7,  name: '大雪', vibe: '藏', txt: '雪盛而藏，主温补' },
  { m: 12, d: 21, name: '冬至', vibe: '藏', txt: '阴极阳生，主静守' },
]

/** 取当前节气：找起始日 <= 今天的最后一个 */
export function currentTerm(date = new Date()) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  let cur = TERMS[TERMS.length - 1]
  for (const t of TERMS) {
    if (t.m < m || (t.m === m && t.d <= d)) cur = t
    else break
  }
  return cur
}

export function todayText(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
