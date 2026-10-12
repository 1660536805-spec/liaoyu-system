/* 弦养 · 页面状态机（按最终版 9 张设计稿一比一复刻）
   1rem = 设计稿 10pt（见 app.css） */
(function(){
'use strict';
var root, state={
  screen:'loading', first:true,
  qIndex:0, qSel:null,
  answers:[], organ:0, track:0,
  quiz:null,                      // 问诊结果（localStorage['xy-quiz']），驱动推荐
  mode:0, rec:0, imode:0, istage:0,
  progress:0, running:false,
  side:0, breath:0, hold:0,
  body:{h:165,w:55,a:28},
  inj:['无'], goals:['舒缓肩颈'], diet:['少盐'], recipe:true,
  jrDraft:{sleep:null,energy:null},  // 「每日一记」弹层打开期间的草稿
  ask:{msgs:null,typing:false,ctrl:null,gen:0,briefDone:false,lastQ:'',draft:[]}  // 问询页：真实历史/简报落 localStorage，气泡模型含 greet/brief/n 标记；draft=待发附件
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
 heart2:'<path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3 1.4-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.2C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
 edit:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l.9-3.1L16.2 5.6a2.2 2.2 0 0 1 3.1 0l.1.1a2.2 2.2 0 0 1 0 3.1L8.1 20.1 4 20z"/><path d="M14.6 7.4l3 3"/></g>',
 download:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></g>',
 copy:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></g>',
 plus:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></g>',
 x:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></g>',
 trash:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M9.5 10.5v6M14.5 10.5v6"/></g>',
 folder:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></g>',
 image:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9.5" cy="10" r="1.6"/><path d="m5 17 4.5-4 3.2 2.8L16 12.5 20 16"/></g>',
 retry2:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/></g>'
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

/* ==================== 音频引擎（真实音源） ====================
   音源全部在仓库内，无外部依赖：
     /guqin/listen/meihua-sannong.mp3   《梅花三弄》真录音 6:28  · RafaelCaro · CC BY 4.0
     /guqin/listen/zuiyu-changwan.mp3   《醉渔唱晚》卫仲乐1934 3:04 · archive.org CC0
     /guqin/listen/qixian-sanyin.mp3    七弦三引（调弦试音）7.2s
     /guqin/N-xiang-*.ogg               七弦散音单音（正调 C–D–F–G–A–c–d）
   ⚠️ 署名要求（见 guqin/README.md）：对外发布须在「关于/致谢」处保留
      「音色素材：RafaelCaro, CC BY 4.0」——主壳放在「设置 › 关于本曲库」里。
   ⚠️ 曲库红线（与 s4 曲库一致）：无干净音源的曲目不进列表、不出现不可播的按钮。 */
var SRC={
  meihua:'/guqin/listen/meihua-sannong.mp3',
  zuiyu:'/guqin/listen/zuiyu-changwan.mp3',
  sanyin:'/guqin/listen/qixian-sanyin.mp3',
  strings:['/guqin/1-xiang-C2.ogg','/guqin/2-xiang-D2.ogg','/guqin/3-xiang-F2.ogg','/guqin/4-xiang-G2.ogg','/guqin/5-xiang-A2.ogg','/guqin/6-xiang-C3.ogg','/guqin/7-xiang-D3.ogg'],
  stringsAlt:['/guqin/listen/string-1.wav','/guqin/listen/string-2.wav','/guqin/listen/string-3.wav','/guqin/listen/string-4.wav','/guqin/listen/string-5.wav','/guqin/listen/string-6.wav','/guqin/listen/string-7.wav']
};
var STRING_NAMES=['一弦 · C2','二弦 · D2','三弦 · F2','四弦 · G2','五弦 · A2','六弦 · C3','七弦 · D3'];
/* 曲库：只列真有音源的曲目。dur 为实测秒数（资源变更时以元数据为准自动校正）。 */
var TRACKS=[
 {key:'meihua',title:'梅花三弄',desc:'清音入肺，涤尘安神。',tone:'综合 · 收束',cls:'grn',
  tags:['落定收功','清心静气'],dur:388,img:'/art/q-none.jpg',pic:'filter:hue-rotate(160deg) saturate(.55)',
  credit:'《梅花三弄》真录音 · RafaelCaro · CC BY 4.0'},
 {key:'zuiyu',title:'醉渔唱晚',desc:'渔舟唱晚，水天一色，明快开阔。',tone:'徵 · 心',cls:'org',
  tags:['安神助眠','平稳情绪'],dur:184,img:'/art/card-landscape.jpg',pic:'',
  credit:'《醉渔唱晚》卫仲乐 1934 · archive.org CC0'},
 /* 第三首：并入分支 web 曲库中唯一带真实音源的曲目（守红线：只收有音源的）。
    key 复用 SRC.sanyin＝/guqin/listen/qixian-sanyin.mp3（实测 7.2s 散音试音）。 */
 {key:'sanyin',title:'七弦散音',desc:'七弦依次拨响，宫商角徵羽。',tone:'宫 · 脾',cls:'org',
  tags:['平和承载','收功静坐'],dur:7,img:'/art/card-landscape.jpg',pic:'filter:sepia(.5)',
  credit:'《七弦散音》真录音 · RafaelCaro · CC BY 4.0'}
];
var AUDIO={vol:.85,loop:false,sound:true,mus:null,pool:{},ctx:null};
function loadAudioPref(){try{var x=JSON.parse(localStorage.getItem('xy-audio')||'null');if(!x||typeof x!=='object')return;
  if(typeof x.vol==='number'&&isFinite(x.vol))AUDIO.vol=Math.max(0,Math.min(1,x.vol));
  if(typeof x.loop==='boolean')AUDIO.loop=x.loop;
  if(typeof x.sound==='boolean')AUDIO.sound=x.sound}catch(_){}}
function saveAudioPref(){try{localStorage.setItem('xy-audio',JSON.stringify({vol:AUDIO.vol,loop:AUDIO.loop,sound:AUDIO.sound}))}catch(_){toast('本机存储不可用，音频偏好仅在本次访问保留')}}
/* 移动端/桌面端的自动播放策略：任何一次真实点击里先唤醒 AudioContext */
function unlockAudio(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!AUDIO.ctx)AUDIO.ctx=new C();
  if(AUDIO.ctx.state!=='running')AUDIO.ctx.resume()}catch(_){}}
function fmtT(s){s=Math.max(0,Math.floor(s||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function trackOf(key){for(var i=0;i<TRACKS.length;i++)if(TRACKS[i].key===key)return TRACKS[i];return null}
function trackTitle(key){var t=trackOf(key);return t?t.title:(key==='sanyin'?'七弦三引':'')}
/* 当前播放器应显示的曲目序号：正在播的那首优先，否则用已选序号 */
function audioIdx(){var k=musKey();for(var i=0;i<TRACKS.length;i++)if(TRACKS[i].key===k)return i;return Math.max(0,Math.min(TRACKS.length-1,state.track))}
/* 长曲单例：同一个 <audio>，切曲只换 src，避免并发播放 */
function musEl(){if(AUDIO.mus)return AUDIO.mus;var a=new Audio();a.preload='metadata';a.volume=AUDIO.vol;a.dataset.key='';
  a.style.display='none';document.body.appendChild(a);
  a.addEventListener('timeupdate',syncAudioUI);
  a.addEventListener('durationchange',syncAudioUI);
  a.addEventListener('loadedmetadata',syncAudioUI);
  a.addEventListener('play',syncAudioUI);
  a.addEventListener('pause',syncAudioUI);
  a.addEventListener('ended',function(){if(AUDIO.loop){try{a.currentTime=0}catch(_){}var p=a.play();if(p&&p.catch)p.catch(function(){})}else{state.playing=false;syncAudioUI();toast('一曲终了 · '+trackTitle(a.dataset.key))}});
  AUDIO.mus=a;return a}
function musicPlaying(){return !!(AUDIO.mus&&!AUDIO.mus.paused&&!AUDIO.mus.ended)}
function musKey(){return AUDIO.mus?AUDIO.mus.dataset.key:''}
function playKey(key,opt){var a=musEl();unlockAudio();
  if(a.dataset.key!==key){a.dataset.key=key;a.src=SRC[key]||key}
  a.loop=(opt&&typeof opt.loop==='boolean')?opt.loop:!!AUDIO.loop;
  a.volume=Math.max(0,Math.min(1,AUDIO.vol*(opt&&opt.gain?opt.gain:1)));
  var p=a.play();
  if(p&&p.catch)p.catch(function(){state.playing=false;syncAudioUI();toast('浏览器拦截了播放，再点一次 ▶ 即可开始')});
  state.playing=true;syncAudioUI();}
function pauseMusic(){if(AUDIO.mus){AUDIO.mus.pause()}state.playing=false;syncAudioUI()}
function stopMusic(){if(AUDIO.mus){try{AUDIO.mus.pause()}catch(_){}}state.playing=false}
function toggleKey(key,opt){if(musicPlaying()&&musKey()===key){pauseMusic()}else{playKey(key,opt)}}
/* 七弦散音：one-shot，连点可重启；ogg 优先，失败自动退回 wav */
function pluckString(i,opt){i=+i;if(!(i>=0&&i<7))return;unlockAudio();
  var a=AUDIO.pool['s'+i];
  if(!a){a=new Audio();a.preload='auto';a.src=SRC.strings[i];AUDIO.pool['s'+i]=a;a.style.display='none';document.body.appendChild(a);
    a.addEventListener('error',function(){if(a.src.indexOf('/listen/string-')<0){a.src=SRC.stringsAlt[i];try{a.currentTime=0}catch(_){}var p=a.play();if(p&&p.catch)p.catch(function(){})}},{once:true})}
  if(AUDIO.sound||(opt&&opt.force)){a.volume=Math.max(0,Math.min(1,AUDIO.vol*(opt&&opt.gain?opt.gain:.95)));try{a.currentTime=0}catch(_){}
    var p=a.play();if(p&&p.catch)p.catch(function(){})}}
/* 只改音频相关 DOM，不重绘整页 —— 重绘会重建 <audio> 之外的节点并打断播放动画 */
function syncAudioUI(){
  if(!root)return;
  var a=AUDIO.mus,playing=musicPlaying(),key=musKey();
  state.playing=playing;
  var curT=a?a.currentTime:0,dur=(a&&isFinite(a.duration)&&a.duration>0)?a.duration:0;
  var pIdx=-1;for(var i=0;i<TRACKS.length;i++)if(TRACKS[i].key===key){pIdx=i;break}
  var shown=pIdx>=0?TRACKS[pIdx]:TRACKS[Math.max(0,state.track)]||TRACKS[0];
  var shownDur=dur&&pIdx>=0?dur:(shown.dur||0);
  var bar=root.querySelector('.player .pbar i');
  if(bar)bar.style.width=(shownDur?Math.min(100,(pIdx>=0?curT:0)/shownDur*100):0)+'%';
  var ts=root.querySelectorAll('.player .times span');
  if(ts.length>=2){ts[0].textContent=fmtT(pIdx>=0?curT:0);ts[1].textContent=shownDur?fmtT(shownDur):'--:--'}
  var pc=root.querySelector('.player .pc');
  if(pc){var on=playing&&pIdx>=0;pc.innerHTML=ic(on?'pause':'play');pc.setAttribute('aria-label',on?'暂停':'播放 '+shown.title)}
  var live=root.querySelector('.player .live');
  if(live)live.innerHTML=ic('music','width:1.2rem;height:1.2rem')+(playing&&pIdx>=0?'正在播放 · 真人录音':(playing?'正在播放 · '+trackTitle(key):'真人录音 · 点 ▶ 播放'));
  var pts=root.querySelector('.player .tt');
  if(pts&&(!playing||pIdx>=0))pts.innerHTML=shown.title+' <i aria-hidden="true">♡</i>';
  var pdesc=root.querySelector('.player .pr>p');if(pdesc)pdesc.textContent=shown.desc;
  var ptags=root.querySelector('.player .tags');
  if(ptags)ptags.innerHTML='<span class="tag '+shown.cls+'">'+shown.tone+'</span>'+shown.tags.map(function(t){return '<span class="tag">'+t+'</span>'}).join('');
  var ppic=root.querySelector('.player .pic');
  if(ppic){ppic.src=shown.img;ppic.style.cssText=shown.pic||''}
  root.querySelectorAll('.track .play-c').forEach(function(b){var ix=+b.getAttribute('data-i');var act=playing&&TRACKS[ix]&&TRACKS[ix].key===key;
    b.classList.toggle('on',act);b.innerHTML=ic(act?'pause':'play');b.setAttribute('aria-label',(act?'暂停 ':'播放 ')+TRACKS[ix].title)});
  root.querySelectorAll('.track .dur').forEach(function(el){var ix=+el.getAttribute('data-i');var d=(playing&&TRACKS[ix]&&TRACKS[ix].key===key&&dur)?dur:TRACKS[ix].dur;el.textContent=fmtT(d)});
  root.querySelectorAll('[data-a="loop"]').forEach(function(lb){
    lb.style.color=AUDIO.loop?'var(--terra)':'';
    lb.setAttribute('aria-pressed',String(AUDIO.loop));
    if(lb.classList.contains('sec-note'))lb.innerHTML=ic('refresh','width:1.4rem;height:1.4rem')+(AUDIO.loop?'循环中':'循环播放')});
  var mb=root.querySelector('[data-a="music-toggle"]');
  if(mb){var onp=playing;mb.innerHTML=ic(onp?'pause':'music');mb.setAttribute('aria-label',onp?'暂停练习音乐':'播放练习音乐')}
  var rb=root.querySelector('.trackcard .rep');
  if(rb){var ron=playing&&key==='meihua';rb.innerHTML=ic(ron?'pause':'play')+(ron?'暂停回放':'完整回放')}
}

/* ==================== 打卡记录 / 我的（真实存储） ====================
   设计稿里「我的」页的百分比、天数、XP 都是稿面固定值；首屏必须与设计稿一致，
   因此下面一律：**没有真实记录时用设计稿默认值**，有记录时才切到真实数据。 */
var DESIGN={xp:360,xpMax:600,streak:7,stageDone:3,
  bars:[34,52,40,66,48,78,58,90,70,100]};
function ymdd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function today(){return ymdd(new Date())}

/* ==================== 今日节气 / 农历（真实日期，不再写死「霜降 · 10月23日」） ====================
   节气：太阳视黄经法（Meeus《Astronomical Algorithms》25 章）算 24 节气交节时刻，
        视黄经误差 < 0.01°，对应时刻误差约 ±10 分钟；与 2025/2026 公开历书逐项核对一致。
   农历：直接用浏览器内置中国历 Intl('zh-CN-u-ca-chinese')，不自抄数据表（易错、易过期）。
   两者都只做展示用途，不做择时/医疗判断。 */
var LUNAR_DAY=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
var _lunFmt=null;
function lunarDate(d){try{
  if(!_lunFmt)_lunFmt=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{year:'numeric',month:'long',day:'numeric'});
  var g={};_lunFmt.formatToParts(d).forEach(function(p){g[p.type]=p.value});
  var n=parseInt(g.day,10);
  return {month:g.month||'',day:LUNAR_DAY[n-1]||('初'+n),yearName:g.yearName||''};
}catch(_){return null}}
function jdFromDate(y,m,dd,h){if(m<=2){y-=1;m+=12}var A=Math.floor(y/100),B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+dd+B-1524.5+(h||0)/24}
function jdToYMD(jd){var z=jd+0.5,Z=Math.floor(z),F=z-Z,A=Z;
  if(Z>=2299161){var a=Math.floor((Z-1867216.25)/36524.25);A=Z+1+a-Math.floor(a/4)}
  var B=A+1524,C=Math.floor((B-122.1)/365.25),D=Math.floor(365.25*C),E=Math.floor((B-D)/30.6001);
  var day=B-D-Math.floor(30.6001*E)+F,month=E<14?E-1:E-13,year=month>2?C-4716:C-4715;
  return {y:year,m:month,d:Math.floor(day)}}
function sunLong(jd){var T=(jd-2451545)/36525,R=Math.PI/180;
  var L0=280.46646+36000.76983*T+0.0003032*T*T,M=357.52911+35999.05029*T-0.0001537*T*T,Mr=M*R;
  var C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);
  var om=(125.04-1934.136*T)*R,la=L0+C-0.00569-0.00478*Math.sin(om);
  return ((la%360)+360)%360}
var TERMS=[['小寒',285],['大寒',300],['立春',315],['雨水',330],['惊蛰',345],['春分',0],['清明',15],['谷雨',30],['立夏',45],['小满',60],['芒种',75],['夏至',90],['小暑',105],['大暑',120],['立秋',135],['处暑',150],['白露',165],['秋分',180],['寒露',195],['霜降',210],['立冬',225],['小雪',240],['大雪',255],['冬至',270]];
function termInstant(year,i){var tg=TERMS[i][1],jd=jdFromDate(year,1,6,0)+i*15.22;
  for(var k=0;k<12;k++){var df=sunLong(jd)-tg;df=((df+180)%360+360)%360-180;if(Math.abs(df)<1e-7)break;jd-=df/0.9856}
  return jdToYMD(jd+8/24)}
function currentTerm(d){var y=d.getFullYear(),now=y*10000+(d.getMonth()+1)*100+d.getDate(),best=null;
  for(var yy=y-1;yy<=y+1;yy++)for(var i=0;i<24;i++){var t=termInstant(yy,i),k=t.y*10000+t.m*100+t.d;
    if(k<=now&&(!best||k>best.k))best={k:k,i:i,t:t}}
  return {name:TERMS[best.i][0],index:best.i,m:best.t.m,d:best.t.d}}
/* 季节：按节气序号划分（小寒=0…冬至=23） */
function seasonOfTerm(i){return (i>=2&&i<=7)?'春':((i>=8&&i<=13)?'夏':((i>=14&&i<=19)?'秋':'冬'))}
/* 节气一句话：物候 + 当下调养建议（自撰描述文字，不冒充古籍引文） */
var TERM_DESC={
 小寒:['小寒时处二三九，','宜静养藏精、避寒就温。'],
 大寒:['寒气之逆极，','宜温补固本，静待春回。'],
 立春:['东风解冻，蛰虫始振，','正是舒展肝气的好时节。'],
 雨水:['天一生水，润物无声，','宜健脾祛湿，调畅情志。'],
 惊蛰:['春雷始鸣，万物复苏，','宜舒展筋骨，唤醒阳气。'],
 春分:['昼夜均分，寒暑相平，','宜平衡阴阳，不偏不倚。'],
 清明:['气清景明，万物皆显，','宜疏肝理气，调畅身心。'],
 谷雨:['雨生百谷，春将尽时，','宜健脾祛湿，为入夏储备。'],
 立夏:['斗指东南，万物至此皆长大，','宜养心安神，静心敛汗。'],
 小满:['麦粒渐满，未至大满，','宜清热利湿，忌贪凉饮冷。'],
 芒种:['有芒之谷，至此可种，','宜晚睡早起，午间小憩。'],
 夏至:['日长之至，阳极生阴，','宜养阳护阴，勿过汗耗气。'],
 小暑:['温风至，蟋蟀居壁，','宜心静纳凉，午后少动。'],
 大暑:['湿热交蒸，一年最盛，','宜清热解暑，顾护脾胃。'],
 立秋:['云天收夏色，木叶动秋声，','宜润燥养肺，收敛神气。'],
 处暑:['暑气至此而止，','宜早卧早起，缓和秋乏。'],
 白露:['露凝而白，昼夜温差渐大，','宜添衣护肺，勿贪凉露体。'],
 秋分:['昼夜再度均分，秋色平分，','宜润肺生津，收敛心神。'],
 寒露:['露气寒冷，将凝为霜，','宜养阴润燥，护好颈足。'],
 霜降:['霜结为霜，万物内敛，','正是调养身心的好时节。'],
 立冬:['水始冰，地始冻，','宜藏养阳气，早卧晚起。'],
 小雪:['天地闭塞，转入严寒，','宜温润滋补，静养心神。'],
 大雪:['仲冬始至，雪盛冰坚，','宜避寒保暖，蓄养精气。'],
 冬至:['日短之至，阴极阳生，','宜进补养藏，静候一阳来复。']};
/* 季节引文：只用四时总纲原文，出处确凿（《素问·四气调神大论》） */
var SEASON_POEM={春:['春三月，此谓发陈。','《素问·四气调神大论》'],
 夏:['夏三月，此谓蕃秀。','《素问·四气调神大论》'],
 秋:['秋三月，此谓容平。','《素问·四气调神大论》'],
 冬:['冬三月，此谓闭藏。','《素问·四气调神大论》']};
/* 供首页/结束页共用的一次性快照 */
function todayContext(){var d=new Date(),T=currentTerm(d),L=lunarDate(d);
  return {date:d,T:T,season:seasonOfTerm(T.index),desc:TERM_DESC[T.name],
    lunar:L,gLunar:(d.getMonth()+1)+'月'+d.getDate()+'日',
    lunarText:L?(L.month+L.day):''}}
/* 季节化的食养「为什么推荐」（不再写死霜降） */
var SEASON_RECIPE_WHY={春:'春季肝气偏旺、易生内热，百合润燥、莲子养心，练后温服，有助于安神入睡。',
 夏:'夏季心火易旺、汗多耗气，百合润燥、莲子养心，练后温服，有助于清心解暑。',
 秋:'秋季燥气偏盛，百合润燥、莲子养心，练后温服，有助于安神入睡。',
 冬:'冬季寒气主令、宜温润内守，百合润燥、莲子养心，练后温服，有助于养阴安神。'}
function loadRecords(){try{var x=JSON.parse(localStorage.getItem('xy-records')||'[]');state.records=Array.isArray(x)?x.filter(function(r){return r&&typeof r.d==='string'}):[]}catch(_){state.records=[]}}
function saveRecords(){try{localStorage.setItem('xy-records',JSON.stringify(state.records));return true}catch(_){return false}}
function recordStats(){var R=state.records,sec=0,poses=0,days={};
  R.forEach(function(r){sec+=(+r.sec||0);poses+=(+r.poses||0);days[r.d]=1});
  return {n:R.length,days:Object.keys(days).length,sec:sec,poses:poses,last:R.length?R[R.length-1]:null}}
function streak(){var set={};state.records.forEach(function(r){set[r.d]=1});var d=new Date(),c=0,first=true;
  for(var i=0;i<400;i++){var k=ymdd(d);
    if(set[k]){c++;first=false}
    else if(first){first=false}
    else break;
    d.setDate(d.getDate()-1)}
  return c}
function recentDays(n){var R=state.records,acc=[],d=new Date(),mx=0;
  for(var i=n-1;i>=0;i--){var dd=new Date(d.getFullYear(),d.getMonth(),d.getDate()-i),k=ymdd(dd),s=0;
    R.forEach(function(r){if(r.d===k)s+=(+r.sec||0)});
    if(s>mx)mx=s;acc.push({d:k,sec:s})}
  return acc.map(function(a){return {d:a.d,sec:a.sec,v:mx?Math.max(6,Math.round(a.sec/mx*100)):0}})}
function checkin(poses,sec){var rec={d:today(),at:new Date().toISOString(),poses:poses,sec:Math.max(0,Math.round(sec||0))};
  var i=-1;state.records.forEach(function(r,ix){if(r.d===rec.d)i=ix});
  var first=state.records.length===0;
  if(i>=0){rec.sec+=state.records[i].sec;rec.poses=Math.max(rec.poses,state.records[i].poses);state.records[i]=rec}
  else state.records.push(rec);
  var ok=saveRecords();
  return {ok:ok,rec:rec,n:state.records.length,streak:streak(),first:first}}
function loadProfile(){try{var a=localStorage.getItem('xy-avatar');if(a&&a.indexOf('data:image/')===0)state.avatar=a}catch(_){}}
function saveAvatar(u){try{localStorage.setItem('xy-avatar',u);state.avatar=u;return true}catch(_){return false}}
/* ---------- 加载页 ---------- */
function pgLoading(){return '<main class="sc center loading-screen" style="padding-bottom:0;position:relative;min-height:100dvh;display:flex;flex-direction:column">' +'<div class="load-ambience" aria-hidden="true"><span class="load-cloud cloud-a"></span><span class="load-cloud cloud-b"></span><span class="load-note note-a">♪</span><span class="load-note note-b">♫</span><span class="load-petal petal-a">✿</span><span class="load-petal petal-b">✿</span></div>'
 +'<div class="load-topbar" style="display:flex;justify-content:flex-end;padding-top:1.6rem"><button class="tbtn" style="background:rgba(253,250,242,.9);border:1px solid var(--line);border-radius:2rem;padding:.7rem 1.6rem" data-a="load-enter">示例 '+ic('chev','width:1.2rem;height:1.2rem')+'</button></div>'
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

/* ---------- 问答页：7 步真问诊（原先是同一道题重复 7 次） ----------
   旧实现的题面与选项都硬编码在 for 循环之外，循环只生成进度条，
   于是「1/7 ~ 7/7」全是「你最近哪里容易不舒服?」+ 同一组 6 张卡
   （实测见 outputs/pm-review/probe-quiz.cjs）。这里改成 7 道**递进**的真题，
   并且答案真的参与推荐：部位 → 音疗方向；时段/情绪 → 今日调式；
   时长/受限部位/期望强度 → 练哪一套（3 式还是 8 式）与从哪个阶段开始。 */
var QUIZ=[
 {title:'最近哪里容易不舒服?',
  hint:'你的回答将帮助我们为你生成<br>更合适的今日练习推荐，调和身心，专属定制。',
  opts:[['q-neck.jpg','颈肩','容易酸痛、僵硬<br>肩颈不适'],
        ['q-back.jpg','腰背','容易酸胀、疲劳<br>久坐不适'],
        ['q-food.jpg','脾胃','容易胀气、消化不良<br>食欲不稳'],
        ['q-sleep.jpg','睡眠','入睡困难、易醒<br>睡眠质量差'],
        ['q-mood.jpg','情绪','容易焦虑、烦躁<br>压力较大'],
        ['q-none.jpg','没有','目前没有明显不适<br>想整体调养']]},
 {title:'最近睡得怎么样?',
  hint:'睡眠与情绪、精力最直接相关，先说清这一项。',
  opts:[['q-sleep.jpg','入睡难','躺下很久才睡得着'],
        ['q-mood.jpg','易醒多梦','夜里常醒，梦多'],
        ['q-none.jpg','基本能睡整觉','一觉到天亮'],
        ['q-back.jpg','时好时坏','没有规律，说不清']]},
 {title:'最近的情绪偏哪一种?',
  hint:'情绪紧的时候，肩背也容易跟着紧。',
  opts:[['q-mood.jpg','容易焦虑','总在担心还没发生的事'],
        ['q-neck.jpg','容易烦躁','一点小事就想发火'],
        ['q-none.jpg','比较平稳','没什么大的起伏'],
        ['q-food.jpg','压力较大','事情多，停不下来']]},
 {title:'一天里，什么时候最没精神?',
  hint:'按你最容易犯困或乏力的时段来选。',
  opts:[['q-none.jpg','上午','一早起来就觉得累'],
        ['q-food.jpg','午后','吃过午饭就犯困'],
        ['q-back.jpg','傍晚','下班前后最疲惫'],
        ['q-mood.jpg','晚上','白天还行，晚上才累']]},
 {title:'今天能拿出多少时间练?',
  hint:'时间长短都算练，先选一个能坚持下来的。',
  opts:[['q-none.jpg','5 分钟','午休间隙就能做完'],
        ['q-neck.jpg','10 分钟','认真做完一套'],
        ['q-back.jpg','12 分钟以上','想完整走一遍八式'],
        ['q-food.jpg','还说不准','今天不确定，先给建议']]},
 {title:'身上有没有要避开的部位?',
  hint:'有伤或不适的部位，动作幅度会替你调小。',
  opts:[['q-neck.jpg','颈肩不适','转颈、耸肩要轻一些'],
        ['q-back.jpg','腰背不适','前屈、后仰要慢一些'],
        ['q-food.jpg','膝盖不适','马步蹲得浅一些'],
        ['q-none.jpg','没什么限制','正常跟着做就可以']]},
 {title:'今天想要什么强度?',
  hint:'最后一步，决定这次练得松一点还是紧一点。',
  opts:[['q-none.jpg','轻柔舒缓','以放松为主，别太累'],
        ['q-food.jpg','适中规律','按部就班做完就好'],
        ['q-back.jpg','想活动开','希望微微出点汗'],
        ['q-mood.jpg','说不上来','你帮我定']]}
];
/* 每个选项在推荐里的短名（用于「我的」与首页那句「按你的回答…」） */
var QUIZ_TAG=[
 ['颈肩','腰背','脾胃','睡眠','情绪','无明显不适'],
 ['入睡难','易醒多梦','睡得还行','睡得不规律'],
 ['容易焦虑','容易烦躁','情绪平稳','压力较大'],
 ['上午没劲','午后犯困','傍晚疲惫','晚上才累'],
 ['5 分钟','10 分钟','12 分钟以上','时间未定'],
 ['颈肩需避让','腰背需避让','膝盖需避让','无限制'],
 ['想轻柔','想适中','想活动开','强度待定']];
/* 答案 → 推荐。只决定「练什么 / 练多久 / 从哪开始」，不做任何医疗判断。 */
function recommendFromAnswers(a){
  var part=nv(a[0],5),sleep=nv(a[1],3),mood=nv(a[2],3),energy=nv(a[3],3),
      time=nv(a[4],3),limit=nv(a[5],3),intent=nv(a[6],3)
  // ① 音疗方向 → 音疗页五个脏腑按钮：0 心 / 1 肝 / 2 脾 / 3 肺 / 4 肾
  var organ=[3,4,2,0,1,2][part]
  // ② 今日调式 → 首页三张推荐：0 宫·平和承载 / 1 徵·轻快舒扬 / 2 羽·沉静滋养
  var rec=0
  if(sleep===0||sleep===1||energy===3||part===3)rec=2          // 睡不好 / 晚上才累 / 主诉睡眠 → 羽调
  else if(energy===1||mood===1||part===0)rec=1                 // 午后犯困 / 易烦躁 / 主诉颈肩 → 徵调
  // ③ 练哪一套：1=招牌 3 式（约 5 分钟） 0=全套 8 式（约 12 分钟）
  var imode=(time===0||time===1)?1:((time===3&&intent===0)?1:0)
  // ④ 从哪个阶段开始：有受限部位一律从「点」起手
  var istage=(limit!==3)?0:(time===2?2:(time===1?1:0))
  var tags=[]
  for(var i=0;i<QUIZ_TAG.length;i++){var v=a[i];if(typeof v==='number'&&QUIZ_TAG[i][v])tags.push(QUIZ_TAG[i][v])}
  return {answers:a.slice(0,QUIZ.length),organ:organ,rec:rec,imode:imode,istage:istage,tags:tags}
}
function nv(v,d){return typeof v==='number'?v:d}
function saveQuiz(q){try{localStorage.setItem('xy-quiz',JSON.stringify(q))}catch(_){}}
function loadQuiz(){try{var q=JSON.parse(localStorage.getItem('xy-quiz')||'null')
  if(q&&typeof q==='object'&&Array.isArray(q.answers)){state.quiz=q;return true}}catch(_){}return false}
/* 把推荐落到界面状态上（首页推荐 / 音疗方向 / 练习准备页的默认值） */
function applyQuiz(q){if(!q)return
  state.organ=q.organ;state.rec=q.rec;state.imode=q.imode;state.istage=q.istage}
function pgQuestion(){var Q=QUIZ[Math.min(state.qIndex,QUIZ.length-1)]||QUIZ[0]
 var steps='';
 for(var i=0;i<QUIZ.length;i++){if(i)steps+='<span class="sline'+(i<=state.qIndex?' done':'')+'"></span>'
  steps+='<span class="snode '+(i<state.qIndex?'done':(i===state.qIndex?'cur':''))+'">'+(i<state.qIndex?ic('check','width:1rem;height:1rem'):'')+'</span>'}
 return '<main class="sc" style="min-height:100dvh;display:flex;flex-direction:column;padding-bottom:3rem">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><span></span></div>'
 +'<div class="center" style="margin-top:.6rem">'+brand(4.6)+'</div>'
 +'<div class="dashline t-sub center" style="margin-top:1rem">让传统之美，滋养当下的你</div>'
 +'<div class="stepper"><span class="num">'+(state.qIndex+1)+' <i>/ '+QUIZ.length+'</i></span><div class="steps">'+steps+'</div></div>'
 +'<div class="center" style="margin-top:2.6rem;font-family:var(--serif);font-size:2.5rem;font-weight:700;color:var(--ink);letter-spacing:.08em">'+Q.title+'</div>'
 +'<p class="center" style="font-size:1.35rem;color:var(--muted);margin-top:1.2rem;line-height:1.8">'+Q.hint+'</p>'
 +'<div class="qgrid">'+Q.opts.map(function(c,i){return '<button class="qcard'+(state.qSel===i?' sel':'')+'" data-a="qsel" data-i="'+i+'">'
   +'<span class="ck">'+ic('check')+'</span><img src="/art/'+c[0]+'" alt=""><h4>'+c[1]+'</h4><p>'+c[2]+'</p></button>'}).join('')+'</div>'
 +'<div style="display:flex;align-items:center;gap:1.2rem;margin-top:auto;padding-top:2.6rem">'
 +'<button class="btn btn-gho" style="width:auto;padding:0 2.2rem" data-a="q-prev">'+ic('chevl','width:1.5rem;height:1.5rem')+'上一步</button>'
 +'<button class="btn" style="flex:1" data-a="q-next">'+(state.qIndex<QUIZ.length-1?'下一步':'看推荐')+' '+ic('chev','width:1.5rem;height:1.5rem')+'</button>'
 +'<button class="tbtn" data-a="q-skip">跳过 '+ic('chev','width:1.2rem;height:1.2rem')+'</button></div>'
 +'</main>'}

/* ---------- 音疗页 ---------- */
function pgAudio(){var organs=[
  ['心','徵','喜悦安神','#C4472F','/art/card-landscape.jpg','filter:hue-rotate(-10deg) saturate(.9)'],
  ['肝','角','舒展疏肝','#5E7C6B','/art/q-none.jpg',''],
  ['脾','宫','平和健脾','#B8862D','/art/card-landscape.jpg','filter:sepia(.5)'],
  ['肺','商','清润宁神','#7A8C99','/art/q-none.jpg','filter:hue-rotate(160deg) saturate(.55)'],
  ['肾','羽','沉静滋养','#4A5E82','/art/card-landscape.jpg','filter:hue-rotate(190deg) saturate(.8) brightness(.85)']]
 /* 曲库只列真有音源的曲目（TRACKS 见文件头的音频引擎）；无音源的不出现。 */
 var idx=audioIdx(),T=TRACKS[idx],on=musicPlaying(),pKey=musKey()
 var listed=TRACKS.map(function(t,i){var act=on&&t.key===pKey
   return '<div class="track">'
   +'<img class="thumb" src="'+t.img+'" style="'+(t.pic||'')+'" alt="">'
   +'<div style="flex:1;min-width:0"><div class="tt">'+t.title+(act?' <span class="note">播放中</span>':'')+'</div>'
   +'<div style="font-size:1.15rem;color:var(--muted);margin-top:.2rem">'+t.desc+'</div>'
   +'<div class="tags"><span class="tag '+t.cls+'">'+t.tone+'</span><span class="tag">'+t.tags[0]+'</span><span class="tag">'+t.tags[1]+'</span></div></div>'
   +'<span class="dur" data-i="'+i+'">'+fmtT(t.dur)+'</span>'
   +'<button class="play-c'+(act?' on':'')+'" data-a="play" data-i="'+i+'" aria-label="'+(act?'暂停 ':'播放 ')+t.title+'">'+ic(act?'pause':'play')+'</button></div>'}).join('')
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
  +'<img class="pic" src="'+T.img+'" style="'+(T.pic||'')+'" alt="">'
  +'<div class="pr"><span class="live">'+ic('music','width:1.2rem;height:1.2rem')+(on?'正在播放 · 真人录音':'真人录音 · 点 ▶ 播放')+'</span>'
  +'<div class="tt">'+T.title+' <i aria-hidden="true">♡</i></div>'
  +'<p>'+T.desc+'</p>'
  +'<div class="tags"><span class="tag '+T.cls+'">'+T.tone+'</span><span class="tag">'+T.tags[0]+'</span><span class="tag">'+T.tags[1]+'</span></div>'
  +'<div class="pbar"><i style="width:0%"></i></div>'
  +'<div class="times"><span>00:00</span><span>'+fmtT(T.dur)+'</span></div>'
  +'<div class="pctrl"><button data-a="loop" aria-label="循环播放" aria-pressed="'+AUDIO.loop+'"'+(AUDIO.loop?' style="color:var(--terra)"':'')+'>'+ic('refresh')+'</button><button data-a="track-prev" aria-label="上一首曲目">'+ic('prev')+'</button><button class="pc" data-a="play" data-i="'+idx+'" aria-label="播放当前曲目">'+ic(on?'pause':'play')+'</button><button data-a="track-next" aria-label="下一首曲目">'+ic('next')+'</button><button data-a="track-list" aria-label="查看推荐曲目">'+ic('list')+'</button></div>'
  +'</div></section>'
 +'<section class="card" style="padding:1.6rem 1.5rem;margin-top:2rem">'
  +'<div class="sec-h">'+knot()+'跟着呼吸，更好地感受音乐<span class="sec-note">点一下，跟着琴音做 4 秒吸 / 6 秒呼</span></div>'
  +'<div class="breath-row" data-a="breath" role="button" tabindex="0" aria-label="开始呼吸引导" aria-pressed="'+(state.breath?1:0)+'">'
   +'<div class="bstep'+(state.breath===1?' on':'')+'" data-b="1"><span class="c">'+ic('medit')+'</span><b>慢吸 4 秒</b><span>感受气息流入丹田</span></div>'
   +'<span class="barrow">'+ic('chev','width:2rem;height:2rem')+'</span>'
   +'<div class="bstep'+(state.breath===2?' on':'')+'" data-b="2"><span class="c">'+ic('hand')+'</span><b>慢呼 6 秒</b><span>慢慢释放紧张与杂念</span></div>'
   +'<span class="barrow">'+ic('chev','width:2rem;height:2rem')+'</span>'
   +'<div class="bstep'+(state.breath===3?' on':'')+'" data-b="3"><span class="c">'+ic('lotus')+'</span><b>放松</b><span>跟随音乐享受此刻的宁静</span></div>'
  +'</div></section>'
 +'<section class="card" style="padding:1.6rem 1.5rem 1.2rem;margin-top:2rem">'
  +'<div class="sec-h">'+knot()+'为你推荐<button class="sec-note" data-a="loop" aria-pressed="'+AUDIO.loop+'" style="display:inline-flex;align-items:center;gap:.4rem;'+(AUDIO.loop?'color:var(--terra)':'')+'">'+ic('refresh','width:1.4rem;height:1.4rem')+(AUDIO.loop?'循环中':'循环播放')+'</button></div>'
  +'<div style="margin-top:.6rem">'+listed+'</div>'
  +'<p class="sec-note" style="margin-top:1.2rem;line-height:1.7">'+T.credit+'。其余曲目暂无干净音源，未列出。</p>'
 +'</section>'
 +nav('audio',true)+'</main>'}

/* ---------- 底部导航 ---------- */
function nav(cur){var h='<nav class="nav">'
 h+='<button class="nitem'+(cur==='home'?' on':'')+'" data-a="nav-home">'+ic('home')+'首页</button>'
 h+='<button class="nitem'+(cur==='audio'?' on':'')+'" data-a="nav-audio">'+ic('music')+'音疗</button>'
 +'<button class="nitem" data-a="nav-intro"><span class="big">'+ic('yinyang')+'</span>开始练</button>'
 +'<button class="nitem'+(cur==='inquiry'?' on':'')+'" data-a="nav-inquiry">'+ic('qmark')+'问询</button>'
 +'<button class="nitem'+(cur==='profile'?' on':'')+'" data-a="nav-profile">'+ic('user')+'我的</button></nav>'
 return h}

/* ---------- 首页 ---------- */
function pgHome(){var C=todayContext()
 var recs=[
  ['八段锦 · 宫调','平和承载 · 12分钟','舒展身心，适合日常练习，调和气息，安定情绪。','八段锦动作柔和，调息养气，帮助舒缓压力、改善睡眠，适合在'+C.T.name+'时节调养身心。',['舒缓减压','调和气息','适合日常']],
  ['八段锦 · 徵调','轻快舒扬 · 10分钟','活跃气血，适合午后练习，振奋心情。','徵调音色明快，配合开弓动作，帮助活血提神，适合午后精力不足时练习。',['提升活力','舒畅心情','适合午后']],
  ['八段锦 · 羽调','沉静滋养 · 14分钟','安定心神，适合夜晚练习，助眠安睡。','羽调深沉静谧，配合攀足动作，帮助放松腰肾，适合夜晚睡前安神。',['安神助眠','滋养腰肾','适合夜晚']]]
 var r=recs[state.rec%recs.length]
 /* 问诊答过就不再是「人人一样」的推荐：把用户自己的答案摆到「为什么推荐给你」前面 */
 var why=(state.quiz&&state.quiz.tags&&state.quiz.tags.length)
   ?('按你的回答（'+state.quiz.tags.slice(0,2).join(' · ')+'），'+r[3]) : r[3]
 return '<main class="sc navpad" style="display:flex;flex-direction:column;min-height:100dvh">'
 +'<div class="hero"><img class="bg" src="/art/landscape.jpg" alt=""><div class="fade"></div>'
  +'<div class="in">'+brand(5.6)
  +'<div class="t-sub">— 让传统之美，滋养当下的你 —</div>'
  +'<div class="jq">今日 · <span class="o">'+C.T.name+'</span></div>'
  +'<div class="date">'+C.gLunar+(C.lunarText?(' 农历'+C.lunarText):'')+'</div>'
  +'<p class="desc">'+C.desc[0]+'<br>'+C.desc[1]+'</p></div></div>'
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
 +'<div class="r"><h4>为什么推荐给你</h4><p>'+why+'</p></div></div>'
 +'<div class="modebar">'
  +'<button class="mseg'+(state.mode===0?' on':'')+'" data-a="mode" data-i="0"><span class="ic">'+ic('medit')+'</span><span class="tx"><b>八段锦</b><span>经典·全身调养</span></span>'+(state.mode===0?'<span class="ckc">'+ic('check')+'</span>':'')+'</button>'
  +'<button class="mseg'+(state.mode===1?' on':'')+'" data-a="mode" data-i="1"><span class="ic">'+ic('deer')+'</span><span class="tx"><b>五禽戏</b><span>灵动·强筋养气</span></span></button>'
  +'<button class="mseg'+(state.mode===2?' on':'')+'" data-a="mode" data-i="2"><span class="ic">'+ic('dice')+'</span><span class="tx"><b>帮我选</b><span>智能推荐练习</span></span><span class="arr">›</span></button></div>'
 +'<div class="quotebar"><img src="/art/card-landscape.jpg" alt=""><p>'+SEASON_POEM[C.season][0]+'<i>——'+SEASON_POEM[C.season][1]+'</i></p><img src="/art/q-none.jpg" style="filter:hue-rotate(15deg)" alt=""></div>'
 +nav('home')+'</main>'}

/* ---------- 八段锦进入页（练习准备） ---------- */
function pgIntro(){
 var stageMotif=[
  '<svg viewBox="0 0 100 44"><ellipse cx="50" cy="30" rx="46" ry="12" fill="#DCE8DC" opacity=".55"/><ellipse cx="30" cy="35" rx="20" ry="7" fill="#CBDCCB" opacity=".6"/><ellipse cx="72" cy="36" rx="16" ry="5" fill="#CBDCCB" opacity=".5"/><circle cx="62" cy="24" r="5.5" fill="#C05A2E"/></svg>',
  '<svg viewBox="0 0 100 44"><ellipse cx="50" cy="32" rx="46" ry="10" fill="#DCE8DC" opacity=".5"/><path d="M8 26c14-12 30 8 44-2s26-10 40 0" fill="none" stroke="#5E7C6B" stroke-width="2.6" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 100 44"><ellipse cx="50" cy="30" rx="46" ry="12" fill="#DCE8DC" opacity=".5"/><ellipse cx="50" cy="27" rx="24" ry="8" fill="none" stroke="#8FAF97" stroke-width="1.6"/><ellipse cx="50" cy="27" rx="13" ry="5" fill="none" stroke="#8FAF97" stroke-width="1.6"/><circle cx="50" cy="27" r="4" fill="#C05A2E"/></svg>']
 var stages=[['阶段一 · 点','认识动作 · 建立感觉'],['阶段二 · 线','贯穿动作 · 气息流动'],['阶段三 · 面','完整演练 · 身心融合']]
 return '<main class="sc" style="min-height:100dvh;display:flex;flex-direction:column;padding-bottom:3rem">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><button class="icbtn" data-a="help" aria-label="练习帮助">'+ic('qmark')+'</button></div>'
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
    +'<div class="tt">全套 <b class="big">8</b> 式</div><div class="meta">约12分钟 · 做到位即进下一式</div>'
    +'<div class="hr"></div><p>完整体验、循序渐进<br>调身养气，身心更佳</p></button>'
   +'<button class="modecard'+(state.imode===1?' sel':'')+'" data-a="imode" data-i="1">'+(state.imode===1?'<span class="ck">'+ic('check')+'</span>':'<span class="rd"></span>')
    +'<img class="pic" src="/art/card-landscape.jpg" alt="">'
    +'<div class="tt">招牌 <b class="big">3</b> 式</div><div class="meta">约5分钟 · 做到位即进下一式</div>'
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

/* ---------- 八段锦八式内容（真实动作要点 / 常见问题；式↔弦沿用 train/src/data/strings.json） ---------- */
var PRACTICE_INFO=[
 {name:'双手托天理三焦',preview:'抬头上托，舒展胸廓，感受三焦通畅。',string:1,
  points:['十指交叉于腹前，掌心向上，缓缓上托至头顶','上托时配合吸气，尽量向上伸展，不必强求绷直，肩沉肘坠','目视手背，足跟可微微提起，体会周身拔伸','下落时呼气，双手经体侧按至腹前'],
  faq:[['手举不直怎么办？','先求松沉再求高度：肩要沉、肘要坠，宁可矮一点，也不要耸肩硬顶。'],
       ['要不要踮脚？','初学只做上托即可；站稳之后再加脚跟微提，避免晃动。']]},
 {name:'左右开弓似射雕',preview:'马步拉弓，打开胸背，气机一开一合。',string:2,
  points:['左脚开步略宽于肩，屈膝下蹲成马步','两手在胸前交叠，一手成「弓手」向侧推出','另一手成「箭手」屈肘后拉，如拉满弓','目视推出手的食指方向，左右各做一次'],
  faq:[['马步蹲多深？','以膝盖不超脚尖、大腿接近水平为宜；体力不足可站高一些。'],
       ['肩膀总耸起来？','拉弓时先沉肩再推手，把注意力放在「肘向后」而不是「手向前」。']]},
 {name:'调理脾胃须单举',preview:'一手上托一手下按，牵拉体侧，舒缓脾胃。',string:3,
  points:['一手掌心向上，从体侧上举至头顶上方','另一手掌心向下，同时下按至髋旁','两手上下对拉，体会体侧被拉开','一上一下为一组，左右交替'],
  faq:[['上举的手要碰到头吗？','不必。到位的感觉是「上下对拉」，不是手臂高度。'],
       ['做的时候腰不舒服？','缩小幅度，先把骨盆摆正，别为了拉高而侧倾。']]},
 {name:'五劳七伤往后瞧',preview:'转头后望，放松颈肩，温和牵动脊柱。',string:4,
  points:['两手垂于体侧或扶在腰后，身体中正','头颈缓缓向左后方转动，目视后方','转到最大幅度时稍停，再缓缓转回','左右交替，全程保持肩部下沉'],
  faq:[['脖子转不动 / 有响声？','幅度以不痛为准，宁可小而顺；不要用手扳头。'],
       ['头晕怎么办？','放慢速度、减小幅度，坐着做也可以。']]},
 {name:'摇头摆尾去心火',preview:'俯身摇摆，松腰摆尾，把心火摇头摆出去。',string:5,
  points:['马步站立，双手扶膝上方','上身向前俯下，重心先移向左腿','头向前下画弧，臀部顺势向侧后摆出','左右交替画弧，动作由腰带动'],
  faq:[['腰不好能做吗？','可改为小幅度的「扶膝转体」，不做大幅俯身。'],
       ['为什么叫去心火？','取的是「摆动松腰、把紧张摇散」的意思，属传统口诀，不是医疗说法。']]},
 {name:'两手攀足固肾腰',preview:'前屈攀足，拉伸腰背，缓缓而起。',string:6,
  points:['两手沿腰背向下推按，一路至臀部、大腿后侧','顺势前屈，双手尽量攀握足踝或足面','保持膝微屈、颈放松，不憋气','以腰胯带动，缓慢起身、双手回到腰后'],
  faq:[['手够不到脚？','够到小腿或脚踝即可，别为够脚而弓背硬压。'],
       ['起来时头晕？','起身一定要慢，配合呼气；有高血压者幅度减半。']]},
 {name:'攒拳怒目增气力',preview:'冲拳怒目，凝神发力，舒展筋骨。',string:7,
  points:['马步下蹲，两拳抱于腰侧，拳心向上','一拳缓缓向前冲出，同时瞪目怒视前方','冲至肩平后，旋腕变掌、五指张开','抓握成拳收回腰侧，左右交替'],
  faq:[['一定要「怒目」吗？','意在「凝神」而非凶相：睁大眼睛、专注看前方即可。'],
       ['冲拳要用力吗？','用力在「稳」不在「猛」，末端略停即可，避免甩关节。']]},
 {name:'背后七颠百病消',preview:'足跟起落，七颠收势，七弦齐鸣作结。',string:0,
  points:['两脚并拢站立，两手自然下垂，全身放松','足跟提起，头顶上顶，稍停一瞬','足跟轻落顿地，全身随之放松微震','一起一落为一次，共做七次收功'],
  faq:[['顿地会不会伤脚跟？','是「轻落」不是「砸地」；关节不适者可只提起、轻放。'],
       ['做几次合适？','传统做七次，取「七颠」之意，也正好呼应七弦。']]}
];
/* 动作 → 琴弦触发（0 表示收势七弦齐鸣） */
function pluckChord(gap,force){for(var k=0;k<7;k++)(function(k){setTimeout(function(){pluckString(k,{force:force})},k*(gap||90))})(k)}
function pluckForStep(i){if(!AUDIO.sound)return;var s=(PRACTICE_INFO[i]||{}).string;if(s===0||s==null)pluckChord(90);else pluckString(s-1)}

/* ---------- 跟练页 ---------- */
var POSES=['双手托天理三焦','左右开弓似射雕','调理脾胃须单举','五劳七伤往后瞧','摇头摆尾去心火','两手攀足固肾腰','攒拳怒目增气力','背后七颠百病消']
function practicePoses(){return state.imode===1?[POSES[0],POSES[1],POSES[2]]:POSES}
function pgPractice(){var i=state.progress,poses=practicePoses(),info=PRACTICE_INFO[i]||PRACTICE_INFO[0]
 var dots='';for(var k=0;k<poses.length;k++){dots+='<span class="d'+(k===i?' on':'')+'"'+(k===i?' aria-current="step"':'')+'>'+(k+1)+'</span>'}
 var skel='<svg class="skel" viewBox="0 0 100 100" preserveAspectRatio="none" width="30rem">'
  +'<polyline points="50,4 36,14 64,14 46,42 30,34 46,42 54,42 70,34 54,42 38,62 62,62 50,66 44,84 56,84 50,92" fill="none" stroke="rgba(140,220,170,.85)" stroke-width=".7"/>'
  +[[50,4],[36,14],[64,14],[30,34],[70,34],[46,42],[54,42],[38,62],[62,62],[50,66],[44,84],[56,84],[50,92]].map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.5" fill="#8FDCAA" stroke="rgba(255,255,255,.8)" stroke-width=".4"/>'}).join('')+'</svg>'
 var breathN='';var pos=[[55,10],[45,30],[58,50],[42,68],[52,86],[48,94]]
 for(var b=0;b<6;b++){breathN+='<em data-a="pluck" data-i="'+(b+1)+'" role="button" tabindex="0" aria-label="'+STRING_NAMES[b+1]+'" style="left:'+pos[b][0]+'%;top:'+pos[b][1]+'%;animation-delay:'+(b*.4)+'s"></em>'}
 return '<main class="sc" style="padding-bottom:3rem">'
 +'<div class="p-top"><button class="icbtn" data-a="exit-practice">'+ic('back')+'</button>'
  +'<div class="center"><div class="brand-mid" style="display:flex;align-items:flex-start;justify-content:center;gap:.8rem"><span>弦养</span><span class="seal" style="font-size:.9rem;margin-top:.2rem">弦养</span></div><div class="p-sub">让传统之美，滋养当下的你</div></div>'
  +'<div style="display:flex;gap:.9rem"><button class="icbtn" data-a="music-toggle" aria-label="播放练习音乐">'+ic(musicPlaying()?'pause':'music')+'</button><button class="icbtn" data-a="settings" aria-label="设置">'+ic('gear')+'</button></div></div>'
 +'<section class="card pinfo"><div><span class="cur">动作预览 · 本式对应'+(info.string?('第 '+info.string+' 弦'):'七弦齐鸣')+'</span><h3><i>第'+(i+1)+'式</i> '+poses[i]+'</h3></div>'
  +'<div class="pstats">'
  +'<div class="pstat"><span class="lb">'+ic('user2')+'上半身</span><div class="v">92<i>%</i></div><div class="bar"><i style="width:92%"></i></div></div>'
  +'<div class="pstat"><span class="lb">'+ic('user2')+'下半身</span><div class="v">88<i>%</i></div><div class="bar"><i style="width:88%"></i></div></div>'
  +'<div class="pstat warn"><span class="lb">'+ic('camera')+'取景完整度</span><div class="v">22<i>%</i></div><div class="bar"><i style="width:22%"></i></div></div></div></section>'
 +'<div class="stage"><img class="bg" src="/art/landscape.jpg" style="object-position:center 40%" alt="">'
  +'<img class="fig" src="/art/figure-pose.png" alt="">'+skel
  +'<div class="bubble"><b>'+ic('volume')+'</b>'+info.preview+'</div>'
  +'<div class="side">'
   +'<button class="sitem on" data-a="side" data-i="0" aria-pressed="true">'+ic('medit')+'动作预览</button>'
   +'<button class="sitem" data-a="side" data-i="1">'+ic('demo')+'动作示范</button>'
   +'<button class="sitem" data-a="side" data-i="2">'+ic('doc')+'动作要点</button>'
   +'<button class="sitem" data-a="side" data-i="3">'+ic('qmark')+'常见问题</button></div>'
  +'<div class="breath-panel"><b>呼吸共鸣</b><div class="strings"><i data-a="pluck" data-i="0" role="button" tabindex="0" aria-label="'+STRING_NAMES[0]+'"></i>'+breathN+'</div><span class="side-t">吸气 · 平稳 · 呼气</span><small>点弦试音<br>以动为弦</small></div>'
  +'<div class="fade-b"></div></div>'
 +'<div class="pdots"><span class="rail"></span>'+dots+'</div>'
 +'<div class="holdrow">···<span class="pill" data-a="hold" role="button" tabindex="0" aria-label="开始保持计时">保持 <b>'+(state.hold||3)+'</b> 秒</span>···</div>'
 +'<div class="ctrl"><button class="cbtn" data-a="prev-step">'+ic('prev')+'上一个</button>'
  +'<button class="mainc" data-a="toggle-run" aria-label="'+(state.running?'暂停':'继续')+'呼吸动画预览">'+(state.running?ic('pause'):ic('play'))+'</button>'
  +'<button class="cbtn" data-a="next-step">'+ic('next')+'下一个</button></div>'
 +'</main>'}

/* ---------- 结束页 ---------- */
/* 真实结果来源：s4 跟练时由 train/src/stores/shellBridge.js 写入 localStorage['xy-last-session']。
   改前这里是写死的 89 分 / 12 分钟 / 146·162 与 seed=7 的伪随机点阵；
   现在没有真实会话就一律显示「—」，不编分数、不编时长、不编偏差。 */
function lastSession(){try{var s=JSON.parse(localStorage.getItem('xy-last-session')||'null')
  if(s&&typeof s==='object'&&typeof s.moves==='number')return s}catch(_){}
 return null}
var ND_EMPTY='#E7DCC6';
var TONE_CN={gong:'宫调',shang:'商调',jue:'角调',zhi:'徵调',yu:'羽调'};
function doneAvg(S){var a=(S&&S.scores&&S.scores.length)?S.scores:[]
 if(!a.length)return null
 return Math.round(a.reduce(function(x,y){return x+(+y||0)},0)/a.length)}
/* 第 n 弦对应的完成度：第 n 式 → 第 n 弦；第 8 式（收势）＝七弦齐鸣，与 pluckForStep 同一套对应关系 */
function stringScore(S,si){if(!S||!S.scores||!S.scores.length)return null
 var a=S.scores
 if(si<a.length)return (+a[si]||0)/100
 if(a.length>=8)return (+a[7]||0)/100
 return null}
function pgDone(){var S=lastSession(),st=recordStats(),sk=streak()
 var avg=doneAvg(S),hasReal=!!S,hasScore=avg!=null
 var seed=7;function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
 /* 点阵：逐点仍按改前的「两次 rnd 消耗」取 left（坐标与改前逐点一致，布局不动），
    只把颜色由伪随机改成该弦的真实完成度；无识别结果时统一为空白色。 */
 var rows='';for(var r=0;r<7;r++){var ns=''
  for(var n=0;n<7;n++){var p=rnd();var c=ND_EMPTY
   if(hasScore){var v=stringScore(S,r);if(v!=null)c=v>=.75?'#7FA08C':(v>=.5?'#D9B25F':'#C4472F')}
   ns+='<span class="nd" style="left:'+(6+rnd()*88)+'%;background:'+c+'"></span>'}
  rows+='<div class="srow">'+ns+'</div>'}
 var colors=[['#7FA08C','准确'],['#D9B25F','偏差'],['#C4472F','未命中']]
 var grade=hasScore?(avg>=85?'良好':(avg>=70?'尚可':'待提升')):'未评估'
 var h4=hasScore?(avg>=85?'琴音渐稳，心气调和':(avg>=70?'渐入佳境，仍有空间':'起步即修行，慢即是快')):'本次未做动作识别'
 var blurb=hasScore?(avg>=85?'节奏基本准确，动作平稳自然，继续保持，下次会更好！'
   :(avg>=70?'整体完成度不错；对完成度偏低的式放慢半拍、把动作做到位，比做快更有效。'
   :'本次完成度偏低：先求动作到位，再求连贯。跟着示范慢练，会比赶进度进步更快。'))
  :'没有采集到姿态数据，所以不显示评分；练习时长与完成动作数照实记录在下方。'
 var note=hasScore?'本页数据来自本次跟练的真实记录：完成动作数、练习时长、逐式完成度均由识别结果统计。'
  :(hasReal?'本页的练习时长与完成动作数来自本次跟练；本次未启用动作识别，因此不显示评分。'
  :'还没有跟练记录：本页所有指标显示「—」，不做任何推测。想拿到真实成绩，请到跟练页开启摄像头。')
 var off=hasScore?(295*(1-Math.min(100,Math.max(0,avg))/100)):295
 var secs=hasReal?Math.max(0,Math.round(S.seconds||0)):0
 var minTxt=hasReal?(secs>=60?(Math.round(secs/60)+'<i>分钟</i>'):(secs+'<i>秒</i>')):'—'
 var moveTxt=hasReal?(S.moves+'<i>/ '+(S.total||8)+'</i>'):'—'
 var moveSmall=hasScore?('平均完成度 '+avg+'%'):(hasReal?'未做动作识别':'暂无记录')
 var skTxt=sk>0?(sk+'<i>天</i>'):'—'
 var nextIdx=hasReal?Math.min(7,S.moves):0
 var goal=hasScore?('继续练习「'+POSES[nextIdx]+'」，把完成度提到 '+Math.min(99,Math.max(avg+5,85))+'% 以上。')
  :('先从「'+POSES[nextIdx]+'」开始：跟着示范做满一遍；再去跟练页开启识别，就有逐式完成度可看。')
 var fixTxt=hasScore?'逐式完成度见上方琴谱：完成度偏低的式，放慢半拍把动作做到位，胜过加快做完。'
  :'本次未做动作识别，无法判断个体动作偏差；请以跟练页里教练的实时提示为准。'
 var howTxt='保持呼吸自然，以肘带手、指尖放松；每个动作到末端略停一瞬，再缓缓收回。'
 var trackSub=hasReal?((S.moves+' / '+(S.total||8)+' 式已完成')+(S.tone&&TONE_CN[S.tone]?(' · '+TONE_CN[S.tone]):'')):(practicePoses().length+' 式预览 · '+TRACKS[0].tone)
 var recLead=hasReal?'结合本次的练习时长与完成度，推荐温服一碗百合莲子羹，有助于舒缓情绪、宁心安神，让身心更好地恢复。'
  :'练习后温服一碗百合莲子羹，有助于舒缓情绪、宁心安神，让身心更好地恢复。'
 return '<main class="sc" style="padding-bottom:3.4rem;position:relative">'
 +'<img class="done-hbg" src="/art/landscape.jpg" alt="">'
 +'<div class="top"><button class="icbtn" data-a="back">'+ic('back')+'</button><span></span><button class="icbtn" data-a="share-sheet" aria-label="分享琴谱">'+ic('share')+'</button></div>'
 +'<div style="margin-top:1rem;position:relative">'+brand(4)+'</div>'
 +'<div class="t-sub" style="margin-top:.6rem;position:relative">以琴养心，日日精进</div>'
 +'<h1 class="done-h" style="position:relative">'+(hasReal?'跟练完成':'动作预览完成')+'</h1><p class="sec-note" style="position:relative">'+note+'</p>'
 +'<p class="done-p" style="position:relative">一曲既终，心自安然。<br>弦音有度，步履生香。</p>'
 +'<section class="card score-card"><div class="ring">'
  +'<svg viewBox="0 0 124 124"><circle cx="62" cy="62" r="52" fill="none" stroke="#EADCC2" stroke-width="9"/>'
  +'<circle cx="62" cy="62" r="52" fill="none" stroke="#5E7C6B" stroke-width="9" stroke-linecap="round" stroke-dasharray="295" stroke-dashoffset="'+off+'" transform="rotate(-90 62 62)"/>'
  +'<circle cx="62" cy="10" r="5" fill="#FDF9EF" stroke="#C9A063" stroke-width="2.5"/></svg>'
  +'<div class="in"><b>'+(hasScore?(avg+'<i>分</i>'):'—')+'</b><span>'+grade+'</span></div></div>'
  +'<div class="score-r"><h4>'+h4+'</h4><p>'+blurb+'</p>'
  +'<div class="statrow">'
   +'<div class="st"><span class="lb">'+ic('timer')+'练习时长</span><div class="v">'+minTxt+'</div><small>'+(hasReal?'专注投入':'暂无记录')+'</small></div>'
   +'<div class="st"><span class="lb">'+ic('bars')+(hasReal?'完成动作':'命中数')+'</span><div class="v">'+moveTxt+'</div><small>'+moveSmall+'</small></div>'
   +'<div class="st"><span class="lb">'+ic('cal')+'连续打卡</span><div class="v">'+skTxt+'</div><small>'+(sk>0?'持之以恒':'暂无记录')+'</small></div></div></div></section>'
 +'<section class="card trackcard"><span class="sq">'+ic('music')+'</span>'
  +'<div class="tx"><b>'+TRACKS[0].title+' <i>›</i></b><span>'+trackSub+'</span></div>'
  +'<button class="rep" data-a="play-full" aria-label="完整回放'+TRACKS[0].title+'">'+ic(musicPlaying()&&musKey()==='meihua'?'pause':'play')+(musicPlaying()&&musKey()==='meihua'?'暂停回放':'完整回放')+'</button></section>'
 +'<div class="fret"><span class="lab">一二三四五六七</span>'+rows
  +'<div class="legend">'+(hasScore?colors.map(function(c){return '<span><i style="background:'+c[0]+'"></i>'+c[1]+'</span>'}).join(''):('<span><i style="background:'+ND_EMPTY+'"></i>'+(hasReal?'本次未做动作识别':'暂无跟练记录')+'</span>'))+'</div></div>'
 +'<section class="card" style="padding:1.6rem;margin-top:1.6rem">'
  +'<div class="sec-h">'+knot()+'练习反馈<button class="sec-note" data-a="analysis">查看详细分析 ›</button></div>'
  +'<div class="fb-grid">'
   +'<div class="fb"><span class="fimg"><img src="/art/figure-pose.png" alt=""></span><b>动作纠错</b><p>'+fixTxt+'</p></div>'
   +'<div class="fb"><span class="fimg"><img src="/art/guqin.png" alt=""></span><b>改正方法</b><p>'+howTxt+'</p></div>'
   +'<div class="fb"><span class="ic">'+ic('target')+'</span><b>明日目标</b><p>'+goal+'</p></div>'
   +'<div class="fb"><span class="ic">'+ic('lotus')+'</span><b>鼓励话语</b><p>今日的坚持，让心更平静。每一次，皆是进步，继续加油！</p></div></div></section>'
 +'<section class="card" style="padding:1.6rem;margin-top:1.4rem">'
  +'<div class="sec-h">'+knot()+'今日食养推荐<button class="sec-note" data-a="recipe">顺时而食，滋养身心 ›</button></div>'
  +'<div class="food"><div class="picw"><img src="/art/q-food.jpg" alt=""></div>'
  +'<div class="tx"><b>百合莲子羹</b><div class="tags"><span class="tag grn">养心安神</span><span class="tag org">润燥助眠</span><span class="tag">适合今日</span></div>'
  +'<p>'+recLead+'</p></div></div></section>'
 +'<div class="done-btns"><button class="btn btn-green" data-a="finish" style="flex:1.2">'+ic('check','width:2rem;height:2rem')+'完成打卡</button>'
  +'<button class="btn btn-gho" data-a="again">'+ic('refresh','width:1.8rem;height:1.8rem;color:#6B4226')+'再练一次</button>'
  +'<button class="btn btn-gho" data-a="share-sheet">'+ic('share','width:1.8rem;height:1.8rem;color:#6B4226')+'分享琴谱</button></div>'
 +'</main>'}

/* ---------- 我的页 ---------- */
function pgProfile(){var st=recordStats(),has=st.n>0,sk=has?streak():DESIGN.streak;
 var xp=has?Math.min(DESIGN.xpMax,DESIGN.xp+st.n*60):DESIGN.xp;
 var xpPct=Math.max(6,Math.round(xp/DESIGN.xpMax*100));
 var bars=has?recentDays(10).map(function(a){return a.v}):DESIGN.bars;
 var on=has?Math.min(8,st.days+2):DESIGN.stageDone;
 var dots='';for(var q=0;q<8;q++)dots+='<i'+(q<on?' class="on"':'')+'></i>';
 var av=state.avatar||'/art/q-mood.jpg';
 return '<main class="sc navpad" style="min-height:100dvh;display:flex;flex-direction:column">'
 +'<div class="top"><span></span><div style="display:flex;gap:1rem"><button class="icbtn" data-a="notices" aria-label="通知">'+ic('bell')+(has?'':'<span class="dot"></span>')+'</button><button class="icbtn" data-a="settings" aria-label="设置">'+ic('gear')+'</button></div></div>'
 +'<div class="brandrow" style="margin-top:1rem"><span class="t-callig" style="font-size:4.6rem">我的</span><span class="seal">弦养</span></div>'
 +'<div class="t-sub" style="margin-top:1rem">在弦音中，遇见更好的自己</div>'
 +'<div class="pf-row"><div class="avatar"><img src="'+av+'" alt="头像"><button class="cam" data-a="avatar" aria-label="更换头像">'+ic('camera')+'</button></div>'
  +'<div><h3>清弦月 <i>›</i></h3><span class="stagepill">'+ic('lotus')+(has?('已练 '+st.days+' 天 · 连续 '+sk+' 天'):'中级阶段 ›')+'</span>'
  +'<div class="xprow"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="'+DESIGN.xpMax+'" aria-valuenow="'+xp+'"><i style="width:'+xpPct+'%"></i></div><span>'+xp+' / '+DESIGN.xpMax+'</span></div>'
  +'<p class="pf-desc">继续练习，舒展身心，遇见更平和的自己。</p></div></div>'
 +'<section class="card bodycard"><div class="sec-h">'+knot()+'身体数据<span class="sec-note">示例指标 · 未连接设备</span></div>'
  +'<div class="bstats">'
   +'<div class="bstat"><span class="ic pink">'+ic('heart')+'</span><div class="lb">心率</div><div class="v">72</div><div style="font-size:1.2rem;color:var(--muted)">次/分</div><span class="tag grn st">正常</span></div>'
   +'<div class="bstat"><span class="ic ind">'+ic('moon')+'</span><div class="lb">睡眠时长</div><div class="v">6.5</div><div style="font-size:1.2rem;color:var(--muted)">小时</div><span class="tag grn st">良好</span></div>'
   +'<div class="bstat"><span class="ic grn">'+ic('lotus')+'</span><div class="lb">身心评分</div><div class="v">92</div><div style="font-size:1.2rem;color:var(--muted)">分</div><span class="tag grn st">状态平和</span></div>'
   +'<div style="display:flex;align-items:center"><button class="btn btn-green btn-sm" style="min-height:4.8rem" data-a="go-body">查看详情 ›</button></div>'
  +'</div></section>'
 +'<div class="halfgrid">'
  +'<section class="card half"><div class="sec-h" data-a="records" role="button" tabindex="0" style="color:var(--green-deep)">'+ic('bars','width:2rem;height:2rem')+'历史数据 ›</div><p>'+(has?('已打卡 '+st.n+' 次 · 累计 '+Math.round(st.sec/60)+' 分钟'):'记录每一次的练习与变化，见证更好的自己。')+'</p>'
   +'<div class="minibars">'+bars.map(function(v){return '<i style="height:'+v+'%"></i>'}).join('')+'</div></section>'
  +'<section class="card half"><div class="sec-h" data-a="stage" role="button" tabindex="0" style="color:var(--green-deep)">'+ic('leaf','width:2rem;height:2rem')+'阶段进度 ›</div>'
   +'<p style="color:var(--brown);font-weight:600;margin-top:1rem">八段锦·中级阶段</p><p>已完成 '+on+' / 8 节</p>'
   +'<div class="dots8">'+dots+'</div></section></div>'
 +'<section class="card setlist">'
  +'<div class="setrow" data-a="go-lab" data-label="调养实验室"><span class="ic">'+ic('leaf')+'</span><b>调养实验室</b><span>五音 · 食养 · 香事 · 功法 · 问卷</span><span class="r">›</span></div>'
  +'<div class="setrow" data-a="set-archive" data-label="我的养生档案"><span class="ic">'+ic('doc')+'</span><b>我的养生档案</b><span>练习与身心数据汇总 · 可导出 Markdown</span><span class="r">›</span></div>'
  +'<div class="setrow" data-a="set-docs" data-label="我的文档"><span class="ic">'+ic('folder')+'</span><b>我的文档</b><span>体检报告 / 舌象照片 / 养生文章 · 仅存本机</span><span class="r">›</span></div>'
  +'<div class="setrow" data-a="set-basic" data-label="基础设置"><span class="ic">'+ic('gear')+'</span><b>基础设置</b><span>账号管理、提醒设置、个性化偏好</span><span class="r">›</span></div>'
  +'<div class="setrow" data-a="set-help" data-label="帮助与反馈"><span class="ic">'+ic('headset')+'</span><b>帮助与反馈</b><span>常见问题、意见反馈、联系我们</span><span class="r">›</span></div>'
  +'<div class="setrow" data-a="set-about" data-label="版本信息"><span class="ic">'+ic('info')+'</span><b>版本信息</b><span>当前版本为最新版</span><span class="r">v1.0.0 ›</span></div></section>'
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

/* ==================== 问询（智能体交互页） ====================
   模型配置（接口地址 / 密钥 / 模型名）只存在本机浏览器 localStorage['xy-ask-cfg']，
   对话时浏览器直连 DeepSeek 兼容接口，不经过弦养的任何中间服务器。
   未配置密钥时保持「诚实兜底」：明确提示演示模式，绝不伪造回答。
   dist/local-config.js（gitignored）可在新机上自动预填一次密钥。 */
var ASK_DEFAULT_BASE='https://api.deepseek.com';
var ASK_DEFAULT_MODEL='deepseek-flash';
var ASK_MODELS=['deepseek-flash','deepseek-v4-pro'];
var ASK_CHIPS=['八段锦第一式怎么做？','今天适合练什么？','徵调适合什么时候听？'];
/* 孙宇晨式 AI 赋能：持续记录留在本机，模型只是可替换的外接大脑。
   收紧回答格式（150 字 / 最多 3 点 / 禁表格代码块标题），小屏气泡阅读优先。 */
var ASK_SYS='你是「弦养」的个人养生顾问，要基于用户本机的真实练习与身心数据给建议，而不是泛泛而谈。'
  +'回答范围：八段锦/五禽戏等功法要领、五音调养（宫商角徵羽）、顺时起居与食养、当日练习安排。'
  +'格式：口语化、具体可执行，控制在 150 字左右、最多分 3 点；只用换行与少量加粗，禁止使用表格、代码块、标题语法。'
  +'语气平和温润，像一位懂传统养生的朋友；不做疾病诊断、不开药方，遇到明显不适应建议就医；不确定的内容如实说明，不要编造。'
  +'个人数据只用于服务本人：不要逐条复述数据，也不要臆造摘要里没有的数据。';
var ASK_BRIEF_SYS='你是「弦养」的个人养生顾问。请根据用户的【今日时令】与本机数据摘要，主动生成一份「今日养生简报」：'
  +'开头一句话呼应节气与季节，随后最多 3 条贴合用户近况的建议（今天练什么、听什么调、起居或食养任选），总共 150 字以内；'
  +'只用换行与少量加粗，不要表格、代码块、标题语法。若缺少练习与日记数据，就按节气给温和的开场建议，'
  +'并在最后用半句话提示：完成一次练习或「每日一记」后，建议会更贴合本人。';
var ASK_ARCHIVE_SYS='你是「弦养」的个人养生顾问。请依据用户的本机数据摘要，写一段 200–300 字的「阶段养生小结」：'
  +'总结近期练习与身心状态的趋势、值得保持的习惯、下一步可调整的一点；语气平实温润，分 2–3 个自然段即可，'
  +'不要表格、代码块、标题语法，不做疾病诊断；数据不足的部分如实带过，不要编造。';
/* 首次加载：本机私密文件 dist/local-config.js 若提供了密钥，自动预填一次（用户已保存过配置则不覆盖） */
function seedAskCfg(){try{var w=window.__XIANYANG_LOCAL__;
  if(w&&typeof w.askKey==='string'&&w.askKey.trim()&&!localStorage.getItem('xy-ask-cfg')){
    localStorage.setItem('xy-ask-cfg',JSON.stringify({base:ASK_DEFAULT_BASE,key:w.askKey.trim(),model:ASK_DEFAULT_MODEL}));
  }}catch(_){}}
function askCfg(){var c={base:ASK_DEFAULT_BASE,key:'',model:ASK_DEFAULT_MODEL};
  try{var x=JSON.parse(localStorage.getItem('xy-ask-cfg')||'null');
    if(x&&typeof x==='object'){
      if(typeof x.base==='string'&&x.base.trim())c.base=x.base.trim();
      if(typeof x.key==='string'&&x.key.trim())c.key=x.key.trim();
      if(typeof x.model==='string'&&x.model.trim())c.model=x.model.trim();
    }}catch(_){}
  return c}
function saveAskCfg(c){try{localStorage.setItem('xy-ask-cfg',JSON.stringify({base:c.base,key:c.key,model:c.model}));return true}
  catch(_){toast('本机存储不可用，配置仅在本次访问保留');return false}}
function askMask(k){k=String(k);return k.length>10?k.slice(0,6)+'•••••••'+k.slice(-4):'••••••••'}
function askEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
/* ---------- 本机存储：隐私 / 历史 / 简报 / 日记 / 档案小结 ---------- */
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}
function lsDel(k){try{localStorage.removeItem(k)}catch(_){}}
function askPriv(){var p={on:true,practice:true,body:true,journal:true},x=lsGet('xy-ask-priv');
  if(x&&typeof x==='object')['on','practice','body','journal'].forEach(function(k){if(typeof x[k]==='boolean')p[k]=x[k]});
  if(!p.on){p.practice=false;p.body=false;p.journal=false}return p}
function savePriv(p){lsSet('xy-ask-priv',p)}
function loadHist(){var a=lsGet('xy-ask-hist');return Array.isArray(a)?a.filter(function(m){return m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string'}).slice(-40):[]}
function persistHist(){var h=askMsgs().filter(function(m){if(m.greet||m.brief)return false;
    if(m.who==='u')return !!(m.text||(m.att&&m.att.length));
    return m.who==='a'&&!!m.text})
  .map(function(m){if(m.who!=='u')return{role:'assistant',content:m.text};
    return{role:'user',content:m.text||'',att:(m.att||[]).map(function(a){
      return{kind:a.kind==='image'?'image':'doc',name:a.name||'',thumb:a.thumb||''}})}}).slice(-40);lsSet('xy-ask-hist',h)}
/* 历史消息发给模型时：旧图片只留占位文字（原图不入库），文档不重发全文 */
function apiHistMsg(h){if(h.role!=='user'||!h.att||!h.att.length)return{role:'user',content:h.content||''};
  var t=h.content||'';
  h.att.forEach(function(a){t+=(t?'\n':'')+(a.kind==='image'
    ?('[图片附件：'+(a.name||'图片')+'，原图未重发]')
    :('[文档附件：'+(a.name||'文档')+'，全文见当时提问]'))});
  return{role:'user',content:t}}
function loadBrief(){var b=lsGet('xy-brief');return(b&&typeof b.d==='string'&&typeof b.text==='string')?b:null}
function saveBrief(text){lsSet('xy-brief',{d:today(),text:text})}
var JR_SLEEP_OPTS=[['不足 6 小时',5.5],['6–7 小时',6.5],['7–8 小时',7.5],['8 小时以上',8.5]];
function sleepLab(v){var lab='';JR_SLEEP_OPTS.forEach(function(o){if(Math.abs(o[1]-v)<0.01)lab=o[0]});return lab||(v+' 小时')}
function loadJournal(){var a=lsGet('xy-journal');return Array.isArray(a)?a.filter(function(j){return j&&typeof j.d==='string'}):[]}
function saveJournal(a){return lsSet('xy-journal',a.slice(-200))}
function journalToday(){var t=null;loadJournal().forEach(function(j){if(j.d===today())t=j});return t}
function recentJournal(n){return loadJournal().slice().sort(function(a,b){return a.d<b.d?1:-1}).slice(0,n).reverse()}
function upsertJournal(e){var a=loadJournal(),i=-1;a.forEach(function(j,ix){if(j.d===e.d)i=ix});
  if(i>=0)a[i]=Object.assign({},a[i],e);else a.push(e);return saveJournal(a)}
function loadArchiveAI(){var a=lsGet('xy-archive-ai');return(a&&typeof a.d==='string'&&typeof a.text==='string')?a:null}
/* ---------- 个人数据摘要（只发压缩摘要，受隐私开关控制） ---------- */
var CN_NUM=['一','二','三','四','五','六','七','八'];
function practice30(){var cut=Date.now()-30*864e5,n=0,sec=0;
  state.records.forEach(function(r){var t=new Date(r.d+'T00:00:00').getTime();if(t>=cut){n++;sec+=(+r.sec||0)}});
  return'近 30 天打卡 '+n+' 天 / 约 '+Math.round(sec/60)+' 分钟'}
function weakMove(S){if(!S||!S.scores||!S.scores.length)return'';var bi=0,bv=101;
  S.scores.forEach(function(v,i){var n=+v||0;if(n<bv){bv=n;bi=i}});
  var name=POSES[bi]||'';return'；最弱环节：第'+CN_NUM[bi]+'式「'+name+'」完成度 '+bv+' 分'}
function askContext(){var p=askPriv(),C=todayContext(),L=[];
  L.push('【今日时令】'+C.gLunar+'，节气「'+C.T.name+'」，属'+C.season+'季。');
  if(p.on){
    if(p.body){
      if(state.quiz&&state.quiz.tags&&state.quiz.tags.length)L.push('【调养问卷】'+state.quiz.tags.join('、'));
      L.push('【身体档案】身高 '+state.body.h+' cm，体重 '+state.body.w+' kg，'+state.body.a+' 岁；'
        +'需避让/不适：'+state.inj.join('、')+'；目标：'+state.goals.join('、')+'；饮食偏好：'+state.diet.join('、'));
    }
    if(p.practice){var st=recordStats(),sk=streak();
      if(st.n)L.push('【练习记录】累计打卡 '+st.n+' 次 / '+st.days+' 天，约 '+Math.round(st.sec/60)+' 分钟，当前连续 '+sk+' 天；'+practice30()+'。');
      else L.push('【练习记录】还没有打卡记录。');
      var S=lastSession();
      if(S)L.push('【最近一次跟练】完成 '+S.moves+' / '+(S.total||8)+' 式，用时 '+fmtDur(S.sec||0)
        +(doneAvg(S)!=null?('，平均完成度 '+doneAvg(S)+' 分'):'')+weakMove(S)+'。');
    }
    if(p.journal){var js=recentJournal(7);
      if(js.length){var ss=js.filter(function(j){return typeof j.sleep==='number'}),es=js.filter(function(j){return typeof j.energy==='number'});
        var avg=function(a,f){if(!a.length)return'';return(a.reduce(function(x,j){return x+f(j)},0)/a.length).toFixed(1)};
        L.push('【每日一记 · 近 7 天】'+(ss.length?('平均睡眠 '+avg(ss,function(j){return j.sleep})+' 小时；'):'')
          +(es.length?('平均精力 '+avg(es,function(j){return j.energy})+' / 5；'):'')
          +js.map(function(j){return j.d.slice(5)+' 睡眠'+(typeof j.sleep==='number'?sleepLab(j.sleep):'未记')
            +'，精力'+(j.energy||'未记')+(j.mood?('，感受「'+j.mood+'」'):'')}).join('；')+'。');
      }
    }
    var ds=docCache.filter(function(r){return r.parse==='ok'&&r.sum==='ok'&&r.summary});
    if(ds.length)L.push('【我的文档】用户本机文库中现有：'+ds.slice(0,10).map(function(r){
      return'《'+r.name+'》'+r.summary}).join('；')+'。用户在消息中附上某文档全文时，优先依据附件内容回答。');
  }
  return L.join('\n')}
function askSystem(kind){var base=kind==='brief'?ASK_BRIEF_SYS:kind==='archive'?ASK_ARCHIVE_SYS:ASK_SYS;
  return base+'\n\n【用户本机数据摘要】\n'+askContext()}
/* ---------- 对话模型 ---------- */
function askSeed(){var s=[{who:'a',greet:true,text:'你好，我是弦养顾问。功法要领、五音调养、今日安排，都可以问我。'}];
  if(!askCfg().key)s.push({who:'n',text:'还没有配置模型接口，当前是演示模式：到「我的 → 设置 → 智能体 API」填入模型密钥，即可真实对话。'});
  return s}
function askMsgs(){if(!state.ask.msgs){state.ask.msgs=askSeed();
    var b=loadBrief();if(b&&b.d===today())state.ask.msgs.push({who:'a',brief:true,text:b.text});
    loadHist().forEach(function(h){state.ask.msgs.push({who:h.role==='user'?'u':'a',text:h.content,
      att:Array.isArray(h.att)?h.att.map(function(a){return{kind:a.kind==='image'?'image':'doc',name:a.name||'',thumb:a.thumb||''}}):[]})});
  }return state.ask.msgs}
/* 简报要插在问候/提示之后、历史对话之前 */
function addLeading(m){var ms=askMsgs(),i=0;while(i<ms.length&&(ms[i].greet||ms[i].brief||ms[i].who==='n'))i++;ms.splice(i,0,m)}
/* ---------- 极简安全 Markdown：先转义 HTML，只放行加粗/换行/无序列表/有序列表 ---------- */
function askMD(s){var rawLines=String(s||'').replace(/\r/g,'').split('\n'),lines=[],
    isUL=t=>/^[-·•*]\s+/.test(t),isOL=t=>/^\d+[.、)]\s+/.test(t);
  /* 模型常在列表项之间插空行（1.…\n\n2.…），把同类列表项间的空行压掉，保证合到同一个 ol/ul */
  rawLines.forEach(function(t,i){
    var trim=t.trim();
    if(!trim&&lines.length){
      var prev=lines[lines.length-1],next='';
      for(var j=i+1;j<rawLines.length;j++){if(rawLines[j].trim()){next=rawLines[j].trim();break}}
      if(next&&((isUL(prev)&&isUL(next))||(isOL(prev)&&isOL(next))))return;
    }
    lines.push(trim);
  });
  var h=[],ul=false,ol=false;
  function close(){if(ul){h.push('</ul>');ul=false}if(ol){h.push('</ol>');ol=false}}
  function inline(t){return askEsc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}
  lines.forEach(function(t){var mu=t.match(/^[-·•*]\s+(.+)$/),mo=t.match(/^\d+[.、)]\s+(.+)$/);
    if(mu){if(ol){h.push('</ol>');ol=false}if(!ul){h.push('<ul>');ul=true}h.push('<li>'+inline(mu[1])+'</li>')}
    else if(mo){if(ul){h.push('</ul>');ul=false}if(!ol){h.push('<ol>');ol=true}h.push('<li>'+inline(mo[1])+'</li>')}
    else if(!t)close();
    else{close();h.push('<p>'+inline(t)+'</p>')}});
  close();return'<div class="ask-md">'+h.join('')+'</div>'}
function askListHTML(){return askMsgs().map(function(m){
    if(m.who==='u'){
      var atts=(m.att||[]).map(function(a){
        if(a.kind==='image'){var src=a.thumb||a.url||'';
          return'<button class="ask-uimg" data-a="img-view" data-src="'+askEsc(src)+'"><img src="'+askEsc(src)+'" alt="'+askEsc(a.name||'图片')+'"></button>'}
        return'<span class="ask-udoc">'+ic('doc')+askEsc(a.name||'文档')+'</span>'}).join('');
      return'<div class="ask-row r"><div class="ask-col" style="align-items:flex-end">'+(m.text?'<div class="ask-b ask-u">'+askEsc(m.text)+'</div>':'')+(atts?'<div class="ask-uatt">'+atts+'</div>':'')+'</div></div>';
    }
    if(m.who==='n')return'<div class="ask-row"><div class="ask-b ask-n"><span>'+askEsc(m.text)+'</span>'
       +(m.retry?'<button class="ask-retry" data-a="ask-retry" data-q="'+askEsc(m.retry)+'">重试</button>':'')+'</div></div>';
    var label=m.greet?'弦养顾问':(m.brief?'今日养生简报':'');
    return'<div class="ask-row"><div class="ask-col">'+(label?'<div class="ask-who'+(m.brief?' brief':'')+'">'+label+'</div>':'')
      +'<div class="ask-b ask-a">'+(m.wait?'<span class="ask-typing">'+ic('dots')+'</span>':askMD(m.text))+'</div></div></div>';
  }).join('')}
var askSyncQueued=false;
function scheduleAskSync(){if(askSyncQueued)return;askSyncQueued=true;requestAnimationFrame(function(){askSyncQueued=false;syncAskUI()})}
/* 只改对话区、不重绘整页 —— 与 syncAudioUI 同一思路：重绘会让输入框失焦 */
function syncAskUI(){
  if(!root)return
  var list=root.querySelector('#ask-list');if(list){list.innerHTML=askListHTML();list.scrollTop=list.scrollHeight}
  var att=root.querySelector('#ask-att');if(att)att.innerHTML=attCapsHTML();
  var inp=root.querySelector('#ask-input'),sb=root.querySelector('[data-a="ask-send"]');
  if(sb)sb.disabled=!!state.ask.typing||!((inp&&inp.value.trim())||state.ask.draft.length)}
function askApiErr(status,d){
  if(status===401)return'接口鉴权失败（401）：密钥无效或已过期，请到「我的 → 设置 → 智能体 API」检查。';
  if(status===402)return'模型账户额度不足（402），请充值或更换密钥后再试。';
  if(status===429)return'请求过于频繁（429），请稍等片刻再发。';
  var msg=d&&d.error&&d.error.message?String(d.error.message):'';
  return'模型服务返回错误（'+status+'）'+(msg?'：'+msg:'');}
/* SSE 流式调用；老浏览器没有 ReadableStream 时回落到一次式 JSON */
function askComplete(messages,onDelta){var cfg=askCfg();
  var url=cfg.base.replace(/\/+$/,'')+'/chat/completions';
  var headers={'Content-Type':'application/json','Authorization':'Bearer '+cfg.key};
  return new Promise(function(resolve,reject){
    var ctrl=new AbortController();state.ask.ctrl=ctrl;
    fetch(url,{method:'POST',headers:headers,signal:ctrl.signal,
      body:JSON.stringify({model:cfg.model,messages:messages,temperature:.7,max_tokens:800,stream:true})})
     .then(function(res){
       if(!res.ok){res.json().catch(function(){return{}}).then(function(d){reject(new Error(askApiErr(res.status,d)))});return}
       if(!res.body||typeof res.body.getReader!=='function'){legacy();return}
       var reader=res.body.getReader(),dec=new TextDecoder(),buf='',full='';
       (function pump(){reader.read().then(function(r){
         if(r.done){resolve(full.trim());return}
         buf+=dec.decode(r.value,{stream:true});
         var nl;while((nl=buf.indexOf('\n'))>=0){var line=buf.slice(0,nl).replace(/\r$/,'');buf=buf.slice(nl+1);
           if(line.indexOf('data:')===0){var d=line.slice(5).trim();
             if(d&&d!=='[DONE]'){try{var o=JSON.parse(d),t=o.choices&&o.choices[0]&&o.choices[0].delta&&o.choices[0].delta.content;
               if(t){full+=t;onDelta&&onDelta(full)}}catch(_){}}}
         }
         pump()
       }).catch(reject)})()
     }).catch(reject);
    function legacy(){fetch(url,{method:'POST',headers:headers,signal:ctrl.signal,
        body:JSON.stringify({model:cfg.model,messages:messages,temperature:.7,max_tokens:800})})
      .then(function(r){return r.json().catch(function(){return{}}).then(function(d){return{ok:r.ok,status:r.status,d:d}})})
      .then(function(res){if(res.ok&&res.d&&res.d.choices&&res.d.choices[0]&&res.d.choices[0].message){
          var t=(res.d.choices[0].message.content||'').trim();onDelta&&onDelta(t);resolve(t)
        }else reject(new Error(askApiErr(res.status,res.d)))})
      .catch(function(){reject(new Error('连不上模型服务，请检查网络或接口地址。'))})}
  })
}
function abortAsk(){state.ask.leaving=true;if(state.ask.ctrl){try{state.ask.ctrl.abort()}catch(_){}state.ask.ctrl=null}}
/* 把待发附件组装成模型消息 content：图片走多模态，文档附全文（截断保护） */
function buildApiUser(q,atts){
  var parts=[];
  if(q)parts.push({type:'text',text:q});
  return Promise.all(atts.map(function(a){
    if(a.kind==='image'){
      if(a.url)return Promise.resolve({type:'image',url:a.url});
      return docGetDB(a.id).then(function(rec){if(!rec||!rec.blob)throw new Error('图片已从文库删除')
        return blob2data(rec.blob).then(function(url){return{type:'image',url:url}})})
    }
    return docGetDB(a.id).catch(function(){return null}).then(function(rec){
      var t=(rec&&rec.text||'').slice(0,DOC_SEND_CAP),tail='';
      if(!rec)t='（该文档已从本机文库删除，无法读取全文）';
      else if(rec.truncated||rec.text.length>DOC_SEND_CAP)tail='\n（文档较长，仅附前 '+DOC_SEND_CAP+' 字）';
      return{type:'text',text:'【附件文档：'+a.name+'（'+docKindName(rec?rec.kind:'doc')+'）】\n'+(t||'（未提取到文字）')+tail}
    })
  })).then(function(more){
    more.forEach(function(m){
      if(m.type==='image')parts.push({type:'image_url',image_url:{url:m.url,detail:'auto'}});
      else parts.push(m)});
    if(!parts.some(function(p){return p.type==='text'}))parts.unshift({type:'text',text:'（请看我发的图片）'});
    if(parts.length===1)return parts[0].text;
    return parts.map(function(p){return p.type==='text'?{type:'text',text:p.text}:p})
  })
}
/* 普通问答：历史只在成功后持久化，失败给可点「重试」的提示气泡 */
function askRun(q,atts){
  if(state.ask.typing)return
  atts=atts||[];
  state.ask.leaving=false;
  var ms=askMsgs();
  var disp=atts.map(function(a){return{kind:a.kind,name:a.name,thumb:a.thumb||''}});
  ms.push({who:'u',text:q,att:disp});
  var wait={who:'a',wait:true},widx=ms.length;ms.push(wait);
  state.ask.lastQ=q;state.ask.typing=true;syncAskUI();
  var cfg=askCfg();
  if(!cfg.key){ms[widx]={who:'n',text:'还没有配置模型接口，无法真实回答。请到「我的 → 设置 → 智能体 API」填写模型密钥。',retry:q};
    state.ask.typing=false;syncAskUI();return}
  var gen=++state.ask.gen,apiHist=loadHist().map(apiHistMsg);
  buildApiUser(q,atts).then(function(content){
    apiHist.push({role:'user',content:content});
    return askComplete([{role:'system',content:askSystem('chat')}].concat(apiHist.slice(-40)),function(full){
      if(gen!==state.ask.gen)return;state.ask.typing=false;wait.wait=false;wait.text=full;scheduleAskSync()})
  })
   .then(function(text){if(gen!==state.ask.gen)return;
     if(text){wait.wait=false;wait.text=text;persistHist()}
     else{var i=ms.indexOf(wait);if(i>=0)ms[i]={who:'n',text:'模型这次没有返回文字，换个问法试试。',retry:q}}
     state.ask.typing=false;syncAskUI()})
   .catch(function(e){if(gen!==state.ask.gen||state.ask.leaving)return;state.ask.typing=false;
     var i=ms.indexOf(wait);var msg=(e&&String(e.message||'').indexOf('AbortError')>=0)?'已停止生成。':'连不上模型服务，请检查网络或接口地址。';
     if(i>=0)ms[i]={who:'n',text:msg,retry:q};syncAskUI()});
}
function askSend(q){
  if(state.ask.typing)return
  var inp=root.querySelector('#ask-input');
  if(typeof q!=='string')q=inp?((inp.value||'').trim()):'';
  q=String(q||'').trim();
  var atts=state.ask.draft.slice();
  if(!q&&!atts.length){toast('先写下你想问的问题，或加一张图片');if(inp)inp.focus();return}
  if(inp)inp.value='';
  state.ask.draft=[];
  /* 点「重试」：先移除上一次的失败气泡及其提问气泡，否则同一句话会出现两遍（重试不带附件） */
  if(!atts.length){var ms0=askMsgs();
    for(var k=ms0.length-1;k>=0&&ms0[k].who==='n';k--){
      if(ms0[k].retry===q){
        ms0.splice(k,1);
        if(ms0[k-1]&&ms0[k-1].who==='u'&&ms0[k-1].text===q)ms0.splice(k-1,1);
        break;
      }
    }}
  syncAskUI();askRun(q,atts)
}
/* ---------- 今日养生简报：每天自动一次（缓存本机，重生成才再花费） ---------- */
function briefRun(){
  var cfg=askCfg();if(!cfg.key){toast('配置模型密钥后才能生成今日简报');return}
  state.ask.leaving=false;
  var ms=askMsgs();
  for(var i=ms.length-1;i>=0;i--)if(ms[i].brief)ms.splice(i,1);
  var b={who:'a',brief:true,wait:true};addLeading(b);
  state.ask.typing=true;syncAskUI();
  var gen=++state.ask.gen;
  askComplete([{role:'system',content:askSystem('brief')},{role:'user',content:'请给出我今天的养生简报。'}],function(full){
      if(gen!==state.ask.gen)return;state.ask.typing=false;b.wait=false;b.text=full;scheduleAskSync()})
   .then(function(text){if(gen!==state.ask.gen)return;b.wait=false;
     if(text){b.text=text;saveBrief(text)}
     else{var i=ms.indexOf(b);if(i>=0)ms.splice(i,1)}
     state.ask.typing=false;syncAskUI()})
   .catch(function(){if(gen!==state.ask.gen||state.ask.leaving)return;
     var i=ms.indexOf(b);if(i>=0&&!b.text)ms.splice(i,1);state.ask.typing=false;syncAskUI()});
}
function maybeBrief(){var b=loadBrief();
  if(b&&b.d===today()){if(!askMsgs().some(function(m){return m.brief}))addLeading({who:'a',brief:true,text:b.text});syncAskUI();return}
  briefRun()}
function askEnter(){askMsgs();if(!state.ask.briefDone){state.ask.briefDone=true;maybeBrief()}}
function askNewConfirm(show){var c=root.querySelector('#ask-confirm');if(c)c.hidden=!show}
function askNew(){abortAsk();lsDel('xy-ask-hist');lsDel('xy-brief');
  state.ask.gen++;state.ask.msgs=null;state.ask.briefDone=false;state.ask.typing=false;state.ask.draft=[];
  paint();askEnter()}
function askNoteHTML(){var c=askCfg(),p=askPriv();
  if(!c.key)return'<p class="ask-note">'+ic('info')+'<span>演示模式：到「我的 → 设置 → 智能体 API」配置模型密钥，即可获得结合你练习数据与个人文档的真实回答。</span></p>';
  return'<p class="ask-note">'+ic('info')+'<span>由你配置的 AI 模型生成'+(p.on?'，已结合你的本机练习数据':'，当前未读取本机数据（可在智能体 API 设置中开启）')+'；内容仅供参考，不替代专业医疗建议。</span></p>'}

/* ---------- 问询页（微信式一屏布局：头部固定 / 消息区单滚动 / 输入沉底） ---------- */
function pgInquiry(){
 return '<main class="sc ask-main">'
 +'<div class="ask-head">'
  +'<div class="ask-top"><div class="ask-brand">'+knot()+'<b>问询 · 弦养顾问</b><span class="ask-badge">智能体</span></div>'
  +'<div class="ask-acts">'
   +'<button class="icbtn" data-a="ask-today" aria-label="今日面板">'+ic('cal')+'</button>'
   +'<button class="icbtn" data-a="ask-journal" aria-label="每日一记">'+ic('edit')+'</button>'
   +'<button class="icbtn" data-a="ask-new" aria-label="新对话">'+ic('refresh')+'</button>'
  +'</div></div>'
  +'<p class="ask-sub">关于功法要领、五音调养与今日练习安排，都可以问一问。'
   +(askCfg().key?'<button class="ask-regen" data-a="ask-brief-regen">重新生成简报</button>':'')+'</p>'
  +'<div class="ask-confirm" id="ask-confirm" hidden><span>清空当前对话？</span>'
   +'<button class="btn btn-gho btn-sm" data-a="ask-new-cancel">取消</button>'
   +'<button class="btn btn-sm" data-a="ask-new-ok">确定</button></div>'
  +'<aside class="ask-side" aria-label="今日面板">'+todayPanelHTML()+'</aside>'
 +'</div>'
 +'<section class="card ask-card">'
  +'<div id="ask-list" class="ask-list" role="log" aria-live="polite">'+askListHTML()+'</div>'
  +'<div class="ask-chips">'+ASK_CHIPS.map(function(c){return '<button class="ask-chip" data-a="ask-chip" data-q="'+askEsc(c)+'">'+askEsc(c)+'</button>'}).join('')+'</div>'
  +'<div class="ask-att" id="ask-att">'+attCapsHTML()+'</div>'
  +'<div class="ask-input">'
   +'<button class="ask-plus" data-a="ask-attach" aria-label="添加图片或文档">'+ic('plus')+'</button>'
   +'<input id="ask-input" type="text" autocomplete="off" maxlength="200" placeholder="写下你想问的…" aria-label="输入要问的问题">'
   +'<button class="ask-send" data-a="ask-send" aria-label="发送" disabled>'+ic('chev','width:2rem;height:2rem')+'</button>'
  +'</div>'
 +'</section>'
 +askNoteHTML()
 +nav('inquiry')+'</main>'}

/* ---------- 渲染 & 事件 ---------- */
var PAGES={loading:pgLoading,question:pgQuestion,audio:pgAudio,home:pgHome,intro:pgIntro,practice:pgPractice,done:pgDone,profile:pgProfile,body:pgBody,inquiry:pgInquiry}
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
  root.querySelectorAll('.setrow').forEach(function(row){row.setAttribute('role','button');row.tabIndex=0;
    if(!row.dataset.a){row.dataset.a='unavailable';row.dataset.label=row.querySelector('b')?row.querySelector('b').textContent:'此功能'}});
  var stage=root.querySelector('.stage');if(stage){stage.classList.toggle('paused',!state.running);stage.dataset.preview='true'}
  if(focusIndex>=0){var next=root.querySelectorAll('button')[focusIndex];if(next)next.focus({preventScroll:true})}
  syncAudioUI();
  syncAskUI();
}
function go(s){if(typeof stopHold==='function')stopHold(true);if(typeof stopBreath==='function')stopBreath(true);
  abortAsk();state.ask.typing=false;
  state.screen=s;paint();window.scrollTo(0,0);root.querySelector('main').focus({preventScroll:true});
  if(s==='inquiry')askEnter()}

/* ==================== 浮层：设置 / 通知 / 帮助 / 详情 / 分享 ==================== */
var SH=null;
function sheetEl(){if(SH&&SH.isConnected)return SH;
  SH=document.createElement('div');SH.className='xs';
  SH.innerHTML='<div class="xs-mask" data-a="sheet-close"></div><div class="xs-panel" role="dialog" aria-modal="true" aria-label="详情">'
   +'<div class="xs-h"><b></b><button class="xs-x" data-a="sheet-close" aria-label="关闭">'+ic('back')+'</button></div>'
   +'<div class="xs-b"></div></div>';
  SH.addEventListener('click',function(e){if(e.target===SH.querySelector('.xs-mask'))closeSheet()});
  document.body.appendChild(SH);return SH}
function openSheet(title,html,cls){var s=sheetEl();s.querySelector('.xs-h b').textContent=title;s.querySelector('.xs-b').innerHTML=html;
  s.querySelector('.xs-panel').className='xs-panel'+(cls?' '+cls:'');
  s.classList.add('show');s.querySelector('.xs-panel').scrollTop=0;document.body.classList.add('xs-lock')}
function closeSheet(){if(SH){SH.classList.remove('show');document.body.classList.remove('xs-lock')}}
function sheetOpen(){return !!(SH&&SH.classList.contains('show'))}

/* ---- 各浮层内容 ---- */
function audioPrefsHTML(){
  return '<div class="xs-row"><div class="xs-lb"><b>曲目音量</b><span>同时影响曲目与七弦音效</span></div>'
   +'<input class="xs-range" type="range" min="0" max="100" step="5" value="'+Math.round(AUDIO.vol*100)+'" data-a="vol" aria-label="曲目音量"></div>'
   +'<div class="xs-row"><div class="xs-lb"><b>七弦音效</b><span>点弦 / 每式起势时拨弦</span></div>'
   +'<button class="tog'+(AUDIO.sound?' on':'')+'" data-a="sound" role="switch" aria-checked="'+AUDIO.sound+'" aria-label="七弦音效"></button></div>'
   +'<div class="xs-row"><div class="xs-lb"><b>循环播放</b><span>曲目播放到底后自动重来</span></div>'
   +'<button class="tog'+(AUDIO.loop?' on':'')+'" data-a="loop" role="switch" aria-checked="'+AUDIO.loop+'" aria-label="循环播放"></button></div>'
   +'<div class="xs-row"><div class="xs-lb"><b>七弦试音</b><span>依次弹出七弦散音（正调 C–D–F–G–A–c–d）</span></div>'
   +'<button class="btn btn-gho btn-sm" data-a="try-strings" style="min-height:4rem;padding:0 1.6rem">试听</button></div>'}
/* 「设置」浮层顶部的智能体 API 状态行 */
function askCfgRowHTML(){var c=askCfg();
  return '<div class="xs-row"><div class="xs-lb"><b>智能体 API</b>'
   +'<span>'+(c.key?('已配置 · '+askMask(c.key)+' · '+askEsc(c.model)):'未配置 · 问询页为演示模式')+'</span></div>'
   +'<button class="btn btn-gho btn-sm" data-a="set-ask" style="min-height:4rem;padding:0 1.6rem">配置</button></div>'}
/* 智能体 API 配置表单（密钥 / 接口地址 / 模型 + 保存 / 测试 / 清除） */
function askCfgHTML(){var c=askCfg();
  return '<div class="xs-item"><b>OpenAI 兼容接口</b><p>密钥只保存在本机浏览器（localStorage），提问时浏览器直连你填写的模型服务，不经过弦养的服务器。支持任何 OpenAI 兼容的 Chat Completions 服务。</p></div>'
   +'<label class="cfgp-lb" for="cfgp-key">API 密钥</label>'
   +'<input id="cfgp-key" class="cfgp-in" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." value="'+askEsc(c.key)+'">'
   +'<label class="cfgp-lb" for="cfgp-base">接口地址</label>'
   +'<input id="cfgp-base" class="cfgp-in" type="text" autocomplete="off" spellcheck="false" placeholder="'+ASK_DEFAULT_BASE+'" value="'+askEsc(c.base)+'">'
   +'<label class="cfgp-lb" for="cfgp-model">模型</label>'
   +'<input id="cfgp-model" class="cfgp-in" type="text" autocomplete="off" spellcheck="false" list="cfgp-models" placeholder="'+ASK_DEFAULT_MODEL+'" value="'+askEsc(c.model)+'">'
   +'<datalist id="cfgp-models">'+ASK_MODELS.map(function(m){return '<option value="'+m+'">'}).join('')+'</datalist>'
   +'<div class="cfgp-btns">'
   +'<button class="btn" data-a="ask-cfg-save">保存</button>'
   +'<button class="btn btn-gho" data-a="ask-cfg-test">测试连接</button>'
   +'<button class="btn btn-gho" data-a="ask-cfg-clear">清除密钥</button></div>'
   +'<div class="xs-note" id="cfgp-res"></div>'
   +askPrivHTML()
   +'<div class="xs-note">本机私密文件 dist/local-config.js（已被 git 忽略）会在未保存配置时自动预填密钥；它不会进入任何分支。</div>'}
/* 隐私：一个总开关 + 练习记录 / 身体数据 / 每日一记三个细分勾选 */
function askPrivHTML(){var p=askPriv();
  function row(k,title,sub){return '<div class="xs-row ask-pr'+(p.on?'':' off')+'"><div class="xs-lb"><b>'+title+'</b><span>'+sub+'</span></div>'
    +'<button class="tog'+(p.on&&p[k]?' on':'')+'" data-a="ask-priv-item" data-k="'+k+'" role="switch" aria-checked="'+(p.on&&p[k])+'"'+(p.on?'':' disabled')+'></button></div>'}
  return '<div class="xs-sub">助手可读取的本机数据</div>'
   +'<div class="xs-row"><div class="xs-lb"><b>允许读取本机数据</b><span>关闭后只按通用养生知识回答，不发送任何个人数据</span></div>'
   +'<button class="tog'+(p.on?' on':'')+'" data-a="ask-priv-on" role="switch" aria-checked="'+p.on+'"></button></div>'
   +row('practice','练习打卡与跟练','累计次数、连续天数、最近一次逐式完成度')
   +row('body','问卷与身体数据','调养方向、身高体重、旧伤、目标与饮食偏好')
   +row('journal','每日一记','睡眠档位、精力评分与一句话感受')}
/* 从弹层表单读出当前输入（未打开弹层时返回 null） */
function askCfgForm(){var s=SH;if(!s)return null;
  var k=s.querySelector('#cfgp-key'),b=s.querySelector('#cfgp-base'),m=s.querySelector('#cfgp-model');
  if(!k||!b||!m)return null;
  return{key:k.value.trim(),base:(b.value.trim()||ASK_DEFAULT_BASE),model:(m.value.trim()||ASK_DEFAULT_MODEL)}}
function askCfgRes(html){var n=SH&&SH.querySelector('#cfgp-res');if(n)n.innerHTML=html}
/* 用指定配置发一条极简请求验证连通性与密钥；save=true 时验证通过后顺带保存 */
function askCfgTest(c,save){
  if(!/^https?:\/\//.test(c.base)){askCfgRes('接口地址需以 http:// 或 https:// 开头。');return}
  askCfgRes('正在连接 '+askEsc(c.base)+' …');
  fetch(c.base.replace(/\/+$/,'')+'/chat/completions',{method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+(c.key||'')},
    body:JSON.stringify({model:c.model,messages:[{role:'user',content:'ping'}],max_tokens:8})})
   .then(function(r){return r.json().catch(function(){return{}}).then(function(d){return{ok:r.ok,status:r.status,d:d}})})
   .then(function(res){if(res.ok&&res.d&&res.d.choices&&res.d.choices[0]){
       if(save)saveAskCfg(c);
       askCfgRes('<b style="color:var(--green-deep)">连接成功 ✓</b> 模型 '+askEsc(c.model)+' 响应正常。'+(save?'配置已保存。':''));
       toast('模型连接成功');
     }else askCfgRes(askEsc(askApiErr(res.status,res.d)));})
   .catch(function(){askCfgRes('连不上接口：请检查网络与接口地址（默认地址 '+ASK_DEFAULT_BASE+'）。')});}
/* ==================== 每日一记 ==================== */
function journalOpenDraft(){var t=journalToday();
  state.jrDraft={sleep:(t&&typeof t.sleep==='number')?t.sleep:null,energy:t&&t.energy?t.energy:null};
  return t||null}
function journalHTML(skippable){var t=journalOpenDraft();
  var sleepChips=JR_SLEEP_OPTS.map(function(o){
    return '<button type="button" class="jr-chip'+(state.jrDraft.sleep!=null&&Math.abs(state.jrDraft.sleep-o[1])<0.01?' sel':'')+'" data-a="jr-sleep" data-v="'+o[1]+'">'+o[0]+'</button>'}).join('');
  var nums='';for(var i=1;i<=5;i++)nums+='<button type="button" class="jr-n'+(state.jrDraft.energy===i?' sel':'')+'" data-a="jr-energy" data-v="'+i+'">'+i+'</button>';
  return '<div class="xs-item"><b>每日一记</b><p>睡前花十秒记一下，弦养顾问会结合它给出更贴合你的建议。内容只保存在这台设备上。</p></div>'
   +'<div class="xs-sub">昨晚睡得怎么样</div><div class="jr-chips">'+sleepChips+'</div>'
   +'<div class="xs-sub">今天精力如何</div><div class="jr-nums"><span class="jr-low">偏乏</span>'+nums+'<span class="jr-low">很足</span></div>'
   +'<div class="xs-sub">一句话感受（可选）</div>'
   +'<textarea id="jr-mood" class="cfgp-in jr-ta" rows="2" maxlength="80" placeholder="比如：午饭后有点犯困，肩颈有点紧……">'+askEsc(t&&t.mood?t.mood:'')+'</textarea>'
   +'<div class="cfgp-btns"><button class="btn" data-a="journal-save">保存</button>'
   +(skippable?'<button class="btn btn-gho" data-a="sheet-close">跳过</button>':'')+'</div>'
   +'<div class="xs-note">每天只保留最新一条；也可以随时在「问询」页右上角补记。</div>'}
function jrSelect(el){if(!el)return;var box=el.parentNode;if(box)box.querySelectorAll('.jr-chip,.jr-n').forEach(function(b){b.classList.remove('sel')});el.classList.add('sel')}

/* ==================== 我的养生档案（Markdown，可带走的数据资产） ==================== */
function archiveMD(aiText){var st=recordStats(),S=lastSession(),C=todayContext(),L=[];
  L.push('# 弦养 · 我的养生档案');
  L.push('> 生成于 '+today()+'（'+C.T.name+' · '+C.season+'季） · 全部数据来自本机记录\n');
  L.push('## 一、身体档案与目标');
  if(state.quiz&&state.quiz.tags&&state.quiz.tags.length)L.push('- 调养问卷：'+state.quiz.tags.join('、'));
  L.push('- 身体数据：身高 '+state.body.h+' cm，体重 '+state.body.w+' kg，'+state.body.a+' 岁');
  L.push('- 需避让/不适：'+state.inj.join('、'));
  L.push('- 调养目标：'+state.goals.join('、'));
  L.push('- 饮食偏好：'+state.diet.join('、')+'\n');
  L.push('## 二、练习总览');
  if(st.n){L.push('- 累计打卡：'+st.n+' 次 / '+st.days+' 天，约 '+Math.round(st.sec/60)+' 分钟');
    L.push('- 当前连续练习：'+streak()+' 天');
    L.push('- '+practice30());
    L.push('- 累计完成招式：'+st.poses+' 式次');
  }else L.push('- 还没有打卡记录。');
  L.push('');
  L.push('## 三、最近一次跟练');
  if(S){L.push('- 完成 '+S.moves+' / '+(S.total||8)+' 式，用时 '+fmtDur(S.sec||0)+(doneAvg(S)!=null?'，平均完成度 '+doneAvg(S)+' 分':''));
    if(S.scores&&S.scores.length)L.push('- 逐式完成度：\n'+S.scores.map(function(v,i){return '  - 第'+CN_NUM[i]+'式「'+(POSES[i]||'')+'」：'+(+v||0)+' 分'}).join('\n'));
  }else L.push('- 暂无真实跟练识别记录。');
  L.push('');
  L.push('## 四、身心日常（每日一记 · 近 14 天）');
  var js=recentJournal(14);
  if(js.length){
    var ss=js.filter(function(j){return typeof j.sleep==='number'}),es=js.filter(function(j){return typeof j.energy==='number'});
    var avg=function(a,f){return a.length?(a.reduce(function(x,j){return x+f(j)},0)/a.length).toFixed(1):''};
    if(ss.length)L.push('- 平均睡眠 '+avg(ss,function(j){return j.sleep})+' 小时');
    if(es.length)L.push('- 平均精力 '+avg(es,function(j){return j.energy})+' / 5');
    js.forEach(function(j){L.push('- '+j.d+'：睡眠 '+(typeof j.sleep==='number'?sleepLab(j.sleep):'未记')+'；精力 '+(j.energy||'未记')+(j.mood?'；感受「'+j.mood+'」':''))});
  }else L.push('- 还没有每日一记。');
  L.push('');
  L.push('## 五、阶段养生小结');
  L.push(aiText||'（在档案页点「生成 AI 小结」后，由你配置的模型生成本节）');
  return L.join('\n')}
function archiveHTML(){var ai=loadArchiveAI(),has=!!(ai&&ai.d===today()&&ai.text);
  return '<div class="xs-item"><b>我的养生档案</b><p>由本机真实数据汇总成 Markdown：换模型、换设备都能带走。前四节随时可导出，AI 小结按需生成。</p></div>'
   +'<pre class="ar-pre" id="ar-pre">'+askEsc(archiveMD(has?ai.text:null))+'</pre>'
   +'<div class="cfgp-btns">'
   +'<button class="btn btn-gho" data-a="ar-copy">'+ic('copy','width:1.6rem;height:1.6rem')+'复制全文</button>'
   +'<button class="btn btn-gho" data-a="ar-download">'+ic('download','width:1.6rem;height:1.6rem')+'下载 .md</button>'
   +'<button class="btn" data-a="ar-ai">'+(has?'重新生成 AI 小结':'生成 AI 小结')+'</button></div>'
   +'<div class="xs-note" id="ar-status">'+(has?('AI 小结生成于 '+ai.d):'AI 小结只读取与问询相同的本机数据摘要；未配置密钥时不可用。')+'</div>'}
function archiveAIRun(){var s=SH;if(!s)return;
  var pre=s.querySelector('#ar-pre'),st=s.querySelector('#ar-status'),btns=s.querySelectorAll('.cfgp-btns button');
  if(!askCfg().key){toast('请先到「智能体 API」配置密钥');if(st)st.textContent='请先到「智能体 API」配置密钥。';return}
  btns.forEach(function(b){b.disabled=true});if(st)st.textContent='正在生成阶段养生小结…';
  var gen=++state.ask.gen;
  askComplete([{role:'system',content:askSystem('archive')},{role:'user',content:'请根据这些数据写我的阶段养生小结。'}],function(full){
    if(gen!==state.ask.gen)return;if(pre)pre.textContent=archiveMD(full.trim())})
   .then(function(text){if(gen!==state.ask.gen)return;btns.forEach(function(b){b.disabled=false});
     if(text){lsSet('xy-archive-ai',{d:today(),text:text});if(pre)pre.textContent=archiveMD(text);if(st)st.textContent='AI 小结已生成 · '+today()}
     else if(st)st.textContent='模型这次没有返回文字，请重试。';})
   .catch(function(e){if(gen!==state.ask.gen)return;btns.forEach(function(b){b.disabled=false});
     if(st)st.textContent=(e&&String(e.message||'').indexOf('AbortError')>=0)?'已停止生成。':'生成失败，请检查网络或密钥后重试。';})}
function archiveCopy(){var pre=SH&&SH.querySelector('#ar-pre');if(!pre)return;var text=pre.textContent;
  function done(){toast('档案全文已复制')}
  function fallback(){var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(_){toast('复制失败，请手动选择文本')}
    document.body.removeChild(ta)}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done).catch(fallback);else fallback()}
function archiveDownload(){var pre=SH&&SH.querySelector('#ar-pre');if(!pre)return;
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([pre.textContent],{type:'text/markdown;charset=utf-8'}));
  a.download='xianyang-archive-'+today()+'.md';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);if(a.parentNode)a.parentNode.removeChild(a)},1000);toast('已下载 Markdown 档案')}

/* ==================== 我的文档（IndexedDB 本机文库 + 图片/文档附件） ====================
   原文（含图片 Blob）只存本机 IndexedDB；仅当用户在某条消息显式附上时，内容才随请求
   发给用户自己配置的模型服务，弦养不经手任何文件。 */
var DOC_MAX_N=20,IMG_MAX=10*1024*1024,TXT_MAX=5*1024*1024;
var DOC_STORE_CAP=20000,DOC_SEND_CAP=12000,DOC_SUM_CAP=6000;
var ASK_DOC_SYS='你是养生助手的文档摘要模块。用户上传了个人文档（体检报告、检验单、养生文章、学习笔记等）。请只用一句话（不超过 50 字）概括其中与健康、养生最相关的要点；若文档与养生无关，概括其主题即可。不要寒暄、不要建议。';
var docCache=[];
/* ---------- IndexedDB ---------- */
var xyDBPromise=null;
function dbOpen(){if(xyDBPromise)return xyDBPromise;
  xyDBPromise=new Promise(function(res,rej){
    if(!window.indexedDB)return rej(new Error('本机文档库不可用（浏览器不支持 IndexedDB）'));
    var r=indexedDB.open('xy-db',1);
    r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains('docs'))db.createObjectStore('docs',{keyPath:'id'})};
    r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)};
  });return xyDBPromise}
function dbIDB(mode,fn){return dbOpen().then(function(db){return new Promise(function(res,rej){
  var tx=db.transaction('docs',mode),rq=fn(tx.objectStore('docs'));
  rq.onsuccess=function(){res(rq.result)};rq.onerror=function(){rej(rq.error)};
})})}
function docAllDB(){return dbIDB('readonly',function(st){return st.getAll()}).then(function(a){
  return(a||[]).sort(function(x,y){return x.at<y.at?1:-1})})}
function docGetDB(id){return dbIDB('readonly',function(st){return st.get(id)})}
function docPutDB(rec){return dbIDB('readwrite',function(st){return st.put(rec)})}
function docDelDB(id){return dbIDB('readwrite',function(st){return st.delete(id)})}
function docsRefresh(){return docAllDB().then(function(a){docCache=a;refreshDocBits();return a}).catch(function(){docCache=[];return[]})}
function docById(id){for(var i=0;i<docCache.length;i++)if(docCache[i].id===id)return docCache[i];return null}
/* ---------- 工具 ---------- */
function docUid(){return'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function fmtSize(n){if(n<1024)return n+' B';if(n<1048576)return Math.round(n/1024)+' KB';return (n/1048576).toFixed(1)+' MB'}
function docKind(file){var n=(file.name||'').toLowerCase(),t=file.type||'';
  if(t.indexOf('image/')===0||/\.(jpe?g|png|gif|webp)$/.test(n))return'image';
  if(t==='application/pdf'||/\.pdf$/.test(n))return'pdf';
  if(/\.docx?$/.test(n)||/word/.test(t))return'word';
  if(/\.(txt|md|markdown)$/.test(n)||t.indexOf('text/')===0)return'text';
  return''}
function docKindName(k){return{image:'图片',pdf:'PDF',word:'Word',text:'文本'}[k]||'文档'}
function docIcon(k){return k==='image'?ic('image'):ic('doc')}
function readAs(blob,as){return new Promise(function(res,rej){var fr=new FileReader();
  fr.onload=function(){res(fr.result)};fr.onerror=function(){rej(fr.error)};
  if(as==='text')fr.readAsText(blob);else fr.readAsDataURL(blob)})}
function blob2data(blob){return readAs(blob,'dataUrl')}
/* 图片缩略图：最长边 220px 的 JPEG，用于消息气泡与列表展示 */
function makeThumb(fileOrBlob){return new Promise(function(res){
  readAs(fileOrBlob,'dataUrl').then(function(url){
    var img=new Image();
    img.onload=function(){try{
      var m=220/Math.max(img.width,img.height),w=img.width,h=img.height;
      if(m<1){w=Math.round(img.width*m);h=Math.round(img.height*m)}
      var cv=document.createElement('canvas');cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);res(cv.toDataURL('image/jpeg',.72))
    }catch(_){res(url)}};
    img.onerror=function(){res('')};img.src=url;
  }).catch(function(){res('')})})}
/* ---------- 解析（全部本机完成） ---------- */
function parsePdf(blob){
  if(window.pdfjsLib&&!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.js';
  if(!window.pdfjsLib)return Promise.reject(new Error('PDF 解析组件未加载'));
  return blob.arrayBuffer().then(function(buf){return pdfjsLib.getDocument({data:buf}).promise})
   .then(function(pdf){var ps=[],n=Math.min(pdf.numPages,30);
    for(var i=1;i<=n;i++)ps.push(i);
    return ps.reduce(function(chain,pi){return chain.then(function(text){
      return pdf.getPage(pi).then(function(pg){return pg.getTextContent()}).then(function(tc){
        return text+tc.items.map(function(it){return it.str}).join(' ')+'\n'})})},Promise.resolve(''))
     .then(function(all){
      if(all.replace(/\s/g,'').length<20)return{text:'',fail:'扫描件暂不支持文字提取，可拍照后以图片方式上传'};
      return capText(all)})})}
function parseWord(blob){
  if(!window.mammoth)return Promise.reject(new Error('Word 解析组件未加载'));
  return blob.arrayBuffer().then(function(buf){return mammoth.extractRawText({arrayBuffer:buf})})
   .then(function(r){return capText(r.value||'')})}
function capText(t){t=String(t||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if(t.length<=DOC_STORE_CAP)return{text:t,truncated:false};
  return{text:t.slice(0,DOC_STORE_CAP),truncated:true}}
function parseFile(kind,blob){
  if(kind==='text')return readAs(blob,'text').then(capText);
  if(kind==='pdf')return parsePdf(blob);
  if(kind==='word')return parseWord(blob);
  return Promise.resolve({text:'',truncated:false})}
/* ---------- 入库 + 摘要 ---------- */
function docSummary(rec,imgDataUrl){
  if(!askCfg().key){rec.sum='fail';rec.summary='';return docPutDB(rec)}
  var content;
  if(rec.kind==='image'){content=[
    {type:'text',text:'这是我上传的图片（'+rec.name+'），请一句话概括其中与养生、健康相关的信息。'},
    {type:'image_url',image_url:{url:imgDataUrl||rec.thumb,detail:'low'}}]}
  else content='文档名：'+rec.name+'（'+docKindName(rec.kind)+'）\n\n'+(rec.text||'').slice(0,DOC_SUM_CAP);
  return askComplete([{role:'system',content:ASK_DOC_SYS},{role:'user',content:content}])
   .then(function(t){rec.summary=(t||'').trim().slice(0,120);rec.sum=rec.summary?'ok':'fail'})
   .catch(function(){rec.sum='fail';rec.summary=''})
   .then(function(){return docPutDB(rec)})
}
function docsIngest(fileList){
  var files=Array.prototype.slice.call(fileList||[]).filter(Boolean);
  if(!files.length)return Promise.resolve();
  return docsRefresh().then(function(existing){
    var room=DOC_MAX_N-existing.length,ok=0,skipped=[];
    function next(i){
      if(i>=files.length){docsRefresh();
        toast(ok?('已保存 '+ok+' 个文档到本机文库'+(skipped.length?'，'+skipped.length+' 个未支持':'')):'文件未被支持，可传图片 / PDF / Word / txt / md');return}
      if(room<=0){toast('文档库最多 '+DOC_MAX_N+' 个，请先删除部分文档');return}
      var f=files[i],kind=docKind(f);
      if(!kind){skipped.push(f.name);return next(i+1)}
      var limit=kind==='image'?IMG_MAX:TXT_MAX;
      if(f.size>limit){toast('「'+f.name+'」超过 '+fmtSize(limit)+' 限制');return next(i+1)}
      var rec={id:docUid(),name:f.name.slice(0,80),kind:kind,mime:f.type||'',size:f.size,at:new Date().toISOString(),
        blob:f,text:'',truncated:false,parse:'loading',parseMsg:'',thumb:'',summary:'',sum:'loading'};
      var thumbP=kind==='image'?makeThumb(f):Promise.resolve('');
      return thumbP.then(function(thumb){rec.thumb=thumb||'';
        return parseFile(kind,f).then(function(r){
          rec.parse='ok';rec.text=r.text||'';rec.truncated=!!r.truncated;
          if(kind==='pdf'&&r.fail){rec.parse='fail';rec.parseMsg=r.fail;rec.sum='fail'}
        }).catch(function(e){rec.parse='fail';rec.parseMsg=(e&&e.message)||'解析失败';rec.sum='fail'})
      }).then(function(){return docPutDB(rec)}).then(function(){room--;ok++})
       .then(function(){
         if(rec.parse==='fail')return Promise.resolve();
         return(kind==='image'&&rec.thumb)?blob2data(f).then(function(u){return docSummary(rec,u)}):docSummary(rec)
       })
       .catch(function(){})
       .then(function(){return next(i+1)})
    }
    toast('正在解析并存入本机文库…');return next(0)
  })
}
/* ---------- 文件选择 ---------- */
function pickFiles(accept,cb){var inp=document.createElement('input');
  inp.type='file';inp.accept=accept;inp.multiple=true;inp.style.display='none';
  document.body.appendChild(inp);
  inp.onchange=function(){var fs=inp.files;
    setTimeout(function(){if(inp.parentNode)inp.parentNode.removeChild(inp)},120000);cb(fs)};
  inp.click()}
/* ---------- 文档库弹层（picker=true 时为「选文档附到本条消息」模式） ---------- */
var docsPicker=false;
function docsMeta(rec){
  var date=rec.at.slice(0,10).replace(/-/g,'/');
  if(rec.parse==='loading')return'<span class="dl-tag">解析中…</span>';
  if(rec.parse==='fail')return'<span class="dl-tag bad">'+askEsc(rec.parseMsg||'解析失败')+'</span>';
  var tag=rec.sum==='ok'?('<span class="dl-sum">'+askEsc(rec.summary)+'</span>')
    :rec.sum==='loading'?'<span class="dl-tag">正在生成摘要…</span>'
    :'<span class="dl-tag bad">摘要生成失败</span>';
  return'<span class="dl-meta">'+docKindName(rec.kind)+' · '+fmtSize(rec.size)+' · '+date+'</span>'+tag}
function docRowHTML(rec){
  var picked=state.ask.draft.some(function(a){return a.id===rec.id});
  var acts='';
  if(docsPicker&&rec.parse==='ok')
    acts='<button class="dl-pick'+(picked?' on':'')+'" data-a="doc-pick" data-id="'+rec.id+'">'+(picked?'已附上':'附上')+'</button>';
  if(!docsPicker){
    if(rec.parse==='fail')acts+='<button class="dl-act" data-a="doc-reparse" data-id="'+rec.id+'" aria-label="重新解析">'+ic('retry2')+'</button>';
    else if(rec.sum==='fail')acts+='<button class="dl-act" data-a="doc-retry" data-id="'+rec.id+'" aria-label="重试摘要">'+ic('retry2')+'</button>';
    acts+='<button class="dl-act danger" data-a="doc-del" data-id="'+rec.id+'" data-arm="0" aria-label="删除">'+ic('trash')+'</button>';
  }
  return '<div class="dl-row" data-id="'+rec.id+'"><span class="dl-ic">'+docIcon(rec.kind)+'</span>'
   +'<div class="dl-main"><b>'+askEsc(rec.name)+'</b>'+docsMeta(rec)+'</div>'
   +'<div class="dl-acts">'+acts+'</div></div>'
}
function docsListHTML(){
  if(!docCache.length)return'<div class="dl-empty">'+ic('folder')
   +'<p>还没有文档。上传体检报告、舌象照片或养生文章，<br>顾问就能结合你的资料回答。</p></div>';
  return docCache.map(docRowHTML).join('')}
function docsHTML(picker){docsPicker=!!picker;
  return '<div class="xs-note">'+ic('info')
   +'<span>文档原文只保存在这台设备（IndexedDB）；当你把它附到某条提问时，内容才会发送给你配置的模型服务。</span></div>'
   +'<div class="cfgp-btns"><button class="btn" data-a="doc-up">'+ic('plus')+' 上传文档 / 图片</button>'
   +(picker?'<button class="btn btn-gho" data-a="sheet-close">完成</button>':'')+'</div>'
   +'<div class="xs-sub" style="margin-top:1.4rem">'+(picker?'选择要附到本条消息的资料（可多个）':'本机文库 · 最多 '+DOC_MAX_N+' 个')+'</div>'
   +'<div class="dl-list" id="dl-list">'+docsListHTML()+'</div>'}
/* ---------- 待发附件胶囊 ---------- */
function attCapsHTML(){return state.ask.draft.map(function(a,i){
  if(a.kind==='image')
    return'<span class="att-cap img"><img src="'+(a.thumb||a.url||'')+'" alt=""><b>'+askEsc(a.name)+'</b>'
     +'<button data-a="att-del" data-i="'+i+'" aria-label="移除">'+ic('x')+'</button></span>';
  return'<span class="att-cap">'+docIcon(a.kind==='image'?'image':'pdf')+'<b>'+askEsc(a.name)+'</b>'
   +'<button data-a="att-del" data-i="'+i+'" aria-label="移除">'+ic('x')+'</button></span>';
}).join('')}
function refreshAttCaps(){var box=root&&root.querySelector('#ask-att');if(box)box.innerHTML=attCapsHTML()}
/* ---------- 附件动作弹层（输入框 ＋） ---------- */
function attachHTML(){
  return '<button class="att-opt" data-a="att-img">'+ic('image')+'<span><b>发图片</b><em>舌象 / 报告单 / 食材拍照，随本条发送</em></span></button>'
   +'<button class="att-opt" data-a="att-lib">'+ic('folder')+'<span><b>从我的文档选择</b><em>附上库存的体检报告、文章全文</em></span></button>'
   +'<button class="att-opt" data-a="att-docup">'+ic('plus')+'<span><b>上传到我的文档</b><em>先存本机文库，随时可引用</em></span></button>'
   +'<div class="xs-note" style="margin-top:1.2rem">图片单张 ≤'+fmtSize(IMG_MAX)+'，文档单个 ≤'+fmtSize(TXT_MAX)+'；内容仅在你主动发送时提交给模型服务。</div>'}
/* ---------- 今日面板（桌面左栏常驻；手机端从头部抽屉打开，同一套内容） ---------- */
function seasonCardHTML(){var C=todayContext();
  return'<div class="tp-card tp-sea"><div class="tp-k">'+ic('sun')+'<span>今日时令</span></div>'
   +'<b class="tp-term">'+C.T.name+' · '+C.season+'季</b>'
   +'<p>'+askEsc(C.desc||'')+'</p></div>'}
function practiceCardHTML(){var st=recordStats(),S=lastSession(),jn=loadJournal().length,rows=[];
  if(st.n>0)rows.push(['连续打卡',streak()+' 天']);
  if(st.n>0)rows.push(['累计练习',Math.round(st.sec/60)+' 分钟 / '+st.days+' 天']);
  if(S)rows.push(['最近跟练',(doneAvg(S)!=null?doneAvg(S)+' 分完成度':S.moves+' 式')]);
  if(jn)rows.push(['每日一记',jn+' 条']);
  if(rows.length)
    return'<div class="tp-card"><div class="tp-k">'+ic('chart')+'<span>我的练习</span></div>'
     +'<div class="tp-stats">'+rows.map(function(r){return'<div><b>'+r[1]+'</b><em>'+r[0]+'</em></div>'}).join('')+'</div></div>';
  return'<div class="tp-card tp-guide"><div class="tp-k">'+ic('lotus')+'<span>开始认识你</span></div>'
   +'<button class="tp-g" data-a="tp-quiz">'+ic('qmark')+'做 1 分钟调养问卷</button>'
   +'<button class="tp-g" data-a="tp-practice">'+ic('medit')+'开始第一次练习</button>'
   +'<button class="tp-g" data-a="tp-journal">'+ic('moon')+'记一笔今天的睡眠</button></div>'}
function quickCardHTML(){
  return'<div class="tp-card"><div class="tp-k">'+ic('list')+'<span>快捷</span></div>'
   +'<div class="tp-quick">'
   +'<button data-a="tp-journal">'+ic('edit')+'记一笔</button>'
   +'<button data-a="tp-archive">'+ic('doc')+'养生档案</button>'
   +'<button data-a="tp-cfg">'+ic('gear')+'API 设置</button>'
   +'</div></div>'}
function docsCardHTML(){
  var recent=docCache.slice(0,3);
  return'<div class="tp-card"><div class="tp-k">'+ic('folder')+'<span>我的文档</span>'
   +'<button class="tp-more" data-a="tp-docs">管理 ›</button></div>'
   +'<div class="tp-docs">'+(recent.length?recent.map(function(r){
     return'<button class="tp-doc" data-a="tp-docs"><span class="tp-doc-ic">'+docIcon(r.kind)+'</span>'
      +'<span class="tp-doc-t"><b>'+askEsc(r.name)+'</b><em>'+(r.sum==='ok'?askEsc(r.summary):(r.parse==='fail'?'解析失败':docKindName(r.kind)+' · '+fmtSize(r.size)))+'</em></span></button>'
   }).join(''):'<button class="tp-doc empty" data-a="tp-docup">'+ic('plus')+'<span class="tp-doc-t"><b>上传体检报告 / 舌象照片</b><em>让顾问更懂你</em></span></button>')
   +'</div></div>'}
function todayPanelHTML(){return'<div class="tp-wrap">'
  +seasonCardHTML()+practiceCardHTML()+quickCardHTML()+docsCardHTML()+'</div>'}
/* 文档库变化后，同步桌面左栏与所有打开弹层里的文档区块 */
function refreshDocBits(){
  var side=root&&root.querySelector('.ask-side .tp-wrap');
  if(side)side.innerHTML=seasonCardHTML()+practiceCardHTML()+quickCardHTML()+docsCardHTML();
  var list=document.querySelector('#dl-list');if(list)list.innerHTML=docsListHTML()}
/* ---------- 图片全屏查看 ---------- */
function imgLightbox(src){if(!src)return;
  var v=document.createElement('div');v.className='imgview';v.innerHTML='<img src="'+src+'" alt="附件大图">';
  v.addEventListener('click',function(){v.remove()});document.body.appendChild(v)}

function settingsHTML(){return askCfgRowHTML()+audioPrefsHTML()
  +'<div class="xs-note">音源与署名：七弦散音 · RafaelCaro · CC BY 4.0；《梅花三弄》· RafaelCaro · CC BY 4.0；《醉渔唱晚》· 卫仲乐 1934 · archive.org CC0。</div>'
  +'<div class="xs-note">动作识别（摄像头 + 八段锦判定 + 陪练教练）在真实跟练页运行；主壳「动作示范」可直接进入。</div>'}
function basicHTML(){return '<div class="xs-item"><b>账号与数据</b><p>本机演示版没有线上账号：练习记录、身体数据、音频偏好与头像都保存在这台设备的浏览器里，换设备不会同步。</p></div>'
  +'<div class="xs-item"><b>每日提醒</b><p>提醒依赖浏览器通知权限，本机演示版未开启；当前仅「练习打卡」会在本机留下记录。</p></div>'
  +'<button class="btn btn-gho" data-a="go-body" style="margin:1rem 0 1.4rem">编辑身体数据（身高 / 体重 / 目标 / 饮食偏好）</button>'
  +'<div class="xs-sub">个性化偏好</div>'+audioPrefsHTML()}
function helpHTML(){
  var A=[['怎么开始一次练习？','首页点「开始练」→ 选「全套 8 式」或「招牌 3 式」→ 点「开始动作预览」，进入真实跟练页（会请求摄像头）。'],
   ['为什么看不到摄像头？','需要浏览器授权；未授权时自动切到预录画面兜底。建议后退 1.5–2 米，全身入镜、正面受光。'],
   ['音乐点了不出声？','浏览器会拦截「无操作自动播放」，再点一次播放图标即可；音量在「设置 › 曲目音量」。'],
   ['七弦是怎么响的？','进入某一式会拨响对应琴弦（式 1–7 → 弦 1–7；收势「背后七颠」七弦齐鸣）。跟练页右侧那排弦也能直接点着试音。'],
   ['打卡数据存在哪？','全部存在本机的浏览器存储里，不上传服务器；清理浏览器数据会一并清除。'],
   ['意见反馈','主壳为演示预览；反馈请汇总给项目对接人。']];
  return A.map(function(x){return '<div class="xs-item"><b>'+x[0]+'</b><p>'+x[1]+'</p></div>'}).join('')}
function noticesHTML(){var st=recordStats(),A=[];
  A.push(st.n?['打卡已记录','最近一次 '+st.last.d+' · '+(+st.last.poses||0)+' 式 · '+fmtDur(+st.last.sec||0)+'；已连续 '+streak()+' 天。']
            :['欢迎来到弦养','还没有打卡记录。完成一次练习并在结束页点「完成打卡」，这里就会出现你的记录。']);
  A.push(['曲库已接入','新增三首可播放真录音：《梅花三弄》6:28、《醉渔唱晚》3:04、《七弦散音》0:07（七弦散音试音）。其余曲目暂无干净音源，未在界面列出。']);
  A.push(['七弦已接通','跟练页每式起势自动拨弦；右侧那排七弦可以直接点着试音。']);
  A.push(['素材授权','七弦散音 / 《梅花三弄》：RafaelCaro · CC BY 4.0；《醉渔唱晚》：卫仲乐 1934 · archive.org CC0。']);
  A.push(['关于动作识别','摄像头识别与陪练教练在真实跟练页运行，主壳是界面预览。']);
  return A.map(function(x){return '<div class="xs-item"><b>'+x[0]+'</b><p>'+x[1]+'</p></div>'}).join('')}
function aboutHTML(){return '<div class="xs-item"><b>弦养 · Xianyang v1.0.0</b><p>以身为琴，以动为弦。主壳是最终版 9 张设计稿的 1:1 复刻；真实识别与陪练教练在跟练子应用里。</p></div>'
  +'<div class="xs-item"><b>已接入的真实能力</b><p>古琴曲目播放（3 首真录音）、七弦散音试音与「动作→琴弦」触发、练习打卡与本地记录、头像更换、分享图导出。</p></div>'
  +'<div class="xs-item"><b>仍未接入（界面已如实标注）</b><p>五禽戏素材、设备体征（心率 / 睡眠）、线上账号与云同步。</p></div>'
  +'<div class="xs-note">素材署名：七弦散音 · RafaelCaro · CC BY 4.0；《梅花三弄》· RafaelCaro · CC BY 4.0；《醉渔唱晚》· 卫仲乐 1934 · archive.org CC0。</div>'}
function analysisHTML(){var poses=practicePoses();var S=lastSession(),avg=doneAvg(S);
  var head=avg!=null
    ? '<div class="xs-note">本次跟练真实记录 · 平均完成度 '+avg+'% · 用时 '+fmtDur(S.seconds||0)+' · 完成 '+S.moves+' / '+(S.total||8)+' 式。下表为逐式完成度（识别结果），仅作参考，不替代医嘱。</div>'
    : '<div class="xs-note">最近一次跟练'+(S?('记录了 '+S.moves+' / '+(S.total||8)+' 式、用时 '+fmtDur(S.seconds||0)+'，但未做动作识别，所以没有评分'):'还没有记录')+'。下面是本套动作的式序与要领；真实判定请在跟练页进行。</div>';
  var rows=poses.map(function(n,i){var p=PRACTICE_INFO[i]||{};
    var sc=stringScore(S,i);
    return '<div class="xs-item"><b>第 '+(i+1)+' 式 · '+n+'</b><p>对应'+(p.string?('第 '+p.string+' 弦'):'七弦齐鸣')+'。要领：'+((p.points||[])[0]||'')
      +(sc!=null?('　完成度 '+Math.round(sc*100)+'%'):'　完成度 —')+'</p></div>'}).join('');
  return head+rows
   +'<button class="btn" data-a="goto-s4" style="margin-top:1.4rem">去真实跟练页（摄像头 + 教练）</button>'}
function recipeHTML(){var C=todayContext();
  return '<div class="xs-item"><b>百合莲子羹</b><p>材料：干百合 15g、去芯莲子 20g、粳米 40g、冰糖少许。</p></div>'
  +'<div class="xs-item"><b>做法</b><p>莲子温水泡 1 小时；与粳米同煮 30 分钟；下百合同煮 10 分钟；起锅前加冰糖调味。</p></div>'
  +'<div class="xs-item"><b>为什么今天推荐</b><p>'+C.T.name+'时节 · '+SEASON_RECIPE_WHY[C.season]+'（食养建议，不替代医嘱）</p></div>'
  +'<div class="xs-item"><b>换着吃</b><p>山药小米粥（健脾）、银耳雪梨汤（润肺）——同样顺时而食。</p></div>'}
function stageHTML(){var st=recordStats(),on=st.n?Math.min(8,st.days+2):DESIGN.stageDone;
  return '<div class="xs-note">八段锦 · 中级阶段共 8 节。进度按练习天数推进，当前 '+on+' / 8。</div>'
   +PRACTICE_INFO.map(function(p,i){return '<div class="xs-item"><b>第 '+(i+1)+' 节 · '+p.name+'</b><p>对应'+(p.string?('第 '+p.string+' 弦'):'七弦齐鸣')+'。'+(i<on?'已开启。':'尚未开启。')+'</p></div>'}).join('')}
function recordsHTML(){var st=recordStats();
  if(!st.n)return '<div class="xs-note">还没有打卡记录。完成一次练习、在结束页点「完成打卡」，记录会出现在这里（存在本机浏览器）。</div>';
  var rows=state.records.slice(-40).reverse().map(function(r){
    return '<div class="xs-item"><b>'+r.d+'</b><p>'+(+r.poses||0)+' 式 · '+fmtDur(+r.sec||0)+(r.at?(' · '+String(r.at).slice(11,16)):'')+'</p></div>'}).join('');
  return '<div class="xs-note">共 '+st.n+' 次打卡 · 累计 '+fmtDur(st.sec)+' · 连续 '+streak()+' 天。数据只存在本机浏览器。</div>'+rows
   +'<button class="btn btn-gho" data-a="clear-records" style="margin-top:1.4rem">清空本机打卡记录</button>'}
function fmtDur(s){s=Math.max(0,Math.round(s||0));return s<60?(s+' 秒'):(Math.floor(s/60)+' 分 '+(s%60)+' 秒')}
/* 分享图：canvas 现场绘制，内容只用真实信息（日期 / 式数 / 式名与弦号 / 署名），不画虚拟评分 */
function shareCard(){
  var W=750,H=1120,c=document.createElement('canvas');c.width=W;c.height=H;var g=c.getContext('2d');
  var grd=g.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#FDF9EF');grd.addColorStop(1,'#F7EEDD');g.fillStyle=grd;g.fillRect(0,0,W,H);
  g.strokeStyle='#E3D3B7';g.lineWidth=3;g.strokeRect(28,28,W-56,H-56);
  g.textAlign='center';g.fillStyle='#4A2C1A';g.font='700 76px "Songti SC","STSong",serif';g.fillText('弦养',W/2,158);
  g.fillStyle='#97836D';g.font='26px "PingFang SC","Microsoft YaHei",sans-serif';g.fillText('以身为琴 · 以动为弦',W/2,206);
  g.strokeStyle='#DCC9A6';g.lineWidth=2;g.beginPath();g.moveTo(150,248);g.lineTo(W-150,248);g.stroke();
  g.fillStyle='#6B4226';g.font='700 40px "Songti SC","STSong",serif';g.fillText(today(),W/2,332);
  var poses=practicePoses();
  g.fillStyle='#97836D';g.font='24px "PingFang SC","Microsoft YaHei",sans-serif';g.fillText('今日练习 · '+poses.length+' 式',W/2,378);
  var y=470;
  poses.forEach(function(n,i){var p=PRACTICE_INFO[i]||{};
    g.textAlign='left';g.fillStyle='#B0552E';g.font='600 26px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText('第 '+(i+1)+' 式',64,y);
    g.fillStyle='#4A2C1A';g.font='600 34px "Songti SC","STSong",serif';g.fillText(n,164,y+2);
    g.textAlign='right';g.fillStyle='#6E8F7C';g.font='24px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText(p.string?('第 '+p.string+' 弦'):'七弦齐鸣',W-64,y);
    g.strokeStyle='#EEE1CA';g.lineWidth=1;g.beginPath();g.moveTo(64,y+26);g.lineTo(W-64,y+26);g.stroke();
    y+=84});
  g.textAlign='center';g.fillStyle='#97836D';g.font='22px "PingFang SC","Microsoft YaHei",sans-serif';
  g.fillText('音源：七弦散音 · RafaelCaro · CC BY 4.0',W/2,H-104);
  g.fillText('《梅花三弄》· RafaelCaro · CC BY 4.0   《醉渔唱晚》· 卫仲乐 1934 · CC0',W/2,H-68);
  return c.toDataURL('image/png')}
function shareHTML(){var u=shareCard();
  return '<div class="xs-note">这张图可以直接长按保存（手机）；桌面端点下面「下载图片」。</div>'
   +'<img class="xs-shot" src="'+u+'" alt="练习分享图">'
   +'<a class="btn" href="'+u+'" download="弦养-练习分享-'+today()+'.png" style="display:flex;margin-top:1.4rem">下载图片</a>'}
/* 头像：本地选图 → canvas 压到 160px → 存本机，避免把原图塞进 localStorage */
function pickAvatar(){var inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];if(!f)return;var rd=new FileReader();
    rd.addEventListener('load',function(){var im=new Image();
      im.addEventListener('load',function(){var S=160,cv=document.createElement('canvas');cv.width=S;cv.height=S;
        var g=cv.getContext('2d'),r=Math.max(S/im.width,S/im.height),w=im.width*r,h=im.height*r;
        g.drawImage(im,(S-w)/2,-(h-S)*0.2,w,h);
        var u=cv.toDataURL('image/jpeg',.82);
        if(saveAvatar(u)){paint();toast('头像已更新（保存在本机）')}else toast('头像保存失败，换一张更小的图试试')});
      im.src=rd.result});
    rd.readAsDataURL(f)});
  inp.click()}
/* 呼吸引导 4 秒吸 / 6 秒呼 / 4 秒放松，循环到再次点击为止 */
var BREATH={on:false,phase:0,left:0,timer:null};
var BSTEP_LB={1:'慢吸 4 秒',2:'慢呼 6 秒',3:'放松'};
function drawBreath(row){row.querySelectorAll('.bstep').forEach(function(s){var p=+s.getAttribute('data-b');
  s.classList.toggle('on',p===BREATH.phase);var b=s.querySelector('b');
  if(b)b.textContent=(p===BREATH.phase)?((p===1?'慢吸 ':p===2?'慢呼 ':'放松 · ')+BREATH.left+' 秒'):BSTEP_LB[p]})}
function startBreath(){var row=root.querySelector('.breath-row[data-a="breath"]');if(!row)return;
  BREATH.on=true;BREATH.phase=1;BREATH.left=4;drawBreath(row);
  BREATH.timer=setInterval(function(){if(!row.isConnected){stopBreath(true);return}
    BREATH.left--;
    if(BREATH.left<=0){BREATH.phase=BREATH.phase===1?2:(BREATH.phase===2?3:1);BREATH.left=BREATH.phase===2?6:4}
    drawBreath(row)},1000)}
function stopBreath(silent){if(BREATH.timer)clearInterval(BREATH.timer);BREATH.timer=null;
  var was=BREATH.on;BREATH.on=false;BREATH.phase=0;BREATH.left=0;
  if(was&&!silent&&state.screen==='audio')paint()}
/* 「保持 N 秒」真实倒计时 */
var HOLD={on:false,t:3,timer:null};
function startHold(){var pill=root.querySelector('.pill[data-a="hold"]');if(!pill)return;
  HOLD.on=true;HOLD.t=3;pill.classList.add('on');var b=pill.querySelector('b');
  function tick(){if(!pill.isConnected){stopHold(true);return}
    if(HOLD.t<=0){clearInterval(HOLD.timer);HOLD.timer=null;pill.classList.remove('on');if(b)b.textContent='完成';
      pluckForStep(state.progress);toast('保持完成 · 可以进入下一式');
      setTimeout(function(){HOLD.on=false;if(state.screen==='practice')paint()},2200);return}
    if(b)b.textContent=HOLD.t;HOLD.t--}
  tick();HOLD.timer=setInterval(tick,1000)}
function stopHold(silent){if(HOLD.timer)clearInterval(HOLD.timer);HOLD.timer=null;
  var was=HOLD.on;HOLD.on=false;HOLD.t=3;
  if(was&&!silent&&state.screen==='practice')paint()}

/* s4 真跟练页地址（与 PrepareView.begin() 规则一致） */
function s4url(){return 's4/#/train?stage='+((['point','line','arc'])[state.istage]||'point')
  +'&mode='+(state.imode===1?'short':'full')+'&style=baduanjin&tone=gong'}

document.addEventListener('click',function(e){
  var el=e.target.closest('[data-a]');if(!el)return
  var a=el.getAttribute('data-a')
  switch(a){
    case 'load-enter':state.qIndex=0;state.qSel=null;state.answers=[];go('question');break
    case 'back':go(state.screen==='body'?'profile':'home');break
    case 'qsel':state.qSel=+el.getAttribute('data-i');state.answers[state.qIndex]=state.qSel;paint();break
    case 'q-prev':if(state.qIndex>0){state.qIndex--;state.qSel=typeof state.answers[state.qIndex]==='number'?state.answers[state.qIndex]:null;paint()}else go('home');break
    case 'q-next':{if(typeof state.qSel!=='number'){toast('请选择一项后再继续');return}
      state.answers[state.qIndex]=state.qSel
      if(state.qIndex<QUIZ.length-1){state.qIndex++;state.qSel=typeof state.answers[state.qIndex]==='number'?state.answers[state.qIndex]:null;paint();break}
      /* 第 7 题答完才结算：答案真的参与推荐（音疗方向 / 今日调式 / 练哪一套 / 从哪个阶段起），并存本机 */
      var qz=recommendFromAnswers(state.answers);state.quiz=qz;saveQuiz(qz);applyQuiz(qz);go('home')
      toast('已按你的回答定制 · '+['全套 8 式','招牌 3 式'][qz.imode]+' · 从「'+['点','线','面'][qz.istage]+'」起 · 音疗方向「'+['心','肝','脾','肺','肾'][qz.organ]+'」')
      break}
    case 'q-skip':state.answers=[];go('home');break
    /* ---- 导航 ---- */
    case 'nav-audio':go('audio');break
    case 'nav-home':go('home');break
    case 'nav-intro':go('intro');break
    case 'nav-inquiry':go('inquiry');break
    case 'nav-profile':go('profile');break
    case 'go-intro':go('intro');break
    /* ---- 首页 ---- */
    case 'swap-rec':state.rec=(state.rec+1)%3;paint();toast('已换一份推荐：'+['宫调 · 平和承载','徵调 · 轻快舒扬','羽调 · 沉静滋养'][state.rec]);break
    case 'mode':{var mi=el.dataset.i;
      if(mi==='1'){openSheet('五禽戏','<div class="xs-item"><b>素材未随包交付</b><p>五禽戏（虎鹿熊猿鸟）目前没有动作示范素材与判定标定，所以没有开放练习入口——界面上如实标注，不做假按钮。</p></div><button class="btn" data-a="goto-s4" style="margin-top:1.4rem">去练八段锦（真实跟练页）</button>');break}
      if(mi==='2'){
        /* 「帮我选」真读问诊结果：state.quiz 由 loadQuiz() 在启动时载入（见 init()），
           applyQuiz 会把 organ/rec/imode/istage 落到界面状态上。
           没做过问诊时不随机、不假装算过 —— 如实说按最稳妥的默认给。 */
        if(state.quiz&&typeof state.quiz.rec==='number'){
          applyQuiz(state.quiz);state.mode=0;paint();
          toast('已按你的问诊回答推荐：八段锦 · '+['宫调 · 平和承载','徵调 · 轻快舒扬','羽调 · 沉静滋养'][state.rec]+' · 从「'+['点','线','面'][state.istage]+'」起');
        }else{
          state.mode=0;paint();
          toast('还没做问诊 · 先按最稳妥的「八段锦 · 宫调」；做完首页那几道题会更贴合你');
        }
        break}
      state.mode=0;paint();break}
    /* ---- 练习准备 ---- */
    case 'imode':state.imode=+el.getAttribute('data-i');paint();break
    case 'istage':state.istage=+el.getAttribute('data-i');paint();break
    case 'help':openSheet('练习帮助',helpHTML());break
    case 'goto-s4':closeSheet();toast('进入真实跟练页 · 摄像头 + 陪练教练');location.href=s4url();break
    /* ---- 音疗页：真实播放 ---- */
    case 'organ':state.organ=+el.getAttribute('data-i');paint();break
    case 'random-track':{var ri=Math.floor(Math.random()*TRACKS.length);state.track=ri;playKey(TRACKS[ri].key);
      toast('随便听听 · 《'+TRACKS[ri].title+'》'+TRACKS[ri].tone);break}
    case 'track-prev':case 'track-next':{var dir=(a==='track-next')?1:-1;
      var nx=(audioIdx()+dir+TRACKS.length)%TRACKS.length;state.track=nx;
      if(musicPlaying())playKey(TRACKS[nx].key);else paint();
      toast('已切到《'+TRACKS[nx].title+'》'+TRACKS[nx].tone);break}
    case 'track-list':{var ltr=root.querySelector('.track');if(ltr&&ltr.scrollIntoView)ltr.scrollIntoView({block:'center',behavior:'smooth'});
      toast('共 '+TRACKS.length+' 首可播曲目：'+TRACKS.map(function(t){return t.title}).join(' / '));break}
    case 'play':{var pi=+el.getAttribute('data-i');var pt=TRACKS[pi];if(!pt)break;state.track=pi;toggleKey(pt.key);
      toast(musicPlaying()?('正在播放《'+pt.title+'》'+pt.tone):('已暂停《'+pt.title+'》'));break}
    case 'play-full':{toggleKey('meihua');toast(musicPlaying()?('完整回放 · 《'+TRACKS[0].title+'》6:28'):'已暂停回放');break}
    case 'loop':{AUDIO.loop=!AUDIO.loop;saveAudioPref();
      root.querySelectorAll('[role="switch"][data-a="loop"]').forEach(function(b){b.classList.toggle('on',AUDIO.loop);b.setAttribute('aria-checked',String(AUDIO.loop))});
      var sn=root.querySelector('.sec-note[data-a="loop"]');
      if(sn){sn.innerHTML=ic('refresh','width:1.4rem;height:1.4rem')+(AUDIO.loop?'循环中':'循环播放');sn.style.color=AUDIO.loop?'var(--terra)':''}
      if(AUDIO.mus)AUDIO.mus.loop=AUDIO.loop;
      syncAudioUI();toast(AUDIO.loop?'已开启循环播放':'已关闭循环播放');break}
    case 'sound':{AUDIO.sound=!AUDIO.sound;saveAudioPref();
      root.querySelectorAll('[role="switch"][data-a="sound"]').forEach(function(b){b.classList.toggle('on',AUDIO.sound);b.setAttribute('aria-checked',String(AUDIO.sound))});
      toast(AUDIO.sound?'七弦音效已开启':'七弦音效已关闭');break}
    case 'vol':break
    case 'try-strings':pluckChord(320,true);toast('七弦试音 · 正调 C–D–F–G–A–c–d');break
    case 'music-toggle':if(musicPlaying()){pauseMusic();toast('练习音乐已暂停')}else{playKey('zuiyu',{gain:.5,loop:true});toast('练习音乐 · 醉渔唱晚（循环，音量在设置里调）')}break
    /* ---- 跟练页 ---- */
    case 'demo':state.progress=0;state.running=true;state.sessionStart=Date.now();go('practice');pluckForStep(0);
      toast('示例演示：设计稿静态复刻页，未启动摄像头；真练请点「开始动作预览」');break
    case 'start-practice':{
      // 接入 xianyang-s4 的真实视觉识别（MediaPipe 姿态 + 八段锦判定 + 古琴拨弦）。
      // s4 现在只对外保留 /train 一个页面，其余路径都会被 s4 弹回主壳，
      // 因此无论选了哪个练习阶段，都只进 /train；阶段/模式作为参数带上
      //（TrainView 当前只读 style/tone，其余参数保留以便后续扩展）。
      state.progress=0;state.running=true;state.sessionStart=Date.now();pluckForStep(0);
      toast('正在进入动作预览…');
      location.href=s4url();
      break}
    case 'side':{var si=+el.getAttribute('data-i');var info=PRACTICE_INFO[state.progress]||PRACTICE_INFO[0];
      if(si===0){state.side=0;paint();break}
      if(si===1){toast('动作示范 · 进入真实跟练页（摄像头 + 陪练教练）');location.href=s4url();break}
      if(si===2){openSheet('第'+(state.progress+1)+'式 · '+info.name+' 动作要点','<div class="xs-note">'+info.preview+'</div>'
        +info.points.map(function(p){return '<div class="xs-li">'+p+'</div>'}).join(''));break}
      openSheet('第'+(state.progress+1)+'式 · 常见问题',info.faq.map(function(f){return '<div class="xs-item"><b>'+f[0]+'</b><p>'+f[1]+'</p></div>'}).join(''));break}
    case 'pluck':pluckString(+el.getAttribute('data-i'));el.classList.add('plucked');
      setTimeout(function(){if(el.isConnected)el.classList.remove('plucked')},320);break
    case 'hold':if(HOLD.on)stopHold();else startHold();break
    case 'breath':if(BREATH.on)stopBreath();else startBreath();break
    case 'skip-intro':go('home');break
    case 'exit-practice':state.running=false;stopMusic();go('home');break
    case 'toggle-run':state.running=!state.running;paint();if(state.running)pluckForStep(state.progress);break
    case 'prev-step':if(state.progress>0){state.progress--;paint();pluckForStep(state.progress)}else toast('已经是第一式');break
    case 'next-step':if(state.progress<practicePoses().length-1){state.progress++;paint();pluckForStep(state.progress)}else{state.running=false;stopMusic();go('done')}break
    /* ---- 结束页 ---- */
    case 'finish':{var fs=state.sessionStart?(Date.now()-state.sessionStart)/1000:0;
      /* 预览页的停留时长也是真实花掉的时间，照实累加（与 s4 侧 shellBridge 写的记录按自然日相加）。
         state.sessionStart 未设置（例如从 URL 直接进结束页）时不补任何时长。 */
      var rr=checkin(practicePoses().length,fs);stopMusic();go('home');
      toast(rr.first?('打卡成功 · 第 1 次打卡 · 连续 '+rr.streak+' 天 · 今日 '+fmtDur(rr.rec.sec))
        :('打卡成功 · 累计 '+rr.n+' 次 · 连续 '+rr.streak+' 天 · 今日 '+fmtDur(rr.rec.sec)+(rr.ok?'':'（本机存储不可用）')));
      /* 打卡后顺手记一笔睡眠与精力（可跳过）——给弦养顾问攒「认识你」的数据 */
      setTimeout(function(){openSheet('每日一记',journalHTML(true))},420);
      break}
    case 'again':state.progress=0;state.running=true;state.sessionStart=Date.now();go('practice');pluckForStep(0);break
    case 'analysis':openSheet('练习详细分析',analysisHTML());break
    case 'recipe':openSheet('今日食养推荐',recipeHTML());break
    case 'share-sheet':openSheet('分享琴谱',shareHTML());break
    /* ---- 我的页 ---- */
    case 'notices':openSheet('通知',noticesHTML());break
    case 'settings':openSheet('设置',settingsHTML());break
    /* ---- 智能体 API 设置 ---- */
    case 'set-ask':openSheet('智能体 API 设置',askCfgHTML());break
    case 'ask-priv-on':{var f0=askCfgForm();if(f0)saveAskCfg(f0);
      /* 不能用 askPriv() 的返回值：它在关闭态会把细分项虚拟成 false，直接存会冲掉用户的勾选 */
      var raw0=lsGet('xy-ask-priv')||{};
      var pp0={on:!(raw0.on===true),
        practice:raw0.practice!==false,body:raw0.body!==false,journal:raw0.journal!==false};
      savePriv(pp0);openSheet('智能体 API 设置',askCfgHTML());break}
    case 'ask-priv-item':{var k=el.dataset.k;if(!k||['practice','body','journal'].indexOf(k)<0)break;
      var fp=askPriv();if(!fp.on)break;
      var f1=askCfgForm();if(f1)saveAskCfg(f1);
      fp[k]=!fp[k];savePriv(fp);openSheet('智能体 API 设置',askCfgHTML());break}
    case 'set-archive':openSheet('我的养生档案',archiveHTML());break
    case 'ar-copy':archiveCopy();break
    case 'ar-download':archiveDownload();break
    case 'ar-ai':archiveAIRun();break
    case 'ask-cfg-save':{var fc=askCfgForm();if(fc){saveAskCfg(fc);askCfgRes('<b style="color:var(--green-deep)">已保存 ✓</b> 去「问询」页即可真实对话。');toast('智能体 API 配置已保存');}break}
    case 'ask-cfg-test':{var tc=askCfgForm();if(tc)askCfgTest(tc,false);break}
    case 'ask-cfg-clear':{try{localStorage.removeItem('xy-ask-cfg')}catch(_){}
      openSheet('智能体 API 设置',askCfgHTML());toast('已清除本机保存的密钥');break}
    case 'set-basic':openSheet('基础设置',basicHTML());break
    case 'set-help':openSheet('帮助与反馈',helpHTML());break
    case 'set-about':openSheet('版本信息',aboutHTML());break
    case 'records':openSheet('历史数据',recordsHTML());break
    case 'stage':openSheet('阶段进度 · 八段锦中级',stageHTML());break
    case 'avatar':pickAvatar();break
    case 'clear-records':if(el.dataset.arm==='1'){state.records=[];saveRecords();openSheet('历史数据',recordsHTML());toast('本机打卡记录已清空');}
      else{el.dataset.arm='1';el.textContent='再点一次确认清空';toast('再点一次即可清空本机打卡记录');}break
    case 'sheet-close':closeSheet();break
    case 'unavailable':toast((el.dataset.label||el.getAttribute('aria-label')||el.textContent.trim()||'此功能')+'：这条暂未接入，已接入的功能清单见「我的 › 版本信息」');break
    /* ---- 我的：调养实验室入口 ---- */
    case 'go-lab':toast('正在进入调养实验室…');location.href='s4/#/preview';break
    /* ---- 问询（弦养顾问）---- */
    case 'ask-send':askSend();break
    case 'ask-chip':askSend(el.getAttribute('data-q')||'');break
    case 'ask-retry':askSend(el.getAttribute('data-q')||'');break
    case 'ask-new':askNewConfirm(true);break
    case 'ask-new-cancel':askNewConfirm(false);break
    case 'ask-new-ok':askNewConfirm(false);askNew();break
    case 'ask-brief-regen':briefRun();break
    case 'ask-today':openSheet('今日',todayPanelHTML(),'xs-drawer');break
    case 'ask-journal':openSheet('每日一记',journalHTML(false));break
    /* ---- 附件与文档库 ---- */
    case 'img-view':imgLightbox(el.getAttribute('data-src')||'');break
    case 'ask-attach':openSheet('添加图片或文档',attachHTML());break
    case 'att-img':closeSheet();pickFiles('image/*',function(fs){
      var files=Array.prototype.slice.call(fs||[]),i=0;
      (function step(){if(i>=files.length){syncAskUI();return}
        var f=files[i++];
        if(f.size>IMG_MAX){toast('「'+f.name+'」超过 '+fmtSize(IMG_MAX)+' 限制');step();return}
        Promise.all([readAs(f,'dataUrl'),makeThumb(f)]).then(function(r){
          state.ask.draft.push({kind:'image',name:f.name.slice(0,80),url:r[0],thumb:r[1]||r[0]});
          syncAskUI();step()}).catch(function(){toast('「'+f.name+'」读取失败，请重试');step()})})()});break
    case 'att-lib':closeSheet();openSheet('从我的文档选择',docsHTML(true));break
    case 'att-docup':pickFiles('image/*,.pdf,.doc,.docx,.txt,.md',function(fs){docsIngest(fs)});break
    case 'doc-up':pickFiles('image/*,.pdf,.doc,.docx,.txt,.md',function(fs){docsIngest(fs)});break
    case 'doc-pick':{var rid=el.dataset.id,rec0=rid&&docById(rid);if(rec0){
        var dix=state.ask.draft.findIndex(function(a){return a.id===rid});
        if(dix>=0)state.ask.draft.splice(dix,1);
        else state.ask.draft.push({kind:rec0.kind==='image'?'image':'doc',id:rid,name:rec0.name,thumb:rec0.thumb||''});
        openSheet('从我的文档选择',docsHTML(true));syncAskUI()}break}
    case 'att-del':state.ask.draft.splice(+el.dataset.i,1);syncAskUI();break
    case 'doc-del':{var row=el.closest('.dl-row'),dr=row&&docById(row.dataset.id);if(dr)
        row.innerHTML='<div class="dl-confirm"><span>删除《'+askEsc(dr.name)+'》？</span>'
         +'<button class="dl-del-ok" data-a="doc-del-ok" data-id="'+dr.id+'">删除</button>'
         +'<button class="btn btn-gho btn-sm" data-a="doc-del-cancel">取消</button></div>';break}
    case 'doc-del-ok':docDelDB(el.dataset.id).then(function(){toast('文档已从本机删除');return docsRefresh()});break
    case 'doc-del-cancel':docsRefresh();break
    case 'doc-retry':{var rr=el.dataset.id&&docById(el.dataset.id);if(rr){
        rr.sum='loading';docPutDB(rr).then(docsRefresh).then(function(){
          if(rr.kind==='image')return docGetDB(rr.id).then(function(f){return blob2data(f.blob)}).then(function(u){return docSummary(rr,u)});
          return docSummary(rr)}).then(docsRefresh)}break}
    case 'doc-reparse':{var rp=el.dataset.id&&docById(el.dataset.id);if(rp&&rp.blob){
        rp.parse='loading';docPutDB(rp).then(docsRefresh).then(function(){return parseFile(rp.kind,rp.blob)})
         .then(function(x){rp.parse=x.fail?'fail':'ok';rp.parseMsg=x.fail||'';rp.text=x.text||'';rp.truncated=!!x.truncated;
           rp.sum=x.fail?'fail':'loading';return docPutDB(rp)})
         .then(function(){return docsRefresh()}).then(function(){if(rp.parse==='ok')return docSummary(rp)})
         .then(docsRefresh).catch(function(){toast('重新解析失败')})}break}
    /* ---- 今日面板快捷动作（桌面左栏 / 手机抽屉共用） ---- */
    case 'tp-journal':openSheet('每日一记',journalHTML(false));break
    case 'tp-archive':openSheet('我的养生档案',archiveHTML());break
    case 'tp-cfg':openSheet('智能体 API 设置',askCfgHTML());break
    case 'tp-quiz':closeSheet();go('question');break
    case 'tp-practice':closeSheet();go('intro');break
    case 'tp-docs':openSheet('我的文档',docsHTML(false));break
    case 'tp-docup':pickFiles('image/*,.pdf,.doc,.docx,.txt,.md',function(fs){docsIngest(fs)});break
    case 'set-docs':openSheet('我的文档',docsHTML(false));break
    case 'jr-sleep':state.jrDraft.sleep=parseFloat(el.getAttribute('data-v'));jrSelect(el);break
    case 'jr-energy':state.jrDraft.energy=parseInt(el.getAttribute('data-v'),10);jrSelect(el);break
    case 'journal-save':{var ta=SH&&SH.querySelector('#jr-mood');
      var je={d:today(),at:new Date().toISOString(),
        sleep:(state.jrDraft.sleep==null?null:state.jrDraft.sleep),
        energy:state.jrDraft.energy||null,mood:ta?(ta.value||'').trim():''};
      if(je.sleep==null&&!je.energy&&!je.mood){toast('睡眠、精力或感受，至少记一点再保存');break}
      upsertJournal(je);closeSheet();refreshDocBits();toast('今日一记已保存');break}
    /* ---- 身体数据 ---- */
    case 'go-body':closeSheet();go('body');break
    case 'stp':var k=el.getAttribute('data-k'),d=+el.getAttribute('data-d');if(!Object.prototype.hasOwnProperty.call(BODY_LIMITS,k)||(d!==1&&d!==-1))return;
      var value=bodyValue(k,state.body[k]+d);if(value===state.body[k])toast('已达到允许范围 '+BODY_LIMITS[k].join('–'));state.body[k]=value;saveBodyState();paint();break
    case 'chip':var nm=el.getAttribute('data-name'),v=el.getAttribute('data-v');if(!Object.prototype.hasOwnProperty.call(BODY_OPTIONS,nm)||BODY_OPTIONS[nm].indexOf(v)<0)return;
      var arr=state[nm].slice(),ix=arr.indexOf(v);
      if(v===BODY_NONE[nm])arr=[v];else{arr=arr.filter(function(item){return item!==BODY_NONE[nm]});if(ix>=0)arr=arr.filter(function(item){return item!==v});else arr.push(v)}
      state[nm]=bodyChoices(nm,arr);saveBodyState();paint();break
    case 'tog':state.recipe=!state.recipe;saveBodyState();paint();break
    case 'save-body':var saved=saveBodyState();go('profile');toast(saved?'身体设置已保存到本机':'本机存储不可用，设置仅在本次访问保留');break
  }
})
document.addEventListener('input',function(e){var el=e.target;if(!el||!el.dataset||el.dataset.a!=='vol')return;
  AUDIO.vol=Math.max(0,Math.min(1,(+el.value||0)/100));saveAudioPref();if(AUDIO.mus)AUDIO.mus.volume=AUDIO.vol})
/* 问询页：空内容禁用发送；手机键盘弹起时把推荐问题收起来，让空间给消息区 */
document.addEventListener('input',function(e){if(e.target&&e.target.id==='ask-input')syncAskUI()});
document.addEventListener('focusin',function(e){if(e.target&&e.target.id==='ask-input'){
  var card=root&&root.querySelector('.ask-card');if(card)card.classList.add('focused')}});
document.addEventListener('focusout',function(e){if(e.target&&e.target.id==='ask-input'){
  setTimeout(function(){var card=root&&root.querySelector('.ask-card');if(card)card.classList.remove('focused')},120)}});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&sheetOpen()){closeSheet();return}
  /* 问询页：回车即发送 */
  if(e.key==='Enter'&&e.target&&e.target.id==='ask-input'){e.preventDefault();askSend();return}
  var el=e.target.closest('[role="button"][data-a]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.click()}})

/* URL 直达（预览用） */
function init(){
  root=document.getElementById('app')
  root.classList.add('phone');loadBodyState();loadAudioPref();loadRecords();loadProfile();
  loadQuiz();applyQuiz(state.quiz);   // 上次问诊的答案要能记住，并继续驱动推荐
  seedAskCfg();                       // 本机 local-config.js 的密钥自动预填（仅一次，不覆盖已有配置）
  docsRefresh();                      // 预热本机文库（IndexedDB 异步加载，完成后自动刷新面板）
  var q=new URLSearchParams(location.search)
  if(q.get('first')==='1'){try{localStorage.removeItem('xy-state')}catch(_){}}
  var sv=q.get('screen');if(sv&&PAGES[sv]){state.screen=sv}
  var mut=q.get('muted');if(mut==='1')AUDIO.vol=0;
  window.__xy={state:state,AUDIO:AUDIO,TRACKS:TRACKS,design:DESIGN,sheets:{settings:settingsHTML,notices:noticesHTML,help:helpHTML,about:aboutHTML}};
  paint();
  if(state.screen==='inquiry')askEnter()
}
init()
})()
