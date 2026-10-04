/* 弦养 · 页面状态机（按最终版 9 张设计稿一比一复刻）
   1rem = 设计稿 10pt（见 app.css） */
(function(){
'use strict';
var root, state={
  screen:'loading', first:true,
  qIndex:0, qSel:null,
  answers:[], organ:0, track:0,
  mode:0, rec:0, imode:0, istage:0,
  progress:0, running:false,
  side:0, breath:0, hold:0,
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
  credit:'《醉渔唱晚》卫仲乐 1934 · archive.org CC0'}
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

/* ---------- 八段锦八式内容（真实动作要点 / 常见问题；式↔弦沿用 train/src/data/strings.json） ---------- */
var PRACTICE_INFO=[
 {name:'双手托天理三焦',preview:'抬头上托，舒展胸廓，感受三焦通畅。',string:1,
  points:['十指交叉于腹前，掌心向上，缓缓上托至头顶','上托时配合吸气，两臂伸直，肩沉肘坠','目视手背，足跟可微微提起，体会周身拔伸','下落时呼气，双手经体侧按至腹前'],
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
  +'<div class="tx"><b>'+TRACKS[0].title+' <i>›</i></b><span>'+practicePoses().length+' 式预览 · '+TRACKS[0].tone+'</span></div>'
  +'<button class="rep" data-a="play-full" aria-label="完整回放'+TRACKS[0].title+'">'+ic(musicPlaying()&&musKey()==='meihua'?'pause':'play')+(musicPlaying()&&musKey()==='meihua'?'暂停回放':'完整回放')+'</button></section>'
 +'<div class="fret"><span class="lab">一二三四五六七</span>'+rows
  +'<div class="legend">'+colors.map(function(c){return '<span><i style="background:'+c[0]+'"></i>'+c[1]+'</span>'}).join('')+'</div></div>'
 +'<section class="card" style="padding:1.6rem;margin-top:1.6rem">'
  +'<div class="sec-h">'+knot()+'练习反馈<button class="sec-note" data-a="analysis">查看详细分析 ›</button></div>'
  +'<div class="fb-grid">'
   +'<div class="fb"><span class="fimg"><img src="/art/figure-pose.png" alt=""></span><b>动作纠错</b><p>右手按弦时手腕略高，建议放松肩颈，手腕自然下沉。</p></div>'
   +'<div class="fb"><span class="fimg"><img src="/art/guqin.png" alt=""></span><b>改正方法</b><p>练习时保持手臂放松以肘带手，注意指尖发力，控制力度。</p></div>'
   +'<div class="fb"><span class="ic">'+ic('target')+'</span><b>明日目标</b><p>继续练习本曲第3段，提升节奏稳定性，尝试达到 90% 以上。</p></div>'
   +'<div class="fb"><span class="ic">'+ic('lotus')+'</span><b>鼓励话语</b><p>今日的坚持，让心更平静。每一次，皆是进步，继续加油！</p></div></div></section>'
 +'<section class="card" style="padding:1.6rem;margin-top:1.4rem">'
  +'<div class="sec-h">'+knot()+'今日食养推荐<button class="sec-note" data-a="recipe">顺时而食，滋养身心 ›</button></div>'
  +'<div class="food"><div class="picw"><img src="/art/q-food.jpg" alt=""></div>'
  +'<div class="tx"><b>百合莲子羹</b><div class="tags"><span class="tag grn">养心安神</span><span class="tag org">润燥助眠</span><span class="tag">适合今日</span></div>'
  +'<p>根据你今日的练习状态，推荐滋养心神的百合莲子羹，有助于舒缓情绪、宁心安神，帮助提升睡眠质量，让身心更好地恢复。</p></div></div></section>'
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
  root.querySelectorAll('.setrow').forEach(function(row){row.setAttribute('role','button');row.tabIndex=0;
    if(!row.dataset.a){row.dataset.a='unavailable';row.dataset.label=row.querySelector('b')?row.querySelector('b').textContent:'此功能'}});
  var stage=root.querySelector('.stage');if(stage){stage.classList.toggle('paused',!state.running);stage.dataset.preview='true'}
  if(focusIndex>=0){var next=root.querySelectorAll('button')[focusIndex];if(next)next.focus({preventScroll:true})}
  syncAudioUI();
}
function go(s){if(typeof stopHold==='function')stopHold(true);if(typeof stopBreath==='function')stopBreath(true);state.screen=s;paint();window.scrollTo(0,0);root.querySelector('main').focus({preventScroll:true})}

/* ==================== 浮层：设置 / 通知 / 帮助 / 详情 / 分享 ==================== */
var SH=null;
function sheetEl(){if(SH&&SH.isConnected)return SH;
  SH=document.createElement('div');SH.className='xs';
  SH.innerHTML='<div class="xs-mask" data-a="sheet-close"></div><div class="xs-panel" role="dialog" aria-modal="true" aria-label="详情">'
   +'<div class="xs-h"><b></b><button class="xs-x" data-a="sheet-close" aria-label="关闭">'+ic('back')+'</button></div>'
   +'<div class="xs-b"></div></div>';
  SH.addEventListener('click',function(e){if(e.target===SH.querySelector('.xs-mask'))closeSheet()});
  document.body.appendChild(SH);return SH}
function openSheet(title,html){var s=sheetEl();s.querySelector('.xs-h b').textContent=title;s.querySelector('.xs-b').innerHTML=html;
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
function settingsHTML(){return audioPrefsHTML()
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
  A.push(['曲库已接入','新增两首可播放真录音：《梅花三弄》6:28、《醉渔唱晚》3:04。其余曲目暂无干净音源，未在界面列出。']);
  A.push(['七弦已接通','跟练页每式起势自动拨弦；右侧那排七弦可以直接点着试音。']);
  A.push(['素材授权','七弦散音 / 《梅花三弄》：RafaelCaro · CC BY 4.0；《醉渔唱晚》：卫仲乐 1934 · archive.org CC0。']);
  A.push(['关于动作识别','摄像头识别与陪练教练在真实跟练页运行，主壳是界面预览。']);
  return A.map(function(x){return '<div class="xs-item"><b>'+x[0]+'</b><p>'+x[1]+'</p></div>'}).join('')}
function aboutHTML(){return '<div class="xs-item"><b>弦养 · Xianyang v1.0.0</b><p>以身为琴，以动为弦。主壳是最终版 9 张设计稿的 1:1 复刻；真实识别与陪练教练在跟练子应用里。</p></div>'
  +'<div class="xs-item"><b>已接入的真实能力</b><p>古琴曲目播放（2 首真人录音）、七弦散音试音与「动作→琴弦」触发、练习打卡与本地记录、头像更换、分享图导出。</p></div>'
  +'<div class="xs-item"><b>仍未接入（界面已如实标注）</b><p>五禽戏素材、设备体征（心率 / 睡眠）、线上账号与云同步。</p></div>'
  +'<div class="xs-note">素材署名：七弦散音 · RafaelCaro · CC BY 4.0；《梅花三弄》· RafaelCaro · CC BY 4.0；《醉渔唱晚》· 卫仲乐 1934 · archive.org CC0。</div>'}
function analysisHTML(){var poses=practicePoses();
  var rows=poses.map(function(n,i){var p=PRACTICE_INFO[i]||{};
    return '<div class="xs-item"><b>第 '+(i+1)+' 式 · '+n+'</b><p>对应'+(p.string?('第 '+p.string+' 弦'):'七弦齐鸣')+'。要领：'+((p.points||[])[0]||'')+'</p></div>'}).join('');
  return '<div class="xs-note">本页是主壳界面预览（静态复刻），未做动作识别与测量；下面是本次的式序与要领，真实判定请在跟练页进行。</div>'+rows
   +'<button class="btn" data-a="goto-s4" style="margin-top:1.4rem">去真实跟练页（摄像头 + 教练）</button>'}
function recipeHTML(){return '<div class="xs-item"><b>百合莲子羹</b><p>材料：干百合 15g、去芯莲子 20g、粳米 40g、冰糖少许。</p></div>'
  +'<div class="xs-item"><b>做法</b><p>莲子温水泡 1 小时；与粳米同煮 30 分钟；下百合同煮 10 分钟；起锅前加冰糖调味。</p></div>'
  +'<div class="xs-item"><b>为什么今天推荐</b><p>霜降时节燥气偏盛，百合润燥、莲子养心，练后温服，有助于安神入睡。（食养建议，不替代医嘱）</p></div>'
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
    case 'q-next':if(typeof state.qSel!=='number'){toast('请选择一项后再继续');return}state.answers[state.qIndex]=state.qSel;if(state.qIndex<6){state.qIndex++;state.qSel=typeof state.answers[state.qIndex]==='number'?state.answers[state.qIndex]:null;paint()}else go('home');break
    case 'q-skip':go('home');break
    /* ---- 导航 ---- */
    case 'nav-audio':go('audio');break
    case 'nav-home':go('home');break
    case 'nav-intro':go('intro');break
    case 'nav-profile':go('profile');break
    case 'go-intro':go('intro');break
    /* ---- 首页 ---- */
    case 'swap-rec':state.rec=(state.rec+1)%3;paint();toast('已换一份推荐：'+['宫调 · 平和承载','徵调 · 轻快舒扬','羽调 · 沉静滋养'][state.rec]);break
    case 'mode':{var mi=el.dataset.i;
      if(mi==='1'){openSheet('五禽戏','<div class="xs-item"><b>素材未随包交付</b><p>五禽戏（虎鹿熊猿鸟）目前没有动作示范素材与判定标定，所以没有开放练习入口——界面上如实标注，不做假按钮。</p></div><button class="btn" data-a="goto-s4" style="margin-top:1.4rem">去练八段锦（真实跟练页）</button>');break}
      if(mi==='2'){state.rec=Math.floor(Math.random()*3);state.mode=0;paint();toast('帮你选好了：八段锦 · '+['宫调 · 平和承载','徵调 · 轻快舒扬','羽调 · 沉静滋养'][state.rec]);break}
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
      var rr=checkin(practicePoses().length,fs);stopMusic();go('home');
      toast(rr.first?('打卡成功 · 第 1 次打卡 · 连续 '+rr.streak+' 天'):('打卡成功 · 累计 '+rr.n+' 次 · 连续 '+rr.streak+' 天'+(rr.ok?'':'（本机存储不可用）')));
      break}
    case 'again':state.progress=0;state.running=true;state.sessionStart=Date.now();go('practice');pluckForStep(0);break
    case 'analysis':openSheet('练习详细分析',analysisHTML());break
    case 'recipe':openSheet('今日食养推荐',recipeHTML());break
    case 'share-sheet':openSheet('分享琴谱',shareHTML());break
    /* ---- 我的页 ---- */
    case 'notices':openSheet('通知',noticesHTML());break
    case 'settings':openSheet('设置',settingsHTML());break
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
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&sheetOpen()){closeSheet();return}
  var el=e.target.closest('[role="button"][data-a]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.click()}})

/* URL 直达（预览用） */
function init(){
  root=document.getElementById('app')
  root.classList.add('phone');loadBodyState();loadAudioPref();loadRecords();loadProfile();
  var q=new URLSearchParams(location.search)
  if(q.get('first')==='1'){try{localStorage.removeItem('xy-state')}catch(_){}}
  var sv=q.get('screen');if(sv&&PAGES[sv]){state.screen=sv}
  var mut=q.get('muted');if(mut==='1')AUDIO.vol=0;
  window.__xy={state:state,AUDIO:AUDIO,TRACKS:TRACKS,design:DESIGN,sheets:{settings:settingsHTML,notices:noticesHTML,help:helpHTML,about:aboutHTML}};
  paint()
}
init()
})()
