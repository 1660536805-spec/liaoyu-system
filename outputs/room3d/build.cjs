/* 把 three.js + room3d.js 组装成：
     A) 独立可预览的 3D 房间页（Downloads 的 xianyang-room.html 直接覆盖）
     B) 我自己用的预览副本（outputs/room3d/preview.html）
   纯静态拼接，不做压缩，方便日后 diff / 改。 */
const fs = require('fs')
const path = require('path')

const DIR = __dirname
const DL = '/Users/leo/Downloads/工作文件/西客松/疗愈'

const three = fs.readFileSync(path.join(DIR, 'three.global.js'), 'utf8')
const scene = fs.readFileSync(path.join(DIR, 'room3d.js'), 'utf8')
const css = fs.readFileSync(path.join(DIR, 'room3d.css'), 'utf8')

const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>弦养 · 首页立体房间</title>
<style>
${css}
</style></head>
<body>
<div class="room-wrap"><div id="app"></div></div>
<script>
${three}
</script>
<script>
${scene}
</script>
<script>
'use strict';
(function () {
  var app = document.getElementById('app');
  app.innerHTML = '<section class="home">' +
    '<div class="room-stage" role="img" aria-label="立体房间：一个身穿白色练功服的小人在房间中央缓缓云手，地面映出倒影，墙上流过关于五音的短句，房间里漂着音符">' +
    '<div class="room-fallback" hidden>当前浏览器未能启用 WebGL，已降级。</div>' +
    '</div></section>' +
    '<div class="home-copy">' +
    '<div><h1>拨一弦，留一刻。</h1><p>不必演奏一首曲子。用一段短短的声音，留意此刻自己的感受。</p></div>' +
    '<div><div class="actions"><button class="primary" type="button">留给自己一分钟</button><button type="button">了解五音</button></div>' +
    '<p class="quiet">1 或 3 分钟 · 点击 / 键盘模拟 · 也可只跟随计时<br>不判断动作准确度，不预测情绪。</p></div>' +
    '</div>';
  var stage = app.querySelector('.room-stage');
  window.__room = Room3D.mount(stage, {});
  if (!window.__room) { var f = app.querySelector('.room-fallback'); if (f) f.hidden = false; }
})();
</script>
</body></html>
`

const outs = [path.join(DIR, 'preview.html'), path.join(DL, 'xianyang-room.html')]
outs.forEach(p => {
  const d = path.dirname(p)
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(p, page)
  console.log('written:', p, fs.statSync(p).size, 'bytes')
})
