#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 xianyang-prototype.html 精确抽取「首页 · 灰蓝立体房间」UI，生成自包含单页。"""
import io, os, re

SRC = "/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-prototype.html"
OUT = "/Users/leo/WorkBuddy/疗愈/outputs/xianyang-room.html"
OUT_COPY = "/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-room.html"

with io.open(SRC, "r", encoding="utf-8") as f:
    raw = f.read()

lines = raw.split("\n")

# 1) 房间相关 CSS：1-indexed 第 5~51 行（含 .room-photo 的 base64）
css_room = "\n".join(lines[4:51]).strip()
assert ".room-photo" in css_room and ".room-stage" in css_room and ".taiji" in css_room
# 校验 base64 完整（未被截断）
m = re.search(r"\.room-photo\{.*?\}", css_room, re.S)
assert m, "room-photo rule not found"
photo_rule = m.group(0)
assert photo_rule.rstrip().endswith("}") and "base64," in photo_rule and "data:image/jpeg" in photo_rule, "room-photo rule looks truncated"
assert len(photo_rule) > 100000, "base64 payload unexpectedly short"

# 2) 房间相关 JS：1-indexed 第 142~224 行（ROOM_POEM ... mountRoom）
js_room = "\n".join(lines[141:224]).strip()
assert js_room.startswith("// 首页立体房间"), "js block head mismatch"
assert js_room.endswith("startTaiji()}"), "js block tail mismatch"
for token in ["ROOM_POEM", "function roomBands", "function roomNotes", "function tjFigure",
              "function startTaiji", "const FLOOR_DISK", "function room3d", "function roomHTML",
              "function mountRoom"]:
    assert token in js_room, "missing token: " + token

# 3) 组装自包含页面
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

for path in (OUT, OUT_COPY):
    d = os.path.dirname(path)
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("written:", path, os.path.getsize(path), "bytes")

print("css_room chars:", len(css_room))
print("js_room chars:", len(js_room))
print("base64 rule chars:", len(photo_rule))
