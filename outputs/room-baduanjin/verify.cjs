/* 校验（八段锦拆动作版）：
   · 控制台零报错
   · 10 式逐式截图（每式取 u=0/.25/.5/.75/1 五帧，拼成 5×10 网格）
   · 数值体检：逐式 u 0→1 采样，读回手臂路径，算「肘/腕单帧最大位移」，用于发现肘翻折
   · 倒影一致性：本体与 reflect 两份 svg 的路径 d 是否逐字相同
*/
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');

const FILE = process.argv[2] || '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/preview.html';
const OUT = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/shots';
fs.mkdirSync(OUT, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  await page.goto('file://' + FILE + '#debug', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const hasHook = await page.evaluate(() => !!window.__tj);
  console.log('debug hook:', hasHook);
  const n = await page.evaluate(() => window.__tj.MOVES.length);
  console.log('MOVES:', n);
  console.log('names:', await page.evaluate(() => window.__tj.MOVES.map(m => m.name).join(' / ')));

  // ── 数值体检：逐式采样，读回手臂路径 ──
  const report = await page.evaluate(() => {
    const { cur, MOVES, paint } = window.__tj;
    const parse = d => {           // "M x y L x y"
      const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)\s*L\s*([-\d.]+)\s+([-\d.]+)/);
      return m ? [+m[1], +m[2], +m[3], +m[4]] : null;
    };
    const readArms = () => {
      const g = document.querySelector('.layer:not(.reflect) .taiji svg');
      return ['armL', 'armR'].map(k => {
        const ps = g.querySelector('[data-p="' + k + '"]').children;
        const up = parse(ps[0].getAttribute('d')), fo = parse(ps[3].getAttribute('d'));
        return { sh: [up[0], up[1]], el: [up[2], up[3]], wr: [fo ? fo[2] : NaN, fo ? fo[3] : NaN] };
      });
    };
    const res = [];
    for (let i = 0; i < MOVES.length; i++) {
      cur.idx = i; cur.playing = false;
      // 从 u=0 起播，模拟真实播放顺序（mem 连续）
      let prev = null, maxJump = 0, worstU = 0, minAng = 999;
      for (let s = 0; s <= 60; s++) {
        cur.u = s / 60; paint(s > 0);          // 第一帧 step=false 清拖影
        const arms = readArms();
        arms.forEach(a => {
          // 肘角度（0°=完全伸直）
          const v1 = [a.sh[0] - a.el[0], a.sh[1] - a.el[1]], v2 = [a.wr[0] - a.el[0], a.wr[1] - a.el[1]];
          const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) /
            (Math.hypot(...v1) * Math.hypot(...v2) || 1)))) * 180 / Math.PI;
          minAng = Math.min(minAng, 180 - ang);
        });
        const key = arms.map(a => a.el.concat(a.wr));
        if (prev) key.forEach((k, j) => {
          const d = Math.hypot(k[0] - prev[j][0], k[1] - prev[j][1]) + Math.hypot(k[2] - prev[j][2], k[3] - prev[j][3]);
          if (d > maxJump) { maxJump = d; worstU = s / 60; }
        });
        prev = key;
      }
      res.push({ i, name: MOVES[i].name, maxJump: +maxJump.toFixed(1), worstU: +worstU.toFixed(2), minFold: +minAng.toFixed(1) });
    }
    return res;
  });
  console.log('\n逐式体检（maxJump=相邻帧肘+腕位移之和上限，>30 视为可疑跳变）:');
  report.forEach(r => console.log(`  ${String(r.i).padStart(2)} ${r.name.padEnd(9)} maxJump=${String(r.maxJump).padStart(6)} @u=${r.worstU}  最小伸直余角=${r.minFold}°`));

  // ── 倒影一致性 ──
  const mirror = await page.evaluate(() => {
    const { cur, paint } = window.__tj; cur.idx = 1; cur.u = 0.5; paint(false);
    const a = document.querySelector('.layer:not(.reflect) .taiji svg');
    const b = document.querySelector('.layer.reflect .taiji svg');
    const keys = ['jacket', 'legL', 'legR', 'sash', 'neck'];
    return keys.map(k => [k, a.querySelector('[data-p="' + k + '"]').getAttribute('d') === b.querySelector('[data-p="' + k + '"]').getAttribute('d')]);
  });
  console.log('\n倒影一致性:', mirror.map(([k, v]) => k + ':' + (v ? 'ok' : 'DIFF')).join('  '));

  // ── 逐式截图（五帧拼一图） ──
  for (let i = 0; i < n; i++) {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate(([i, u]) => { const t = window.__tj; t.goto(i, false); t.cur.u = u; t.paint(false); }, [i, u]);
      await page.waitForTimeout(60);
      const stage = await page.$('.room-stage');
      await stage.screenshot({ path: path.join(OUT, `m${String(i).padStart(2, '0')}_u${String(Math.round(u * 100)).padStart(3, '0')}.png`) });
    }
  }
  // 控制台整页
  await page.evaluate(() => { window.__tj.goto(1, false); });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, 'page-full.png'), fullPage: true });

  console.log('\nconsole errors:', errs.length ? errs : '(none)');
  await browser.close();
  console.log('\nshots →', OUT);
})();
