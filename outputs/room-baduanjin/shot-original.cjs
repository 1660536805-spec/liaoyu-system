/* 截「用户提供的那份原始内容」（改动前备份 original-backup.html）的四个时刻：
   起势(t≈3s) / 云手向右(t≈10s) / 云手向左(t≈22s) / 收势(t≈30.5s)。
   它没有 debug 钩子，只能按真实时间等待（33.5s 一轮，够用）。 */
const { chromium } = require('playwright-core');
const path = require('path');
const FILE = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/original-backup.html';
const OUT = '/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/shots';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1120, height: 980 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE, { waitUntil: 'load' });
  await p.addStyleTag({ content: '*{animation:none!important}' });

  const marks = [[3, 'orig-1-qishi'], [10, 'orig-2-cloudright'], [22, 'orig-3-cloudleft'], [30.5, 'orig-4-shoushi']];
  let el = 0;
  for (const [t, nm] of marks) {
    const wait = Math.max(0, t * 1000 - el);
    await p.waitForTimeout(wait); el = t * 1000;
    await p.screenshot({ path: path.join(OUT, nm + '.png'), fullPage: true });
    console.log('shot', nm, 'at t≈' + t + 's');
  }
  console.log('errors:', errs.length ? errs : '(none)');
  await b.close();
})();
