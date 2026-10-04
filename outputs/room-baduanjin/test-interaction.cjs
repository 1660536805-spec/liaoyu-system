/* 交互测试：直接开 Downloads 那份成品，验证按钮 / 键盘 / 播放 / 连播 / 进度条。 */
const { chromium } = require('playwright-core');
const FILE = '/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-room.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const R = [];
const ok = (n, c, extra = '') => { R.push([c ? 'PASS' : 'FAIL', n, extra]); };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  // 自由浏览控制条只存在于 free 档；默认 full 档会被教练条替换（.room-ctl 隐藏）
  await p.goto('file://' + FILE + '?mode=free#debug', { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const g = () => p.evaluate(() => { const c = window.__tj.cur; return { idx: c.idx, u: +c.u.toFixed(3), playing: c.playing, auto: c.auto }; });
  const txt = s => p.textContent('.room-ctl ' + s);
  const click = s => p.click('.room-ctl button[data-act="' + s + '"]');

  ok('初始为第1式', (await g()).idx === 0);
  ok('式名已渲染', (await txt('.ctl-name')).length > 0, await txt('.ctl-name'));
  ok('提示已渲染', (await txt('.ctl-hint')).length > 5);
  ok('共10式', (await txt('.ctl-idx')).includes('10'), await txt('.ctl-idx'));
  ok('初始未播放', (await g()).playing === false);

  // 下一个 / 上一个
  await click('next'); await p.waitForTimeout(80);
  let s = await g(); ok('下一个 → idx=1, u=0', s.idx === 1 && s.u === 0, JSON.stringify(s));
  await click('prev'); await p.waitForTimeout(80);
  s = await g(); ok('上一个 → idx=0', s.idx === 0);

  // 循环：第 1 式按上一个 → 到第 10 式
  await click('prev'); await p.waitForTimeout(80);
  s = await g(); ok('第1式再上一个 → 回绕到第10式', s.idx === 9, 'idx=' + s.idx);
  await click('next'); await p.waitForTimeout(80);

  // 播放推进
  await click('play'); await p.waitForTimeout(700);
  s = await g(); ok('播放中 u 在推进', s.playing && s.u > 0.05, JSON.stringify(s));
  ok('播放中按钮变“暂停”', (await txt('button[data-act="play"]')).includes('暂停'));
  const w1 = await p.evaluate(() => document.querySelector('.room-ctl .ctl-prog i').style.width);
  ok('进度条有宽度', parseFloat(w1) > 0, w1);

  // 暂停
  await click('play'); await p.waitForTimeout(250);
  const a1 = await g(); await p.waitForTimeout(400); const a2 = await g();
  ok('暂停后 u 不再变', a1.u === a2.u && !a2.playing, `${a1.u} → ${a2.u}`);

  // 重放
  await click('replay'); await p.waitForTimeout(80);
  ok('重放 → u=0', (await g()).u === 0);

  // 键盘
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(80);
  ok('→ 键进下一式', (await g()).idx === 1);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(80);
  ok('← 键回上一式', (await g()).idx === 0);
  await p.keyboard.press(' '); await p.waitForTimeout(300);
  ok('空格开始播放', (await g()).playing === true);
  await p.keyboard.press(' '); await p.waitForTimeout(120);
  ok('空格再按暂停', (await g()).playing === false);
  await p.keyboard.press('r'); await p.waitForTimeout(80);
  ok('R 键重放', (await g()).u === 0);

  // 连播：把 dur 调小，跑一遍
  await p.evaluate(() => { window.__tj.MOVES.forEach(m => m.dur = 0.35); });
  await click('auto'); await p.waitForTimeout(80);
  ok('连播开启（aria-pressed）', (await p.getAttribute('.room-ctl button[data-act="auto"]', 'aria-pressed')) === 'true');
  await click('play');
  await p.waitForTimeout(1600);
  s = await g();
  ok('连播自动进到后续式', s.idx >= 1, JSON.stringify(s));
  await click('play'); await p.waitForTimeout(100);   // 停
  await click('auto'); await p.waitForTimeout(80);
  ok('连播可关闭', (await p.getAttribute('.room-ctl button[data-act="auto"]', 'aria-pressed')) === 'false');

  // 放完停住：关连播，单式播放到结束
  await p.evaluate(() => { const t = window.__tj; t.goto(0, false); t.MOVES[0].dur = 0.4; });
  await click('play'); await p.waitForTimeout(900);
  s = await g(); ok('放完停住 u=1 且不播放', s.u === 1 && !s.playing, JSON.stringify(s));

  ok('零控制台错误', errs.length === 0, errs.join(' | '));

  console.log('\n交互测试结果：');
  R.forEach(([st, n, e]) => console.log(` ${st === 'PASS' ? '✓' : '✗'} ${n}${e ? '   [' + e + ']' : ''}`));
  const bad = R.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${R.length - bad}/${R.length} 通过`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
