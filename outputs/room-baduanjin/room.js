'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app');
let roomObserver=null,roomAnim=null;

/* ============================================================================
   首页 · 灰蓝立体房间（实景照片 + 3D 墙面文字 + 地面倒影）
   本轮改动：把房间中央的小人从「一条 33.5s 的连续云手循环」改成
   「八段锦 10 式拆解：一次只演示一势，可上一个 / 下一个 / 重放」。
   房间本体（照片、三面墙、滚动文字、浮动音符、倒影、地盘）保持原样。
   ========================================================================= */

/* 三面墙共用同一条滚动文字带，按墙长错位（后墙 -880、右墙 -1880），文字从左墙经后墙流到右墙。 */
const ROOM_POEM='清晨的庭院里，<b>宫</b>声沉稳，像脚下的土地；<b>商</b>声清越，掠过肩头；<b>角</b>声舒展，从指尖抽出新枝；<b>徵</b>声温暖，停在掌心；<b>羽</b>声如水，流过一呼一吸。<b>云手</b>缓缓，一开一合，不求整齐，只求<b>此刻</b>。拨一弦，留一刻，让声音陪你守住这段<b>留白</b>。';
function roomBands(){const poem=`<span>${ROOM_POEM}</span>`,tones=`<span>${'宫　商　角　徵　羽　宫高　商高　'.repeat(8)}</span>`;return `<div class="band band-poem"><div class="track">${poem}${poem}</div></div><div class="band band-tones"><div class="track">${tones}${tones}</div></div>`}
/* 音符分布在房间体积内（x 60–940、y 175–360、z -60– -820），避开小人所在的位置。 */
function roomNotes(){let seed=11;const rand=()=>(seed=seed*16807%2147483647)/2147483647,glyphs=['♪','♫','♩','♬','♪','♫','宫','商','角','徵','羽'];return Array.from({length:28},(_,i)=>{const g=glyphs[i%glyphs.length],cjk=i%glyphs.length>5,z=Math.round(-820+rand()*760),y=Math.round(175+rand()*185);let x=Math.round(60+rand()*880);if(x>380&&x<620&&z>-320&&z<-40)x+=x<500?-220:220;return `<span class="note${cjk?' cjk':''}${z>-150?' near':''}" style="left:0;top:0;transform:translate3d(${x}px,${y}px,${z}px)"><i style="font-size:${Math.round((cjk?18:22)+rand()*22)}px;--o:${(.45+rand()*.45).toFixed(2)};--d:${(9+rand()*9).toFixed(1)}s;--delay:${(-rand()*18).toFixed(1)}s;--dx:${Math.round(-22+rand()*44)}px">${g}${cjk?'':'︎'}</i></span>`}).join('')}

/* ============================================================================
   一、八段锦 10 式动作库
   ----------------------------------------------------------------------------
   直接沿用 outputs/xianyang-room.html 里那一版已经定好的动作（动作名称、关键帧、
   时长、步法），只把坐标系从 v3 空间换算到本页小人所在的空间。

   v3 空间：地面 y=266，骨盆静止 y=168，中轴 x=120，肩静止 y=110，臂长 32/28
   本页空间：地面 y=434，骨盆静止 y≈300，中轴 x=200（viewBox -100 150 600 300）
   ⇒ 比例 VS=1.367，原点 (120,266) → (200,434)。换算后手腕落点与小人原有
     站姿（168,304）几乎重合，说明两套人形比例本来就接近。
   ========================================================================= */
const VS = 1.367;
const VMX = 200 - 120 * VS;          // v3 x=120 → 本页 x=200
const VGY = 434;                     // v3 地面 y=266 → 本页地面 y=434
const vx = x => VMX + x * VS;
const vy = y => VGY - (266 - y) * VS;

/* v3 侧的人体标尺 */
const VB = { shoulder: 20, torso: 58, upperArm: 32, foreArm: 28 };
const VFOLD_K = 0.62;
const RAD = Math.PI / 180;
const VSH0L = [100, 110], VSH0R = [140, 110];   // 静止站姿下的左右肩：极坐标参考原点
const R_MIN = 28, R_MAX = 56;

/* 腕位以「相对各自肩的极坐标 (r,θ°)」存储，而不是绝对坐标。
   理由：绝对坐标下，手从「低于肩」抬到「高于肩」时，两点之间的直线插值必然
   穿过肩点，|腕−肩|→0 ⇒ 两骨 IK 在 d→|l₁−l₂| 处退化 ⇒ 肘整体翻折。
   极坐标下 r 被夹在 [28,56] < 臂长(60)，插值只改 θ —— 手绕肩划弧。 */
function pol(origin, p) {
  const dx = p[0] - origin[0], dy = p[1] - origin[1];
  let r = Math.hypot(dx, dy) || 1e-6;
  r = Math.min(R_MAX, Math.max(R_MIN, r));
  return [r, Math.atan2(dx, dy) / RAD];
}
const polar2 = (sh, p) => [sh[0] + Math.sin(p[1] * RAD) * p[0], sh[1] + Math.cos(p[1] * RAD) * p[0]];
function P(wl, wr, fl, fr, rx, ry, lean, fold, ho) {
  return { wrists: [pol(VSH0L, wl), pol(VSH0R, wr)], feet: [fl, fr], root: [rx, ry],
           lean: lean || 0, fold: fold || 0, headOff: ho || 0 };
}
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const clamp01 = k => Math.min(1, Math.max(0, k));
const mixP = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];

function lerpP(a, b, k) {
  const L = (p, q) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
  return { wrists: [L(a.wrists[0], b.wrists[0]), L(a.wrists[1], b.wrists[1])],
           feet: [L(a.feet[0], b.feet[0]), L(a.feet[1], b.feet[1])],
           root: L(a.root, b.root), lean: lerp(a.lean, b.lean, k),
           fold: lerp(a.fold, b.fold, k), headOff: lerp(a.headOff, b.headOff, k) };
}
function kfAt(frames, u) {
  if (u <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (u <= frames[i][0]) {
      const a = frames[i - 1], b = frames[i];
      return lerpP(a[1], b[1], ease((u - a[0]) / Math.max(1e-6, b[0] - a[0])));
    }
  }
  return frames[frames.length - 1][1];
}
/* 极坐标腕 → 绝对坐标（要先算出该姿态下真实的肩点） */
function wristsAbs(st) {
  const up = [Math.sin(st.lean), -Math.cos(st.lean)], u = [Math.cos(st.lean), Math.sin(st.lean)];
  const torsoLen = VB.torso * (1 - VFOLD_K * st.fold);
  const chest = add(st.root, up, torsoLen);
  const shL = add(chest, u, -VB.shoulder), shR = add(chest, u, VB.shoulder);
  return [polar2(shL, st.wrists[0]), polar2(shR, st.wrists[1])];
}

/* 每式统一以「抱球」位起、以「抱球」位收 ⇒ 势与势首尾同姿，切换不跳。 */
const NEUTRAL = P([100, 166], [140, 166], [108, 266], [132, 266], 120, 168);
const BALL0   = P([102, 148], [138, 148], [108, 266], [132, 266], 120, 168);

const MOVES = [
  { id: 'pre', name: '起势', hint: '两脚并拢，两手自然垂落；松开肩，把呼吸放慢。', dur: 3.0, kf: [
      [0.00, NEUTRAL],
      [0.50, P([100, 154], [140, 154], [108, 266], [132, 266], 120, 168)],
      [1.00, BALL0] ] },

  { id: 'tuotian', name: '两手托天理三焦', hint: '两手交叉上托，掌心向上；托到顶时停一下，再慢慢落下。', dur: 6.5, kf: [
      [0.00, BALL0],
      [0.16, P([80, 134], [160, 134], [108, 266], [132, 266], 120, 168)],
      [0.34, P([60, 100], [180, 100], [108, 262], [132, 262], 120, 168)],
      [0.50, P([82, 64], [158, 64], [108, 258], [132, 258], 120, 168)],
      [0.58, P([98, 56], [142, 56], [108, 258], [132, 258], 120, 168)],
      [0.70, P([82, 66], [158, 66], [108, 262], [132, 262], 120, 168)],
      [0.86, P([78, 132], [162, 132], [108, 266], [132, 266], 120, 168)],
      [1.00, BALL0] ] },

  { id: 'kaigong', name: '左右开弓似射雕', hint: '一手平举向侧、一手屈肘如拉弓；眼神跟着开弓的手走。', dur: 8.0, tags: ['step'], kf: [
      [0.00, BALL0],
      [0.10, P([96, 150], [144, 150], [108, 266], [132, 266], 120, 168)],
      [0.14, P([95, 150], [145, 150], [108, 258], [132, 258], 120, 170)],
      [0.19, P([94, 150], [146, 150], [86, 258], [154, 258], 120, 174)],
      [0.23, P([93, 150], [147, 150], [86, 266], [154, 266], 120, 176)],
      [0.34, P([46, 118], [120, 146], [86, 266], [154, 266], 120, 176)],
      [0.46, P([92, 150], [148, 150], [86, 266], [154, 266], 120, 176)],
      [0.58, P([120, 146], [194, 118], [86, 266], [154, 266], 120, 176)],
      [0.70, P([92, 150], [148, 150], [86, 266], [154, 266], 120, 176)],
      [0.76, P([93, 150], [147, 150], [86, 266], [154, 266], 120, 175)],
      [0.80, P([94, 150], [146, 150], [86, 258], [154, 258], 120, 173)],
      [0.85, P([95, 150], [145, 150], [108, 258], [132, 258], 120, 170)],
      [0.90, P([96, 152], [144, 152], [108, 266], [132, 266], 120, 169)],
      [1.00, BALL0] ] },

  { id: 'danju', name: '调理脾胃须单举', hint: '一手向上举、一手向下按；上举不过头，下按到腰侧。', dur: 7.0, kf: [
      [0.00, BALL0],
      [0.12, P([88, 154], [146, 152], [108, 266], [132, 266], 120, 168)],
      [0.22, P([72, 126], [148, 158], [108, 266], [132, 266], 120, 168)],
      [0.32, P([94, 62], [150, 166], [108, 266], [132, 266], 120, 168)],
      [0.44, P([74, 124], [166, 124], [108, 266], [132, 266], 120, 168)],
      [0.56, P([84, 150], [176, 92], [108, 266], [132, 266], 120, 168)],
      [0.68, P([98, 152], [152, 62], [108, 266], [132, 266], 120, 168)],
      [0.80, P([100, 150], [166, 88], [108, 266], [132, 266], 120, 168)],
      [0.90, P([101, 148], [144, 118], [108, 266], [132, 266], 120, 168)],
      [1.00, BALL0] ] },

  { id: 'houqiao', name: '五劳七伤往后瞧', hint: '身体不动，只把头慢慢转向一侧，再转向另一侧。', dur: 6.0, kf: [
      [0.00, BALL0],
      [0.20, P([92, 156], [148, 156], [108, 266], [132, 266], 120, 168, 0, 0, -4.5)],
      [0.32, P([84, 166], [156, 166], [108, 266], [132, 266], 120, 168, 0, 0, -4.5)],
      [0.44, P([88, 168], [152, 168], [108, 266], [132, 266], 120, 168, 0, 0, 0)],
      [0.56, P([84, 166], [156, 166], [108, 266], [132, 266], 120, 168, 0, 0, 4.5)],
      [0.68, P([90, 158], [150, 158], [108, 266], [132, 266], 120, 168, 0, 0, 4.5)],
      [0.80, P([96, 152], [144, 152], [108, 266], [132, 266], 120, 168, 0, 0, 2.0)],
      [1.00, BALL0] ] },

  { id: 'yaotou', name: '摇头摆尾去心火', hint: '马步站稳，俯身左右摆动；头随身走，不要憋气。', dur: 8.0, tags: ['step'], kf: [
      [0.00, BALL0],
      [0.08, P([96, 150], [144, 150], [108, 258], [132, 258], 120, 172, 0, 0.10, 0)],
      [0.14, P([94, 150], [146, 150], [86, 258], [154, 258], 120, 176, 0, 0.30, 0)],
      [0.20, P([92, 152], [148, 152], [86, 266], [154, 266], 120, 178, 0, 0.35, 0)],
      [0.34, P([74, 156], [142, 156], [86, 266], [154, 266], 108, 178, -0.12, 0.35, 0)],
      [0.50, P([92, 152], [148, 152], [86, 266], [154, 266], 120, 178, 0, 0.35, 0)],
      [0.66, P([98, 156], [166, 156], [86, 266], [154, 266], 132, 178, 0.12, 0.35, 0)],
      [0.78, P([92, 152], [148, 152], [86, 266], [154, 266], 120, 178, 0, 0.35, 0)],
      [0.84, P([94, 150], [146, 150], [86, 258], [154, 258], 120, 175, 0, 0.20, 0)],
      [0.90, P([96, 150], [144, 150], [108, 258], [132, 258], 120, 172, 0, 0.10, 0)],
      [0.96, P([98, 148], [142, 148], [108, 266], [132, 266], 120, 169, 0, 0.02, 0)],
      [1.00, BALL0] ] },

  { id: 'panzu', name: '两手攀足固肾腰', hint: '俯身向下，两手沿腿后够向脚；量力而行，不要猛拉。', dur: 6.5, kf: [
      [0.00, BALL0],
      [0.14, P([96, 168], [144, 168], [108, 266], [132, 266], 120, 168, 0, 0.35, 0)],
      [0.30, P([98, 196], [142, 196], [108, 266], [132, 266], 120, 168, 0, 1.00, 0)],
      [0.46, P([104, 193], [136, 193], [108, 266], [132, 266], 120, 168, 0, 0.95, 0)],
      [0.62, P([100, 186], [140, 186], [108, 266], [132, 266], 120, 168, 0, 0.60, 0)],
      [0.78, P([102, 166], [138, 166], [108, 266], [132, 266], 120, 168, 0, 0.28, 0)],
      [1.00, BALL0] ] },

  { id: 'zuanquan', name: '攒拳怒目增气力', hint: '马步站稳，一拳缓缓向前推出，再收回。', dur: 7.0, tags: ['step'], kf: [
      [0.00, BALL0],
      [0.10, P([96, 150], [144, 150], [108, 258], [132, 258], 120, 172, 0, 0, 0)],
      [0.16, P([94, 150], [146, 150], [86, 258], [154, 258], 120, 176, 0, 0, 0)],
      [0.22, P([92, 158], [148, 158], [86, 266], [154, 266], 120, 176, 0, 0, 0)],
      [0.34, P([70, 146], [148, 158], [86, 266], [154, 266], 120, 176, 0, 0, 0)],
      [0.46, P([92, 158], [148, 158], [86, 266], [154, 266], 120, 176, 0, 0, 0)],
      [0.58, P([92, 158], [170, 146], [86, 266], [154, 266], 120, 176, 0, 0, 0)],
      [0.70, P([92, 158], [148, 158], [86, 266], [154, 266], 120, 176, 0, 0, 0)],
      [0.76, P([94, 150], [146, 150], [86, 258], [154, 258], 120, 174, 0, 0, 0)],
      [0.82, P([96, 150], [144, 150], [108, 258], [132, 258], 120, 171, 0, 0, 0)],
      [0.90, P([98, 148], [142, 148], [108, 266], [132, 266], 120, 169, 0, 0, 0)],
      [1.00, BALL0] ] },

  { id: 'qidian', name: '背后七颠百病消', hint: '两脚并拢，脚跟提起再落下，连做 7 次；轻一点，别用蛮力。', dur: 5.0, f: u => {
      const env = ease(clamp01(u / 0.14)) * ease(clamp01((1 - u) / 0.14));
      /* 颠动包络不能再乘到 root/feet 上：包络先饱和、颠动后启动，中间会出现一段
         「全关节静止」的假卡帧。改为一者用包络、一者用纯正弦。 */
      const b = Math.abs(Math.sin(7 * Math.PI * u));
      return { wrists: [mixP(BALL0.wrists[0], pol(VSH0L, [98, 166]), env),
                        mixP(BALL0.wrists[1], pol(VSH0R, [142, 166]), env)],
               feet: [[108, 266 - 5 * b], [132, 266 - 5 * b]],
               root: [120, 168 - 5 * b], lean: 0, fold: 0, headOff: 0 };
    } },

  { id: 'post', name: '收势', hint: '两手慢慢落回体侧，收势；站一会儿，再睁开眼睛。', dur: 3.0, kf: [
      [0.00, BALL0],
      [0.40, P([104, 146], [136, 146], [108, 266], [132, 266], 120, 168)],
      [0.70, P([100, 160], [140, 160], [108, 266], [132, 266], 120, 168)],
      [1.00, NEUTRAL] ] },
];

const SEG = []; let _acc = 0;
MOVES.forEach((m, i) => { SEG.push({ idx: i, id: m.id, name: m.name, dur: m.dur, t0: _acc });
  _acc += m.dur; });
const moveStateV3 = (idx, u) => (MOVES[idx].f ? MOVES[idx].f(u) : kfAt(MOVES[idx].kf, u));

/* 把 v3 姿态换算成本页小人用的姿态 */
function roomPose(idx, u) {
  const st = moveStateV3(idx, u);
  const w = wristsAbs(st);
  return {
    px: vx(st.root[0]), py: vy(st.root[1]),
    hL: [vx(w[0][0]), vy(w[0][1])], hR: [vx(w[1][0]), vy(w[1][1])],
    feet: [[vx(st.feet[0][0]), vy(st.feet[0][1])], [vx(st.feet[1][0]), vy(st.feet[1][1])]],
    lean: st.lean, fold: st.fold, headOff: st.headOff * VS,
  };
}

/* ============================================================================
   二、小人绘制（沿用原房间里的造型：白色练功服、腰带、发髻、飘带）
   ========================================================================= */
const TJ={UA:43.7,FA:38.3};   // 臂长 82 = (VB.upperArm+VB.foreArm)×VS = 60×1.367：必须与姿势数据同尺度。旧值 50/48（=98）比手离肩的距离(50~77)长一大截，肘会被永久折死（“胳膊奇怪”的根因）。
const tjLerp=lerp, tjEase=ease;
const tjAdd=add, tjP=p=>p[0].toFixed(1)+' '+p[1].toFixed(1), tjMixPt=mixP;
const tjClamp=(v,a,b)=>v<a?a:v>b?b:v;

/* 两段式手臂 IK。
   平面里「与臂轴 a→b 垂直的单位向量」只有两个、且互为反向（相差 180°），
   所以任何「在两条垂线里挑一条」的固定规则，都必然在某个臂轴方向上发生 180° 翻折
   （八段锦里托天、开弓都会把手臂抬到那个区域）。
   这里改成**沿动作连续取支**：记住上一帧选的支，选离上一帧肘位更近的那支 ——
   它是时间的连续函数，结构上不可能翻折。每式开头按「肘向外」播种。 */
function tjIK(s,h,side,mem){
  const dx=h[0]-s[0],dy=h[1]-s[1],d0=Math.hypot(dx,dy)||1;
  const d=Math.min(Math.max(d0,Math.abs(TJ.UA-TJ.FA)+.5),TJ.UA+TJ.FA-.5);
  const ux=dx/d0,uy=dy/d0;
  const c=Math.acos(tjClamp((TJ.UA*TJ.UA+d*d-TJ.FA*TJ.FA)/(2*TJ.UA*d),-1,1)),a=Math.atan2(uy,ux);
  const e1=[s[0]+TJ.UA*Math.cos(a+c),s[1]+TJ.UA*Math.sin(a+c)];
  const e2=[s[0]+TJ.UA*Math.cos(a-c),s[1]+TJ.UA*Math.sin(a-c)];
  if(!mem.e){
    mem.e=(side<0)?(e1[0]<e2[0]?e1:e2):(e1[0]>e2[0]?e1:e2);   // 播种：肘朝身体外侧
  }else{
    const p=mem.e,d1=(e1[0]-p[0])*(e1[0]-p[0])+(e1[1]-p[1])*(e1[1]-p[1]),
                d2=(e2[0]-p[0])*(e2[0]-p[0])+(e2[1]-p[1])*(e2[1]-p[1]);
    mem.e=d1<=d2?e1:e2;
  }
  return {e:mem.e,h:[s[0]+ux*d,s[1]+uy*d]};
}
/* 腰带飘带：简易 Verlet 链 */
function tjChain(c,anchor,len,wind){c[0].p=anchor;
 for(let i=1;i<c.length;i++){const q=c[i];if(!q.p){q.p=[anchor[0],anchor[1]+i*len];q.o=[...q.p]}const vx2=(q.p[0]-q.o[0])*.9,vy2=(q.p[1]-q.o[1])*.9;q.o=[...q.p];q.p=[q.p[0]+vx2+wind,q.p[1]+vy2+.45]}
 for(let k=0;k<3;k++)for(let i=1;i<c.length;i++){const a=c[i-1].p,b=c[i].p,dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,f=(d-len)/d;if(i>1){a[0]+=dx*f/2;a[1]+=dy*f/2;b[0]-=dx*f/2;b[1]-=dy*f/2}else{b[0]-=dx*f;b[1]-=dy*f}}
 return'M'+c.map(q=>tjP(q.p)).join('L')}
const TJ_DEFS=`<svg class="tj-defs" width="0" height="0" aria-hidden="true"><defs><radialGradient id="tj-shadow"><stop offset="0" stop-color="#05080B" stop-opacity=".75"/><stop offset="1" stop-color="#05080B" stop-opacity="0"/></radialGradient><linearGradient id="tj-robe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3F6F9"/><stop offset=".55" stop-color="#D5E0E8"/><stop offset="1" stop-color="#93A7B7"/></linearGradient><radialGradient id="tj-skin" cx=".4" cy=".35"><stop offset="0" stop-color="#EFE6DC"/><stop offset="1" stop-color="#C8B8A8"/></radialGradient><filter id="tj-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>`;
const TJ_ARM='<path class="limb" stroke="#7D92A3" stroke-width="16"/><path class="limb" stroke="#E3EAEF" stroke-width="14"/><path fill="#E6EDF1" stroke="#7D92A3" stroke-width=".8"/><path class="limb" stroke="#7D92A3" stroke-width="16.5"/><path class="limb" stroke="#EEF2F5" stroke-width="14.5"/><path class="limb" stroke="#9FB2C1" stroke-width="2.2"/><ellipse rx="5" ry="7.5" cy="1.5" fill="url(#tj-skin)" stroke="#A8978A" stroke-width=".6"/>';
const TJ_BODY=`<svg viewBox="-100 150 600 300" aria-hidden="true"><ellipse data-p="shadow" cy="438" rx="62" ry="7" fill="url(#tj-shadow)"/><path data-p="legL0" class="limb" stroke="#7D92A3" stroke-width="21"/><path data-p="legL" class="limb" stroke="#C9D6E0" stroke-width="19"/><path data-p="legR0" class="limb" stroke="#7D92A3" stroke-width="21"/><path data-p="legR" class="limb" stroke="#C9D6E0" stroke-width="19"/><ellipse data-p="shoeL" rx="12" ry="4.6" fill="#1C252D"/><ellipse data-p="shoeR" rx="12" ry="4.6" fill="#1C252D"/><path data-p="jacket" fill="url(#tj-robe)" stroke="#7D92A3" stroke-width="1"/><path data-p="placket" fill="none" stroke="#3E5262" stroke-opacity=".35" stroke-width="1"/><path data-p="buttons" fill="none" stroke="#4E6475" stroke-width="1.6" stroke-linecap="round"/><path data-p="sash" class="limb" stroke="#3E5262" stroke-width="7"/><g fill="none" stroke="#5D7182" stroke-linecap="round" stroke-linejoin="round"><path data-p="rb0" stroke-width="3.2"/><path data-p="rb1" stroke-width="2.6"/></g><circle data-p="knot" r="4" fill="#3E5262"/><path data-p="neck" class="limb" stroke="#D3C5B7" stroke-width="9"/><g data-p="head"><ellipse rx="14" ry="16.5" fill="url(#tj-skin)"/><path d="M-14.6 0C-16-21 16-21 14.6 0C11-9-11-9-14.6 0Z" fill="#1A232B"/><circle cy="-20" r="7.5" fill="#1A232B"/><path d="M-12-25L12-16" stroke="#AFC1CF" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="-16" r="1.8" fill="#DCE6EE"/><g data-p="face" fill="none" stroke="#3A3330" stroke-width="1" stroke-linecap="round" opacity=".7"><path d="M-8 2q3 2 6 0M2 2q3 2 6 0"/><path d="M-1.5 10q1.5 .8 3 0" opacity=".6"/></g></g><g data-p="armL"></g><g data-p="armR"></g><g data-p="trails" fill="none" stroke="#D6E4EE" stroke-linecap="round" filter="url(#tj-glow)"></g></svg>`;

/* 每个 SVG 一个实例（房间本体与地面倒影各一份），返回逐帧绘制函数。
   render(pose, step)：pose 由调用方按当前势号 + 进度算好，两个实例共用，
   保证倒影与本体严丝合缝。 */
function tjFigure(svg){
 const el={};svg.querySelectorAll('[data-p]').forEach(e=>{el[e.dataset.p]=e});
 const arms=['armL','armR'].map(n=>{el[n].innerHTML=TJ_ARM;return[...el[n].children]});
 const trailEls=[0,1].map(()=>Array.from({length:5},(_,k)=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('stroke-width',1+k*.5);p.setAttribute('stroke-opacity',((k+1)/5*.55).toFixed(2));el.trails.append(p);return p}));
 const trails=[[],[]],chains=[7,5].map(n=>Array.from({length:n},()=>({p:null,o:null})));
 const mem=[{e:null},{e:null}];                 // 左右臂各记一支：IK 取支的连续性状态
 let sx=200,sv=0,yaw=0;
 const render=function(q,step){
  const mid=(q.feet[0][0]+q.feet[1][0])/2;
  const lean=(q.px-mid)*.006+q.lean;
  const up=[Math.sin(lean),-Math.cos(lean)],dn=[-up[0],-up[1]],u=[Math.cos(lean),Math.sin(lean)];
  const P=[q.px,q.py];
  /* 前俯：正面视角下表达为躯干压缩 + 头肩下沉（前冲分量在投影里没有位移） */
  const torsoH=88*(1-VFOLD_K*q.fold), headGap=25*(1-0.30*q.fold);
  const N=tjAdd(P,up,torsoH),H=tjAdd(N,up,headGap);
  const pt=(b,a,c)=>[b[0]+u[0]*a+dn[0]*c,b[1]+u[1]*a+dn[1]*c];
  if(step){sv=(sv+(q.px-sx)*.05)*.84;sx+=sv}else{sv*=.9}
  yaw=yaw+(q.headOff-yaw)*.18;
  const hx=[tjClamp((sx-q.px)*1.4,-9,9)+yaw,0];

  [-1,1].forEach((s,i)=>{const hip=pt(P,s*12,0),f=q.feet[i],a=[f[0],f[1]-4],
   d=Math.hypot(a[0]-hip[0],a[1]-hip[1]),b=Math.sqrt(Math.max(0,142*142-d*d))*.22,
   k=[(hip[0]+a[0])/2+s*b,(hip[1]+a[1])/2],dd=`M${tjP(hip)}L${tjP(k)}L${tjP(a)}`,id=i?'R':'L';
   el['leg'+id+'0'].setAttribute('d',dd);el['leg'+id].setAttribute('d',dd);
   el['shoe'+id].setAttribute('cx',f[0]+s*3);el['shoe'+id].setAttribute('cy',f[1])});

  const NL=pt(N,-8,0),NR=pt(N,8,0),SLo=pt(N,-29,9),SRo=pt(N,29,9),
        ApL=pt(N,-25,36),ApR=pt(N,25,36),WL=pt(P,-21,-14),WR=pt(P,21,-14),
        HL=tjAdd(pt(P,-33,40),hx),HR=tjAdd(pt(P,33,40),hx),HC=tjAdd(pt(P,0,50),hx),NC=pt(N,0,7);
  el.jacket.setAttribute('d',`M${tjP(NL)}L${tjP(SLo)}L${tjP(ApL)}Q${tjP(WL)} ${tjP(HL)}Q${tjP(HC)} ${tjP(HR)}Q${tjP(WR)} ${tjP(ApR)}L${tjP(SRo)}L${tjP(NR)}Q${tjP(NC)} ${tjP(NL)}Z`);
  el.placket.setAttribute('d',`M${tjP(NC)}L${tjP(tjAdd(pt(P,0,44),hx,.8))}`);
  el.buttons.setAttribute('d',[.2,.4,.6,.8].map(f=>{const c=[tjLerp(NC[0],P[0]+up[0]*16,f),tjLerp(NC[1],P[1]+up[1]*16,f)];return`M${tjP(tjAdd(c,u,-4.5))}L${tjP(tjAdd(c,u,4.5))}`}).join(''));
  el.sash.setAttribute('d',`M${tjP(pt(P,-21,-12))}L${tjP(pt(P,21,-12))}`);
  const knot=pt(P,12,-11);el.knot.setAttribute('cx',knot[0]);el.knot.setAttribute('cy',knot[1]);
  if(step){el.rb0.setAttribute('d',tjChain(chains[0],knot,7,-sv*.35));el.rb1.setAttribute('d',tjChain(chains[1],tjAdd(knot,u,3),7,-sv*.25))}
  el.neck.setAttribute('d',`M${tjP(pt(N,0,2))}L${tjP(tjAdd(N,up,12))}`);

  const w=1/(1+Math.exp((q.hL[1]-q.hR[1])/12)),
        look=tjClamp((w*q.hL[0]+(1-w)*q.hR[0]-q.px)*.06,-4,4);
  el.head.setAttribute('transform',`translate(${tjP(H)}) rotate(${(lean*180/Math.PI*1.6+look*.8).toFixed(2)})`);
  el.face.setAttribute('transform',`translate(${look.toFixed(2)} 0)`);

  [[pt(N,-24,10),q.hL,-1,0],[pt(N,24,10),q.hR,1,1]].forEach(([S,target,side,mi])=>{
   const{e:Eb,h}=tjIK(S,target,side,mem[mi]),Wr=tjMixPt(Eb,h,.86),ang=Math.atan2(h[1]-Eb[1],h[0]-Eb[0]);
   let n=[-Math.sin(ang),Math.cos(ang)];if(n[1]<0)n=[-n[0],-n[1]];
   const md=tjMixPt(Eb,Wr,.5),c=arms[mi],a1=`M${tjP(S)}L${tjP(Eb)}`,a2=`M${tjP(Eb)}L${tjP(Wr)}`,
         cuff=[Math.cos(ang+Math.PI/2),Math.sin(ang+Math.PI/2)];
   c[0].setAttribute('d',a1);c[1].setAttribute('d',a1);
   c[2].setAttribute('d',`M${tjP(tjAdd(Eb,n,5))}Q${tjP(tjAdd(md,n,14))} ${tjP(tjAdd(Wr,n,11))}L${tjP(tjAdd(Wr,n,3))}Z`);
   c[3].setAttribute('d',a2);c[4].setAttribute('d',a2);
   c[5].setAttribute('d',`M${tjP(tjAdd(Wr,cuff,-7.5))}L${tjP(tjAdd(Wr,cuff,7.5))}`);
   c[6].setAttribute('transform',`translate(${tjP(h)}) rotate(${(ang*180/Math.PI-90).toFixed(1)})`);
   if(step){trails[mi].push(h);if(trails[mi].length>44)trails[mi].shift()}
   const tr=trails[mi],m=tr.length;trailEls[mi].forEach((p,k)=>{const s=tr.slice(Math.floor(k*m/5),Math.floor((k+1)*m/5)+1);p.setAttribute('d',s.length>1?'M'+s.map(tjP).join('L'):'')})});
  el.shadow.setAttribute('cx',q.px.toFixed(1))};
 /* 切式时清空拖影：否则上一式的轨迹会横着拉一条线穿过新姿势。 */
 render.clear=()=>{trails[0].length=0;trails[1].length=0;
  trailEls.forEach(a=>a.forEach(p=>p.setAttribute('d','')))};
 return render;
}

const FLOOR_DISK=`<svg viewBox="-60 -60 120 120" aria-hidden="true"><circle r="56" fill="none" stroke="rgba(226,236,244,.55)" stroke-dasharray="14 6"/><circle r="48" fill="none" stroke="rgba(226,236,244,.75)"/><path d="M0-48A48 48 0 0 1 0 48A24 24 0 0 1 0 0A24 24 0 0 0 0-48Z" fill="rgba(226,236,244,.32)"/><circle cy="-24" r="6" fill="rgba(226,236,244,.32)"/><circle cy="24" r="6" fill="none" stroke="rgba(226,236,244,.6)"/></svg>`;
function room3d(mirror){return `<div class="room3d"><div class="wall wall-left">${roomBands()}</div><div class="wall wall-back">${roomBands()}</div><div class="wall wall-right">${roomBands()}</div>${mirror?'':`<div class="floor-disk">${FLOOR_DISK}</div>`}<div class="taiji">${TJ_BODY}</div>${roomNotes()}</div>`}
function roomHTML(){return `<div class="room-stage" role="img" aria-label="灰蓝色的立体房间：一个身穿白色练功服的小人在房间中央演示八段锦，一次演示一势，地面映出倒影，房间里飘着音符，墙上流动着关于五音的短句"><div class="room-scene" aria-hidden="true">${TJ_DEFS}<div class="camera"><div class="room-photo"></div><div class="room-tint"></div><div class="room-tone"></div><div class="layer reflect">${room3d(true)}</div><div class="layer">${room3d(false)}</div><div class="room-vignette"></div></div></div></div>`}

/* ============================================================================
   三、陪练教练：教练示范 → 用户跟练 → 等完成 → 自动进下一步
   ----------------------------------------------------------------------------
   核心是一个**纯函数状态机**（时间由外部 rAF 注入，内部不开定时器、不读时钟），
   每个阶段的等待都有**硬上界** ⇒ 结构上不可能「一直停在同一个动作上循环等待」。

   状态图（每一式都完整走一遍）：
     idle ──start()──→ demo ──demoMs──→ follow ──followMs──→ grace
                                        ├─ hit()  ───────────────→ stepDone
                                        └─ redemoOnce() → demo（≤ maxRedemo 次）
     grace ─┬─ hit() ────────→ stepDone
            ├─ extendOnce() → follow（≤ maxExtend 次）
            └─ graceMs ─────→ advance('timeout')     ← 兜底放行，绝不停死
     stepDone ──doneMs──→ advance ──→ 下一式 begin()／全部完成 allDone

   两档模式（URL 可覆盖）：
     ?mode=full（默认，完整引导）  教练逐式示范 + 等用户完成
     ?mode=free                  原来的自由浏览（上一个 / 播放 / 下一个 / 重放 / 连播）
   ========================================================================= */

/* ---- 3.0 模式与档位（URL query 覆盖，便于端到端把节奏压到几秒） ---- */
const CP = (() => {
  /* search 与 hash 里都可能带参数，且两者之间没有天然分隔符（`#` 不是 URLSearchParams 的分隔符），
     直接拼接会让 `?mode=free#debug` 把 mode 解析成 "free#debug"。
     先把 `?` / `#` 一律换成 `&`，再交给 URLSearchParams。 */
  const raw = [location.search, location.hash].join('&').replace(/^[?#]/, '').replace(/[?#]/g, '&');
  const q = new URLSearchParams(raw);
  const num = (k, d) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : d; };
  return {
    mode: q.get('mode') === 'free' ? 'free' : 'full',
    demoK: num('coachDemoK', 1.0),        // 示范时长 = 动作时长 × 该系数
    followK: num('coachFollowK', 0.9),    // 跟练时长 = 动作时长 × 该系数
    minDemoMs: num('coachMinDemo', 2200),
    minFollowMs: num('coachMinFollow', 2600),
    maxFollowMs: num('coachMaxFollow', 8000),
    graceMs: num('coachGrace', 4000),     // 跟练窗口走完后再等这么久就放行
    doneMs: num('coachDone', 800),        // 「本式完成」停留
    maxRedemo: num('coachRedemo', 1),     // 「再看一遍示范」额度（每式）
    maxExtend: num('coachExtend', 1),     // 「再练一会」额度（每式）
  };
})();

/* ---- 3.1 状态机（纯函数：只进 dt，内部不碰时钟） ---- */
function coachCreate(durs, P) {
  const N = durs.length;
  let i = 0, phase = 'idle', t = 0, redemo = 0, extend = 0, reason = '';
  const demoMs = k => Math.max(P.minDemoMs, durs[k] * 1000 * P.demoK);
  const followMs = k => Math.min(P.maxFollowMs, Math.max(P.minFollowMs, durs[k] * 1000 * P.followK));

  function begin(k) { i = Math.max(0, Math.min(N - 1, k)); phase = 'demo'; t = 0; redemo = 0; extend = 0; reason = ''; }
  function advance(why) {
    reason = why || '';
    if (i + 1 >= N) { i = N - 1; phase = 'allDone'; t = 0; }
    else begin(i + 1);
  }
  /* dt 超过 50ms 直接丢弃：切回标签页时别把几秒当成一帧补上 */
  function tick(dt) {
    t += Math.max(0, Math.min(dt, 50));
    if (phase === 'demo') { if (t >= demoMs(i)) { phase = 'follow'; t = 0; } }
    else if (phase === 'follow') { if (t >= followMs(i)) { phase = 'grace'; t = 0; } }
    else if (phase === 'grace') { if (t >= P.graceMs) advance('timeout'); }
    else if (phase === 'stepDone') { if (t >= P.doneMs) advance('done'); }
  }
  function hit() {                                   // 用户点「我练好了」
    if (phase === 'follow' && t >= 900) { phase = 'stepDone'; t = 0; reason = 'user'; return true; }
    if (phase === 'grace') { phase = 'stepDone'; t = 0; reason = 'user'; return true; }
    return false;
  }
  function redemoOnce() {                            // 「再看一遍示范」
    if (redemo >= P.maxRedemo) return false;
    if (phase !== 'follow' && phase !== 'grace') return false;
    redemo++; phase = 'demo'; t = 0; return true;
  }
  function extendOnce() {                            // 「再练一会」
    if (extend >= P.maxExtend || phase !== 'grace') return false;
    extend++; phase = 'follow'; t = 0; return true;
  }
  function skip() { if (phase !== 'allDone' && phase !== 'idle') advance('skip'); }
  function start() { if (phase === 'idle' || phase === 'allDone') begin(0); }
  function restart() { begin(0); }

  return {
    get i() { return i; }, get phase() { return phase; }, get t() { return t; },
    get redemo() { return redemo; }, get extend() { return extend; }, get reason() { return reason; },
    total: N, demoMs: () => demoMs(i), followMs: () => followMs(i),
    demoT: () => phase === 'demo' ? Math.min(1, t / demoMs(i)) : (phase === 'idle' ? 0 : 1),
    tick, hit, redemoOnce, extendOnce, skip, start, restart, begin,
  };
}
const coach = coachCreate(MOVES.map(m => m.dur), CP);

/* ---- 3.2 渲染状态：cur.idx / cur.u 由 coach 推导 ---- */
const cur = { idx: 0, u: 0, playing: false, auto: false };
let figs = [];
let breath = 0;
const BREATH_PERIOD = 3.6;   // 秒/一次呼吸

function basePose() {
  const ph = coach.phase;
  /* 只在引导模式下由状态机推导 cur；自由浏览时 cur 归用户控制，绝不能每帧覆写回去 */
  if (CP.mode === 'full') {
    cur.idx = coach.i;
    cur.u = ph === 'demo' ? coach.demoT() : (ph === 'idle' ? 0 : 1);
  }
  const p = roomPose(cur.idx, cur.u);
  /* 示范之外的阶段（等用户、完成、就绪）让小人保留一点呼吸起伏，避免看起来像卡住的静帧 */
  if (CP.mode === 'full' && (ph === 'follow' || ph === 'grace' || ph === 'idle' || ph === 'allDone')) {
    const br = Math.sin(breath * (2 * Math.PI / BREATH_PERIOD));
    p.py -= br * 2.2;
    p.hL = [p.hL[0], p.hL[1] + br * 1.8];
    p.hR = [p.hR[0], p.hR[1] + br * 1.8];
  }
  return p;
}
function renderFrame(step) { const p = basePose(); figs.forEach(f => f(p, step)); }
const paint = renderFrame;      // 调试钩子/单测用同一个入口
function clearTrails() { figs.forEach(f => f.clear && f.clear()); }

/* ---- 3.3 教练 UI ---- */
const coachHTML = `<div class="coach" data-phase="idle" role="group" aria-label="八段锦陪练教练">
 <div class="coach-top">
  <span class="coach-step">第 <b>1</b> 式 / 共 ${MOVES.length} 式</span>
  <span class="coach-name"></span>
  <span class="coach-chip"></span>
 </div>
 <p class="coach-tip"></p>
 <div class="coach-bar"><i></i></div>
 <div class="coach-btns">
  <button type="button" data-cact="start" class="primary">开始跟练</button>
  <button type="button" data-cact="done" class="primary">我练好了</button>
  <button type="button" data-cact="redemo">再看一遍示范</button>
  <button type="button" data-cact="extend">再练一会</button>
  <button type="button" data-cact="skip">跳过本式</button>
  <button type="button" data-cact="restart" class="primary">重头再来</button>
  <button type="button" data-cact="free" class="ghost">切到自由浏览</button>
 </div>
 <p class="coach-note">教练先把这一式示范一遍；示范结束后轮到你跟着做。做完点「我练好了」就进入下一式；即使一直不点，等待也有上限，到点会自动继续，不会停在同一式。</p>
</div>`;

/* 自由浏览模式（原「拆动作」控制台），仅在 ?mode=free 下显示 */
const ctlHTML = `<div class="room-ctl" role="group" aria-label="八段锦自由浏览">
 <div class="ctl-top"><span class="ctl-idx">第 <b>1</b> 式 / 共 ${MOVES.length} 式</span><span class="ctl-name"></span></div>
 <p class="ctl-hint"></p>
 <div class="ctl-btns">
  <button type="button" data-act="prev" title="上一式（←）">上一个</button>
  <button type="button" data-act="play" class="primary" title="播放 / 暂停（空格）">播放</button>
  <button type="button" data-act="next" title="下一式（→）">下一个</button>
  <button type="button" data-act="replay" title="重放本式（R）">重放</button>
  <button type="button" data-act="auto" aria-pressed="false" title="放完自动进下一式">连播</button>
  <button type="button" data-act="coach" class="ghost">切到完整引导</button>
 </div>
 <div class="ctl-prog"><i></i></div>
</div>`;

const PILL = { idle: '准备开始', demo: '示范中', follow: '轮到你了', grace: '等你确认', stepDone: '本式完成', allDone: '全部完成' };
const q1 = s => $('.room-ctl ' + s, app);
const q2 = s => $('.coach ' + s, app);

function syncCoachUI() {
  const box = $('.coach', app); if (!box) return;
  const ph = coach.phase, m = MOVES[coach.i];
  box.dataset.phase = ph;
  const put = (s, v) => { const e = q2(s); if (e) e.textContent = v; };
  const sb = q2('.coach-step b'); if (sb) sb.textContent = coach.i + 1;
  put('.coach-name', m.name);
  put('.coach-chip', PILL[ph] || '');
  let tip = '', pct = 0;
  if (ph === 'idle') { tip = '点击「开始跟练」，教练会从起势开始逐式带你做。'; pct = 0; }
  else if (ph === 'demo') {
    tip = `教练正在示范「${m.name}」，先看一遍。${m.hint || ''}`;
    pct = coach.demoT();
  } else if (ph === 'follow') {
    const left = Math.max(0, Math.ceil((coach.followMs() - coach.t) / 1000));
    tip = `现在轮到你 —— 跟着做「${m.name}」。${m.hint || ''}（约 ${left} 秒后进入确认）`;
    pct = Math.min(1, coach.t / coach.followMs());
  } else if (ph === 'grace') {
    const left = Math.max(0, Math.ceil((CP.graceMs - coach.t) / 1000));
    tip = `做完了吗？点「我练好了」进入「${MOVES[Math.min(coach.i + 1, MOVES.length - 1)].name}」；不点的话 ${left} 秒后也会自动继续。`;
    pct = Math.min(1, coach.t / CP.graceMs);
  } else if (ph === 'stepDone') {
    tip = `第 ${coach.i + 1} 式「${m.name}」完成 ✓`;
    pct = 1;
  } else {
    tip = `十式全部完成，做得不错。可以「重头再来」，或切到自由浏览单独复习某一式。`;
    pct = 1;
  }
  put('.coach-tip', tip);
  const pr = q2('.coach-bar i'); if (pr) pr.style.width = (pct * 100).toFixed(1) + '%';
  const dn = $('.coach button[data-cact="done"]', app);
  if (dn) dn.disabled = (ph === 'follow' && coach.t < 900) || (ph !== 'follow' && ph !== 'grace');
  const rd = $('.coach button[data-cact="redemo"]', app);
  if (rd) rd.disabled = coach.redemo >= CP.maxRedemo;
  const ex = $('.coach button[data-cact="extend"]', app);
  if (ex) ex.disabled = coach.extend >= CP.maxExtend;
}

function syncUI() {
  const m = MOVES[cur.idx];
  const b = q1('.ctl-idx b'); if (b) b.textContent = cur.idx + 1;
  const n = q1('.ctl-name'); if (n) n.textContent = m.name;
  const h = q1('.ctl-hint'); if (h) h.textContent = m.hint || '';
  const p = q1('button[data-act="play"]'); if (p) p.textContent = cur.playing ? '暂停' : '播放';
  const a = q1('button[data-act="auto"]'); if (a) a.setAttribute('aria-pressed', String(cur.auto));
  const pr = q1('.ctl-prog i'); if (pr) pr.style.width = (cur.u * 100).toFixed(1) + '%';
}

/* ---- 3.4 自由浏览模式的动作控制 ---- */
function goto(idx, play) {
  cur.idx = ((idx % MOVES.length) + MOVES.length) % MOVES.length;
  cur.u = 0; cur.playing = !!play;
  clearTrails(); paint(false); syncUI();
}
function doPlay() { if (cur.u >= 1) { cur.u = 0; clearTrails(); } cur.playing = true; syncUI(); }
function doPause() { cur.playing = false; syncUI(); }
function doReplay() { cur.u = 0; clearTrails(); syncUI(); }
function stepBy(d) { goto(cur.idx + d, false); }

/* ---- 3.5 主循环：两种模式共用一个 rAF ---- */
let lastPhase = '', lastIdx = -1, last = null;
function engineLoop(now) {
  const dt = last == null ? 0 : Math.min(50, now - last); last = now;
  breath += dt / 1000;

  if (CP.mode === 'full') {
    coach.tick(dt);
    if (coach.phase !== lastPhase || coach.i !== lastIdx) {
      lastPhase = coach.phase; lastIdx = coach.i;
      clearTrails();                       // 换阶段/换式时清拖影，避免上一式轨迹横拉一条线
    }
    renderFrame(true);
    syncCoachUI();
  } else {
    if (cur.playing) {
      cur.u += (dt / 1000) / MOVES[cur.idx].dur;
      if (cur.u >= 1) {
        cur.u = 1;
        if (cur.auto) goto((cur.idx + 1) % MOVES.length, true);
        else { cur.playing = false; syncUI(); }
      }
      renderFrame(true); syncUI();
    } else { renderFrame(false); }
  }
  roomAnim = requestAnimationFrame(engineLoop);
}

function startEngine() {
  figs = [...app.querySelectorAll('.taiji svg')].map(tjFigure);
  if (!figs.length) return;
  /* 就位：full 模式画「就绪」，free 模式画第 1 式起始姿 */
  cur.idx = coach.i; cur.u = 0;
  paint(false);
  CP.mode === 'full' ? syncCoachUI() : syncUI();

  const still = document.body?.classList?.contains('reduce')
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof requestAnimationFrame !== 'function') return;
  roomAnim = requestAnimationFrame(engineLoop);
}

/* ---- 3.6 事件 ---- */
function switchMode(m) {
  const u = new URL(location.href);
  u.hash = ''; u.search = '?mode=' + m;
  location.replace(u.toString());          // 整页重载，两档互不干扰
}

function bindCoach() {
  const box = $('.coach', app); if (!box) return;
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-cact]'); if (!b || b.disabled) return;
    const a = b.dataset.cact;
    if (a === 'start') coach.start();
    else if (a === 'done') coach.hit();
    else if (a === 'redemo') coach.redemoOnce();
    else if (a === 'extend') coach.extendOnce();
    else if (a === 'skip') coach.skip();
    else if (a === 'restart') coach.restart();
    else if (a === 'free') { switchMode('free'); return; }
    lastPhase = ''; syncCoachUI();
    b.blur();
  });
  document.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const ph = coach.phase;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
      if (ph === 'idle' || ph === 'allDone') coach.start();
      else coach.hit();
      lastPhase = ''; syncCoachUI(); e.preventDefault();
    } else if (e.key === 'r' || e.key === 'R') { coach.redemoOnce(); lastPhase = ''; syncCoachUI(); }
    else if (e.key === 's' || e.key === 'S' || e.key === 'Escape') { coach.skip(); lastPhase = ''; syncCoachUI(); }
  });
}

function bindCtl() {
  const box = $('.room-ctl', app); if (!box) return;
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'prev') stepBy(-1);
    else if (a === 'next') stepBy(1);
    else if (a === 'play') cur.playing ? doPause() : doPlay();
    else if (a === 'replay') doReplay();
    else if (a === 'auto') { cur.auto = !cur.auto; syncUI(); }
    else if (a === 'coach') { switchMode('full'); return; }
    b.blur();
  });
  document.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { stepBy(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { stepBy(1); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Spacebar') { cur.playing ? doPause() : doPlay(); e.preventDefault(); }
    else if (e.key === 'r' || e.key === 'R') doReplay();
  });
}

/* 房间按 1000×562 设计，按容器宽度等比缩放（与原实现一致）。 */
function mountRoom() {
  const stage = $('.room-stage', app), scene = $('.room-scene', app);
  if (!stage || !scene) return;
  const fit = () => scene.style.setProperty?.('--room-scale', String((stage.clientWidth || 1000) / 1000));
  fit();
  if (typeof ResizeObserver === 'function') { roomObserver = new ResizeObserver(fit); roomObserver.observe(stage); }
  const cb = $('.coach', app), fb = $('.room-ctl', app);
  if (cb) cb.hidden = CP.mode !== 'full';
  if (fb) fb.hidden = CP.mode !== 'free';
  startEngine();
  bindCoach(); bindCtl();
}

app.innerHTML = `<section class="home" data-mode="${CP.mode}">${roomHTML()}${coachHTML}${ctlHTML}</section>`;
/* 调试钩子：只在 URL 带 debug 时挂出，便于自动化逐式校验，不影响正常使用。 */
if (/debug/.test(location.search + location.hash))
  window.__tj = { cur, MOVES, paint, goto, syncUI, roomPose, coach, CP, syncCoachUI,
                  phase: () => coach.phase, idx: () => coach.i, t: () => coach.t };
mountRoom();
