/* 检查「每式首尾都在抱球位」时，左右肘是否落在身体外侧（种子支）。
   若 u=0 / u=1 的肘相对肩偏内侧 ⇒ 说明 mem 串味会带来翻到身体另一侧的坏姿势。 */
const { chromium } = require('playwright-core');
const FILE = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/preview.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
  await p.goto('file://' + FILE + '#debug', { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const out = await p.evaluate(() => {
    const { cur, MOVES, paint } = window.__tj;
    const parse = d => { const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)\s*L\s*([-\d.]+)\s+([-\d.]+)/); return m ? m.map(Number).slice(1) : null; };
    const readArms = () => {
      const g = document.querySelector('.layer:not(.reflect) .taiji svg');
      return ['armL', 'armR'].map(k => {
        const ps = g.querySelector('[data-p="' + k + '"]').children;
        const up = parse(ps[0].getAttribute('d')), fo = parse(ps[3].getAttribute('d'));
        return { sh: [up[0], up[1]], el: [up[2], up[3]], wr: [fo[2], fo[3]] };
      });
    };
    const rows = [];
    // 模拟真实使用：从第 0 式开始按顺序「放完再切下一式」（连续，mem 不重置）
    for (let i = 0; i < MOVES.length; i++) {
      cur.idx = i; cur.u = 0; paint(false);          // 切式：pose 跳到 BALL0，mem 沿用上一式
      const at0 = readArms();
      for (let s = 1; s <= 60; s++) { cur.u = s / 60; paint(true); }
      const at1 = readArms();                        // 放完
      const side = a => {                            // 肘在肩的外侧为 +，内侧为 -
        const L = a[0], R = a[1];
        const mid = (L.sh[0] + R.sh[0]) / 2;
        return [+(mid - L.el[0]).toFixed(1), +(R.el[0] - mid).toFixed(1)];  // >0 = 外侧
      };
      rows.push({ i, name: MOVES[i].name, s0: side(at0), s1: side(at1) });
    }
    return rows;
  });
  console.log('式号 名称          切式瞬间(左/右 外侧度)   放完时(左/右 外侧度)');
  out.forEach(r => console.log(
    ` ${String(r.i).padStart(2)}  ${r.name.padEnd(10)}   ${String(r.s0[0]).padStart(6)} ${String(r.s0[1]).padStart(6)}        ${String(r.s1[0]).padStart(6)} ${String(r.s1[1]).padStart(6)}`));
  const bad = out.filter(r => r.s0[0] < 0 || r.s0[1] < 0 || r.s1[0] < 0 || r.s1[1] < 0);
  console.log('\n首尾肘内侧(负值)的式:', bad.length ? bad.map(b => b.name).join(', ') : '无 ✓');
  await b.close();
})();
