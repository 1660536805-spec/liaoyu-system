/* 陪练教练 · 端到端验证（Playwright + 本机 Chrome）
   验的是需求里最容易漏的两条：
     ① 教练先示范 → 示范结束才轮到用户 → 用户完成后才进下一式
     ② 一直不完成也必须能自动往下走（每段等待都有硬上界，绝不停死）
   用压缩参数把整链压到几十秒内。每个用例先 about:blank 再进目标，避免读到上一例状态。 */
const { chromium } = require('playwright-core');
const FILE = '/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-room.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const R = [];
const ok = (n, c, extra = '') => R.push([c ? 'PASS' : 'FAIL', n, extra || '']);

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1180, height: 1000 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  const open = async (query) => {
    await page.goto('about:blank');
    await page.goto('file://' + FILE + query, { waitUntil: 'load' });
    await page.waitForTimeout(350);
  };
  const S = () => page.evaluate(() => {
    const t = window.__tj;
    return { idx: t.coach.i, phase: t.coach.phase, t: Math.round(t.coach.t), reason: t.coach.reason,
             redemo: t.coach.redemo, extend: t.coach.extend, total: t.coach.total,
             chip: document.querySelector('.coach .coach-chip')?.textContent || '',
             tip: document.querySelector('.coach .coach-tip')?.textContent || '',
             step: document.querySelector('.coach .coach-step')?.textContent || '',
             barW: document.querySelector('.coach .coach-bar i')?.style.width || '',
             coachHidden: document.querySelector('.coach')?.hidden,
             freeHidden: document.querySelector('.room-ctl')?.hidden };
  });
  /* 记录状态序列（去重相邻相同）；到 allDone 立刻停，返回真实耗时 */
  const record = async (capMs, stepMs = 50) => {
    const seq = []; let last = ''; const t0 = Date.now(); let doneMs = null;
    while (Date.now() - t0 < capMs) {
      const s = await S();
      const key = s.phase + '#' + s.idx;
      if (key !== last) { seq.push({ phase: s.phase, idx: s.idx, t: Date.now() - t0 }); last = key; }
      if (s.phase === 'allDone') { doneMs = Date.now() - t0; break; }
      await page.waitForTimeout(stepMs);
    }
    return { seq, ms: doneMs, capped: doneMs === null };
  };
  const click = async sel => { await page.click(sel).catch(() => {}); await page.waitForTimeout(60); };

  // ══════════ A. 一直不完成 → 必须自动往下走 ══════════
  await open('?mode=full&debug&coachDemoK=0.06&coachFollowK=0.05&coachMinDemo=400&coachMinFollow=500&coachMaxFollow=900&coachGrace=1200&coachDone=250');
  let s = await S();
  ok('A1 默认进入 full 模式（教练条显示、自由条隐藏）', s.coachHidden === false && s.freeHidden === true,
     `coach.hidden=${s.coachHidden} free.hidden=${s.freeHidden}`);
  ok('A2 初始为 idle「准备开始」', s.phase === 'idle' && s.chip === '准备开始', s.phase + '/' + s.chip);
  ok('A3 初始显示第 1 式', s.idx === 0 && /第\s*1\s*式/.test(s.step), s.step);

  await click('.coach button[data-cact="start"]');
  s = await S();
  ok('A4 点「开始跟练」→ 进入示范', s.phase === 'demo', s.phase);
  ok('A5 示范期文案是「示范中」', s.chip === '示范中', s.chip);
  const noDone = await page.$eval('.coach button[data-cact="done"]', e => getComputedStyle(e).display === 'none');
  ok('A6 示范期不显示「我练好了」', noDone);

  // 全程不点任何按钮，看它自己能不能走完十式
  const recA = await record(60000, 50);
  const seqA = recA.seq, msA = recA.ms === null ? 60000 : recA.ms;
  s = await S();
  ok('A7 全程零操作也能走到「全部完成」', s.phase === 'allDone', `phase=${s.phase} idx=${s.idx}`);
  ok('A8 逐式推进到第 10 式（没有停死在同一式）', s.idx === 9, 'idx=' + s.idx);
  const phasesA = seqA.map(x => x.phase);
  ok('A9 状态序列按 示范→跟练→宽限 循环推进', ['demo', 'follow', 'grace'].every(p => phasesA.includes(p)),
     phasesA.join('→'));
  ok('A10 十式走完耗时在硬上界内（<35s，压缩参数理论值≈21s）', recA.ms !== null && msA < 35000, msA + 'ms');
  const followedIdx = new Set(seqA.filter(x => x.phase === 'follow').map(x => x.idx));
  ok('A11 十式都进入过「跟练」（每式都等过用户）', followedIdx.size === 10, [...followedIdx].join(','));
  const monotonic = seqA.every((x, i) => i === 0 || x.idx >= seqA[i - 1].idx);
  ok('A13 式号单调不回退', monotonic);
  ok('A12 兜底放行理由为 timeout', s.reason === 'timeout' || s.reason === 'done', s.reason);

  // ══════════ B. 用户每式都主动完成 → 应更快推进 ══════════
  await open('?mode=full&debug&coachDemoK=0.06&coachFollowK=0.5&coachMinDemo=400&coachMinFollow=1500&coachMaxFollow=2500&coachGrace=6000&coachDone=200');
  await click('.coach button[data-cact="start"]');
  const t1 = Date.now();
  let hitCount = 0, guard = 0;
  while (guard++ < 400) {
    const st = await S();
    if (st.phase === 'allDone') break;
    if (st.phase === 'follow') {
      const en = await page.$eval('.coach button[data-cact="done"]', e => !e.disabled && getComputedStyle(e).display !== 'none').catch(() => false);
      if (en) { await click('.coach button[data-cact="done"]'); hitCount++; }
    }
    await page.waitForTimeout(50);
  }
  const msB = Date.now() - t1;
  s = await S();
  ok('B1 用户每式主动完成也能走完十式', s.phase === 'allDone', `phase=${s.phase} idx=${s.idx}`);
  ok('B2 用户路径确实用了「我练好了」推进', hitCount >= 10, hitCount + ' 次');
  ok('B3 用户路径比纯兜底更快', msB < msA, `用户 ${msB}ms < 兜底 ${msA}ms`);
  ok('B4 完成后文案为「全部完成」', s.chip === '全部完成', s.chip);

  // ══════════ C. 「再看一遍示范」额度 ══════════
  await open('?mode=full&debug&coachDemoK=0.05&coachFollowK=0.6&coachMinDemo=300&coachMinFollow=3000&coachMaxFollow=4000&coachGrace=8000&coachDone=300');
  await click('.coach button[data-cact="start"]');
  await page.waitForFunction(() => window.__tj.phase() === 'follow', null, { timeout: 5000 });
  await click('.coach button[data-cact="redemo"]');
  s = await S();
  ok('C1 「再看一遍示范」→ 回到示范', s.phase === 'demo' && s.redemo === 1, `${s.phase}/${s.redemo}`);
  await page.waitForFunction(() => window.__tj.phase() === 'follow', null, { timeout: 5000 });
  const rdDisabled = await page.$eval('.coach button[data-cact="redemo"]', e => e.disabled).catch(() => null);
  ok('C2 用完额度后按钮禁用', rdDisabled === true, String(rdDisabled));

  // ══════════ D. 「再练一会」在宽限里续期 ══════════
  await open('?mode=full&debug&coachDemoK=0.05&coachFollowK=0.2&coachMinDemo=300&coachMinFollow=700&coachMaxFollow=1200&coachGrace=9000&coachDone=300');
  await click('.coach button[data-cact="start"]');
  await page.waitForFunction(() => window.__tj.phase() === 'grace', null, { timeout: 6000 });
  const beforeIdx = (await S()).idx;
  await click('.coach button[data-cact="extend"]');
  s = await S();
  ok('D1 宽限期「再练一会」→ 回到跟练（且不跳式）', s.phase === 'follow' && s.idx === beforeIdx && s.extend === 1,
     `${s.phase}/${s.idx}/${s.extend}`);

  // ══════════ E. 跳过本式 ══════════
  await open('?mode=full&debug&coachDemoK=0.05&coachFollowK=0.2&coachMinDemo=600&coachMinFollow=900&coachMaxFollow=1500&coachGrace=6000&coachDone=300');
  await click('.coach button[data-cact="start"]');
  await click('.coach button[data-cact="skip"]');
  s = await S();
  ok('E1 「跳过本式」立刻进下一式', s.idx === 1 && s.phase === 'demo', `idx=${s.idx} phase=${s.phase}`);

  // ══════════ F. mode=free 不受影响 ══════════
  await open('?mode=free&debug');
  s = await S();
  ok('F1 mode=free 时教练条隐藏、自由条显示', s.coachHidden === true && s.freeHidden === false,
     `coach.hidden=${s.coachHidden} free.hidden=${s.freeHidden}`);
  await click('.room-ctl button[data-act="next"]');
  const fi = await page.evaluate(() => window.__tj.cur.idx);
  ok('F2 free 模式下一个/下一个仍可用', fi === 1, 'cur.idx=' + fi);
  const hasSwitch = await page.$('.coach button[data-cact="free"]') && await page.$('.room-ctl button[data-act="coach"]');
  ok('F3 两档之间有互切入口', !!hasSwitch);

  // ══════════ G. 指引文案确实在讲「下一步做什么」 ══════════
  await open('?mode=full&debug&coachDemoK=0.05&coachFollowK=0.6&coachMinDemo=300&coachMinFollow=4000&coachMaxFollow=5000&coachGrace=8000');
  await click('.coach button[data-cact="start"]');
  const tipDemo = (await S()).tip;
  ok('G1 示范期文案说明「教练正在示范」', /示范/.test(tipDemo), tipDemo.slice(0, 40));
  await page.waitForFunction(() => window.__tj.phase() === 'follow', null, { timeout: 5000 });
  const sG = await S();
  ok('G2 跟练期文案明确「轮到你」并带式名与要领', /轮到你/.test(sG.tip) && sG.tip.includes('起势'), sG.tip.slice(0, 60));
  ok('G3 跟练期给出剩余秒数（等待有可见上界）', /\d+\s*秒/.test(sG.tip), (sG.tip.match(/\d+\s*秒[^）]*/) || [''])[0]);
  await page.waitForFunction(() => window.__tj.phase() === 'grace', null, { timeout: 8000 });
  const sH = await S();
  ok('G4 宽限期明说「不点也会自动继续」', /自动继续/.test(sH.tip), sH.tip.slice(0, 60));

  ok('Z 零（非预期）控制台错误', errs.length === 0, errs.join(' | '));

  console.log('\n陪练教练端到端结果：');
  R.forEach(([st, n, e]) => console.log(` ${st === 'PASS' ? '✓' : '✗'} ${n}${e ? '   [' + e + ']' : ''}`));
  const bad = R.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${R.length - bad}/${R.length} 通过`);
  console.log('\nA 例状态序列：' + seqA.map(x => `${x.phase}@${x.idx}`).join(' → '));  await b.close();
  process.exit(bad ? 1 : 0);
})();
