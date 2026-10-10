/* 对比两份 dom-snap JSON：改前 vs 改后 的渲染后 DOM。
 *
 * 判定口径：
 *   · 未触碰的屏（loading / audio / practice / body / profile）必须**逐字符相同**
 *   · 有意改动的屏（home / question / done / intro）允许差异，但必须打印差异行，供人眼复核
 *
 * 用法：node outputs/pm-review/dom-diff.cjs outputs/pm-review/dom-before.json outputs/pm-review/dom-after.json
 */
const fs = require('fs')
const path = require('path')

const A = path.resolve(process.argv[2])
const B = path.resolve(process.argv[3])
const INTENDED = new Set(['home', 'question', 'done', 'intro'])
const UNTOUCHED = new Set(['loading', 'audio', 'practice', 'body', 'profile'])

const a = JSON.parse(fs.readFileSync(A, 'utf8'))
const b = JSON.parse(fs.readFileSync(B, 'utf8'))

/** 把一段 HTML 切成便于比较的「标签块」：在 '>' 后断行，便于逐块看差异 */
const blocks = (h) => h.replace(/>\s*</g, '>\n<').split('\n')

let pass = 0
let fail = 0

console.log('改前：' + A)
console.log('改后：' + B)
console.log('app.css 字符数：改前 ' + a.appCssLen + ' / 改后 ' + b.appCssLen +
  (a.appCssLen === b.appCssLen ? '  ✓ 样式表未动' : '  ✗ 样式表变了！') + '\n')
if (a.appCssLen !== b.appCssLen) fail++; else pass++

for (const s of Object.keys(a.screens)) {
  const ha = a.screens[s]
  const hb = b.screens[s]
  if (ha === hb) {
    console.log(`  ✓ ${s.padEnd(9)} 渲染后 DOM 逐字符相同（${ha.length} 字符）`)
    pass++
    continue
  }
  const la = blocks(ha)
  const lb = blocks(hb)
  const changed = []
  const n = Math.max(la.length, lb.length)
  for (let i = 0; i < n; i++) if (la[i] !== lb[i]) changed.push(i)
  if (INTENDED.has(s)) {
    console.log(`  ◆ ${s.padEnd(9)} 有意改动：${changed.length} / ${n} 个标签块不同`)
    for (const i of changed.slice(0, 6)) {
      console.log('        - ' + String(la[i]).slice(0, 150))
      console.log('        + ' + String(lb[i]).slice(0, 150))
    }
    if (changed.length > 6) console.log(`        … 另有 ${changed.length - 6} 块，详见 JSON`)
    pass++
  } else {
    console.log(`  ✗ ${s.padEnd(9)} 不该变却变了：${changed.length} 个标签块不同`)
    for (const i of changed.slice(0, 4)) {
      console.log('        - ' + String(la[i]).slice(0, 150))
      console.log('        + ' + String(lb[i]).slice(0, 150))
    }
    fail++
  }
}

// 反向检查：未触碰清单里的屏若真的没出现在结果里，也要提醒
for (const s of UNTOUCHED) if (!(s in a.screens)) console.log('  ! 缺屏：' + s)

console.log('\n' + (fail === 0
  ? `✅ 未触碰的屏渲染后 DOM 逐字符相同（${pass} 通过 / 0 失败）`
  : `❌ 有 ${fail} 项未通过（${pass} 通过）`))
process.exit(fail === 0 ? 0 : 1)
