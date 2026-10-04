/* 全周期逐帧扫描：120Hz 采样整个 60s 十式周期，读回渲染后的关节坐标，
   统计「单帧最大位移」。这是把 v3 那次扫描（阈值 1.2px/帧、当时残留 1.47px 腕跳变）
   原封不动搬到本页，用于逐项比对。 */
const { chromium } = require('playwright-core');
const FILE = process.argv[2] || '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/preview.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
  // 必须用 free 模式：full 模式下 basePose() 会用教练状态覆写 cur，手动设的 idx/u 会被冲掉（位移恒 0）
  await p.goto('file://' + FILE + '?mode=free#debug', { waitUntil: 'load' });
  await p.waitForTimeout(400);
  // 冻结自动循环：free 模式的连播会在每帧覆写 cur，不冻结则手动设的 idx/u 立刻被冲掉（位移恒 0）
  await p.evaluate(() => { for (let i = 0; i < 200000; i++) cancelAnimationFrame(i); });
  await p.waitForTimeout(80);
  p.setDefaultTimeout(180000);

  const out = await p.evaluate(() => {
    const { cur, MOVES, paint } = window.__tj;
    const parse = d => { const m = String(d).match(/M\s*([-\d.]+)\s+([-\d.]+)\s*L\s*([-\d.]+)\s+([-\d.]+)(?:\s*L\s*([-\d.]+)\s+([-\d.]+))?/); return m ? m.slice(1).map(Number) : null; };
    const joints = () => {
      const svg = document.querySelector('.layer:not(.reflect) .taiji svg');
      const g = k => svg.querySelector('[data-p="' + k + '"]');
      const tr = s => { const m = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(s.getAttribute('transform') || ''); return m ? [+m[1], +m[2]] : [NaN, NaN]; };
      const J = {};
      J.head = tr(g('head'));
      ['L', 'R'].forEach(sd => {
        const ps = g('arm' + sd).children;
        const up = parse(ps[0].getAttribute('d')), fo = parse(ps[3].getAttribute('d'));
        J['sh' + sd] = [up[0], up[1]]; J['el' + sd] = [up[2], up[3]];
        J['wr' + sd] = [fo[2], fo[3]];
        const lg = parse(g('leg' + sd).getAttribute('d'));
        J['kn' + sd] = lg ? [lg[4], lg[5]] : [NaN, NaN];
        J['ft' + sd] = [+g('shoe' + sd).getAttribute('cx'), +g('shoe' + sd).getAttribute('cy')];
      });
      return J;
    };
    const KEYS = Object.keys(joints());
    const rows = [];
    const HZ = 120;
    for (let i = 0; i < MOVES.length; i++) {
      const dur = MOVES[i].dur, n = Math.round(dur * HZ);
      cur.idx = i; cur.u = 0; paint(false);
      let prev = joints(), mx = 0, at = 0, who = '', over12 = 0, over60 = 0;
      for (let s = 1; s <= n; s++) {
        cur.u = s / n; paint(true);
        const now = joints();
        for (const k of KEYS) {
          const d = Math.hypot(now[k][0] - prev[k][0], now[k][1] - prev[k][1]);
          if (d > mx) { mx = d; at = s / n; who = k; }
          if (d > 1.2) over12++;
          if (d > 0.6) over60++;
        }
        prev = now;
      }
      rows.push({ i, name: MOVES[i].name, dur, n, mx: +mx.toFixed(3), at: +at.toFixed(3), who, over12, over60 });
    }
    return rows;
  });

  console.log('本页（八段锦拆动作版）· 120Hz 逐帧扫描 · 阈值参考 v3=1.2px/帧');
  console.log('式号 名称          时长   采样  最大单帧位移  @u     关节    >1.2px  >0.6px');
  out.forEach(r => console.log(
    ` ${String(r.i).padStart(2)}  ${r.name.padEnd(10)} ${String(r.dur).padStart(5)}s ${String(r.n).padStart(5)}   ${String(r.mx).padStart(8)}  ${String(r.at).padStart(6)}  ${r.who.padEnd(5)} ${String(r.over12).padStart(6)} ${String(r.over60).padStart(7)}`));
  const worst = out.reduce((a, c) => c.mx > a.mx ? c : a, out[0]);
  const tot12 = out.reduce((a, c) => a + c.over12, 0);
  console.log(`\n全周期最大单帧位移 = ${worst.mx}px @「${worst.name}」u=${worst.at}（${worst.who}）`);
  console.log(`超过 1.2px 阈值的帧数合计 = ${tot12}`);
  console.log(tot12 === 0 ? '⇒ 本页全周期无超阈值跳变（v3 当时残留 1.47px 腕跳变）' : '⇒ 存在超阈值帧，需定位');
  await b.close();
})();
