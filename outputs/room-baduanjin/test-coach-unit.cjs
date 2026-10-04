/* 状态机单测：coachCreate 是纯函数（只进 dt、不碰时钟），直接从 room.js 里切出来在 node 跑。
   断言「给定 dt 序列 → 状态序列」，并证明：任意一轮等待都有硬上界，结构上不可能停死。 */
const fs = require('fs');
const src = fs.readFileSync('/Users/leo/WorkBuddy/疗愈/outputs/room-baduanjin/room.js', 'utf8');
const a = src.indexOf('function coachCreate(');
const b = src.indexOf('const coach = coachCreate(');
if (a < 0 || b < 0) { console.error('切不出 coachCreate'); process.exit(1); }
const coachCreate = new Function(src.slice(a, b) + '\nreturn coachCreate;')();

const R = [];
const ok = (n, c, e = '') => R.push([c ? 'PASS' : 'FAIL', n, e]);

const P = { demoK: 1, followK: 1, minDemoMs: 2200, minFollowMs: 2600, maxFollowMs: 8000,
            graceMs: 4000, doneMs: 800, maxRedemo: 1, maxExtend: 1 };
const DURS = [3, 6.5, 8, 7, 6, 8, 6.5, 7, 5, 3];      // 真实十式时长（秒）

const feed = (c, ms, step = 16) => { let left = ms; while (left > 0) { const d = Math.min(step, left); c.tick(d); left -= d; } };
/* 一直喂时间直到进入某状态（避免固定步长跨阶段边界时因取整少喂几毫秒） */
const until = (c, phase, cap = 600000) => { let ms = 0; while (c.phase !== phase && ms < cap) { c.tick(16); ms += 16; } return ms; };
const newC = () => coachCreate(DURS, P);

// ── 1. 基本推进：示范期不接受完成信号 ──
let c = newC();
ok('初始为 idle', c.phase === 'idle');
c.tick(500); ok('idle 不接受时间推进', c.phase === 'idle');
c.start(); ok('start() → demo', c.phase === 'demo' && c.i === 0);
ok('demo 期 hit() 无效（用户抢在示范中做完也不算数）', c.hit() === false && c.phase === 'demo');
until(c, 'follow');
ok('demoMs 到点 → follow（示范结束才轮到用户）', c.phase === 'follow', `demoMs=${c.demoMs()}`);
ok('follow 期 t<900ms 时 hit() 无效（防误触）', c.hit() === false, 't=' + c.t);
feed(c, 1000);
ok('follow 期 t≥900ms 时 hit() → stepDone', c.hit() === true && c.phase === 'stepDone', c.phase);
ok('推进理由 = user', c.reason === 'user', c.reason);
until(c, 'demo');
ok('doneMs 后自动进下一式 demo', c.phase === 'demo' && c.i === 1, `i=${c.i}/${c.phase}`);

// ── 2. 软等待 → 宽限 → 兜底放行（核心：绝不停死） ──
c = newC(); c.start();
until(c, 'grace');
ok('followMs 到点 → grace', c.phase === 'grace', `followMs=${c.followMs()}`);
/* 注意：reason 是「瞬时值」——advance('timeout') 内部随即 begin(i+1) 把它清空，
   所以只有走到 allDone 终止路径（不再 begin）时才留得住（见第 9 节）。
   中途某式想验证「确实走的兜底路径」，只能看可观测后果：全程没出现过 stepDone。 */
const phasesSeen = new Set();
while (c.phase !== 'demo' && phasesSeen.size < 200) { c.tick(16); phasesSeen.add(c.phase); }
ok('graceMs 到点 → 自动放行到下一式', c.i === 1 && c.phase === 'demo', `i=${c.i}/${c.phase}`);
ok('放行走的是兜底 timeout 路径（全程不经过 stepDone）', !phasesSeen.has('stepDone'), [...phasesSeen].join('→'));

// ── 3. 重放额度 ──
c = newC(); c.start(); until(c, 'follow');
ok('redemo 在 follow 可用 → 回到 demo', c.redemoOnce() === true && c.phase === 'demo' && c.redemo === 1);
until(c, 'follow');
ok('重放额度用尽后不可再用', c.redemoOnce() === false && c.redemo === 1);

// ── 4. 「再练一会」额度 ──
c = newC(); c.start(); until(c, 'grace');
ok('extend 在 grace 可用 → 回到 follow', c.extendOnce() === true && c.phase === 'follow' && c.extend === 1, c.phase);
until(c, 'grace');
ok('续期额度用尽后不可再用', c.extendOnce() === false && c.extend === 1);

// ── 5. skip ──
c = newC(); c.start(); c.skip();
ok('skip 立刻进下一式', c.i === 1 && c.phase === 'demo');

// ── 6. dt 截断（切回标签页时别把几秒当成一帧补上）──
c = newC(); c.start(); c.tick(30000);
ok('单次 dt 被截断到 50ms', c.t === 50, 't=' + c.t);

// ── 7. allDone 收敛 ──
c = newC(); c.start(); c.begin(9);
until(c, 'allDone');
ok('最后一式兜底后进入 allDone', c.phase === 'allDone' && c.i === 9, `i=${c.i}/${c.phase}`);
feed(c, 120000);
ok('allDone 后长时间喂时间也不越界', c.phase === 'allDone' && c.i === 9, `i=${c.i}/${c.phase}`);
c.skip(); ok('allDone 后 skip 无效', c.i === 9);

// ── 8. 硬上界（需求里最关键的一条）──
const dOf = k => Math.max(P.minDemoMs, DURS[k] * 1000 * P.demoK);
const fOf = k => Math.min(P.maxFollowMs, Math.max(P.minFollowMs, DURS[k] * 1000 * P.followK));
/* 兜底路径（全程不点任何按钮）：demo → follow → grace → 直接进下一式，不经过 stepDone */
const boundTimeout = k => dOf(k) + fOf(k) + P.graceMs;
/* 用满额度的绝对最坏：多一次重放 + 一次续期 + 一次 stepDone */
const boundWorst = k => dOf(k) + P.maxRedemo * (dOf(k) + fOf(k)) + fOf(k) + P.maxExtend * fOf(k) + P.graceMs + P.doneMs;
const sum = arr => arr.reduce((x, y) => x + y, 0);
const perT = DURS.map((_, k) => boundTimeout(k)), perW = DURS.map((_, k) => boundWorst(k));
console.log('每式耗时上界：兜底路径 / 用满全部额度');
DURS.forEach((_, k) => console.log(`  ${String(k + 1).padStart(2)}式  ${(perT[k] / 1000).toFixed(1)}s  /  ${(perW[k] / 1000).toFixed(1)}s`));
console.log(`全链合计：兜底 ${(sum(perT) / 1000).toFixed(1)}s  /  最坏 ${(sum(perW) / 1000).toFixed(1)}s`);
ok('每式等待有硬上界（兜底 <25s）', perT.every(v => v < 25000), `max=${(Math.max(...perT) / 1000).toFixed(1)}s`);
ok('每式用满额度也有硬上界（<50s）', perW.every(v => v < 50000), `max=${(Math.max(...perW) / 1000).toFixed(1)}s`);
ok('十式全链有硬上界（兜底 <200s）', sum(perT) < 200000, `${(sum(perT) / 1000).toFixed(1)}s`);

// ── 9. 模拟「用户一直不完成」的最坏路径 ──
c = newC(); c.start();
let guard = 0, sim = 0;
while (c.phase !== 'allDone' && guard++ < 60000) { c.tick(50); sim += 50; }
ok('纯兜底路径一定能走完十式', c.phase === 'allDone' && c.i === 9, `i=${c.i}/${c.phase} 用时 ${(sim / 1000).toFixed(1)}s`);
ok('纯兜底实测耗时 == 理论上界（无缺口、无停死）', sim === sum(perT), `${(sim / 1000).toFixed(1)}s vs ${(sum(perT) / 1000).toFixed(1)}s`);
ok('兜底路径不经过 stepDone（timeout 直接进下一式）', c.reason === 'timeout', c.reason);

console.log('\n状态机单测：');
R.forEach(([st, n, e]) => console.log(` ${st === 'PASS' ? '✓' : '✗'} ${n}${e ? '   [' + e + ']' : ''}`));
const bad = R.filter(r => r[0] === 'FAIL').length;
console.log(`\n${R.length - bad}/${R.length} 通过`);
process.exit(bad ? 1 : 0);
