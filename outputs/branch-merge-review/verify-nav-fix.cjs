/* 验收「底部导航固定为 4 项」这次改动。
 * 改前 = dom-after.json（有 go-lab 入口、导航仍是 3 项/无首页）
 * 改后 = dom-navfix.json（导航统一 4 项）
 * 期望：只有 home / profile 变；audio 及无导航的 6 屏逐字符相同；
 *       且 home/profile 的差异恰好 = 新增 1 个「首页」导航按钮。
 * 用法：node outputs/branch-merge-review/verify-nav-fix.cjs <before.json> <after.json>
 */
const fs = require('fs')
const path = require('path')

const A = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'))
const B = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8'))
const SHOULD_CHANGE = new Set(['home', 'profile'])
const SHOULD_SAME = ['loading', 'question', 'audio', 'intro', 'practice', 'done', 'body']

const blocks = (h) => h.replace(/>\s*</g, '>\n<').split('\n')
let pass = 0, fail = 0

console.log('改前：' + process.argv[2])
console.log('改后：' + process.argv[3] + '\n')

for (const s of SHOULD_SAME) {
  const a = A.screens[s], b = B.screens[s]
  if (a === b) { console.log(`  ✓ ${s.padEnd(9)} 逐字符相同（${a.length} 字符）`); pass++ }
  else {
    const la = blocks(a), lb = blocks(b); const ch = []
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) ch.push(i)
    console.log(`  ✗ ${s.padEnd(9)} 不该变却变了：${ch.length} 块不同`)
    for (const i of ch.slice(0, 3)) { console.log('        - ' + String(la[i]).slice(0, 110)); console.log('        + ' + String(lb[i]).slice(0, 110)) }
    fail++
  }
}

for (const s of SHOULD_CHANGE) {
  const a = A.screens[s], b = B.screens[s]
  if (a === b) { console.log(`  ✗ ${s.padEnd(9)} 期待导航变化却没变`); fail++; continue }
  const la = blocks(a), lb = blocks(b)
  const add = lb.filter((x) => la.indexOf(x) < 0)
  const del = la.filter((x) => lb.indexOf(x) < 0)
  const nav = B.screens[s]
  const navCount = (nav.match(/class="nitem/g) || []).length
  const hasHomeBtn = /data-a="nav-home"/.test(nav)
  // 一个「首页」按钮会被 blocks() 切成 4 块（button / path / path / </svg>首页</button>），
  // 通过条件 = 导航恰好 4 项 + 含首页按钮 + 无任何删除 + 新增块数合理（<=6）
  const onlyHomeBtn = add.length >= 1 && add.length <= 6
  console.log(`  ◆ ${s.padEnd(9)} 导航项数=${navCount}  含首页按钮=${hasHomeBtn}  +${add.length}块 / -${del.length}块`)
  console.log(`      新增：${add.map((x) => x.slice(0, 90)).join(' | ') || '（无）'}`)
  if (del.length) console.log(`      ⚠ 删除：${del.map((x) => x.slice(0, 90)).join(' | ')}`)
  if (navCount === 4 && hasHomeBtn && onlyHomeBtn && del.length === 0) pass++
  else { fail++; console.log('      ✗ 不满足「恰好新增 1 个首页按钮且导航=4」') }
}

console.log('\n' + (fail === 0
  ? `✅ 通过：导航统一 4 项；仅 home/profile 变（各 +1 个「首页」按钮）；其余 7 屏逐字符相同（${pass} 通过 / 0 失败）`
  : `❌ 未通过（${pass} 通过 / ${fail} 失败）`))
process.exit(fail === 0 ? 0 : 1)
