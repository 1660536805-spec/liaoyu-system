/* 弦养 · 页面状态机（按最终版 9 张设计稿一比一复刻）
   1rem = 设计稿 10pt（见 app.css） */
(function(){
'use strict';
var root, state={
  screen:'loading', first:true,
  qIndex:0, qSel:null,
  answers:[], organ:0, track:-1,
  mode:0, rec:0, imode:0, istage:0,
  progress:0, running:false,
  body:{h:165,w:55,a:28},
  inj:['无'], goals:['舒缓肩颈'], diet:['少盐'], recipe:true
};

/* ---------- 图标库（描边风格 SVG） ---------- */
function ic(n,c){var s={
 back:'<path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
 chev:'<path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 chevl:'<path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 share:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m8 6 4-3.5L16 6"/><path d="M6 10H5v10h14V10h-1"/></g>',
 bell:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></g>',
 gear:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/></g>',
 music:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></g>',
 user:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.6 4.4-5.5 8-5.5s6.5 1.9 8 5.5"/></g>',
 yinyang:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9 9 9 0 0 0 0-18z" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.4" fill="#F3E9D5" stroke="none"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none"/>',
 lotus:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4 0-7-2.4-8-6 2.4-.4 4.6.2 6.2 1.6C9.4 12 10.4 8.6 12 6c1.6 2.6 2.6 6 1.8 9.6C15.4 14.2 17.6 13.6 20 14c-1 3.6-4 6-8 6z"/></g>',
 refresh:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/></g>',
 play:'<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
 pause:'<g fill="currentColor"><rect x="7" y="5" width="3.4" height="14" rx="1.2"/><rect x="13.6" y="5" width="3.4" height="14" rx="1.2"/></g>',
 prev:'<g fill="currentColor"><path d="M17 5v14L8 12z"/><rect x="6" y="5" width="2.4" height="14" rx="1"/></g>',
 next:'<g fill="currentColor"><path d="M7 5v14l9-7z"/><rect x="15.6" y="5" width="2.4" height="14" rx="1"/></g>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
 shuffle:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l10 10h4M21 17l-2.5-2.5M21 17l-2.5 2.5M3 17h4l2.5-2.5M14.5 9.5 17 7h4M21 7l-2.5-2.5M21 7l-2.5 2.5"/></g>',
 dice:'<g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/></g>',
 deer:'<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21c-2.5-1.5-4-4-4-7 0-2 .6-3.8 1.8-5.2M15 21c2.5-1.5 4-4 4-7 0-2-.6-3.8-1.8-5.2"/><path d="M9.5 8.5C10.4 7.6 11.2 7 12 7s1.6.6 2.5 1.5"/><path d="M7 4c.8 1.4 1.2 2.6 1 4M17 4c-.8 1.4-1.2 2.6-1 4"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/></g>',
 medit:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5.5" r="2.2"/><path d="M12 9v4M12 13c-2.6 0-4.8 1.4-6 3.6M12 13c2.6 0 4.8 1.4 6 3.6M8 19h8"/></g>',
 demo:'<path d="M8 5.5v13l11-6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
 doc:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3.5"/></g>',
 qmark:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3A2.6 2.6 0 1 1 12 12.6v1.6"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/></g>',
 heart:'<path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3 1.4-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.2C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
 moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/>',
 wave:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></g>',
 hand:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v7c0 3.5-2.3 6-5.7 6-2.7 0-4.3-1.2-5.6-3.6L4 13.6c-.8-1.3.6-2.7 1.9-1.8L8 13.5"/></g>',
 target:'<g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></g>',
 leaf:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19C5 9 11 5 20 4c-.5 9-4.5 15-13 15"/><path d="M5 19c2-5 5-8 9-10"/></g>',
 headset:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 1 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.8"/><rect x="17" y="13" width="4" height="6" rx="1.8"/></g>',
 info:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/></g>',
 camera:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></g>',
 chart:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/></g>',
 timer:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5"/></g>',
 bars:'<g fill="currentColor"><rect x="4" y="13" width="3" height="7" rx="1"/><rect x="9" y="9" width="3" height="11" rx="1"/><rect x="14" y="5" width="3" height="15" rx="1"/></g>',
 cal:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/></g>',
 user2:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7.5" r="3"/><path d="M5.5 20c1.3-3.2 3.7-5 6.5-5s5.2 1.8 6.5 5"/></g>',
 salt:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9V6a3 3 0 0 1 6 0v3"/><rect x="5" y="9" width="14" height="11" rx="2.5"/><path d="M9 13.5h6"/></g>',
 volume:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></g>',
 sun:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/></g>',
 dots:'<g fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></g>',
 bowl:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9.5 7.5c0-1.4 1-1.6 1-3M13.5 7.5c0-1.4 1-1.6 1-3"/></g>',
 stomach:'<path d="M15 3v3.5c0 2-1.5 3.5-3.5 3.5H10a5 5 0 0 0-5 5c0 3 2.5 5 5.5 5 3.5 0 6-2.5 6-6V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
 spine:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v18"/><path d="M8.5 6.5h7M8.5 10.5h7M8.5 14.5h7M8.5 18.5h7"/></g>',
 knee:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 3v6M15 3v6M9 15v6M15 15v6"/><circle cx="12" cy="12" r="2.4"/></g>',
 ban:'<g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></g>',
 home:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v10h11V10"/></g>',
 list:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/></g>',
 chair:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5v9.5h8"/><path d="M7 13v7.5M15 13v7.5M7 17.5h8"/></g>',
 heart2:'<path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3 1.4-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.2C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'
};return '<svg viewBox="0 0 24 24" aria-hidden="true"'+(c?' style="'+c+'"':'')+'>'+s[n]+'</svg>'}
function knot(){return '<svg class="knot" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M12 7 17 12l-5 5-5-5z"/></g></svg>'}

/* ---------- 公共片段 ---------- */
function brand(sz,sub){return '<div class="brandrow"><span class="t-callig" style="font-size:'+sz+'rem">弦养</span><span class="seal">弦养</span></div>'+(sub?'<div class="t-sub" style="margin-top:1.1rem">'+sub+'</div>':'')}
function toast(msg){var t=document.querySelector('.toast');if(!t){t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show')},3500)}
var BODY_LIMITS={h:[100,230],w:[20,250],a:[1,120]};
var BODY_OPTIONS={inj:['颈肩','腰背','膝盖','手腕','无'],goals:['舒缓肩颈','改善睡眠','调理脾胃','提神','无所谓'],diet:['素食','少盐','无特殊']};
var BODY_NONE={inj:'无',goals:'无所谓',diet:'无特殊'};
function bodyValue(k,v){return typeof v==='number'&&Number.isFinite(v)?Math.max(BODY_LIMITS[k][0],Math.min(BODY_LIMITS[k][1],Math.round(v))):state.body[k]}
function bodyChoices(k,values){var valid=values.filter(function(v){return BODY_OPTIONS[k].indexOf(v)>=0}).filter(function(v,i,a){return a.indexOf(v)===i});return valid.indexOf(BODY_NONE[k])>=0?[BODY_NONE[k]]:(valid.length?valid:[BODY_NONE[k]])}
function saveBodyState(){try{localStorage.setItem('xy-body',JSON.stringify({body:state.body,inj:state.inj,goals:state.goals,diet:state.diet,recipe:state.recipe}));return true}catch(_){toast('本机存储不可用，设置仅在本次访问保留');return false}}
function loadBodyState(){try{var x=JSON.parse(localStorage.getItem('xy-body')||'null');if(!x||typeof x!=='object'||Array.isArray(x))return;if(x.body&&typeof x.body==='object'&&!Array.isArray(x.body))Object.keys(BODY_LIMITS).forEach(function(k){state.body[k]=bodyValue(k,x.body[k])});Object.keys(BODY_OPTIONS).forEach(function(k){if(Array.isArray(x[k]))state[k]=bodyChoices(k,x[k])});if(typeof x.recipe==='boolean')state.recipe=x.recipe}catch(_){} }

/* ---------- 加载页 ---------- */
function pgLoading(){return '<main class="sc center" style="padding-bottom:0;position:relative;min-height:100dvh;display:flex;flex-direction:column">'
 +'<div style="display:flex;justify-content:flex-end;padding-top:1.6rem"><button class="tbtn" style="background:rgba(253,250,242,.9);border:1px solid var(--line);border-radius:2rem;padding:.7rem 1.6rem" data-a="load-enter">示例 '+ic('chev','width:1.2rem;height:1.2rem')+'</button></div>'
 +'<div class="load-hero">'
 +'<div style="display:flex;justify-content:center">'+brand(8.2)+'</div>'
 +'<div class="dashline t-sub" style="margin-top:1.8rem;width:26rem">以身为琴，以动为弦</div>'
 +'<p class="load-poem">古琴之音，调息养心；<br>一动一弦，唤回更好的自己。</p>'
 +'<div class="loader"><svg viewBox="0 0 96 96">'
   +'<circle cx="48" cy="48" r="40" fill="none" stroke="#EADCC2" stroke-width="3"/>'
   +'<g class="spin"><path d="M48 8 a40 40 0 0 1 34.6 20" fill="none" stroke="#C9A063" stroke-width="4" stroke-linecap="round"/>'
   +'<path d="M82.6 68 a40 40 0 0 1 -30 19.5" fill="none" stroke="#5E7C6B" stroke-width="4" stroke-linecap="round"/>'
   +'<circle cx="82.6" cy="28" r="3.4" fill="#C9A063"/></g>'
   +'<g transform="translate(33,33) scale(1.35)" color="#A87F3F">'+ic('lotus')+'</g>'
 +'</svg></div>'
 +'<p class="load-tip">古琴与动作练习 · 界面预览</p>'
 +'<button class="btn" style="width:32rem;margin:2.6rem auto 0" data-a="load-enter">'+ic('lotus','width:2.4rem;height:2.4rem;color:#F6E3C8')+'进入弦养</button>'
 +'<div class="load-foot">未连接摄像头与动作识别</div>'
 +'</div>'
 +'<div class="load-guqin" style="margin-top:auto"><img src="/art/guqin.png" alt="" style="height:30rem"></div>'
 +'</main>'}

/* ---------- 问答页 ---------- */
function pgQuestion(){var cards=[
  ['q-neck.jpg','颈肩','容易酸痛、僵硬<br>肩颈不适'],
  ['q-back.jpg','腰背','容易酸胀、疲劳<br>久坐不适'],
  ['q-food.jpg','脾胃','容易胀气、消化不良<br>食欲不稳'],
  ['q-sleep.jpg','睡眠','入睡困难、易醒<br>睡眠质量差'],
  ['q-mood.jpg','情绪','容易焦虑、烦躁<br>压力较大'],
  ['q-none.jpg','没有','目前没有明显不适<br>想整体调养']]
 var steps='';
 for(var i=0;i<7;i++){if(i)steps+='<span class="sline'+(i<=state.qIndex?' done':'')+'"></span>'
  steps+='<span class="snode '+(i<state.qIndex?'done':(i===state.qIndex?'cur':''))+'">'+(i<state.qIndex?ic('check','width:1rem;height:1rem'):'')+'</span>'}
 return '<main class="sc" style="min-height:100dvh;display:flex;flex-direction:column;padding-bottom:3rem">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><span></span></div>'
 +'<div class="center" style="margin-top:.6rem">'+brand(4.6)+'</div>'
 +'<div class="dashline t-sub center" style="margin-top:1rem">让传统之美，滋养当下的你</div>'
 +'<div class="stepper"><span class="num">'+(state.qIndex+1)+' <i>/ 7</i></span><div class="steps">'+steps+'</div></div>'
 +'<div class="center" style="margin-top:2.6rem;font-family:var(--serif);font-size:2.5rem;font-weight:700;color:var(--ink);letter-spacing:.08em">你最近哪里容易不舒服?</div>'
 +'<p class="center" style="font-size:1.35rem;color:var(--muted);margin-top:1.2rem;line-height:1.8">你的回答将帮助我们为你生成<br>更合适的今日练习推荐，调和身心，专属定制。</p>'
 +'<div class="qgrid">'+cards.map(function(c,i){return '<button class="qcard'+(state.qSel===i?' sel':'')+'" data-a="qsel" data-i="'+i+'">'
   +'<span class="ck">'+ic('check')+'</span><img src="/art/'+c[0]+'" alt=""><h4>'+c[1]+'</h4><p>'+c[2]+'</p></button>'}).join('')+'</div>'
 +'<div style="display:flex;align-items:center;gap:1.2rem;margin-top:auto;padding-top:2.6rem">'
 +'<button class="btn btn-gho" style="width:auto;padding:0 2.2rem" data-a="q-prev">'+ic('chevl','width:1.5rem;height:1.5rem')+'上一步</button>'
 +'<button class="btn" style="flex:1" data-a="q-next">下一步 '+ic('chev','width:1.5rem;height:1.5rem')+'</button>'
 +'<button class="tbtn" data-a="q-skip">跳过 '+ic('chev','width:1.2rem;height:1.2rem')+'</button></div>'
 +'</main>'}

/* ---------- 音疗页 ---------- */
function pgAudio(){var organs=[
  ['心','徵','喜悦安神','#C4472F','/art/card-landscape.jpg','filter:hue-rotate(-10deg) saturate(.9)'],
  ['肝','角','舒展疏肝','#5E7C6B','/art/q-none.jpg',''],
  ['脾','宫','平和健脾','#B8862D','/art/card-landscape.jpg','filter:sepia(.5)'],
  ['肺','商','清润宁神','#7A8C99','/art/q-none.jpg','filter:hue-rotate(160deg) saturate(.55)'],
  ['肾','羽','沉静滋养','#4A5E82','/art/card-landscape.jpg','filter:hue-rotate(190deg) saturate(.8) brightness(.85)']]
 var tracks=[
  ['平湖秋月','月映平湖，心境澄明。','心·徵','org','安神助眠','平稳情绪','08:24','/art/card-landscape.jpg',''],
  ['高山流水','清泉如诉，舒展胸怀。','肝·角','grn','疏肝解郁','放松身心','07:36','/art/q-none.jpg',''],
  ['阳春白雪','和煦温暖，健脾养中。','脾·宫','org','调和脾胃','提升专注','06:52','/art/card-landscape.jpg','filter:sepia(.5)'],
  ['梅花三弄','清音入肺，涤尘安神。','肺·商','blu','清润宁神','改善睡眠','07:28','/art/q-none.jpg','filter:hue-rotate(160deg) saturate(.55)']]
 return '<main class="sc navpad" style="min-height:100dvh;display:flex;flex-direction:column">'
 +'<div class="a-hero"><img src="/art/landscape.jpg" alt=""><div class="fade"></div>'
  +'<div class="in"><div class="brandrow"><span class="t-callig" style="font-size:4.4rem">弦养·点单</span><span class="seal">弦养</span></div></div></div>'
 +'<div style="margin-top:1.8rem;font-size:1.8rem;font-weight:700;color:var(--brown);letter-spacing:.06em">今天想照顾哪里？</div>'
 +'<p style="font-size:1.3rem;color:var(--muted);margin-top:.8rem;line-height:1.8">五音入五脏，<br>以琴音和身心，<br>让此刻的你，被温柔照顾。</p>'
 +'<section class="card" style="padding:1.6rem 1.4rem 1.4rem;margin-top:2rem">'
  +'<div class="sec-h">'+knot()+'选择调养方向<span class="sec-note">根据当下的身心状态，选择一个想要照顾的方向</span></div>'
  +'<div class="organ-row">'+organs.map(function(o,i){return '<button class="organ'+(state.organ===i?' sel':'')+'" data-a="organ" data-i="'+i+'">'
   +'<span class="ck">'+ic('check')+'</span><div class="zi" style="color:'+o[3]+'">'+o[0]+'</div><div class="yun">'+o[1]+'</div><div class="tip">'+o[2]+'</div>'
   +'<img class="pic" src="'+o[4]+'" style="'+o[5]+'" alt=""></button>'}).join('')+'</div>'
 +'</section>'
 +'<div style="display:flex;gap:1.2rem;margin-top:1.4rem">'
  +'<button class="btn btn-gho" style="flex:1;min-height:4.8rem;font-size:1.45rem" data-a="random-track">'+ic('shuffle','width:2rem;height:2rem')+'说不上来，随便听听 ›</button>'
  +'<button class="btn" style="flex:1.15;min-height:4.8rem;font-size:1.45rem" data-a="play" data-i="0">'+ic('music','width:2rem;height:2rem')+'练完了·听一首完整的 ›</button></div>'
 +'<section class="player card">'
  +'<img class="pic" src="/art/card-landscape.jpg" alt="">'
  +'<div class="pr"><span class="live">'+ic('music','width:1.2rem;height:1.2rem')+'曲目预览 · 未提供音源</span>'
  +'<div class="tt">'+tracks[Math.max(0,state.track)][0]+' <i aria-hidden="true">♡</i></div>'
  +'<p>'+tracks[Math.max(0,state.track)][1]+'</p>'
  +'<div class="tags"><span class="tag '+tracks[Math.max(0,state.track)][3]+'">'+tracks[Math.max(0,state.track)][2]+'</span><span class="tag">'+tracks[Math.max(0,state.track)][4]+'</span><span class="tag">'+tracks[Math.max(0,state.track)][5]+'</span></div>'
  +'<div class="pbar"><i style="width:0%"></i></div>'
  +'<div class="times"><span>00:00</span><span>时长待确认</span></div>'
  +'<div class="pctrl"><button data-a="unavailable" aria-label="循环播放">'+ic('refresh')+'</button><button data-a="track-prev" aria-label="上一首曲目预览">'+ic('prev')+'</button><button class="pc" data-a="play" data-i="'+Math.max(0,state.track)+'" aria-label="尝试播放当前曲目">'+ic('play')+'</button><button data-a="track-next" aria-label="下一首曲目预览">'+ic('next')+'</button><button data-a="track-list" aria-label="查看推荐曲目">'+ic('list')+'</button></div>'
  +'</div></section>'
 +'<section class="card" style="padding:1.6rem 1.5rem;margin-top:2rem">'
  +'<div class="sec-h">'+knot()+'跟着呼吸，更好地感受音乐<span class="sec-note">让呼吸与琴音同频，放松身心</span></div>'
  +'<div class="breath-row">'
   +'<div class="bstep"><span class="c">'+ic('medit')+'</span><b>慢吸 4 秒</b><span>感受气息流入丹田</span></div>'
   +'<span class="barrow">'+ic('chev','width:2rem;height:2rem')+'</span>'
   +'<div class="bstep"><span class="c">'+ic('hand')+'</span><b>慢呼 6 秒</b><span>慢慢释放紧张与杂念</span></div>'
   +'<span class="barrow">'+ic('chev','width:2rem;height:2rem')+'</span>'
   +'<div class="bstep"><span class="c">'+ic('lotus')+'</span><b>放松</b><span>跟随音乐享受此刻的宁静</span></div>'
  +'</div></section>'
 +'<section class="card" style="padding:1.6rem 1.5rem 1.2rem;margin-top:2rem">'
  +'<div class="sec-h">'+knot()+'为你推荐<button class="sec-note" data-a="swap-tracks" style="display:inline-flex;align-items:center;gap:.4rem">'+ic('refresh','width:1.4rem;height:1.4rem')+'换一批</button></div>'
  +'<div style="margin-top:.6rem">'+tracks.map(function(t,i){return '<div class="track">'
   +'<img class="thumb" src="'+t[7]+'" style="'+(t[8]||'')+'" alt="">'
   +'<div style="flex:1;min-width:0"><div class="tt">'+t[0]+(state.track===i?' <span class="note">已选预览</span>':'')+'</div>'
   +'<div style="font-size:1.15rem;color:var(--muted);margin-top:.2rem">'+t[1]+'</div>'
   +'<div class="tags"><span class="tag '+t[3]+'">'+t[2]+'</span><span class="tag">'+t[4]+'</span><span class="tag">'+t[5]+'</span></div></div>'
   +'<span class="dur">预览</span>'
   +'<button class="play-c'+(state.track===i?' on':'')+'" data-a="play" data-i="'+i+'" aria-label="尝试播放'+t[0]+'">'+ic('play')+'</button></div>'}).join('')+'</div>'
 +'</section>'
 +nav('audio',true)+'</main>'}

/* ---------- 底部导航 ---------- */
function nav(cur,four){var h='<nav class="nav">'
 if(four)h+='<button class="nitem'+(cur==='home'?' on':'')+'" data-a="nav-home">'+ic('home')+'首页</button>'
 h+='<button class="nitem'+(cur==='audio'?' on':'')+'" data-a="nav-audio">'+ic('music')+'音疗</button>'
 +'<button class="nitem" data-a="nav-intro"><span class="big">'+ic('yinyang')+'</span>开始练</button>'
 +'<button class="nitem'+(cur==='profile'?' on':'')+'" data-a="nav-profile">'+ic('user')+'我的</button></nav>'
 return h}

/* ---------- 首页 ---------- */
function pgHome(){var recs=[
  ['八段锦 · 宫调','平和承载 · 12分钟','舒展身心，适合日常练习，调和气息，安定情绪。','八段锦动作柔和，调息养气，帮助舒缓压力、改善睡眠，适合在霜降时节调养身心。',['舒缓减压','调和气息','适合日常']],
  ['八段锦 · 徵调','轻快舒扬 · 10分钟','活跃气血，适合午后练习，振奋心情。','徵调音色明快，配合开弓动作，帮助活血提神，适合午后精力不足时练习。',['提升活力','舒畅心情','适合午后']],
  ['八段锦 · 羽调','沉静滋养 · 14分钟','安定心神，适合夜晚练习，助眠安睡。','羽调深沉静谧，配合攀足动作，帮助放松腰肾，适合夜晚睡前安神。',['安神助眠','滋养腰肾','适合夜晚']]]
 var r=recs[state.rec%recs.length]
 return '<main class="sc navpad" style="display:flex;flex-direction:column;min-height:100dvh">'
 +'<div class="hero"><img class="bg" src="/art/landscape.jpg" alt=""><div class="fade"></div>'
  +'<div class="in">'+brand(5.6)
  +'<div class="t-sub">— 让传统之美，滋养当下的你 —</div>'
  +'<div class="jq">今日 · <span class="o">霜降</span></div>'
  +'<div class="date">10月23日 农历九月初三</div>'
  +'<p class="desc">霜结为霜，万物内敛，<br>正是调养身心的好时节。</p></div></div>'
 +'<div class="center" style="margin-top:1.6rem"><span class="dashline" style="display:inline-flex;font-size:1.6rem;font-weight:700;color:var(--brown);letter-spacing:.2em">'+knot()+'今日推荐</span></div>'
 +'<div class="disc-wrap"><button class="disc" data-a="go-intro">'
  +'<svg class="play" viewBox="0 0 24 24" aria-hidden="true" style="width:4.6rem;height:4.6rem;color:#FFF4E4;margin-bottom:.4rem">'+ic('play').replace('<svg viewBox="0 0 24 24" aria-hidden="true">','').replace('</svg>','')+'</svg>'
  +'<b>开始练</b>'
  +'<svg class="cloud" style="top:3rem;right:2.4rem" viewBox="0 0 60 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22c6-10 16-14 26-10M22 24c8-6 18-8 30-4"/></svg>'
  +'<svg class="cloud" style="bottom:3.4rem;left:2.6rem" viewBox="0 0 60 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22c6-10 16-14 26-10M22 24c8-6 18-8 30-4"/></svg>'
  +'</button>'
  +'<button class="swap" data-a="swap-rec">'+ic('refresh')+'换一个</button></div>'
 +'<div class="rec-cols"><div class="l"><h4>'+r[0]+'</h4><div class="meta">'+r[1]+'</div><p>'+r[2]+'</p>'
  +'<div class="tagrow">'+r[4].map(function(t){return '<span class="tag">'+t+'</span>'}).join('')+'</div></div>'
 +'<div class="r"><h4>为什么推荐给你</h4><p>'+r[3]+'</p></div></div>'
 +'<div class="modebar">'
  +'<button class="mseg'+(state.mode===0?' on':'')+'" data-a="mode" data-i="0"><span class="ic">'+ic('medit')+'</span><span class="tx"><b>八段锦</b><span>经典·全身调养</span></span>'+(state.mode===0?'<span class="ckc">'+ic('check')+'</span>':'')+'</button>'
  +'<button class="mseg'+(state.mode===1?' on':'')+'" data-a="mode" data-i="1"><span class="ic">'+ic('deer')+'</span><span class="tx"><b>五禽戏</b><span>灵动·强筋养气</span></span></button>'
  +'<button class="mseg'+(state.mode===2?' on':'')+'" data-a="mode" data-i="2"><span class="ic">'+ic('dice')+'</span><span class="tx"><b>帮我选</b><span>智能推荐练习</span></span><span class="arr">›</span></button></div>'
 +'<div class="quotebar"><img src="/art/card-landscape.jpg" alt=""><p>霜降水返壑，风落木归山。<i>——《月令七十二候集解》</i></p><img src="/art/q-none.jpg" style="filter:hue-rotate(15deg)" alt=""></div>'
 +nav('home')+'</main>'}

/* ---------- 八段锦进入页（练习准备） ---------- */
function pgIntro(){
 var stageMotif=[
  '<svg viewBox="0 0 100 44"><ellipse cx="50" cy="30" rx="46" ry="12" fill="#DCE8DC" opacity=".55"/><ellipse cx="30" cy="35" rx="20" ry="7" fill="#CBDCCB" opacity=".6"/><ellipse cx="72" cy="36" rx="16" ry="5" fill="#CBDCCB" opacity=".5"/><circle cx="62" cy="24" r="5.5" fill="#C05A2E"/></svg>',
  '<svg viewBox="0 0 100 44"><ellipse cx="50" cy="32" rx="46" ry="10" fill="#DCE8DC" opacity=".5"/><path d="M8 26c14-12 30 8 44-2s26-10 40 0" fill="none" stroke="#5E7C6B" stroke-width="2.6" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 100 44"><ellipse cx="50" cy="30" rx="46" ry="12" fill="#DCE8DC" opacity=".5"/><ellipse cx="50" cy="27" rx="24" ry="8" fill="none" stroke="#8FAF97" stroke-width="1.6"/><ellipse cx="50" cy="27" rx="13" ry="5" fill="none" stroke="#8FAF97" stroke-width="1.6"/><circle cx="50" cy="27" r="4" fill="#C05A2E"/></svg>']
 var stages=[['阶段一 · 点','认识动作 · 建立感觉'],['阶段二 · 线','贯穿动作 · 气息流动'],['阶段三 · 面','完整演练 · 身心融合']]
 return '<main class="sc" style="min-height:100dvh;display:flex;flex-direction:column;padding-bottom:3rem">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><button class="icbtn" aria-label="练习帮助">'+ic('qmark')+'</button></div>'
 +'<div class="intro-hero" style="margin-top:.6rem">'
  +'<img class="bg" src="/art/landscape.jpg" style="object-position:74% 22%" alt=""><div class="fade"></div>'
  +'<img class="fig" src="/art/figure-pose.png" alt="">'
  +'<div class="in">'+brand(5)
  +'<div class="dashline t-sub" style="margin-top:1.4rem">— 调身 · 静心 · 启程 —</div>'
  +'<p class="intro-p" style="margin-top:1.6rem">在古琴的呼吸里，<br>安放自己，<br>从这一刻，开始练习。</p></div></div>'
 +'<section class="card i-sec"><div class="sec-h">'+knot()+'选择练习模式<span class="sec-note">根据你的时间与状态，选择适合的练习内容</span></div>'
  +'<div class="mode-grid">'
   +'<button class="modecard'+(state.imode===0?' sel':'')+'" data-a="imode" data-i="0"><span class="ck">'+ic('check')+'</span>'
    +'<img class="pic" src="/art/figure-pose.png" alt="">'
    +'<div class="tt">全套 <b class="big">8</b> 式</div><div class="meta">约12分钟</div>'
    +'<div class="hr"></div><p>完整体验、循序渐进<br>调身养气，身心更佳</p></button>'
   +'<button class="modecard'+(state.imode===1?' sel':'')+'" data-a="imode" data-i="1">'+(state.imode===1?'<span class="ck">'+ic('check')+'</span>':'<span class="rd"></span>')
    +'<img class="pic" src="/art/card-landscape.jpg" alt="">'
    +'<div class="tt">招牌 <b class="big">3</b> 式</div><div class="meta">约5分钟</div>'
    +'<div class="hr"></div><p>精选核心，轻松跟练<br>快速放松，唤醒状态</p></button>'
  +'</div></section>'
 +'<section class="card i-sec"><div class="sec-h">'+knot()+'选择练习阶段<span class="sec-note">从"点"到"线"再到"面"，循序渐进，稳步提升</span></div>'
  +'<div class="stage-grid">'+stages.map(function(s,i){return '<button class="stagecard'+(state.istage===i?' sel':'')+'" data-a="istage" data-i="'+i+'">'
   +(state.istage===i?'<span class="ck">'+ic('check')+'</span>':'')
   +'<b>'+s[0]+'</b><span>'+s[1]+'</span><span class="motif">'+stageMotif[i]+'</span></button>'}).join('')+'</div></section>'
 +'<section class="card i-sec"><div class="sec-h">'+knot()+'调整环境与取景<span class="sec-note">请按提示调整站位和光线，获得更好的练习体验</span></div>'
  +'<div class="vf-row"><div class="vf"><img src="/art/q-mood.jpg" alt="">'
   +'<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i></div>'
  +'<div class="vf-tx">请后退 <b>1.5−2 米</b>，<br>全身进入取景框，<br>正面受光。</div></div>'
  +'<div class="env-row">'
   +'<div class="env"><span class="c">'+ic('user2')+'</span><b>全身入镜</b><span>从头到脚<br>完整可见</span></div>'
   +'<div class="env"><span class="c">'+ic('sun')+'</span><b>正面受光</b><span>面部清晰<br>避免逆光</span></div>'
   +'<div class="env"><span class="c">'+ic('chair')+'</span><b>环境整洁</b><span>周围无杂物<br>留出练习空间</span></div>'
  +'</div></section>'
 +'<div class="cam-row"><button class="btn" data-a="start-practice">'+ic('camera','width:2.2rem;height:2.2rem')+'开始动作预览</button>'
  +'<button class="btn btn-gho ex" data-a="demo"><span class="pc">'+ic('play','width:1.4rem;height:1.4rem')+'</span>示例</button></div>'
 +'</main>'}

/* ---------- 跟练页 ---------- */
var POSES=['双手托天理三焦','左右开弓似射雕','调理脾胃须单举','五劳七伤往后瞧','摇头摆尾去心火','两手攀足固肾腰','攒拳怒目增气力','背后七颠百病消']
function practicePoses(){return state.imode===1?[POSES[0],POSES[1],POSES[2]]:POSES}
function pgPractice(){var i=state.progress,poses=practicePoses()
 var dots='';for(var k=0;k<poses.length;k++){dots+='<span class="d'+(k===i?' on':'')+'"'+(k===i?' aria-current="step"':'')+'>'+(k+1)+'</span>'}
 var skel='<svg class="skel" viewBox="0 0 100 100" preserveAspectRatio="none" width="30rem">'
  +'<polyline points="50,4 36,14 64,14 46,42 30,34 46,42 54,42 70,34 54,42 38,62 62,62 50,66 44,84 56,84 50,92" fill="none" stroke="rgba(140,220,170,.85)" stroke-width=".7"/>'
  +[[50,4],[36,14],[64,14],[30,34],[70,34],[46,42],[54,42],[38,62],[62,62],[50,66],[44,84],[56,84],[50,92]].map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.5" fill="#8FDCAA" stroke="rgba(255,255,255,.8)" stroke-width=".4"/>'}).join('')+'</svg>'
 var breathN='';var pos=[[55,10],[45,30],[58,50],[42,68],[52,86],[48,94]]
 for(var b=0;b<6;b++){breathN+='<em style="left:'+pos[b][0]+'%;top:'+pos[b][1]+'%;animation-delay:'+(b*.4)+'s"></em>'}
 return '<main class="sc" style="padding-bottom:3rem">'
 +'<div class="p-top"><button class="icbtn" data-a="exit-practice">'+ic('back')+'</button>'
  +'<div class="center"><div class="brand-mid" style="display:flex;align-items:flex-start;justify-content:center;gap:.8rem"><span>弦养</span><span class="seal" style="font-size:.9rem;margin-top:.2rem">弦养</span></div><div class="p-sub">让传统之美，滋养当下的你</div></div>'
  +'<div style="display:flex;gap:.9rem"><button class="icbtn" aria-label="练习音乐">'+ic('music')+'</button><button class="icbtn" aria-label="设置">'+ic('gear')+'</button></div></div>'
 +'<section class="card pinfo"><div><span class="cur">动作预览 · 指标为示例</span><h3><i>第'+(i+1)+'式</i> '+poses[i]+'</h3></div>'
  +'<div class="pstats">'
  +'<div class="pstat"><span class="lb">'+ic('user2')+'上半身</span><div class="v">92<i>%</i></div><div class="bar"><i style="width:92%"></i></div></div>'
  +'<div class="pstat"><span class="lb">'+ic('user2')+'下半身</span><div class="v">88<i>%</i></div><div class="bar"><i style="width:88%"></i></div></div>'
  +'<div class="pstat warn"><span class="lb">'+ic('camera')+'取景完整度</span><div class="v">22<i>%</i></div><div class="bar"><i style="width:22%"></i></div></div></div></section>'
 +'<div class="stage"><img class="bg" src="/art/landscape.jpg" style="object-position:center 40%" alt="">'
  +'<img class="fig" src="/art/figure-pose.png" alt="">'+skel
  +'<div class="bubble"><b>'+ic('volume')+'</b>抬头上托，舒展胸廓，感受三焦通畅。</div>'
  +'<div class="side">'
   +'<button class="sitem on">'+ic('medit')+'动作预览</button>'
   +'<button class="sitem">'+ic('demo')+'动作示范</button>'
   +'<button class="sitem">'+ic('doc')+'动作要点</button>'
   +'<button class="sitem">'+ic('qmark')+'常见问题</button></div>'
  +'<div class="breath-panel"><b>呼吸共鸣</b><div class="strings"><i></i>'+breathN+'</div><span class="side-t">吸气 · 平稳 · 呼气</span><small>气随波动<br>身心相应</small></div>'
  +'<div class="fade-b"></div></div>'
 +'<div class="pdots"><span class="rail"></span>'+dots+'</div>'
 +'<div class="holdrow">···<span class="pill">保持 <b>3</b> 秒</span>···</div>'
 +'<div class="ctrl"><button class="cbtn" data-a="prev-step">'+ic('prev')+'上一个</button>'
  +'<button class="mainc" data-a="toggle-run" aria-label="'+(state.running?'暂停':'继续')+'呼吸动画预览">'+(state.running?ic('pause'):ic('play'))+'</button>'
  +'<button class="cbtn" data-a="next-step">'+ic('next')+'下一个</button></div>'
 +'</main>'}

/* ---------- 结束页 ---------- */
function pgDone(){var colors=[['#7FA08C','准确'],['#D9B25F','偏差'],['#C4472F','未命中']]
 var seed=7;function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
 var rows='';for(var r=0;r<7;r++){var ns=''
  for(var n=0;n<7;n++){var p=rnd();var c=p<.62?'#7FA08C':(p<.87?'#D9B25F':'#C4472F');ns+='<span class="nd" style="left:'+(6+rnd()*88)+'%;background:'+c+'"></span>'}
  rows+='<div class="srow">'+ns+'</div>'}
 return '<main class="sc" style="padding-bottom:3.4rem;position:relative">'
 +'<img class="done-hbg" src="/art/landscape.jpg" alt="">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><button class="icbtn" data-a="share-sheet" aria-label="分享琴谱">'+ic('share')+'</button></div>'
 +'<div style="margin-top:1rem;position:relative">'+brand(4)+'</div>'
 +'<div class="t-sub" style="margin-top:.6rem;position:relative">以琴养心，日日精进</div>'
 +'<h1 class="done-h" style="position:relative">动作预览完成</h1><p class="sec-note" style="position:relative">以下评分与建议为示例，未进行动作识别或测量。</p>'
 +'<p class="done-p" style="position:relative">一曲既终，心自安然。<br>弦音有度，步履生香。</p>'
 +'<section class="card score-card"><div class="ring">'
  +'<svg viewBox="0 0 124 124"><circle cx="62" cy="62" r="52" fill="none" stroke="#EADCC2" stroke-width="9"/>'
  +'<circle cx="62" cy="62" r="52" fill="none" stroke="#5E7C6B" stroke-width="9" stroke-linecap="round" stroke-dasharray="295" stroke-dashoffset="59" transform="rotate(-90 62 62)"/>'
  +'<circle cx="62" cy="10" r="5" fill="#FDF9EF" stroke="#C9A063" stroke-width="2.5"/></svg>'
  +'<div class="in"><b>89<i>分</i></b><span>良好</span></div></div>'
  +'<div class="score-r"><h4>琴音渐稳，心气调和</h4><p>节奏基本准确，音色平稳自然，继续保持，下次会更好！</p>'
  +'<div class="statrow">'
   +'<div class="st"><span class="lb">'+ic('timer')+'练习时长</span><div class="v">12<i>分钟</i></div><small>专注投入</small></div>'
   +'<div class="st"><span class="lb">'+ic('bars')+'命中数</span><div class="v">146<i>/162</i></div><small>准确率 90%</small></div>'
   +'<div class="st"><span class="lb">'+ic('cal')+'连续打卡</span><div class="v">7<i>天</i></div><small>持之以恒</small></div></div></div></section>'
 +'<section class="card trackcard"><span class="sq">'+ic('music')+'</span>'
  +'<div class="tx"><b>双手托天理三焦 <i>›</i></b><span>'+practicePoses().length+' 式预览 · 平和舒展</span></div>'
  +'<button class="rep">'+ic('play')+'完整回放</button></section>'
 +'<div class="fret"><span class="lab">一二三四五六七</span>'+rows
  +'<div class="legend">'+colors.map(function(c){return '<span><i style="background:'+c[0]+'"></i>'+c[1]+'</span>'}).join('')+'</div></div>'
 +'<section class="card" style="padding:1.6rem;margin-top:1.6rem">'
  +'<div class="sec-h">'+knot()+'练习反馈<button class="sec-note">查看详细分析 ›</button></div>'
  +'<div class="fb-grid">'
   +'<div class="fb"><span class="fimg"><img src="/art/figure-pose.png" alt=""></span><b>动作纠错</b><p>右手按弦时手腕略高，建议放松肩颈，手腕自然下沉。</p></div>'
   +'<div class="fb"><span class="fimg"><img src="/art/guqin.png" alt=""></span><b>改正方法</b><p>练习时保持手臂放松以肘带手，注意指尖发力，控制力度。</p></div>'
   +'<div class="fb"><span class="ic">'+ic('target')+'</span><b>明日目标</b><p>继续练习本曲第3段，提升节奏稳定性，尝试达到 90% 以上。</p></div>'
   +'<div class="fb"><span class="ic">'+ic('lotus')+'</span><b>鼓励话语</b><p>今日的坚持，让心更平静。每一次，皆是进步，继续加油！</p></div></div></section>'
 +'<section class="card" style="padding:1.6rem;margin-top:1.4rem">'
  +'<div class="sec-h">'+knot()+'今日食养推荐<button class="sec-note">顺时而食，滋养身心 ›</button></div>'
  +'<div class="food"><div class="picw"><img src="/art/q-food.jpg" alt=""></div>'
  +'<div class="tx"><b>百合莲子羹</b><div class="tags"><span class="tag grn">养心安神</span><span class="tag org">润燥助眠</span><span class="tag">适合今日</span></div>'
  +'<p>根据你今日的练习状态，推荐滋养心神的百合莲子羹，有助于舒缓情绪、宁心安神，帮助提升睡眠质量，让身心更好地恢复。</p></div></div></section>'
 +'<div class="done-btns"><button class="btn btn-green" data-a="finish" style="flex:1.2">'+ic('check','width:2rem;height:2rem')+'完成打卡</button>'
  +'<button class="btn btn-gho" data-a="again">'+ic('refresh','width:1.8rem;height:1.8rem;color:#6B4226')+'再练一次</button>'
  +'<button class="btn btn-gho" data-a="share-sheet">'+ic('share','width:1.8rem;height:1.8rem;color:#6B4226')+'分享琴谱</button></div>'
 +'</main>'}

/* ---------- 我的页 ---------- */
function pgProfile(){return '<main class="sc navpad" style="min-height:100dvh;display:flex;flex-direction:column">'
 +'<div class="top"><span></span><div style="display:flex;gap:1rem"><button class="icbtn" aria-label="通知">'+ic('bell')+'<span class="dot"></span></button><button class="icbtn" aria-label="设置">'+ic('gear')+'</button></div></div>'
 +'<div class="brandrow" style="margin-top:1rem"><span class="t-callig" style="font-size:4.6rem">我的</span><span class="seal">弦养</span></div>'
 +'<div class="t-sub" style="margin-top:1rem">在弦音中，遇见更好的自己</div>'
 +'<div class="pf-row"><div class="avatar"><img src="/art/q-mood.jpg" alt=""><span class="cam">'+ic('camera')+'</span></div>'
  +'<div><h3>清弦月 <i>›</i></h3><span class="stagepill">'+ic('lotus')+'中级阶段 ›</span>'
  +'<div class="xprow"><div class="bar"><i></i></div><span>360 / 600</span></div>'
  +'<p class="pf-desc">继续练习，舒展身心，遇见更平和的自己。</p></div></div>'
 +'<section class="card bodycard"><div class="sec-h">'+knot()+'身体数据<span class="sec-note">示例指标 · 未连接设备</span></div>'
  +'<div class="bstats">'
   +'<div class="bstat"><span class="ic pink">'+ic('heart')+'</span><div class="lb">心率</div><div class="v">72</div><div style="font-size:1.2rem;color:var(--muted)">次/分</div><span class="tag grn st">正常</span></div>'
   +'<div class="bstat"><span class="ic ind">'+ic('moon')+'</span><div class="lb">睡眠时长</div><div class="v">6.5</div><div style="font-size:1.2rem;color:var(--muted)">小时</div><span class="tag grn st">良好</span></div>'
   +'<div class="bstat"><span class="ic grn">'+ic('lotus')+'</span><div class="lb">身心评分</div><div class="v">92</div><div style="font-size:1.2rem;color:var(--muted)">分</div><span class="tag grn st">状态平和</span></div>'
   +'<div style="display:flex;align-items:center"><button class="btn btn-green btn-sm" style="min-height:4.8rem" data-a="go-body">查看详情 ›</button></div>'
  +'</div></section>'
 +'<div class="halfgrid">'
  +'<section class="card half"><div class="sec-h" style="color:var(--green-deep)">'+ic('bars','width:2rem;height:2rem')+'历史数据 ›</div><p>记录每一次的练习与变化，见证更好的自己。</p>'
   +'<div class="minibars"><i style="height:34%"></i><i style="height:52%"></i><i style="height:40%"></i><i style="height:66%"></i><i style="height:48%"></i><i style="height:78%"></i><i style="height:58%"></i><i style="height:90%"></i><i style="height:70%"></i><i style="height:100%"></i></div></section>'
  +'<section class="card half"><div class="sec-h" style="color:var(--green-deep)">'+ic('leaf','width:2rem;height:2rem')+'阶段进度 ›</div>'
   +'<p style="color:var(--brown);font-weight:600;margin-top:1rem">八段锦·中级阶段</p><p>已完成 3 / 8 节</p>'
   +'<div class="dots8"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i><i></i><i></i></div></section></div>'
 +'<section class="card setlist">'
  +'<div class="setrow"><span class="ic">'+ic('gear')+'</span><b>基础设置</b><span>账号管理、提醒设置、个性化偏好</span><span class="r">›</span></div>'
  +'<div class="setrow"><span class="ic">'+ic('headset')+'</span><b>帮助与反馈</b><span>常见问题、意见反馈、联系我们</span><span class="r">›</span></div>'
  +'<div class="setrow"><span class="ic">'+ic('info')+'</span><b>版本信息</b><span>当前版本为最新版</span><span class="r">v1.0.0 ›</span></div></section>'
 +nav('profile')+'</main>'}

/* ---------- 身体数据页 ---------- */
function pgBody(){function chips(name,opts,multi){return '<div class="chips">'+opts.map(function(o){var v=o[0],icn=o[1]||'',sel=state[name].indexOf(v)>=0
   return '<button class="chip'+(sel?' sel':'')+'" data-a="chip" data-name="'+name+'" data-v="'+v+'" data-multi="'+(multi?1:0)+'">'+(icn?ic(icn):'')+v
    +'<span class="ck">'+ic('check')+'</span></button>'}).join('')+'</div>'}
 return '<main class="sc" style="padding-bottom:3.4rem">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><span></span></div>'
 +'<div class="bd-hero"><img class="bg" src="/art/landscape.jpg" alt=""><img class="fig" src="/art/figure-pose.png" alt=""><div class="fade"></div>'
  +'<div class="in"><div style="display:flex;align-items:flex-start;gap:1rem"><span class="bd-h">身体数据</span><span class="seal">弦养</span></div>'
  +'<div class="bd-sub">补充身体数据，解锁定制推荐</div>'
  +'<p class="bd-p">因人而异，顺时而练，<br>让古法智慧，更好地陪伴你的日常。</p></div></div>'
 +'<section class="bdcard card"><div class="sec-h">'+knot()+'基础信息</div><p class="desc">填写基本身体数据，帮助我们为你生成更精准的练习方案。</p>'
  +'<div class="steppers">'
   +'<div class="stp"><span class="lb">'+ic('user2')+'身高 (cm)</span><div class="ctl"><button data-a="stp" data-k="h" data-d="-1">−</button><b>'+state.body.h+'</b><button data-a="stp" data-k="h" data-d="1">＋</button></div></div>'
   +'<div class="stp"><span class="lb">'+ic('moon')+'体重 (kg)</span><div class="ctl"><button data-a="stp" data-k="w" data-d="-1">−</button><b>'+state.body.w+'</b><button data-a="stp" data-k="w" data-d="1">＋</button></div></div>'
   +'<div class="stp"><span class="lb">'+ic('cal')+'年龄 (岁)</span><div class="ctl"><button data-a="stp" data-k="a" data-d="-1">−</button><b>'+state.body.a+'</b><button data-a="stp" data-k="a" data-d="1">＋</button></div></div></div></section>'
 +'<section class="bdcard card"><div class="sec-h">'+knot()+'既往运动损伤或慢性疾病</div><p class="desc">选择你有的运动损伤或慢性不适（可多选）</p>'
  +chips('inj',[['颈肩','user2'],['腰背','spine'],['膝盖','knee'],['手腕','hand'],['无','ban']],true)+'</section>'
 +'<section class="bdcard card"><div class="sec-h">'+knot()+'主要练习目标</div><p class="desc">选择你希望通过练习达成的目标（可多选）</p>'
  +chips('goals',[['舒缓肩颈','user2'],['改善睡眠','moon'],['调理脾胃','stomach'],['提神','sun'],['无所谓','dots']],true)+'</section>'
 +'<section class="bdcard card"><div class="sec-h">'+knot()+'饮食偏好</div><p class="desc">选择你的饮食偏好，帮助我们推荐更合适的养生建议。</p>'
  +chips('diet',[['素食','leaf'],['少盐','salt'],['无特殊','bowl']],true)+'</section>'
 +'<section class="bdcard card togrow"><div class="tx"><b>是否接收每日食谱推荐</b><p>根据你的体质与目标，推荐个性化的三餐食养建议。</p></div>'
  +'<button class="tog'+(state.recipe?' on':'')+'" data-a="tog" role="switch" aria-label="接收每日食谱推荐" aria-checked="'+state.recipe+'"></button></section>'
 +'<div class="save-wrap"><button class="btn" data-a="save-body">保存身体设置 '+ic('chev','width:1.5rem;height:1.5rem')+'</button></div>'
 +'</main>'}

/* ---------- 渲染 & 事件 ---------- */
var PAGES={loading:pgLoading,question:pgQuestion,audio:pgAudio,home:pgHome,intro:pgIntro,practice:pgPractice,done:pgDone,profile:pgProfile,body:pgBody}
function paint(){
  var active=document.activeElement,buttons=Array.from(root.querySelectorAll('button')),focusIndex=buttons.indexOf(active);
  document.title='弦养';root.dataset.screen=state.screen;root.innerHTML=(PAGES[state.screen]||pgLoading)();
  root.querySelector('main').setAttribute('tabindex','-1');
  root.querySelectorAll('button').forEach(function(b){
    b.type='button';var a=b.dataset.a;
    if(a==='back'||a==='exit-practice')b.setAttribute('aria-label','返回');
    if(a==='stp')b.setAttribute('aria-label',(b.dataset.d==='1'?'增加':'减少')+({h:'身高',w:'体重',a:'年龄'})[b.dataset.k]);
    if(['chip','qsel','organ','mode','imode','istage'].indexOf(a)>=0)b.setAttribute('aria-pressed',String(b.classList.contains('sel')||b.classList.contains('on')));
    if(!a){b.dataset.a='unavailable';b.dataset.label=b.getAttribute('aria-label')||b.textContent.trim()||'此功能'}
    if(!b.getAttribute('aria-label')&&!b.textContent.trim())b.setAttribute('aria-label','查看功能说明');
  });
  root.querySelectorAll('.setrow').forEach(function(row){row.setAttribute('role','button');row.tabIndex=0;row.dataset.a='unavailable';row.dataset.label=row.querySelector('b').textContent});
  var stage=root.querySelector('.stage');if(stage){stage.classList.toggle('paused',!state.running);stage.dataset.preview='true'}
  if(focusIndex>=0){var next=root.querySelectorAll('button')[focusIndex];if(next)next.focus({preventScroll:true})}
}
function go(s){state.screen=s;paint();window.scrollTo(0,0);root.querySelector('main').focus({preventScroll:true})}

document.addEventListener('click',function(e){
  var el=e.target.closest('[data-a]');if(!el)return
  var a=el.getAttribute('data-a')
  switch(a){
    case 'load-enter':state.qIndex=0;state.qSel=null;state.answers=[];go('question');break
    case 'back':go(state.screen==='body'?'profile':'home');break
    case 'qsel':state.qSel=+el.getAttribute('data-i');state.answers[state.qIndex]=state.qSel;paint();break
    case 'q-prev':if(state.qIndex>0){state.qIndex--;state.qSel=typeof state.answers[state.qIndex]==='number'?state.answers[state.qIndex]:null;paint()}else go('home');break
    case 'q-next':if(typeof state.qSel!=='number'){toast('请选择一项后再继续');return}state.answers[state.qIndex]=state.qSel;if(state.qIndex<6){state.qIndex++;state.qSel=typeof state.answers[state.qIndex]==='number'?state.answers[state.qIndex]:null;paint()}else go('home');break
    case 'q-skip':go('home');break
    case 'nav-audio':go('audio');break
    case 'nav-home':go('home');break
    case 'nav-intro':go('intro');break
    case 'nav-profile':go('profile');break
    case 'go-intro':go('intro');break
    case 'swap-rec':state.rec++;paint();toast('已为你换一份推荐');break
    case 'mode':if(el.dataset.i!=='0'){toast(el.dataset.i==='1'?'五禽戏尚未提供，当前可预览八段锦':'当前推荐为本地示例，尚未接入 AI 推荐');break}state.mode=0;paint();break
    case 'imode':state.imode=+el.getAttribute('data-i');paint();break
    case 'istage':state.istage=+el.getAttribute('data-i');paint();break
    case 'demo':location.href='s4/#/guide';break
    case 'organ':state.organ=+el.getAttribute('data-i');paint();break
    case 'swap-tracks':toast('当前仅有这四首曲目资料，未提供更多音源');break
    case 'random-track':state.track=Math.floor(Math.random()*4);paint();toast('已选择曲目预览；未提供音源，无法播放');break
    case 'track-prev':state.track=(Math.max(0,state.track)+3)%4;paint();break
    case 'track-next':state.track=(Math.max(0,state.track)+1)%4;paint();break
    case 'track-list':var list=root.querySelector('.track');if(list)list.scrollIntoView({block:'center'});break
    case 'play':state.track=+el.getAttribute('data-i');paint();toast('未提供该曲音源，无法播放；当前仅为曲目预览');break
    case 'start-practice':{
      // 接入 xianyang-s4 的真实视觉身体识别（MediaPipe 姿态 + 八段锦判定 + 古琴拨弦）。
      // 按当前所选「练习阶段」映射到 s4 的三个页面，与 s4 准备页的 begin() 规则一致：
      //   一·点 → 跟练页 /train · 二·线 → 短句工坊 /workshop · 三·面 → 十二分钟弧线 /arc
      var stageMap=[['train','point'],['workshop','line'],['arc','arc']];
      var pick=stageMap[state.istage]||stageMap[0];
      state.progress=0;state.running=true;
      toast('正在进入动作预览…');
      location.href='s4/#/'+pick[0]+'?stage='+pick[1]+'&mode='+(state.imode===1?'short':'full')+'&style=baduanjin&tone=gong';
      break}
    case 'skip-intro':go('home');break
    case 'go-body':go('body');break
    case 'exit-practice':state.running=false;go('home');break
    case 'toggle-run':state.running=!state.running;paint();break
    case 'prev-step':if(state.progress>0){state.progress--;paint()}else toast('已经是第一式');break
    case 'next-step':if(state.progress<practicePoses().length-1){state.progress++;paint()}else{state.running=false;go('done')}break
    case 'finish':go('home');toast('动作预览已结束；尚未接入真实打卡记录');break
    case 'again':state.progress=0;state.running=true;go('practice');break
    case 'share-sheet':toast('未生成真实琴谱或分享文件，暂不可分享');break
    case 'unavailable':toast((el.dataset.label||el.getAttribute('aria-label')||el.textContent.trim()||'此功能')+'：当前仅为界面示例，尚未接入实际功能');break
    case 'stp':var k=el.getAttribute('data-k'),d=+el.getAttribute('data-d');if(!Object.prototype.hasOwnProperty.call(BODY_LIMITS,k)||(d!==1&&d!==-1))return;
      var value=bodyValue(k,state.body[k]+d);if(value===state.body[k])toast('已达到允许范围 '+BODY_LIMITS[k].join('–'));state.body[k]=value;saveBodyState();paint();break
    case 'chip':var nm=el.getAttribute('data-name'),v=el.getAttribute('data-v');if(!Object.prototype.hasOwnProperty.call(BODY_OPTIONS,nm)||BODY_OPTIONS[nm].indexOf(v)<0)return;
      var arr=state[nm].slice(),ix=arr.indexOf(v);
      if(v===BODY_NONE[nm])arr=[v];else{arr=arr.filter(function(item){return item!==BODY_NONE[nm]});if(ix>=0)arr=arr.filter(function(item){return item!==v});else arr.push(v)}
      state[nm]=bodyChoices(nm,arr);saveBodyState();paint();break
    case 'tog':state.recipe=!state.recipe;saveBodyState();paint();break
    case 'save-body':var saved=saveBodyState();go('profile');toast(saved?'身体设置已保存到本机；未接入 AI 方案生成':'本机存储不可用，设置仅在本次访问保留');break
  }
})

document.addEventListener('keydown',function(e){var el=e.target.closest('[role="button"][data-a]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.click()}})

/* URL 直达（预览用） */
function init(){
  root=document.getElementById('app')
  root.classList.add('phone');loadBodyState();
  var q=new URLSearchParams(location.search)
  if(q.get('first')==='1'){try{localStorage.removeItem('xy-state')}catch(_){}}
  var sv=q.get('screen');if(sv&&PAGES[sv]){state.screen=sv}
  paint()
}
init()
})()
