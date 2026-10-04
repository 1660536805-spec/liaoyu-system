/* 展示图：从最终成品截图（托天 / 开弓 / 单举 三个姿势 + 整页） */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const FILE = '/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-room.html';
const OUT = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/shots';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1120, height: 980 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE + '#debug', { waitUntil: 'load' });
  await p.addStyleTag({ content: '*{animation:none!important}' });
  await p.waitForTimeout(500);

  const shots = [[1, 0.5, 'a-tuotian'], [2, 0.35, 'b-kaigong'], [3, 0.32, 'c-danju']];
  for (const [i, u, nm] of shots) {
    await p.evaluate(([i, u]) => { const t = window.__tj; t.goto(i, false); t.cur.u = u; t.paint(false); }, [i, u]);
    await p.waitForTimeout(80);
    await p.screenshot({ path: path.join(OUT, `show-${nm}.png`), fullPage: true });
  }
  // 整页（带着控制条，处于开弓式）
  await p.evaluate(() => { const t = window.__tj; t.goto(2, false); t.cur.u = 0.35; t.paint(false); t.syncUI(); });
  await p.waitForTimeout(80);
  await p.screenshot({ path: path.join(OUT, 'show-fullpage.png'), fullPage: true });
  console.log('errors:', errs.length ? errs : '(none)');
  await b.close();
})();
