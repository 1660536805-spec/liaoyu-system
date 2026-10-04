#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 outputs/room-baduanjin/room.js（八段锦 10 式拆动作版）组装成自包含单文件，
   写回 Downloads 的 xianyang-room.html。房间本体（实景照片 base64、三面墙、
   滚动文字、浮动音符、倒影、地盘）全部原样保留，只替换 <script> 段并追加控制台样式。"""
import os, shutil, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
JS_IN = os.path.join(HERE, 'room.js')
TARGET = '/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-room.html'
BACKUP = os.path.join(HERE, 'original-backup.html')
PREVIEW = os.path.join(HERE, 'preview.html')

EXTRA_CSS = """
/* ── 拆动作控制台（八段锦 10 式：一次一动，可上一个 / 下一个 / 重放） ── */
.room-ctl{margin-top:18px;display:grid;gap:11px}
.room-ctl .ctl-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.room-ctl .ctl-idx{font-size:13px;letter-spacing:.08em;color:#5D6E7A;font-variant-numeric:tabular-nums}
.room-ctl .ctl-name{font-family:var(--serif);font-size:clamp(21px,2.6vw,27px);color:#1E2E3B;letter-spacing:.05em}
.room-ctl .ctl-hint{margin:0;font-size:15px;color:#41535F;min-height:1.7em}
.room-ctl .ctl-btns{display:flex;gap:10px;flex-wrap:wrap}
.room-ctl button{appearance:none;border:1px solid #B9C7D1;background:#fff;color:#24323C;font-family:inherit;font-size:15px;line-height:1;padding:10px 18px;border-radius:999px;cursor:pointer;transition:background .15s,border-color .15s,color .15s,transform .08s}
.room-ctl button:hover{background:#E4EAEE}
.room-ctl button:active{transform:translateY(1px)}
.room-ctl button:focus-visible{outline:2px solid #2B777B;outline-offset:2px}
.room-ctl button.primary{background:#2B777B;border-color:#2B777B;color:#fff}
.room-ctl button.primary:hover{background:#256A6E}
.room-ctl button[aria-pressed="true"]{background:#24323C;border-color:#24323C;color:#fff}
.room-ctl .ctl-prog{height:3px;border-radius:999px;background:#DCE5E7;overflow:hidden}
.room-ctl .ctl-prog i{display:block;height:100%;width:0;background:#2B777B}

/* ── 陪练教练：示范 → 跟练 → 等完成 → 自动进下一步 ── */
.coach{margin-top:18px;display:grid;gap:11px}
.coach[hidden],.room-ctl[hidden]{display:none}
.coach .coach-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.coach .coach-step{font-size:13px;letter-spacing:.08em;color:#5D6E7A;font-variant-numeric:tabular-nums}
.coach .coach-name{font-family:var(--serif);font-size:clamp(21px,2.6vw,27px);color:#1E2E3B;letter-spacing:.05em}
.coach .coach-chip{font-size:13px;line-height:1;padding:6px 12px;border-radius:999px;border:1px solid currentColor;font-weight:600;letter-spacing:.06em;color:#5D6E7A}
.coach .coach-tip{margin:0;font-size:15px;color:#41535F;min-height:1.7em}
.coach .coach-bar{height:5px;border-radius:999px;background:#DCE5E7;overflow:hidden}
.coach .coach-bar i{display:block;height:100%;width:0;background:#2B777B}
.coach .coach-btns{display:flex;gap:10px;flex-wrap:wrap}
.coach button{appearance:none;border:1px solid #B9C7D1;background:#fff;color:#24323C;font-family:inherit;font-size:15px;line-height:1;padding:10px 18px;border-radius:999px;cursor:pointer;transition:background .15s,border-color .15s,color .15s,transform .08s}
.coach button:hover:not(:disabled){background:#E4EAEE}
.coach button:active:not(:disabled){transform:translateY(1px)}
.coach button:focus-visible{outline:2px solid #2B777B;outline-offset:2px}
.coach button:disabled{opacity:.38;cursor:default}
.coach button.primary{background:#2B777B;border-color:#2B777B;color:#fff}
.coach button.primary:hover:not(:disabled){background:#256A6E}
.coach button.ghost{margin-left:auto;border-style:dashed;color:#5D6E7A}
.coach .coach-note{margin:0;font-size:13px;line-height:1.7;color:#6C7C88}
/* 阶段配色：示范=湖蓝 跟练=暖金 宽限=赭石 完成=青瓷玉 */
.coach[data-phase="demo"] .coach-chip{color:#2B777B}
.coach[data-phase="demo"] .coach-bar i{background:#2B777B}
.coach[data-phase="follow"] .coach-chip{color:#8A6520}
.coach[data-phase="follow"] .coach-bar i{background:#D9A53C}
.coach[data-phase="grace"] .coach-chip{color:#A34A24}
.coach[data-phase="grace"] .coach-bar i{background:#C1663A}
.coach[data-phase="stepDone"] .coach-chip,.coach[data-phase="allDone"] .coach-chip{color:#4A7362}
.coach[data-phase="stepDone"] .coach-bar i,.coach[data-phase="allDone"] .coach-bar i{background:#6E8F7C}
@keyframes coach-pulse{0%,100%{box-shadow:0 0 0 0 rgba(217,165,60,0)}50%{box-shadow:0 0 0 6px rgba(217,165,60,.20)}}
.coach[data-phase="follow"] .coach-chip{animation:coach-pulse 2.2s ease-in-out infinite}
/* 按阶段只显示该阶段可用的按钮 */
.coach .coach-btns>button{display:none}
.coach [data-cact="free"]{display:inline-block}
.coach[data-phase="idle"] [data-cact="start"]{display:inline-block}
.coach[data-phase="demo"] [data-cact="skip"]{display:inline-block}
.coach[data-phase="follow"] [data-cact="done"],.coach[data-phase="follow"] [data-cact="redemo"],.coach[data-phase="follow"] [data-cact="skip"]{display:inline-block}
.coach[data-phase="grace"] [data-cact="done"],.coach[data-phase="grace"] [data-cact="extend"],.coach[data-phase="grace"] [data-cact="skip"]{display:inline-block}
.coach[data-phase="allDone"] [data-cact="restart"]{display:inline-block}
@media(max-width:760px){.coach button,.room-ctl button{padding:9px 14px;font-size:14px}.coach button.ghost{margin-left:0}}
"""


def main():
    html = open(TARGET, encoding='utf-8').read()
    js = open(JS_IN, encoding='utf-8').read()
    assert 'const B D' not in js, 'room.js 仍含占位坏行'
    assert 'app.innerHTML' in js, 'room.js 缺挂载'

    if not os.path.exists(BACKUP):
        shutil.copyfile(TARGET, BACKUP)
        print('备份原始文件 →', BACKUP)

    # 1) 注入控制台 CSS（放在 </style> 之前）
    marker = '\n</style></head>'
    assert html.count(marker) == 1, '找不到唯一的 </style>'
    html = html.replace(marker, '\n' + EXTRA_CSS + '</style></head>')

    # 2) 替换 <script> ... </script> 整段
    a = html.index('<script>')
    b = html.index('</script>', a)
    html = html[:a] + '<script>\n' + js + '\n' + html[b:]

    # 3) 标题点明「八段锦拆动作」
    html = html.replace('<title>弦养 · 首页立体房间</title>',
                        '<title>弦养 · 八段锦拆动作</title>')

    open(TARGET, 'w', encoding='utf-8').write(html)
    open(PREVIEW, 'w', encoding='utf-8').write(html)
    print('写入目标 →', TARGET, len(html.encode('utf-8')), 'bytes')
    print('预览副本 →', PREVIEW)


if __name__ == '__main__':
    main()
