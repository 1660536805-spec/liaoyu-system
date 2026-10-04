#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 Downloads 的 xianyang-room.html 还原成「从 xianyang-prototype.html 抽出的原始首页房间」。

与 extract-room.py 的区别：**只写 Downloads 那一份**，绝不动
/Users/leo/WorkBuddy/疗愈/outputs/xianyang-room.html（那里放着另一条线的工作）。
"""
import io, os, re

SRC = "/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-prototype.html"
OUT = "/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-room.html"

with io.open(SRC, "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

css_room = "\n".join(lines[4:51]).strip()
js_room = "\n".join(lines[141:224]).strip()

assert ".room-photo" in css_room and ".room-stage" in css_room and ".taiji" in css_room
assert js_room.startswith("// 首页立体房间") and js_room.endswith("startTaiji()}")
for tok in ["ROOM_POEM", "function roomBands", "function roomNotes", "function tjFigure",
            "function startTaiji", "const FLOOR_DISK", "function room3d", "function roomHTML",
            "function mountRoom"]:
    assert tok in js_room, "missing token: " + tok

head = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>弦养 · 首页立体房间</title>
<style>
:root{color-scheme:light;--bg:#F3F8F8;--ink:#143E43;--lake:#2B777B;--silver:#D5E2E3;--gold:#AD873C;--serif:'Songti SC','STSong','SimSun',serif}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 system-ui,-apple-system,'Microsoft YaHei',sans-serif}
.room-wrap{max-width:1180px;margin:0 auto;padding:clamp(16px,4vw,48px)}
"""

body_html = """</style></head>
<body>
<div class="room-wrap"><div id="app"></div></div>
<script>
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const app=$('#app');
let roomObserver=null,roomAnim=null;
"""

tail = """
app.innerHTML=`<section class="home">${roomHTML()}</section>`;
mountRoom();
</script></body></html>
"""

html = head + css_room + "\n" + body_html + js_room + tail
d = os.path.dirname(OUT)
if d and not os.path.isdir(d):
    os.makedirs(d, exist_ok=True)
with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("restored:", OUT, os.path.getsize(OUT), "bytes")
