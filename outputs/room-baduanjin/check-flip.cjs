/* 肘翻折专项检测：逐式 u 0→1 采样，计算 (肩→肘)×(肘→腕) 的有符号叉积方向
   （即肘在臂轴的哪一侧）。若中途符号翻转 ⇒ 肘翻折（八段锦托天/开弓最容易中招）。
   同时给出每式的「最大单帧位移」与发生位置。 */
const { chromium } = require('playwright-core');
const FILE = process.argv[2] || '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/preview.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  await page.goto('file://' + FILE + '#debug', { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const out = await page.evaluate(() => {
    const { cur, MOVES, paint } = window.__tj;
    const parse = d => { const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)\s*L\s*([-\d.]+)\s+([-\d.]+)/); return m ? [+m[1], +m[2], +m[3], +m[4]] : null; };
    const readArms = () => {
      const g = document.querySelector('.layer:not(.reflect) .taiji svg');
      return ['armL', 'armR'].map(k => {
        const ps = g.querySelector('[data-p="' + k + '"]').children;
        const up = parse(ps[0].getAttribute('d')), fo = parse(ps[3].getAttribute('d'));
        return { sh: [up[0], up[1]], el: [up[2], up[3]], wr: [fo[2], fo[3]] };
      });
    };
    const rows = [];
    for (let i = 0; i < MOVES.length; i++) {
      cur.idx = i; cur.u = 0; paint(false);
      const S = 120; let prevSign = [null, null], flips = [0, 0], prev = null, maxJump = 0, worstU = 0;
      for (let s = 0; s <= S; s++) {
        cur.u = s / S; paint(s > 0);
        const arms = readArms();
        const key = [];
        arms.forEach((a, j) => {
          const ax = a.wr[0] - a.sh[0], ay = a.wr[1] - a.sh[1];
          const bx = a.el[0] - a.sh[0], by = a.el[1] - a.sh[1];
          const cross = ax * by - ay * bx;             // >0 肘在臂轴一侧，<0 另一侧
          const sg = cross >= 0 ? 1 : -1;
          if (prevSign[j] !== null && sg !== prevSign[j]) flips[j]++;
          prevSign[j] = sg;
          key.push(a.el.concat(a.wr));
        });
        if (prev) key.forEach((k, j) => {
          const d = Math.hypot(k[0] - prev[j][0], k[1] - prev[j][1]) + Math.hypot(k[2] - prev[j][2], k[3] - prev[j][3]);
          if (d > maxJump) { maxJump = d; worstU = s / S; }
        });
        prev = key;
      }
      rows.push({ i, name: MOVES[i].name, flips, maxJump: +maxJump.toFixed(1), worstU: +worstU.toFixed(2) });
    }
    return rows;
  });

  console.log('式号  名称          左肘翻折 右肘翻折  最大单帧位移  @u');
  out.forEach(r => console.log(`  ${String(r.i).padStart(2)}  ${r.name.padEnd(10)}    ${r.flips[0]}        ${r.flips[1]}      ${String(r.maxJump).padStart(6)}    ${r.worstU}`));
  const bad = out.filter(r => r.flips[0] || r.flips[1]);
  console.log('\n结论:', bad.length ? '存在翻折 → ' + bad.map(b => b.name).join(', ') : '十式全程无肘翻折 ✓');
  await browser.close();
})();
