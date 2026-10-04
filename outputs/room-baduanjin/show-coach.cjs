/* 教练条视觉截图：full 模式六个阶段各一张（idle / demo / follow / grace / stepDone / allDone）。
   为稳定截图：先取消页面内所有 rAF（否则 engineLoop 会持续 tick 改变状态），
   再用 debug 钩子把状态机直接推到目标阶段，paint + syncCoachUI 后截图。 */
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
  await p.waitForTimeout(400);
  await p.addStyleTag({ content: '*{animation:none!important}' });
  // 冻结自动循环，避免截图期间状态漂移
  await p.evaluate(() => { for (let i = 0; i < 200000; i++) cancelAnimationFrame(i); });
  await p.waitForTimeout(120);

  const stages = [
    ['idle', 0, null],
    ['demo', 1, 'demo'],      // 第 2 式「两手托天理三焦」示范中
    ['follow', 1, 'follow'],
    ['grace', 1, 'grace'],
    ['stepDone', 1, 'stepDone'],
    ['allDone', 9, 'allDone'],
  ];

  for (const [nm, idx, target] of stages) {
    const got = await p.evaluate(([idx, target]) => {
      const t = window.__tj;
      if (target === null) {                 // idle：页面加载后教练未启动，本身即 idle，原样重绘
        t.paint(true); t.syncCoachUI();
        return t.coach.phase + '@' + t.coach.i;
      }
      t.coach.begin(idx);
      const reach = tp => { let g = 0; while (t.coach.phase !== tp && g++ < 8000) t.coach.tick(50); };
      if (target === 'stepDone') {                       // stepDone 只能由 hit() 触发；且单次 dt 截断到 50ms，要循环喂够 900ms
        reach('follow');
        for (let k = 0; k < 30; k++) t.coach.tick(50);   // 1500ms > hit 的 900ms 门槛
        t.coach.hit();
      }
      else if (target !== 'demo') reach(target);
      t.paint(true); t.syncCoachUI();
      return t.coach.phase + '@' + t.coach.i;
    }, [idx, target]);
    await p.waitForTimeout(120);
    await p.screenshot({ path: path.join(OUT, `coach-${nm}.png`), fullPage: true });
    console.log(nm.padEnd(9), '→', got);
  }

  console.log('errors:', errs.length ? errs : '(none)');
  await b.close();
})();
