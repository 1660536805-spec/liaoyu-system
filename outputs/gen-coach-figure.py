"""生成 train/src/components/CoachFigure.vue：
把 outputs/room-baduanjin/room.js 里的房间版小人（TJ_DEFS / TJ_ARM / TJ_BODY / tjFigure）
逐行搬进一个 Vue 组件，驱动放在外部（父组件按 rAF 传 u），组件只负责「按姿态画一帧」。
用法：python outputs/extract-room-figure.py && python outputs/gen-coach-figure.py
"""
import re, pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
SRC = REPO / 'outputs/room-baduanjin/room.js'
DST = REPO / 'train/src/components/CoachFigure.vue'

lines = SRC.read_text(encoding='utf-8').split('\n')


def find(pattern, start=1):
    rx = re.compile(pattern)
    for i in range(start - 1, len(lines)):
        if rx.search(lines[i]):
            return i + 1
    raise SystemExit('not found: ' + pattern)


def seg(a, b):
    return [ln.rstrip('\r') for ln in lines[a - 1:b]]


L_TJ = find(r'^const TJ=\{UA:50,FA:48\};')
L_FIG = find(r'^function tjFigure\(svg\)\{')
L_FIG_END = find(r'^ return render;') + 1   # 含结尾的 }

figure_code = seg(L_TJ, L_FIG_END)
# 缩进两格，放进组件 script
figure_code = [('  ' + ln) if ln.strip() else '' for ln in figure_code]

TPL = '''<template>
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
__FIGURE_CODE__

/* ---------------------------------------------------------------- 生命周期 */
let seq = 0

function build() {
  if (!svgEl.value) return
  const uid = 'cf' + (++seq)
  // 渐变/滤镜 id 加实例后缀，避免同页出现第二个小人时互相抢 defs
  // （抢了的话会退化：衣料变成纯黑、皮肤没有渐变、拖影发光失效）
  const fx = (html) => html
    .replace(/id="tj-/g, 'id="' + uid + '-')
    .replace(/url\\(#tj-/g, 'url(#' + uid + '-')
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
'''

out = TPL.replace('__FIGURE_CODE__', '\n'.join(figure_code))
DST.write_text(out, encoding='utf-8')
print('已写出', DST, '(figure 代码', len(figure_code), '行)')
