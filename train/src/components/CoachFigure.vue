<template>
  <!-- 教练形象：房间版小人（白练功服 / 腰带发髻 / 飘带拖影），**不含 3D 房间场景**。
       逐帧由父组件的 rAF 推进，这里只做「按姿态重绘」。 -->
  <div class="cf" :class="{ frozen }">
    <svg ref="svgEl" :viewBox="ROOM_VIEWBOX" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>
  </div>
</template>

<script setup>
// 房间版教练形象（**由 outputs/gen-coach-figure.py 从 outputs/room-baduanjin/room.js 抽取**）
//
// 【职责单一】只画一帧：props.idx（房间版式号）+ props.u（本式进度 0~1）变了就重绘。
//   时间轴 / 播放暂停 / 循环 / 重播全部留在父组件（DemoAnimation.vue），不在这里开定时器。
//
// 【为什么要搬这一版】用户明确要求：教练小窗里的形象换成「房间版拆动作」里那个小人，
//   但**不要立体房间**。所以这里只保留了小人本体（含拖影、腰带飘带、地面投影），
//   把房间（墙面/滚动文字/音符/倒影）全部去掉。
//
// 【几何】沿用房间版 viewBox "-100 150 600 300" 里的坐标：地面 y=434、中轴 x=200。
//   这里把视口收紧到 ROOM_VIEWBOX（只框住小人 + 手臂完全展开的余量），
//   这样放进 96×108 的教练小窗时不会四周留一大圈空。
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
// VFOLD_K / lerp / ease / add / mixP：下面那段「原文搬运」的小人代码直接引用这几个顶层名字，
// 所以必须一并从 roomMoves.js 取过来（原文件里它们是同一个作用域里的顶层常量）。
import { roomPose, ROOM_VIEWBOX, VFOLD_K, lerp, ease, add, mixP } from '../data/roomMoves.js'

const props = defineProps({
  /** 房间版式号（应用第 i 式 → i+1，因为房间版头部多一个「起势」） */
  idx: { type: Number, default: 1 },
  /** 本式进度 0~1（父组件的动画时间轴） */
  u: { type: Number, default: 0 },
  /** 暂停/定格：不再推进飘带与拖影（但不影响静态重绘） */
  frozen: { type: Boolean, default: false },
})

const svgEl = ref(null)
let render = null

/* ---------------------------------------------------------------- 房间版小人（原文） */
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
    const d=Math.min(Math.max(d0,Math.abs(TJ.UA-TJ.FA)+.5),TJ.UA+TJ.FA-1e-3);   // 上界放到 UA+FA：否则肘内角被数学封顶在 167.3°，永远差 12.7° 伸不直（-1e-3 避免 acos 取到 1.0000001）
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

/* ---------------------------------------------------------------- 生命周期 */
let seq = 0

function build() {
  if (!svgEl.value) return
  const uid = 'cf' + (++seq)
  // 渐变/滤镜 id 加实例后缀，避免同页出现第二个小人时互相抢 defs
  // （抢了的话会退化：衣料变成纯黑、皮肤没有渐变、拖影发光失效）
  const fx = (html) => html
    .replace(/id="tj-/g, 'id="' + uid + '-')
    .replace(/url\(#tj-/g, 'url(#' + uid + '-')
  // TJ_BODY 原本是「一整只 <svg viewBox="-100 150 600 300">」。
  // 这里只用它的**内部内容**，让元素直接活在父 svg 的 ROOM_VIEWBOX 坐标系里；
  // 若原样嵌套，内层 600×300 会被再缩一次，小人会缩成小小一只居中。
  const inner = (html) => html.slice(html.indexOf('>') + 1, html.lastIndexOf('</svg>'))
  const svg = svgEl.value
  svg.innerHTML = fx(TJ_DEFS) + fx(inner(TJ_BODY))
  render = tjFigure(svg)
  paint()
}

function paint() {
  if (!render) return
  // frozen 时不再推进飘带/拖影物理，但仍按当前姿态重绘（保证定格那一刻画面正确）
  render(roomPose(props.idx, props.u), !props.frozen)
}

onMounted(build)

// 切式 → 清拖影（否则上一式的轨迹会横着拉一条线穿过新姿势），并重建（新式姿态可能不同）
watch(() => props.idx, () => {
  if (render && render.clear) render.clear()
  paint()
})

// 每帧：父组件的 u 变了就重绘
watch(() => props.u, paint)

onBeforeUnmount(() => { render = null })
</script>

<style scoped>
/* 房间版小人是**为暗色房间**设计的：白练功服 + 灰蓝描边 + 深色发髻 + 浅蓝发光拖影。
   所以这里给它一个同色系的「暗色小房间」底（青灰蓝），而不是原来的深棕。
   ⚠️ 只换底色，小窗尺寸/圆角/边框仍由 DemoAnimation 的 .cv-box 控制，版面不动。 */
.cf {
  position: absolute; inset: 0;
  background:
    radial-gradient(78% 40% at 50% 92%, rgba(150, 190, 215, .16) 0%, rgba(150, 190, 215, 0) 72%),
    linear-gradient(180deg, #263743 0%, #1A2831 58%, #101A21 100%);
}
.cf svg { width: 100%; height: 100%; display: block; }
.cf.frozen { filter: saturate(.7) brightness(.96); }
</style>
