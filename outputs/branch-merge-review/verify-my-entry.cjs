/* 本次改动（主壳「我的」页新增「调养实验室」入口）专用验收器。
 *
 * 判定口径：
 *   · 唯一有意改动的屏 = profile（新增 1 条 setrow；同卡片内后续元素整体下移）
 *   · 其余 8 屏（loading/question/audio/home/intro/practice/done/body）必须**逐字符相同**
 *   · app.css 字符数必须一致（证明只动了 JS，没动样式）
 *
 * 用法：node outputs/branch-merge-review/verify-my-entry.cjs <before.json> <after.json>
 */
const fs = require('fs')
const path = require('path')

const A = path.resolve(process.argv[2])
const B = path.resolve(process.argv[3])
const INTENDED = new Set(['profile'])
const UNTOUCHED = ['loading', 'question', 'audio', 'home', 'intro', 'practice', 'done', 'body']

const a = JSON.parse(fs.readFileSync(A, 'utf8'))
const b = JSON.parse(fs.readFileSync(B, 'utf8'))

const blocks = (h) => h.replace(/>\s*</g, '>\n<').split('\n')

let pass = 0
let fail = 0

console.log('改前：' + A)
console.log('改后：' + B)
console.log('app.css 字符数：改前 ' + a.appCssLen + ' / 改后 ' + b.appCssLen +
  (a.appCssLen === b.appCssLen ? '  ✓ 样式表未动' : '  ✗ 样式表变了！') + '\n')
if (a.appCssLen !== b.appCssLen) fail++; else pass++

for (const s of UNTOUCHED) {
  const ha = a.screens[s]
  const hb = b.screens[s]
  if (ha === hb) {
    console.log(`  ✓ ${s.padEnd(9)} 渲染后 DOM 逐字符相同（${ha.length} 字符）`)
    pass++
  } else {
    const la = blocks(ha), lb = blocks(hb)
    const changed = []
    const n = Math.max(la.length, lb.length)
    for (let i = 0; i < n; i++) if (la[i] !== lb[i]) changed.push(i)
    console.log(`  ✗ ${s.padEnd(9)} 不该变却变了：${changed.length} 个标签块不同`)
    for (const i of changed.slice(0, 4)) {
      console.log('        - ' + String(la[i]).slice(0, 150))
      console.log('        + ' + String(lb[i]).slice(0, 150))
    }
    fail++
  }
}

// profile：只允许「新增 1 行 setrow」——校验差异块并确认净增 1 块
for (const s of INTENDED) {
  const ha = a.screens[s], hb = b.screens[s]
  if (ha === hb) { console.log(`  ✗ ${s.padEnd(9)} 期待新增入口却没变化`); fail++; continue }
  const la = blocks(ha), lb = blocks(hb)
  const add = lb.filter((x) => la.indexOf(x) < 0)
  const del = la.filter((x) => lb.indexOf(x) < 0)
  const hasLab = lb.some((x) => x.indexOf('data-a="go-lab"') >= 0)
  console.log(`  ◆ ${s.padEnd(9)} 有意改动：+${add.length} 块 / -${del.length} 块`)
  console.log(`      新入口 go-lab 存在：${hasLab ? '✓' : '✗'}`)
  console.log(`      新增块：${add.map((x) => x.slice(0, 120)).join(' | ') || '（无）'}`)
  if (del.length) console.log(`      ⚠ 被删除块：${del.map((x) => x.slice(0, 120)).join(' | ')}`)
  // 一条 setrow 会被 blocks() 按标签切成 2~4 块（div 开标签 / <b> / <span>…），
  // 故通过条件 = 无删除 + go-lab 存在 + 新增块全部属于这一条新行 + 块数合理(<=4)
  const allFromNewRow = add.every((x) =>
    x.indexOf('go-lab') >= 0 || x.indexOf('调养实验室') >= 0 || x.indexOf('五音') >= 0)
  if (del.length === 0 && hasLab && allFromNewRow && add.length >= 1 && add.length <= 4) { pass++ }
  else { fail++ }
}

console.log('\n' + (fail === 0
  ? `✅ 通过：其余 8 屏逐字符相同；profile 仅净增 1 条入口（${pass} 通过 / 0 失败）`
  : `❌ 未通过（${pass} 通过 / ${fail} 失败）`))
process.exit(fail === 0 ? 0 : 1)
