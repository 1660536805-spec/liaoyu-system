(function () {
  'use strict'

  var router = null
  var root = null
  var app = null
  var roomObserver = null
  var roomAnim = null
  var page = null
  var KEY = 'xianyang.shell.preferences.v1'
  var PATHS = ['/', '/explore', '/culture', '/profile', '/listen']
  // 练后赏听轨：均为已授权的真人古琴录音，与跟练中的合成声音分属两条轨（文档 §3.1 / §5.1）。
  // 无干净音源的曲目不在此列出，不展示不可播放的按钮（文档 §8.2）。
  var LISTEN_TRACKS = [
    { id: 'meihua', title: '梅花三弄', sub: '前半段与尾声', performer: 'RafaelCaro', year: '2013', tone: '综合', dur: '6:28', src: '/guqin/listen/meihua-sannong.mp3', license: 'CC BY 4.0', credit: '“Guqin-song.wav” by RafaelCaro · https://freesound.org/people/RafaelCaro/sounds/176265/ · CC BY 4.0' },
    { id: 'zuiyu', title: '醉渔唱晚', sub: '卫仲乐演奏，中国第一张古琴唱片', performer: '卫仲乐', year: '1934', tone: '徵', dur: '3:04', src: '/guqin/listen/zuiyu-changwan.mp3', license: 'CC0 1.0 · 公共领域', credit: '《醉渔唱晚》卫仲乐演奏，1934 年上海百代唱片 · https://archive.org/details/1484193434571bH · CC0 1.0' },
    { id: 'qixian', title: '七弦散音', sub: '七根空弦依次拨响，五声音阶散音', performer: 'RafaelCaro', year: '2013', tone: '散音', dur: '0:07', src: '/guqin/listen/qixian-sanyin.mp3', license: 'CC BY 4.0', credit: '“Guqin-open-strings.wav” by RafaelCaro · https://freesound.org/people/RafaelCaro/sounds/176266/ · CC BY 4.0' }
  ]
  var preferences = { mode: 'manual', reduceMotion: false }
  var preferenceError = false
  var $ = function (selector, host) { return (host || root).querySelector(selector) }

  // 仅嵌入原型的房间展示函数，不加载其引擎、路由或摄像头代码。
  const ROOM_POEM='清晨的庭院里，<b>宫</b>声沉稳，像脚下的土地；<b>商</b>声清越，掠过肩头；<b>角</b>声舒展，从指尖抽出新枝；<b>徵</b>声温暖，停在掌心；<b>羽</b>声如水，流过一呼一吸。<b>云手</b>缓缓，一开一合，不求整齐，只求<b>此刻</b>。拨一弦，留一刻，让声音陪你守住这段<b>留白</b>。';
function roomBands(){const poem=`<span>${ROOM_POEM}</span>`,tones=`<span>${'宫　商　角　徵　羽　宫高　商高　'.repeat(8)}</span>`;return `<div class="band band-poem"><div class="track">${poem}${poem}</div></div><div class="band band-tones"><div class="track">${tones}${tones}</div></div>`}
// 音符分布在房间体积内（x 60–940、y 175–360、z -60– -820），避开小人所在的位置。
function roomNotes(){let seed=11;const rand=()=>(seed=seed*16807%2147483647)/2147483647,glyphs=['♪','♫','♩','♬','♪','♫','宫','商','角','徵','羽'];return Array.from({length:14},(_,i)=>{const g=glyphs[i%glyphs.length],cjk=i%glyphs.length>5,z=Math.round(-820+rand()*760),y=Math.round(175+rand()*185);let x=Math.round(60+rand()*880);if(x>380&&x<620&&z>-320&&z<-40)x+=x<500?-220:220;return `<span class="note${cjk?' cjk':''}${z>-150?' near':''}" style="left:0;top:0;transform:translate3d(${x}px,${y}px,${z}px)"><i style="font-size:${Math.round((cjk?18:22)+rand()*22)}px;--o:${(.45+rand()*.45).toFixed(2)};--d:${(9+rand()*9).toFixed(1)}s;--delay:${(-rand()*18).toFixed(1)}s;--dx:${Math.round(-22+rand()*44)}px">${g}${cjk?'':'︎'}</i></span>`}).join('')}
// 首页太极小人（来自 taiji-preview.html）：起势 → 云手向右三步 → 云手向左三步回到中间 → 收势，循环 33.5 秒。
// 坐标沿用验收稿的 400×500 画布，房间里用 viewBox -100 150 600 300 留出左右走动空间。
const TJ={UA:50,FA:48,LOOP:33.5,STEP:58,CYCLE:4},TJ_FEET=[[170,434],[230,434]];
const tjLerp=(a,b,k)=>a+(b-a)*k,tjEase=k=>(1-Math.cos(Math.PI*Math.min(1,Math.max(0,k))))/2;
const tjAdd=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k],tjP=p=>p[0].toFixed(1)+' '+p[1].toFixed(1),tjMixPt=(a,b,k)=>[tjLerp(a[0],b[0],k),tjLerp(a[1],b[1],k)];
const tjMix=(a,b,k)=>({px:tjLerp(a.px,b.px,k),py:tjLerp(a.py,b.py,k),hL:tjMixPt(a.hL,b.hL,k),hR:tjMixPt(a.hR,b.hR,k)});
const TJ_REST={px:200,py:294,hL:[168,304],hR:[232,304]},TJ_RAISE={px:200,py:296,hL:[158,228],hR:[242,228]},TJ_PRESS={px:200,py:308,hL:[164,300],hR:[236,300]},TJ_CROSS={px:200,py:302,hL:[214,244],hR:[186,248]};
// 云手 t∈[5,29)：前 12 秒向画面右，后 12 秒向画面左；每圈 4 秒一步，先出前脚、再并后脚。
// 重心落在支撑脚一侧，上手与行进方向一致。
function tjCloud(t){const right=t<17,d=right?1:-1,k=(t-(right?5:17))/TJ.CYCLE,n=Math.floor(k),u=k-n,S=TJ.STEP;
 const base=right?n*S:3*S-n*S,w1=(u-.08)/.34,w2=(u-.58)/.34,lead=base+d*S*tjEase(w1),trail=base+d*S*tjEase(w2),lift=v=>7*Math.sin(Math.PI*Math.min(1,Math.max(0,v)));
 const off=right?[trail,lead]:[lead,trail],up=right?[lift(w2),lift(w1)]:[lift(w1),lift(w2)],th=right?Math.PI-2*Math.PI*u:Math.PI+2*Math.PI*u;
 const px=200+(off[0]+off[1])/2-d*10*Math.sin(2*Math.PI*u);
 return{px,py:308+3*Math.sin(2*th),hL:[px-10+60*Math.cos(th),258-30*Math.sin(th)],hR:[px+10+60*Math.cos(th+Math.PI),258-30*Math.sin(th+Math.PI)],feet:[[170+off[0],434-up[0]],[230+off[1],434-up[1]]]}}
const TJ_END=tjCloud(28.999);
function tjKf(seq,t){for(let i=0;i<seq.length-1;i++){const[a,pa]=seq[i],[b,pb]=seq[i+1];if(t<=b)return tjMix(pa,pb,tjEase((t-a)/(b-a)))}return seq[seq.length-1][1]}
function tjPose(t){if(t<5)return{...tjKf([[0,TJ_REST],[2,TJ_REST],[3.4,TJ_RAISE],[5,TJ_PRESS]],t),feet:TJ_FEET};
 if(t<29){const c=tjCloud(t);return{...tjMix(TJ_PRESS,c,tjEase((t-5)/1.4)),feet:c.feet}}
 return{...tjKf([[29,TJ_END],[30.6,TJ_CROSS],[32.2,TJ_REST],[TJ.LOOP,TJ_REST]],t),feet:TJ_FEET}}
// 两段式手臂 IK，肘部取更低、更外侧的解（沉肩坠肘）
function tjIK(s,h,side){const dx=h[0]-s[0],dy=h[1]-s[1],d0=Math.hypot(dx,dy)||1,d=Math.min(Math.max(d0,8),TJ.UA+TJ.FA-.5),ux=dx/d0,uy=dy/d0;
 const c=Math.acos(Math.min(1,Math.max(-1,(TJ.UA*TJ.UA+d*d-TJ.FA*TJ.FA)/(2*TJ.UA*d)))),a=Math.atan2(uy,ux);
 const[e1,e2]=[a+c,a-c].map(r=>[s[0]+TJ.UA*Math.cos(r),s[1]+TJ.UA*Math.sin(r)]),sc=e=>e[1]+side*.5*e[0];
 return{e:sc(e1)>sc(e2)?e1:e2,h:[s[0]+ux*d,s[1]+uy*d]}}
// 腰带飘带：简易 Verlet 链
function tjChain(c,anchor,len,wind){c[0].p=anchor;
 for(let i=1;i<c.length;i++){const q=c[i];if(!q.p){q.p=[anchor[0],anchor[1]+i*len];q.o=[...q.p]}const vx=(q.p[0]-q.o[0])*.9,vy=(q.p[1]-q.o[1])*.9;q.o=[...q.p];q.p=[q.p[0]+vx+wind,q.p[1]+vy+.45]}
 for(let k=0;k<3;k++)for(let i=1;i<c.length;i++){const a=c[i-1].p,b=c[i].p,dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,f=(d-len)/d;if(i>1){a[0]+=dx*f/2;a[1]+=dy*f/2;b[0]-=dx*f/2;b[1]-=dy*f/2}else{b[0]-=dx*f;b[1]-=dy*f}}
 return'M'+c.map(q=>tjP(q.p)).join('L')}
const TJ_DEFS=`<svg class="tj-defs" width="0" height="0" aria-hidden="true"><defs><radialGradient id="tj-shadow"><stop offset="0" stop-color="#05080B" stop-opacity=".75"/><stop offset="1" stop-color="#05080B" stop-opacity="0"/></radialGradient><linearGradient id="tj-robe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3F6F9"/><stop offset=".55" stop-color="#D5E0E8"/><stop offset="1" stop-color="#93A7B7"/></linearGradient><radialGradient id="tj-skin" cx=".4" cy=".35"><stop offset="0" stop-color="#EFE6DC"/><stop offset="1" stop-color="#C8B8A8"/></radialGradient><filter id="tj-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>`;
const TJ_ARM='<path class="limb" stroke="#7D92A3" stroke-width="16"/><path class="limb" stroke="#E3EAEF" stroke-width="14"/><path fill="#E6EDF1" stroke="#7D92A3" stroke-width=".8"/><path class="limb" stroke="#7D92A3" stroke-width="16.5"/><path class="limb" stroke="#EEF2F5" stroke-width="14.5"/><path class="limb" stroke="#9FB2C1" stroke-width="2.2"/><ellipse rx="5" ry="7.5" cy="1.5" fill="url(#tj-skin)" stroke="#A8978A" stroke-width=".6"/>';
const TJ_BODY=`<svg viewBox="-100 150 600 300" aria-hidden="true"><ellipse data-p="shadow" cy="438" rx="62" ry="7" fill="url(#tj-shadow)"/><path data-p="legL0" class="limb" stroke="#7D92A3" stroke-width="21"/><path data-p="legL" class="limb" stroke="#C9D6E0" stroke-width="19"/><path data-p="legR0" class="limb" stroke="#7D92A3" stroke-width="21"/><path data-p="legR" class="limb" stroke="#C9D6E0" stroke-width="19"/><ellipse data-p="shoeL" rx="12" ry="4.6" fill="#1C252D"/><ellipse data-p="shoeR" rx="12" ry="4.6" fill="#1C252D"/><path data-p="jacket" fill="url(#tj-robe)" stroke="#7D92A3" stroke-width="1"/><path data-p="placket" fill="none" stroke="#3E5262" stroke-opacity=".35" stroke-width="1"/><path data-p="buttons" fill="none" stroke="#4E6475" stroke-width="1.6" stroke-linecap="round"/><path data-p="sash" class="limb" stroke="#3E5262" stroke-width="7"/><g fill="none" stroke="#5D7182" stroke-linecap="round" stroke-linejoin="round"><path data-p="rb0" stroke-width="3.2"/><path data-p="rb1" stroke-width="2.6"/></g><circle data-p="knot" r="4" fill="#3E5262"/><path data-p="neck" class="limb" stroke="#D3C5B7" stroke-width="9"/><g data-p="head"><ellipse rx="14" ry="16.5" fill="url(#tj-skin)"/><path d="M-14.6 0C-16-21 16-21 14.6 0C11-9-11-9-14.6 0Z" fill="#1A232B"/><circle cy="-20" r="7.5" fill="#1A232B"/><path d="M-12-25L12-16" stroke="#AFC1CF" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="-16" r="1.8" fill="#DCE6EE"/><g data-p="face" fill="none" stroke="#3A3330" stroke-width="1" stroke-linecap="round" opacity=".7"><path d="M-8 2q3 2 6 0M2 2q3 2 6 0"/><path d="M-1.5 10q1.5 .8 3 0" opacity=".6"/></g></g><g data-p="armL"></g><g data-p="armR"></g><g data-p="trails" fill="none" stroke="#D6E4EE" stroke-linecap="round" filter="url(#tj-glow)"></g></svg>`;
// 每个 SVG 一个实例（房间本体与地面倒影各一份），返回逐帧绘制函数。
function tjFigure(svg){const el={};svg.querySelectorAll('[data-p]').forEach(e=>{el[e.dataset.p]=e});
 const arms=['armL','armR'].map(n=>{el[n].innerHTML=TJ_ARM;return[...el[n].children]});
 const trailEls=[0,1].map(()=>Array.from({length:5},(_,k)=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('stroke-width',1+k*.5);p.setAttribute('stroke-opacity',((k+1)/5*.55).toFixed(2));el.trails.append(p);return p}));
 const trails=[[],[]],chains=[7,5].map(n=>Array.from({length:n},()=>({p:null,o:null})));let sx=200,sv=0;
 return function render(t,step){
  const q=tjPose(t),mid=(q.feet[0][0]+q.feet[1][0])/2,lean=(q.px-mid)*.006,up=[Math.sin(lean),-Math.cos(lean)],dn=[-up[0],-up[1]],u=[Math.cos(lean),Math.sin(lean)];
  const P=[q.px,q.py],N=tjAdd(P,up,88),H=tjAdd(N,up,25),pt=(b,a,c)=>[b[0]+u[0]*a+dn[0]*c,b[1]+u[1]*a+dn[1]*c];
  if(step){sv=(sv+(q.px-sx)*.05)*.84;sx+=sv}
  const hx=[Math.max(-9,Math.min(9,(sx-q.px)*1.4)),0];
  [-1,1].forEach((s,i)=>{const hip=pt(P,s*12,0),f=q.feet[i],a=[f[0],f[1]-4],d=Math.hypot(a[0]-hip[0],a[1]-hip[1]),b=Math.sqrt(Math.max(0,142*142-d*d))*.22,k=[(hip[0]+a[0])/2+s*b,(hip[1]+a[1])/2],dd=`M${tjP(hip)}L${tjP(k)}L${tjP(a)}`,id=i?'R':'L';
   el['leg'+id+'0'].setAttribute('d',dd);el['leg'+id].setAttribute('d',dd);el['shoe'+id].setAttribute('cx',f[0]+s*3);el['shoe'+id].setAttribute('cy',f[1])});
  const NL=pt(N,-8,0),NR=pt(N,8,0),SLo=pt(N,-29,9),SRo=pt(N,29,9),ApL=pt(N,-25,36),ApR=pt(N,25,36),WL=pt(P,-21,-14),WR=pt(P,21,-14),HL=tjAdd(pt(P,-33,40),hx),HR=tjAdd(pt(P,33,40),hx),HC=tjAdd(pt(P,0,50),hx),NC=pt(N,0,7);
  el.jacket.setAttribute('d',`M${tjP(NL)}L${tjP(SLo)}L${tjP(ApL)}Q${tjP(WL)} ${tjP(HL)}Q${tjP(HC)} ${tjP(HR)}Q${tjP(WR)} ${tjP(ApR)}L${tjP(SRo)}L${tjP(NR)}Q${tjP(NC)} ${tjP(NL)}Z`);
  el.placket.setAttribute('d',`M${tjP(NC)}L${tjP(tjAdd(pt(P,0,44),hx,.8))}`);
  el.buttons.setAttribute('d',[.2,.4,.6,.8].map(f=>{const c=[tjLerp(NC[0],P[0]+up[0]*16,f),tjLerp(NC[1],P[1]+up[1]*16,f)];return`M${tjP(tjAdd(c,u,-4.5))}L${tjP(tjAdd(c,u,4.5))}`}).join(''));
  el.sash.setAttribute('d',`M${tjP(pt(P,-21,-12))}L${tjP(pt(P,21,-12))}`);
  const knot=pt(P,12,-11);el.knot.setAttribute('cx',knot[0]);el.knot.setAttribute('cy',knot[1]);
  if(step){el.rb0.setAttribute('d',tjChain(chains[0],knot,7,-sv*.35));el.rb1.setAttribute('d',tjChain(chains[1],tjAdd(knot,u,3),7,-sv*.25))}
  el.neck.setAttribute('d',`M${tjP(pt(N,0,2))}L${tjP(tjAdd(N,up,12))}`);
  const w=1/(1+Math.exp((q.hL[1]-q.hR[1])/12)),look=Math.max(-4,Math.min(4,(w*q.hL[0]+(1-w)*q.hR[0]-q.px)*.06));
  el.head.setAttribute('transform',`translate(${tjP(H)}) rotate(${(lean*180/Math.PI*1.6+look*.8).toFixed(2)})`);
  el.face.setAttribute('transform',`translate(${look.toFixed(2)} 0)`);
  [[pt(N,-24,10),q.hL,-1],[pt(N,24,10),q.hR,1]].forEach(([S,target,side],i)=>{
   const{e:Eb,h}=tjIK(S,target,side),Wr=tjMixPt(Eb,h,.86),ang=Math.atan2(h[1]-Eb[1],h[0]-Eb[0]);
   let n=[-Math.sin(ang),Math.cos(ang)];if(n[1]<0)n=[-n[0],-n[1]];
   const md=tjMixPt(Eb,Wr,.5),c=arms[i],a1=`M${tjP(S)}L${tjP(Eb)}`,a2=`M${tjP(Eb)}L${tjP(Wr)}`,cuff=[Math.cos(ang+Math.PI/2),Math.sin(ang+Math.PI/2)];
   c[0].setAttribute('d',a1);c[1].setAttribute('d',a1);
   c[2].setAttribute('d',`M${tjP(tjAdd(Eb,n,5))}Q${tjP(tjAdd(md,n,14))} ${tjP(tjAdd(Wr,n,11))}L${tjP(tjAdd(Wr,n,3))}Z`);
   c[3].setAttribute('d',a2);c[4].setAttribute('d',a2);
   c[5].setAttribute('d',`M${tjP(tjAdd(Wr,cuff,-7.5))}L${tjP(tjAdd(Wr,cuff,7.5))}`);
   c[6].setAttribute('transform',`translate(${tjP(h)}) rotate(${(ang*180/Math.PI-90).toFixed(1)})`);
   if(step){trails[i].push(h);if(trails[i].length>44)trails[i].shift()}
   const tr=trails[i],m=tr.length;trailEls[i].forEach((p,k)=>{const s=tr.slice(Math.floor(k*m/5),Math.floor((k+1)*m/5)+1);p.setAttribute('d',s.length>1?'M'+s.map(tjP).join('L'):'')})});
  el.shadow.setAttribute('cx',q.px.toFixed(1))}}
const FLOOR_DISK=`<svg viewBox="-60 -60 120 120" aria-hidden="true"><circle r="56" fill="none" stroke="rgba(226,236,244,.55)" stroke-dasharray="14 6"/><circle r="48" fill="none" stroke="rgba(226,236,244,.75)"/><path d="M0-48A48 48 0 0 1 0 48A24 24 0 0 1 0 0A24 24 0 0 0 0-48Z" fill="rgba(226,236,244,.32)"/><circle cy="-24" r="6" fill="rgba(226,236,244,.32)"/><circle cy="24" r="6" fill="none" stroke="rgba(226,236,244,.6)"/></svg>`;
// 细光琴弦：练习者身前悬着七根冷色光弦，对应八式触发的 1–7 弦；第八式七弦齐鸣。
const STRINGS='<div class="strings" aria-hidden="true">'+Array.from({length:7},(_,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div>';
function room3d(mirror){return `<div class="room3d"><div class="wall wall-left">${roomBands()}</div><div class="wall wall-back">${roomBands()}</div><div class="wall wall-right">${roomBands()}</div>${mirror?'':`<div class="floor-disk">${FLOOR_DISK}</div>`}<div class="taiji">${TJ_BODY}</div>${mirror?'':STRINGS}${roomNotes()}</div>`}
function roomHTML(){return `<div class="room-stage" role="img" aria-label="灰蓝色的立体房间：一个身穿白色练功服的小人在房间中央打太极云手，向右走几步再向左走回，地面映出倒影，房间里飘着音符，墙上流动着关于五音的短句"><div class="room-scene" aria-hidden="true">${TJ_DEFS}<div class="camera"><div class="room-photo"></div><div class="room-tint"></div><div class="room-tone"></div><div class="layer reflect">${room3d(true)}</div><div class="layer">${room3d(false)}</div><div class="room-vignette"></div></div></div></div>`}


  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
    })
  }

  function readPreferences() {
    try {
      var raw = localStorage.getItem(KEY)
      var data = raw ? JSON.parse(raw) : {}
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('偏好格式无效')
      return {
        mode: data.mode === 'camera' ? 'camera' : 'manual',
        reduceMotion: data.reduceMotion === true
      }
    } catch (error) {
      preferenceError = true
      return { mode: 'manual', reduceMotion: false }
    }
  }

  function setPreference(key, value) {
    var next = Object.assign({}, preferences)
    if (key === 'mode' && (value === 'manual' || value === 'camera')) next.mode = value
    else if (key === 'reduceMotion' && typeof value === 'boolean') next.reduceMotion = value
    else return false
    try {
      // 损坏的偏好不自动覆盖；练习记录使用独立存储键。
      var raw = localStorage.getItem(KEY)
      if (raw) {
        var stored = JSON.parse(raw)
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('偏好格式无效')
      }
      localStorage.setItem(KEY, JSON.stringify(next))
      preferences = next
      preferenceError = false
      applyMotion()
      return true
    } catch (error) {
      preferenceError = true
      return false
    }
  }

  function applyMotion() {
    if (root) root.classList.toggle('reduce', preferences.reduceMotion)
  }

  function teardownRoom() {
    if (roomObserver) roomObserver.disconnect()
    roomObserver = null
    if (roomAnim !== null) cancelAnimationFrame(roomAnim)
    roomAnim = null
  }

  function mountRoom() {
    var stage = $('.room-stage')
    var scene = $('.room-scene')
    if (!stage || !scene) return
    var fit = function () { scene.style.setProperty('--room-scale', String(stage.clientWidth / 1000)) }
    fit()
    if (typeof ResizeObserver === 'function') {
      roomObserver = new ResizeObserver(fit)
      roomObserver.observe(stage)
    }
    var figures = Array.from(root.querySelectorAll('.taiji svg')).map(tjFigure)
    for (var i = 0; i < 90; i++) figures.forEach(function (figure) { figure(0, true) })
    if (preferences.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    var time = 0
    var last = null
    function frame(now) {
      if (document.hidden) { last = null; roomAnim = null; return }
      var delta = last === null ? 0 : Math.min(.05, (now - last) / 1000)
      last = now
      time = (time + delta) % TJ.LOOP
      figures.forEach(function (figure) { figure(time, true) })
      roomAnim = requestAnimationFrame(frame)
    }
    if (!document.hidden) roomAnim = requestAnimationFrame(frame)
  }

  function go(path) {
    if (router) return router.push(path)
  }

  function navButton(path, title) {
    return '<button type="button" data-route="' + path + '"' + (page === path ? ' aria-current="page"' : '') + '>' + title + '</button>'
  }

  function action(path, title, primary) {
    return '<button type="button" class="shell-btn' + (primary ? ' primary' : '') + '" data-route="' + path + '">' + title + '</button>'
  }

  function homeHTML() {
    return '<section class="home"><div class="home-hero">' +
      '<div class="home-copy"><div class="shell-kicker">弦养 · 八段锦互动练习</div>' +
      '<h1>用身体弹古琴，<br>练完一套，弹完一曲。</h1>' +
      '<p>对着摄像头完成八段锦，动作到位，琴就响一声。<br>你慢，它就等；不必做得完美。</p>' +
      '<div class="shell-actions">' + action('/explore', '开始练习', true) + '</div>' +
      '<p class="shell-note">八段锦完整八式 · 约 12 分钟 · 全程本机识别，不录制画面</p></div>' +
      '<div class="home-room">' + roomHTML() + '</div></div>' +
      '<ul class="home-points" aria-label="产品要点">' +
      '<li><span class="home-point-index">01</span><h2>摄像头识别</h2><p>镜头只在本机判断动作是否到位，不录制、不上传画面。</p></li>' +
      '<li><span class="home-point-index">02</span><h2>动作拨弦</h2><p>每式到位拨响一根琴弦，第八式七弦齐鸣，声音即反馈。</p></li>' +
      '<li><span class="home-point-index">03</span><h2>练后赏听</h2><p>八式收成一曲，进入静坐与真人古琴录音的赏听时间。</p></li>' +
      '</ul></section>'
  }

  function exploreHTML() {
    return '<section><div class="shell-kicker">开始体验 · 先选一段留白</div><h1 class="shell-section-title">今天，练一段八段锦</h1>' +
      '<p class="shell-lead">完整八式，建议约 12 分钟完成；实际节奏由你决定，没有必须坚持到的时间，也随时可以停下。</p>' +
      '<div class="shell-card-grid shell-experiences"><article class="shell-card shell-available"><span class="shell-step">已开放 · 完整八式</span><h2>八段锦</h2><p>动作要领、七弦声音、练后感受与本机历史，组成完整的跟练体验。</p>' +
      '<form id="shell-experience"><fieldset class="shell-options"><legend>体验方式</legend>' +
      '<label><input type="radio" name="mode" value="manual"' + (preferences.mode === 'manual' ? ' checked' : '') + '> 手动跟练 · 不申请摄像头</label>' +
      '<label><input type="radio" name="mode" value="camera"' + (preferences.mode === 'camera' ? ' checked' : '') + '> 摄像头跟练 · 本机识别</label></fieldset>' +
      '<p class="shell-note">手动模式按「完成本式」记录进度；摄像头需要权限和安全环境，失败时仍可手动继续。手动 / 演示计数不代表准确识别。</p>' +
      '<div class="shell-actions"><button type="submit" class="shell-btn primary">选择体验，去做安全确认</button>' + action('/guide?style=baduanjin', '先看要领') + '</div></form></article>' +
      '<article class="shell-card shell-unavailable"><span class="shell-step">未开放</span><h2>太极拳</h2><p>首页的云手小人只是氛围展示，当前没有可用的太极练习流程。</p><p class="shell-note">暂不提供体验入口</p></article>' +
      '<article class="shell-card shell-unavailable"><span class="shell-step">未开放</span><h2>五禽戏</h2><p>当前尚未提供完整动作与跟练流程。此处仅说明产品边界。</p><p class="shell-note">暂不提供体验入口</p></article></div>' +
      '<aside class="shell-copy-card">若感到疼痛、眩晕或任何不适，请立即停下。无需坚持完成；弦养是日常跟练工具，不是医疗服务。</aside></section>'
  }

  function cultureHTML() {
    var tones = [
      ['宫', '第一音', '沉稳如土地，作为一段声音的起点。'],
      ['商', '第二音', '清越的声音，为流动留出一点空间。'],
      ['角', '第三音', '舒展的意象，像枝叶慢慢展开。'],
      ['徵', '第四音 · 读作 zhǐ', '温暖的意象，停在一呼一吸之间。'],
      ['羽', '第五音', '如水的意象，让注意回到当下。']
    ]
    return '<section><div class="shell-kicker">五音小记 · 文化线索</div><h1 class="shell-section-title">把声音，当作陪伴</h1>' +
      '<p class="shell-lead">宫、商、角、徵、羽是传统音乐中常用的五声音阶名称。这里的文字是文化与审美意象，不用于推断情绪或健康。</p>' +
      '<div class="shell-tone-list">' + tones.map(function (tone) {
        return '<article class="shell-card shell-tone"><div class="shell-tone-glyph">' + tone[0] + '</div><div><h2>' + tone[1] + '</h2><p>' + tone[2] + '</p></div></article>'
      }).join('') + '</div>' +
      '<aside class="shell-copy-card">动作反馈来自你上传的「Guqin-open-strings.wav」七弦散音录音，RafaelCaro 演奏，CC BY 4.0；按拨弦切为七段，末尾短淡出，原速播放，不移调、不替换为合成音。来源：freesound.org/people/RafaelCaro/sounds/176266/。五音不与脏器、疾病或疗效绑定。</aside>' +
      '<div class="shell-actions">' + action('/explore', '从八段锦开始', true) + action('/', '回到房间') + '</div></section>'
  }

  function listenHTML() {
    var tracks = LISTEN_TRACKS.map(function (track) {
      return '<article class="listen-track" data-track="' + track.id + '">' +
        '<button type="button" class="listen-play" data-play="' + track.id + '" aria-label="播放 ' + track.title + '">' +
        '<span class="listen-icon" aria-hidden="true">▶</span><span class="listen-label">播放</span></button>' +
        '<div class="listen-meta"><h3>' + track.title + '<span class="listen-sub">' + track.sub + '</span></h3>' +
        '<p class="listen-credit">' + escapeHTML(track.performer) + ' · ' + track.year + ' · ' + track.tone + '音 · <span class="listen-license">' + track.license + '</span></p></div>' +
        '<div class="listen-progress"><span class="listen-bar"><i data-bar="' + track.id + '"></i></span>' +
        '<span class="listen-time" data-time="' + track.id + '">0:00 / ' + track.dur + '</span></div></article>'
    }).join('')
    var credits = LISTEN_TRACKS.map(function (track) {
      return '<li>' + escapeHTML(track.credit) + '</li>'
    }).join('')
    return '<section><div class="shell-kicker">练后赏听 · 静坐片刻</div><h1 class="shell-section-title">练完一套，听一曲古琴</h1>' +
      '<p class="shell-lead">这里都是真人演奏的古琴录音，与跟练过程中的合成声音分属两条轨。不看屏幕，坐一会儿，让声音自己走完。</p>' +
      '<div class="listen-list">' + tracks + '</div>' +
      '<aside class="shell-copy-card"><h2 class="shell-subtitle">音源与授权</h2>' +
      '<p class="shell-note">仅列出有干净授权、可真实播放的录音；无音源的曲目不展示播放按钮，也不会假装可播。</p>' +
      '<ul class="listen-sources">' + credits + '</ul></aside>' +
      '<div class="shell-actions">' + action('/explore', '再练一次', true) + action('/profile', '查看记录') + action('/', '回到房间') + '</div></section>'
  }

  function recordSummary(records) {
    var valid = (records || []).filter(function (record) { return record && typeof record === 'object' })
    var duration = valid.reduce(function (sum, record) {
      return sum + (Number.isFinite(record.durationMs) && record.durationMs >= 0 ? record.durationMs : 0)
    }, 0)
    var timed = valid.filter(function (record) { return Number.isFinite(record.durationMs) && record.durationMs >= 0 }).length
    return {
      total: valid.length,
      complete: valid.filter(function (record) { return record.complete === true && record.completion !== 'partial' }).length,
      durationMs: duration,
      timed: timed,
      recent: valid.slice().sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0) }).slice(0, 3)
    }
  }

  function durationText(ms) {
    var seconds = Math.round(ms / 1000)
    return Math.floor(seconds / 60) + ' 分 ' + String(seconds % 60).padStart(2, '0') + ' 秒'
  }

  function profileHTML() {
    var records = window.XianyangFlow.readRecords()
    var summary = recordSummary(records)
    var stats = records === null ? '<p role="alert">记录暂时不可读取，请检查浏览器存储；不会覆盖已有记录。</p>' :
      '<div class="shell-card-grid shell-stats"><article class="shell-card"><strong>' + summary.total + '</strong><p>次练习记录</p></article>' +
      '<article class="shell-card"><strong>' + summary.complete + '</strong><p>套完整八式</p></article>' +
      '<article class="shell-card"><strong>' + (summary.timed ? durationText(summary.durationMs) : '未记录') + '</strong><p>已记录的练习时长</p></article></div>'
    return '<section><div class="shell-kicker">我的练习 · 只和自己的节奏相处</div><h1 class="shell-section-title">留在本机的片刻</h1>' + stats +
      '<p class="shell-note">汇总仅基于本浏览器最近最多 60 次记录，中途结束不计完整打卡。旧记录缺失的时长不推测补全，时长包含本次会话的等待与准备。</p>' +
      '<div class="shell-actions">' + action('/record', '查看 / 管理练习历史', true) + action('/explore', '开始新的体验') + action('/guide?style=baduanjin', '动作要领') + '</div>' +
      '<h2 class="shell-subtitle">最近感受</h2><div class="shell-recent">' + (records === null ? '<p>记录不可读取，暂不展示最近感受。</p>' : summary.recent.length ? summary.recent.map(function (record) {
        var feeling = ['更放松', '没变化', '不舒服', '说不清', '暂不评价'].indexOf(record.feedback) >= 0 ? record.feedback : '感受未记录'
        return '<article class="shell-card"><h3>' + escapeHTML(record.date || '日期未记录') + '</h3><p>' + escapeHTML(feeling) + ' · ' + (record.completion === 'partial' ? '中途结束' : record.complete ? '完整八式' : '部分进度') + '</p>' +
          (feeling === '不舒服' ? '<p class="shell-advice">请停止练习并休息。如不适持续或加重，请寻求专业医疗帮助。</p>' : '') + '</article>'
      }).join('') : '<p class="shell-empty">还没有练习记录。完成体验并保存感受后，这里才会出现你的小记。</p>') + '</div>' +
      '<section class="shell-card shell-preferences"><h2 class="shell-subtitle">体验偏好</h2><p class="shell-note">仅保存到本浏览器，并在下次体验中实际使用。不会跳过安全确认，也不会自动打开摄像头。</p>' +
      '<label class="shell-setting">默认体验方式<select data-pref="mode"><option value="manual"' + (preferences.mode === 'manual' ? ' selected' : '') + '>手动跟练（不申请摄像头）</option><option value="camera"' + (preferences.mode === 'camera' ? ' selected' : '') + '>摄像头跟练（进入后申请权限）</option></select></label>' +
      '<label class="shell-setting"><input type="checkbox" data-pref="reduceMotion"' + (preferences.reduceMotion ? ' checked' : '') + '> 减少首页动态效果（静态房间与云手起势）</label>' +
      '<p id="shell-preference-status" role="status">' + (preferenceError ? '偏好读取或保存失败，请检查浏览器存储；未覆盖原数据。' : '偏好仅在此浏览器保存。') + '</p></section>' +
      '<section class="shell-copy-card"><h2 class="shell-subtitle">隐私与使用边界</h2><ul><li>无账号，不做云端同步。练习记录和偏好仅存于当前浏览器；清除浏览器数据、换设备或换浏览器会丢失。</li>' +
      '<li>摄像头模式在本机处理画面，不录制、不上传视频，不申请麦克风权限。手动模式不申请摄像头。</li>' +
      '<li>识别运行时、模型、音色和演示资源从当前站点加载。选择系统或离线语音时，具体资源加载沿用跟练页设置。</li>' +
      '<li>动作进度不是识别准确率、质量评分或健康效果。感受是主观记录，不用于医疗判断。</li></ul></section></section>'
  }

  function ensureRoot() {
    if (root) return
    app = document.getElementById('app')
    root = document.createElement('div')
    root.id = 'xianyang-shell'
    root.className = 'shell-app'
    root.hidden = true
    document.body.appendChild(root)
    root.addEventListener('click', function (event) {
      var play = event.target.closest('[data-play]')
      if (play && root.contains(play)) { toggleTrack(play.getAttribute('data-play')); return }
      var button = event.target.closest('[data-route]')
      if (button && root.contains(button)) go(button.getAttribute('data-route'))
    })
    root.addEventListener('submit', function (event) {
      if (event.target.id !== 'shell-experience') return
      event.preventDefault()
      var selected = $('input[name="mode"]:checked').value
      go('/train?style=baduanjin&mode=' + (selected === 'camera' ? 'camera' : 'manual'))
    })
    root.addEventListener('change', function (event) {
      var control = event.target
      var key = control.getAttribute('data-pref')
      if (!key) return
      var saved = setPreference(key, key === 'reduceMotion' ? control.checked : control.value)
      $('#shell-preference-status').textContent = saved ? '已保存，下次体验将使用此偏好。' : '偏好未保存，请检查浏览器存储后重试。'
      if (!saved) {
        if (key === 'reduceMotion') control.checked = preferences.reduceMotion
        else control.value = preferences.mode
      }
    })
  }

  function render(route, focus) {
    ensureRoot()
    teardownRoom()
    if (page !== route.path) stopAudio()
    page = route.path
    var isShell = PATHS.indexOf(page) >= 0
    root.hidden = !isShell
    if (app) app.hidden = isShell
    document.body.classList.toggle('shell-active', isShell)
    document.body.classList.toggle('shell-core', !isShell)
    if (!isShell) { root.innerHTML = ''; return }
    applyMotion()
    var views = { '/': homeHTML, '/explore': exploreHTML, '/culture': cultureHTML, '/profile': profileHTML, '/listen': listenHTML }
    root.innerHTML = '<header class="shell-top"><button type="button" class="shell-brand" data-route="/" aria-label="弦养首页">弦养</button>' +
      '<nav class="shell-nav" aria-label="主导航">' + navButton('/', '首页') + navButton('/explore', '开始练习') + navButton('/listen', '练后赏听') + navButton('/culture', '五音小记') + navButton('/profile', '我的练习') + '</nav></header>' +
      '<main class="shell-main">' + views[page]() + '</main><footer class="shell-footer">给自己一段留白。日常跟练，不作诊断或治疗；无需追求动作幅度，不适时立即停止。</footer>'
    if (page === '/') mountRoom()
    if (focus) {
      var heading = $('h1')
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
      window.scrollTo(0, 0)
    }
  }

  function installRouter(instance) {
    router = instance
    preferences = readPreferences()
    router.afterEach(function (to, from, failure) {
      // 只在导航成功后切换壳层，取消安全确认或退出确认不改变当前视图。
      if (!failure) render(to, true)
    })
    router.isReady().then(function () { render(router.currentRoute.value, false) })
  }

  // 赏听播放器：单实例 <audio>，切曲即换源，离开页面自动暂停。
  var audioEl = null
  var currentId = null
  function formatClock(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0
    var s = Math.floor(sec)
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
  }
  function trackById(id) {
    for (var i = 0; i < LISTEN_TRACKS.length; i++) { if (LISTEN_TRACKS[i].id === id) return LISTEN_TRACKS[i] }
    return null
  }
  function ensureAudio() {
    if (audioEl) return audioEl
    audioEl = new Audio()
    audioEl.preload = 'metadata'
    ;['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata', 'error'].forEach(function (ev) { audioEl.addEventListener(ev, syncPlayer) })
    return audioEl
  }
  function syncPlayer() {
    if (!root) return
    var playing = !!(audioEl && currentId && !audioEl.paused && !audioEl.ended)
    root.querySelectorAll('[data-play]').forEach(function (btn) {
      var id = btn.getAttribute('data-play')
      var on = id === currentId && playing
      btn.classList.toggle('is-playing', on)
      var icon = btn.querySelector('.listen-icon')
      var label = btn.querySelector('.listen-label')
      if (icon) icon.textContent = on ? '❚❚' : '▶'
      if (label) label.textContent = on ? '暂停' : (id === currentId && audioEl && audioEl.ended ? '重播' : '播放')
      btn.setAttribute('aria-label', (on ? '暂停 ' : '播放 ') + ((trackById(id) || {}).title || ''))
    })
    var bar = root.querySelector('[data-bar="' + currentId + '"]')
    if (bar) {
      var dur = audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : 0
      bar.style.width = dur ? Math.min(100, (audioEl.currentTime / dur) * 100) + '%' : '0%'
    }
    var time = root.querySelector('[data-time="' + currentId + '"]')
    if (time) {
      var track = trackById(currentId)
      var total = audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0 ? formatClock(audioEl.duration) : (track ? track.dur : '0:00')
      time.textContent = formatClock(audioEl ? audioEl.currentTime : 0) + ' / ' + total
    }
  }
  function toggleTrack(id) {
    var track = trackById(id)
    if (!track) return
    var player = ensureAudio()
    if (currentId === id && !player.paused) { player.pause(); return }
    if (currentId !== id) {
      currentId = id
      player.src = track.src
      root.querySelectorAll('[data-bar]').forEach(function (n) { if (n.getAttribute('data-bar') !== id) n.style.width = '0%' })
      root.querySelectorAll('[data-time]').forEach(function (n) {
        var other = n.getAttribute('data-time')
        if (other !== id) n.textContent = '0:00 / ' + ((trackById(other) || {}).dur || '0:00')
      })
    }
    var p = player.play()
    if (p && typeof p.catch === 'function') p.catch(function () { currentId = null; syncPlayer() })
    syncPlayer()
  }
  function stopAudio() {
    if (audioEl && !audioEl.paused) audioEl.pause()
    currentId = null
  }

  window.XianyangShell = { installRouter: installRouter, readPreferences: readPreferences, recordSummary: recordSummary }
  window.addEventListener('xianyang:records-changed', function () {
    if (router && router.currentRoute.value.path === '/profile') render(router.currentRoute.value, false)
  })
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) {
      preferences = readPreferences()
      if (router && PATHS.indexOf(router.currentRoute.value.path) >= 0) render(router.currentRoute.value, false)
    }
  })
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) teardownRoom()
    else if (page === '/') mountRoom()
  })
  window.addEventListener('pagehide', teardownRoom)
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && router) render(router.currentRoute.value, false)
  })
})()
