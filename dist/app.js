(function(){
'use strict'
var root,timer
var S={
  screen:'loading',tab:'home',first:true,goal:'舒缓压力',
  qIndex:3,qTotal:7,areas:['颈肩'],goals:['舒缓肩颈'],diet:['少盐'],dietOn:true,
  organ:'心',tone:'宫',step:0,running:false,record:0,
  body:{h:165,w:55,a:28},toast:'',sheet:null
}
var K='xianyang.final.ui.v2',A='/art/'
var POSES=['两手托天理三焦','左右开弓似射雕','调理脾胃须单举','五劳七伤往后瞧','摇头摆尾去心火','两手攀足固肾腰','攒拳怒目增气力','背后七颠百病消']
var TIPS=['抬头上托，舒展胸廓，感受三焦通畅。','开弓如拉满的弦，力从背脊生。','一手上举一手下按，升清降浊，调理脾胃。','缓缓转头，眼随动作，松开颈肩的僵滞。','摇头摆尾，呼气时将心火摇出去。','双手攀足，柔韧以舒适为度，缓缓起身。','攥拳怒目，劲由腰发，力在掌根。','七颠百病消，震动由脚跟传到头顶。']

function esc(s){return String(s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function load(){try{var d=JSON.parse(localStorage.getItem(K)||'{}');if(d&&typeof d==='object')S=Object.assign(S,d)}catch(e){}}
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
function toast(t){S.toast=t;paint();clearTimeout(timer);timer=setTimeout(function(){S.toast='';paint()},1700)}
function go(s,t){S.screen=s;if(t)S.tab=t;S.sheet=null;save();paint();window.scrollTo(0,0)}
function toggleArr(k,v){var i=S[k].indexOf(v);if(i>=0)S[k].splice(i,1);else S[k].push(v);paint()}

/* ---------- 公共组件 ---------- */
function topbar(title,back){return '<header class="top">'+(back?'<button class="icb plain" data-a="back">‹</button>':'')+'<span class="sp"></span>'+(title?'<span class="ti">'+title+'</span>':'')+'<span class="sp"></span><button class="icb" data-a="menu">⋯</button></header>'}
function tabbar(on){var t=[['home','⌂','首页'],['audio','◌','音疗'],['profile','◎','我的']]
 return '<nav class="tabbar">'+t.map(function(x){return '<button class="'+(on===x[0]?'on':'')+'" data-tab="'+x[0]+'"><span class="ti">'+x[1]+'</span><span>'+x[2]+'</span></button>'}).join('')+'</nav>'}
function btn(t,a,k){return '<button class="btn '+(k||'btn-pri')+'" data-a="'+a+'">'+t+'</button>'}
function cardH(ic,t,go2){return '<div class="card-h"><span class="ic">'+ic+'</span><h2>'+t+'</h2>'+(go2?'<span class="go">'+go2+' ›</span>':'')+'</div>'}
function orn(t){return '<div class="orn"><span class="lf">◆</span><span>'+t+'</span><span class="lf">◆</span></div>'}
function orgThumb(i){var f=['linear-gradient(150deg,#E7B9A6,#C98D74)','linear-gradient(150deg,#A8C2A2,#7C9A76)','linear-gradient(150deg,#E4CE9C,#C9A96B)','linear-gradient(150deg,#BFD3DD,#8FAEBF)','linear-gradient(150deg,#B9B4D0,#8C86A8)'];return f[i%5]}

/* ---------- 00 加载页 ---------- */
function pgLoading(){return '<main class="sc mid"><div class="ctr" style="padding:0 15.5pt"><span class="seal v">弦养<br>雅集</span><div class="t-brand" style="font-size:52pt;margin:10pt 0 0">弦养</div><div class="t-sub" style="margin:12pt 26pt 0">以身 为琴 · 以动为弦</div>'+
 '<p class="t-p" style="margin-top:26pt;line-height:2.1">古琴之音，调息养心；<br>一动一弦，唤回更好的自己。</p>'+
 '<div style="margin:30pt auto 0;width:52pt;height:52pt;border-radius:50%;border:1.5pt solid var(--line-2);display:grid;place-items:center;position:relative"><span style="font-size:20pt;color:var(--gold)">❀</span></div>'+
 '<p class="t-p sm" style="margin-top:14pt">正在准备古琴音色与动作识别…</p>'+
 '<div style="margin-top:38pt">'+btn('进入弦养','start')+'</div>'+
 '<p class="t-p sm" style="margin-top:11pt;color:var(--faint)">◆ 加载完成后即可开始 ◆</p></div>'+
 '<div style="position:absolute;left:0;right:0;bottom:0;height:31%;overflow:hidden"><img src="'+A+'guqin.png" style="position:absolute;bottom:-10%;left:50%;transform:translateX(-50%);width:128%;mix-blend-mode:multiply;opacity:.92"></div></main>'}

/* ---------- 01 首次进入问题页 ---------- */
function pgQuestion(){
 var areas=[['颈肩','低头久了，肩颈发僵','🫧'],['腰背','久坐之后，腰背酸胀','〰'],['脾胃','饮食不节，脾胃不适','🍵'],['睡眠','入睡困难，易醒多梦','☾'],['情绪','心绪不宁，压力偏大','❀'],['没有','目前都很舒服','○']]
 var i='';for(var k=1;k<7;k++)i+='<span class="l'+(k<S.qIndex?' on':'')+'"></span><span class="d'+(k<S.qIndex?' on':'')+(k===S.qIndex?' cur':'')+'">'+(k<S.qIndex?'✓':'')+'</span>'
 return '<main class="sc"><div class="top"><button class="icb plain" data-a="back">‹</button><span class="sp"></span><span class="sp"></span><span class="icb plain" style="visibility:hidden">⋯</span></div>'+
 '<div class="ctr"><span class="seal v">弦养<br>雅集</span><div class="t-brand" style="font-size:38pt;margin:8pt 0 0">弦养</div>'+
 '<div class="t-sub" style="margin:11pt 14pt 0">让传统之美，滋养当下的你</div>'+
 '<div class="stepper" style="justify-content:center;margin:16pt 20pt 14pt"><span class="n">'+S.qIndex+' / '+S.qTotal+'</span>'+i+'</div>'+
 '<h1 class="t-h1" style="font-size:19pt">你最近哪里容易不舒服？</h1>'+
 '<p class="t-p sm" style="padding:0 12pt">你的回答将帮助我们为你生成更合适的今日练习推荐，调和身心，专属定制。</p></div>'+
 '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8pt;margin-top:16pt">'+areas.map(function(a){
   return '<button class="card" data-area="'+a[0]+'" style="text-align:left;padding:11pt 10pt;border-color:'+(S.areas.indexOf(a[0])>=0?'var(--orange)':'var(--line)')+';position:relative">'+
   '<div style="width:34pt;height:34pt;border-radius:9pt;display:grid;place-items:center;font-size:15pt;background:'+orgThumb(a[0].charCodeAt(0))+'55;color:var(--brown);margin-bottom:7pt">'+a[2]+'</div>'+
   '<b style="display:block;font:600 12.5pt var(--serif);margin-bottom:3pt">'+a[0]+'</b><span class="t-p sm">'+a[1]+'</span>'+
   (S.areas.indexOf(a[0])>=0?'<span style="position:absolute;top:8pt;right:8pt;width:15pt;height:15pt;border-radius:50%;background:var(--orange);color:#fff;font-size:9pt;display:grid;place-items:center">✓</span>':'')+'</button>'}).join('')+'</div>'+
 '<div class="btn-row">'+btn('上一步','q-prev','btn-gho')+btn('下一步','q-next')+'</div>'+
 '<button class="btn-txt" data-a="q-skip">跳过 ›</button></main>'}

/* ---------- 1 音疗页 ---------- */
function pgAudio(){
 var organs=[['心','徵','喜悦安神'],['肝','角','舒展疏肝'],['脾','宫','平和健脾'],['肺','商','清润宁神'],['肾','羽','沉静滋养']]
 var tracks=[['平湖秋月','月映湖心，心境澄明','心 · 徵','安神助眠 · 平静情绪','08:24'],['高山流水','清泉如音，舒展胸怀','肝 · 角','疏肝解郁 · 放松身心','07:36'],['阳春白雪','和煦温润，健脾养中','脾 · 宫','调和脾胃 · 提升专注','06:52'],['梅花三弄','清音入脾，涤尘安神','肺 · 商','清润宁神 · 改善睡眠','07:28']]
 var cur=organs.filter(function(o){return o[0]===S.organ})[0]
 return '<main class="sc">'+topbar('音疗')+
 '<h1 class="t-h1" style="margin-top:6pt">今天想照顾哪里？</h1>'+
 '<p class="t-p">五音入五脏，以琴音调和身心，<br>让此刻的你，被温柔照顾。</p>'+
 '<div class="orn">选择调养方向</div>'+
 '<p class="t-p sm" style="margin-bottom:4pt">根据当下的身心状态，选择一个想要照顾的方向</p>'+
 '<div class="organs">'+organs.map(function(o){
  return '<button class="organ'+(S.organ===o[0]?' on':'')+'" data-organ="'+o[0]+'"><div class="z">'+o[0]+'</div><div class="y">'+o[1]+'</div><div class="l">'+o[2]+'</div></button>'}).join('')+'</div>'+
 '<div class="btn-row">'+btn('说不上来，随便听听','organ-any','btn-gho')+'</div>'+
 '<div style="margin-top:8pt">'+btn('练完了 · 听一首完整的','play')+'</div>'+
 '<div class="orn">跟着呼吸，更好地感受音乐</div>'+
 '<div class="card" style="display:grid;grid-template-columns:repeat(3,1fr);text-align:center;padding:11pt 4pt">'+
 '<div><b style="display:block;font:600 13pt var(--serif);color:var(--brown)">慢吸 4″</b><span class="t-p sm">感受气息<br>流入丹田</span></div>'+
 '<div style="border-left:1px solid var(--line);border-right:1px solid var(--line)"><b style="display:block;font:600 13pt var(--serif);color:var(--brown)">慢呼 6″</b><span class="t-p sm">慢慢释放<br>身心浊气</span></div>'+
 '<div><b style="display:block;font:600 13pt var(--serif);color:var(--brown)">放松</b><span class="t-p sm">跟随音乐<br>享受宁静</span></div></div>'+
 '<div class="card-h" style="margin:16pt 0 0"><span class="ic">♪</span><h2>为你推荐</h2><span class="go">换一批 ›</span></div>'+
 tracks.map(function(t,i){
  return '<div class="track"><div class="th" style="background:'+orgThumb(i)+'"></div><div class="tt"><b>'+t[0]+'</b><span>'+t[1]+' · '+t[2]+'</span><div class="chips" style="margin-top:5pt;gap:4pt"><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">'+t[3].split(' · ')[0]+'</span><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">'+t[3].split(' · ')[1]+'</span></div></div><span class="t-p sm" style="align-self:center">'+t[4]+'</span><button class="tp" data-a="play">▶</button></div>'}).join('')+
 '</main>'+tabbar('audio')}

/* ---------- 2-1 首页 ---------- */
function pgHome(){return '<main class="sc flush"><div class="pad">'+topbar()+'</div>'+
 '<div class="ctr" style="padding:2pt 26pt 0"><div class="brandrow"><span class="t-brand" style="font-size:34pt">弦养</span><span class="seal">弦</span></div>'+
 '<div class="t-sub" style="margin:9pt 0 0">让传统之美，滋养当下的你</div></div>'+
 '<div class="pad" style="margin:14pt 0 0;height:196pt;border-radius:12pt;overflow:hidden;position:relative">'+
 '<img src="'+A+'landscape.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">'+
 '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(252,247,236,.16),rgba(252,247,236,.72))"></div>'+
 '<div style="position:absolute;right:-6pt;bottom:-8pt;width:52%;border-radius:10pt;overflow:hidden;box-shadow:0 6pt 16pt rgba(90,72,48,.22)"><img src="'+A+'guqin.png" style="width:100%;display:block"></div></div>'+
 '<div class="pad"><div class="ctr" style="margin-top:13pt"><div class="t-sub" style="max-width:220pt;margin:0 auto 6pt">今日 · 霜降</div>'+
 '<p class="t-p sm">10月23日 农历九月初三 · 霜结为霜，万物内敛，正是调养身心的好时节。</p></div>'+
 '<div class="orn">今日推荐</div>'+
 '<div class="ctr"><button class="playbig" data-a="intro"><span class="pl"><i>▶</i>开始练</span></button>'+
 '<p class="t-p sm" style="margin-top:7pt">换一个</p></div>'+
 '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10pt;margin-top:14pt">'+
 '<div><b style="display:block;font:600 15pt var(--serif)">八段锦 · 宫调</b><span class="t-p sm" style="color:var(--orange);font-weight:600">平和承载 · 12分钟</span>'+
 '<p class="t-p sm" style="margin-top:6pt">舒展身心，适合日常练习，调和气息，安定情绪。</p>'+
 '<div class="chips" style="margin-top:7pt;gap:4pt"><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">舒缓减压</span><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">调和气息</span><span class="chip" style="padding:2pt 6pt;font-size:2.5pt"> </span></div></div>'+
 '<div style="border-left:1px solid var(--line);padding-left:10pt"><b style="display:block;font:600 12.5pt var(--serif)">为什么推荐给你</b>'+
 '<p class="t-p sm" style="margin-top:6pt">八段锦动作柔和，调息养气，帮助舒缓压力，改善睡眠，适合在霜降时节调养身心。</p></div></div>'+
 '<div class="modes"><button class="mode on"><b>八段锦</b><span>经典 · 全身调养</span></button><button class="mode" data-a="mode-animal"><b>五禽戏</b><span>灵动 · 强筋养气</span></button><button class="mode" data-a="mode-help"><b>帮我选</b><span>智能推荐练习 ›</span></button></div>'+
 '<div class="card" style="margin-top:12pt;text-align:center"><p class="t-p" style="font-family:var(--serif);color:var(--ink)">霜降水返壑，风落木归山。</p><p class="t-p sm" style="margin-top:4pt">——《月令七十二候集解》</p></div>'+
 '</div></main>'+tabbar('home')}

/* ---------- 2-2 八段锦进入页 ---------- */
function pgIntro(){var f=[['动静相生','跟随引导，舒展身心','◉'],['古琴相和','动作反馈，琴音随动','♪'],['养身养心','日常练习，积累改变','❀']]
 return '<main class="sc flush">'+topbar('八段锦练习',true).replace('class="top"','class="top pad"')+
 '<div class="ctr" style="padding:6pt 26pt 0"><div class="t-sub" style="margin-bottom:9pt">以身 为琴 · 以动为弦</div>'+
 '<h1 class="t-h1" style="font-size:20pt">八段锦 × 古琴音疗</h1><p class="t-h1" style="font-size:20pt;margin:0">做对动作，拨响一弦</p></div>'+
 '<p class="t-p" style="padding:9pt 26pt 0">将传统养生功法与古琴音律相结合，通过动作引导与实时音乐反馈，在呼吸与旋律之间，滋养身心，找回内在的平和与力量。</p>'+
 '<div class="pad" style="margin:12pt 0 0">'+f.map(function(x){
  return '<div style="display:flex;align-items:center;gap:9pt;padding:7pt 0"><span style="width:30pt;height:30pt;border-radius:50%;background:linear-gradient(150deg,#DCC7A6,#C3A87E);color:#fff;display:grid;place-items:center;font-size:13pt;flex:none">'+x[2]+'</span>'+
  '<span><b style="display:block;font:600 13pt var(--serif)">'+x[0]+'</b><span class="t-p sm">'+x[1]+'</span></span></div>'}).join('')+'</div>'+
 '<div class="pad" style="height:112pt;margin:0;position:relative;overflow:hidden;border-radius:10pt"><img src="'+A+'figure-cloud.png" style="position:absolute;bottom:-64pt;left:50%;transform:translateX(-50%);height:186pt;mix-blend-mode:multiply"></div>'+
 '<div class="pad"><div class="card" style="display:flex;align-items:center;gap:8pt"><span class="ic" style="width:19pt;height:19pt;flex:none;display:grid;place-items:center;border-radius:6pt;background:linear-gradient(150deg,#DCC7A6,#C3A87E);color:#fff;font-size:10pt">📊</span><p class="t-p sm" style="flex:1">在「我的」页面补充身体数据，解锁定制推荐。</p><span class="t-p sm">›</span></div>'+
 '<div style="margin-top:12pt">'+btn('开始体验','start-practice')+'</div>'+
 '<button class="btn-txt" data-a="safety">跳过</button></div></main>'+tabbar('practice')}

/* ---------- 2-3 跟练主页面 ---------- */
function pgPractice(){
 var g='';for(var i=0;i<7;i++)g+='<i class="'+(i<=S.step%7?'on':'')+'"></i>'
 var sl='';for(var j=0;j<7;j++)sl+='<i class="'+(j<=S.step%7?'lit':'')+'"></i>'
 var st='';for(var k=0;k<7;k++)st+='<span class="d'+(k<=S.step?' on':'')+(k===S.step?' cur':'')+'">'+(k<S.step?'✓':'')+'</span>'+(k<6?'<span class="l'+(k<S.step?' on':'')+'"></span>':'')
 return '<main class="sc">'+topbar('跟我练',true)+
 '<div class="infobar"><div>当前式名<b>'+(S.step+1)+'式 '+POSES[S.step].slice(0,5)+'</b></div><div>上半身<b>92%</b></div><div>下半身<b>88%</b></div><div>取景完整度<b>22%</b></div></div>'+
 '<div class="stagewrap"><img src="'+A+'figure-pose.png"><div class="bubble">🔊 '+TIPS[S.step]+'</div><div class="gauge7">'+g+'</div></div>'+
 '<div class="ctr" style="margin-top:9pt"><span class="t-sub" style="max-width:200pt;margin:0 auto">保持 3 秒</span></div>'+
 '<div class="practice-grid"><div class="rail"><button class="on">跟练中</button><button data-a="noop">动作示范</button><button data-a="noop">动作要点</button><button data-a="noop">常见问题</button></div>'+
 '<div class="breath"><h3>呼吸共鸣</h3><div class="strings7">'+sl+'</div>'+
 '<div style="display:flex;justify-content:space-between;margin-top:9pt"><span class="t-p sm">吸气</span><span class="t-p sm">平稳</span><span class="t-p sm">呼气</span></div>'+
 '<p class="t-p sm" style="text-align:center;margin-top:6pt">气随弦动 · 身心相应</p>'+
 '<div class="stepper" style="margin:10pt 0 0">'+st+'</div>'+
 '<div class="transport"><button data-a="p-prev">⏮</button><button class="big" data-a="p-next">'+(S.running?'⏸':'▶')+'</button><button data-a="p-step">'+(S.step===7?'完成':'下一式')+'</button></div>'+
 '</div></div>'+
 '<div style="margin-top:9pt">'+btn(S.running?'完成本式':'开始本式','p-run')+'</div>'+
 '<button class="btn-txt" data-a="exit">暂时退出，不记录本次练习</button></main>'}

/* ---------- 2-4 结束页 ---------- */
function pgDone(){
 var dots='',strings='';for(var i=1;i<=7;i++){strings+='<i style="top:'+(i*6.4+4)+'pt"></i>'}
 var pts=[[18,12],[30,30],[42,8],[55,26],[66,14],[78,34],[86,20]]
 pts.forEach(function(p,i){var c=i%3===0?'#7FA98A':i%3===1?'#D9B26A':'#5C7A68';dots+='<b style="left:'+p[0]+'%;top:'+p[1]+'pt;background:'+c+'"></b>'})
 return '<main class="sc">'+topbar('完成',true).replace('class="top"','class="top pad"')+
 '<div class="ctr" style="padding-top:2pt"><h1 class="t-h1" style="font-size:20pt">今日练习完成</h1><p class="t-p">一曲既终，心自安然。弦音有度，步履生香。</p></div>'+
 '<div class="card" style="margin-top:12pt;display:flex;align-items:center;gap:12pt"><div class="ring"><span>89</span></div>'+
 '<div style="flex:1"><b style="display:block;font:600 14pt var(--serif)">琴音渐稳，心气调和</b><p class="t-p sm" style="margin-top:4pt">节奏基本准确，音色平稳自然，继续保持，下次会更好！</p></div></div>'+
 '<div class="card"><div class="metrics"><div><b>12′</b><span>练习时长</span></div><div><b>146/162</b><span>命中数</span></div><div><b>7天</b><span>连续打卡</span></div></div></div>'+
 '<div class="card"><div class="card-h" style="margin-bottom:4pt"><span class="ic">♪</span><h2>双手托天理三焦</h2></div>'+
 '<div style="display:flex;align-items:center;gap:9pt"><p class="t-p sm" style="flex:1">第 2/8 段 · 平和舒展</p>'+
 '<button class="btn btn-gho" style="width:auto;min-height:26pt;padding:0 11pt;font-size:10.5pt" data-a="noop">▶ 完整回放</button></div></div>'+
 '<div class="card"><div class="fret">'+strings+dots+'</div><div class="legend"><span><s style="background:#7FA98A"></s>准确</span><span><s style="background:#D9B26A"></s>偏差</span><span><s style="background:#5C7A68"></s>未命中</span>'+
 '<span style="margin-left:auto">一二三四五六七</span></div></div>'+
 '<div class="card">'+cardH('🖐','练习反馈','查看详细分析')+
 '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9pt 11pt">'+
 '<div><b class="t-h3" style="font-size:11.5pt;color:var(--orange)">动作纠错</b><p class="t-p sm">右手拨弦时手腕略高，建议放松肩颈，手腕自然下沉。</p></div>'+
 '<div><b class="t-h3" style="font-size:11.5pt;color:var(--orange)">改正方法</b><p class="t-p sm">抬腕时呼气，让肩胛下沉，再顺势拨弦。</p></div>'+
 '<div><b class="t-h3" style="font-size:11.5pt;color:var(--orange)">明日目标</b><p class="t-p sm">八式完整，节奏均匀，减少停顿。</p></div>'+
 '<div><b class="t-h3" style="font-size:11.5pt;color:var(--orange)">鼓励</b><p class="t-p sm">第一次就能完成八式，已经很好了。</p></div></div></div>'+
 '<div class="card">'+cardH('🍚','今日食养推荐','顺时而食，滋养身心')+
 '<div style="display:flex;gap:9pt;align-items:center"><div style="width:44pt;height:44pt;border-radius:8pt;background:'+orgThumb(2)+'66;flex:none"></div>'+
 '<div style="flex:1"><b style="display:block;font:600 12.5pt var(--serif)">百合莲子羹</b><div class="chips" style="gap:4pt;margin-top:4pt"><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">养心安神</span><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">润燥助眠</span><span class="chip" style="padding:2pt 6pt;font-size:8.5pt">🔒 会员专享</span></div></div></div></div>'+
 '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;margin-top:12pt">'+btn('✓ 完成打卡','finish','btn-grn')+btn('↻ 再练一次','redo','btn-gho grn')+btn('分享琴谱','share','btn-gho')+'</div></main>'}

/* ---------- 3-1 我的 ---------- */
function pgProfile(){return '<main class="sc">'+topbar('')+
 '<div class="ctr" style="padding-top:2pt"><div class="t-brand" style="font-size:34pt">我的</div><div class="t-sub" style="margin:9pt 22pt 0">在弦音中，遇见更好的自己</div></div>'+
 '<div class="card" style="margin-top:14pt;display:flex;align-items:center;gap:11pt">'+
 '<div style="width:46pt;height:46pt;border-radius:50%;background:url('+A+'figure-cloud.png) 50% 22%/108px auto no-repeat;background-color:#D8C4AE;border:1.5pt solid var(--gold);flex:none"></div>'+
 '<div style="flex:1"><b style="display:block;font:600 14pt var(--serif)">清弦月 ›</b><span class="t-p sm">🏵 中级阶段 ›</span>'+
 '<div class="pbar" style="margin-top:6pt"><i style="width:60%"></i></div><span class="t-p sm">360/600</span></div></div>'+
 '<p class="t-p sm" style="margin-top:6pt;padding:0 2pt">继续练习，舒展身心，遇见更平和的自己。</p>'+
 '<div class="card" style="margin-top:12pt">'+cardH('🖐','身体数据','更新于 10月23日 14:20')+
 '<div class="metrics" style="padding:6pt 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">'+
 '<div><b style="font-size:15pt;color:var(--ink)">72</b><span>❤️ 心率 次/分</span><div><span class="chip" style="padding:1pt 5pt;font-size:8pt;background:var(--green-soft);color:var(--green);border-color:transparent">正常</span></div></div>'+
 '<div><b style="font-size:15pt;color:var(--ink)">6.5</b><span>🌙 睡眠时长 小时</span><div><span class="chip" style="padding:1pt 5pt;font-size:8pt;background:var(--green-soft);color:var(--green);border-color:transparent">良好</span></div></div>'+
 '<div><b style="font-size:15pt;color:var(--ink)">92</b><span>🪷 身心评分 分</span><div><span class="chip" style="padding:1pt 5pt;font-size:8pt;background:var(--green-soft);color:var(--green);border-color:transparent">状态平和</span></div></div></div>'+
 '<div class="btn-row"><button class="btn btn-gho" data-a="body">查看详情 ›</button></div></div>'+
 '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9pt;margin-top:12pt">'+
 '<div class="card">'+cardH('📊','历史数据','›')+'<div style="display:flex;align-items:flex-end;gap:4pt;height:38pt;margin-top:6pt">'+[14,22,18,30,26,34,28].map(function(h){return '<i style="flex:1;height:'+h+'pt;background:linear-gradient(180deg,#D9B98F,#B98F62);border-radius:2pt 2pt 0 0"></i>'}).join('')+'</div></div>'+
 '<div class="card">'+cardH('🌿','阶段进度','›')+'<p class="t-p sm">八段锦 · 中级阶段</p><div style="display:flex;gap:4pt;margin-top:9pt">'+[1,1,1,0,0,0,0,0].map(function(v){return '<i style="flex:1;height:6pt;border-radius:3pt;background:'+(v?'var(--green)':'var(--line)')+'"></i>'}).join('')+'</div><p class="t-p sm" style="margin-top:6pt">已完成 3/8 节</p></div></div>'+
 '<div class="card" style="margin-top:12pt;padding-top:4pt;padding-bottom:4pt">'+
 '<div class="row"><span class="ri">⚙</span>基础设置<span class="go">›</span></div>'+
 '<div class="row"><span class="ri">🎧</span>帮助与反馈<span class="go">›</span></div>'+
 '<div class="row"><span class="ri">ⓘ</span>版本信息<span class="t-p sm" style="margin-left:auto;color:var(--faint)">当前版本为最新版 v1.0.0 ›</span></div></div>'+
 '</main>'+tabbar('profile')}

/* ---------- 3-2 身体数据页 ---------- */
function pgBody(){
 function ns(k,label,unit){return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8pt 0"><span class="t-p sm" style="color:var(--ink);font-size:12pt">'+label+'</span>'+
  '<span class="numstep" data-ns="'+k+'"><button data-a="dec-'+k+'">−</button><b>'+S.body[k]+'</b><button data-a="inc-'+k+'">+</button><span class="t-p sm">'+unit+'</span></span></div>'}
 function grp(title,desc,key,opts){return '<div class="card">'+cardH('🖐',title,'')+'<p class="t-p sm" style="margin-bottom:9pt">'+desc+'</p><div class="chips">'+
  opts.map(function(o){return '<button class="chip'+(S[key].indexOf(o)>=0?' on':'')+'" data-grp="'+key+'" data-v="'+o+'">'+o+'</button>'}).join('')+'</div></div>'}
 return '<main class="sc">'+topbar('身体数据',true)+
 '<div style="position:absolute;right:15.5pt;top:52pt;width:96pt;opacity:.5;pointer-events:none"><img src="'+A+'figure-cloud.png" style="width:100%"></div>'+
 '<h1 class="t-h1" style="margin-top:6pt">补充身体数据，<br>解锁定制推荐</h1>'+
 '<p class="t-p">因人而异、顺时而练，<br>让古法智慧，更好地陪伴你的日常。</p>'+
 '<div class="card" style="margin-top:12pt">'+cardH('🧍','基础信息','')+'<p class="t-p sm" style="margin-bottom:6pt">填写基本身体数据，帮助我们为你生成更精准的练习方案。</p>'+
 ns('h','身高','cm')+ns('w','体重','kg')+ns('a','年龄','岁')+'</div>'+
 grp('既往运动损伤或慢性疾病','选择你有过的运动损伤或慢性不适（可多选）','areas',['颈肩','腰背','膝盖','手腕','无'])+
 grp('主要练习目标','选择你希望通过练习达成的目标（可多选）','goals',['舒缓肩颈','改善睡眠','调理脾胃','提神','无所谓'])+
 grp('饮食偏好','选择你的饮食偏好，帮助我们推荐更合适的养生建议。','diet',['素食','少盐','无特殊'])+
 '<div class="card">'+cardH('🖐','是否接收每日食谱推荐','')+
 '<div style="display:flex;align-items:flex-start;gap:10pt"><p class="t-p sm" style="flex:1">根据你的体质与目标，推荐个性化的三餐食养建议。</p>'+
 '<button class="sw'+(S.dietOn?' on':'')+'" data-a="diet-sw" aria-label="开关"></button></div></div>'+
 '<div style="margin-top:14pt">'+btn('保存并生成定制方案 ›','save-body')+'</div>'+
 '<p class="t-p sm ctr" style="margin-top:9pt;color:var(--faint)">数据仅保存在当前设备，不用于诊断</p></main>'}

/* ---------- 渲染 ---------- */
var PAGES={loading:pgLoading,question:pgQuestion,audio:pgAudio,home:pgHome,intro:pgIntro,practice:pgPractice,done:pgDone,profile:pgProfile,body:pgBody}
function sheet(){
 if(!S.sheet)return ''
 var c=S.sheet==='safety'?'<h2 class="t-h2">练习前安全提示</h2><p class="t-p">请在安全、平坦、空气流通的地方练习。动作以舒适为度，不追求幅度。若感到疼痛、眩晕或不适，请立即停止，必要时寻求专业帮助。</p><div style="margin-top:14pt">'+btn('我已了解，开始练习','start-practice')+'</div>'
  :'<h2 class="t-h2">更多设置</h2><p class="t-p">练习记录与身体数据仅保存在当前设备，不上传、不做诊断。</p><div style="margin-top:14pt">'+btn('知道了','close-sheet','btn-gho')+'</div>'
 return '<div class="sheet" data-a="close-sheet"><section class="sheet-c" onclick="event.stopPropagation()">'+c+'</section></div>'}
function paint(){if(!root)return
 root.innerHTML='<div class="phone">'+(PAGES[S.screen]||pgHome)()+sheet()+(S.toast?'<div class="toast">'+esc(S.toast)+'</div>':'')+'</div>'
 bind()}
function bind(){
 var q=function(s){return root.querySelectorAll(s)}
 q('[data-tab]').forEach(function(e){e.onclick=function(){go(e.dataset.tab,e.dataset.tab)}})
 q('[data-organ]').forEach(function(e){e.onclick=function(){S.organ=e.dataset.organ;paint()}})
 q('[data-area]').forEach(function(e){e.onclick=function(){toggleArr('areas',e.dataset.area)}})
 q('[data-grp]').forEach(function(e){e.onclick=function(){toggleArr(e.dataset.grp,e.dataset.v)}})
 q('[data-a]').forEach(function(e){e.onclick=function(ev){ev.stopPropagation();handle(e.dataset.a)}})}
function handle(a){
 if(a==='start'){go(S.first?'question':'home','home');S.first=false;save()}
 else if(a==='finish-question'||a==='q-next'){if(S.qIndex<S.qTotal){S.qIndex++;save();paint()}else go('home','home')}
 else if(a==='q-prev'){if(S.qIndex>1){S.qIndex--;paint()}}
 else if(a==='q-skip'){go('home','home')}
 else if(a==='back'){go(S.screen==='body'?'profile':S.screen==='practice'?'intro':S.screen==='intro'?'home':S.screen==='audio'?'home':'home',S.screen==='practice'?'practice':S.tab)}
 else if(a==='menu'){toast('更多设置即将开放')}
 else if(a==='home'){go('home','home')}
 else if(a==='audio'){go('audio','audio')}
 else if(a==='profile'){go('profile','profile')}
 else if(a==='body'){go('body','profile')}
 else if(a==='intro'){go('intro','practice')}
 else if(a==='start-practice'){S.sheet=null;go('practice','practice')}
 else if(a==='play'){toast('正在播放 · 清晨 '+S.tone+' 调')}
 else if(a==='organ-any'){S.organ='心';toast('为你推荐 · 宫调')}
 else if(a==='p-run'||a==='p-next'){S.running=!S.running;paint()}
 else if(a==='p-step'){if(S.step<7){S.step++;S.running=false}else{S.step=0;S.running=false;S.record++;save();go('done','profile')}paint()}
 else if(a==='p-prev'){if(S.step>0){S.step--;S.running=false;paint()}}
 else if(a==='exit'){S.step=0;S.running=false;go('home','home')}
 else if(a==='finish'){S.record++;save();toast('已完成打卡 · 连续 7 天')}
 else if(a==='redo'){S.step=0;S.running=false;go('practice','practice')}
 else if(a==='share'){toast('琴谱已生成 · 可分享给同伴')}
 else if(a==='save-body'){save();toast('身体数据已保存 · 已生成定制方案')}
 else if(a==='diet-sw'){S.dietOn=!S.dietOn;paint()}
 else if(a==='close-sheet'){S.sheet=null;paint()}
 else if(a==='safety'){S.sheet='safety';paint()}
 else if(a==='inc-h'||a==='dec-h'||a==='inc-w'||a==='dec-w'||a==='inc-a'||a==='dec-a'){var k=a.slice(4),d=a.slice(0,3)==='inc'?1:-1;S.body[k]=Math.max(1,+S.body[k]+d);paint()}
 else if(a==='mode-animal'){toast('五禽戏 · 即将开放')}
 else if(a==='mode-help'){toast('智能推荐 · 即将开放')}
 else toast('功能即将开放')}
function preview(){var q=new URLSearchParams(location.search),s=q.get('screen')
 if(s&&PAGES[s])S.screen=s
 var p=Number(q.get('step'));if(Number.isInteger(p)&&p>=0&&p<8)S.step=p
 if(q.get('first')==='1')S.first=true}
function init(){load();preview();root=document.getElementById('app')
 var l=document.createElement('link');l.rel='stylesheet';l.href='/app.css';document.head.appendChild(l);paint()}
window.XianyangFinalUI={init:init,state:S}
document.addEventListener('DOMContentLoaded',init)
})()
