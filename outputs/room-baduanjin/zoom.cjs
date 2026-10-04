/* 放大取样：给定式号与若干 u，截图后裁出人物区并放大拼条，用于细看姿态。 */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const FILE = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/preview.html';
const OUT = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/shots';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MOVE = +process.argv[2] || 6;
const US = (process.argv[3] || '0,0.15,0.3,0.45,0.6,0.8').split(',').map(Number);

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + FILE + '#debug', { waitUntil: 'load' });
  await p.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  await p.waitForTimeout(400);
  for (const u of US) {
    await p.evaluate(([i, u]) => { const t = window.__tj; t.goto(i, false); t.cur.u = u; t.paint(false); }, [MOVE, u]);
    await p.waitForTimeout(50);
    const el = await p.$('.layer:not(.reflect) .taiji');
    const box = await el.boundingBox();
    await p.screenshot({ path: path.join(OUT, `zoom_m${MOVE}_${String(Math.round(u * 100)).padStart(3, '0')}.png`),
      clip: { x: box.x + box.width * 0.30, y: box.y + box.height * 0.04,
              width: box.width * 0.40, height: box.height * 0.96 } });
  }
  await b.close();
  console.log('done', MOVE, US.join(','));
})();
