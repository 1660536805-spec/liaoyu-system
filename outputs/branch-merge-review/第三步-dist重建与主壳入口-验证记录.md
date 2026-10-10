# 第三步 · dist/s4 重建生效 + 主壳「我的」新增入口 —— 验证记录

> 对应用户口径：**「重建 dist/s4 让新页面在真站生效」+「先 A（主壳『我的』加入口）」**
> 结论：**两项均已完成并通过两条独立证据验收**（DOM 逐字符 + 行为探针）。

---

## 0. 一句话总览

| 项 | 内容 | 证据 |
|---|---|---|
| ① figureIdx 崩溃修复 | `DemoAnimation.vue` 的 `dur` 误用未定义标识符 `figureIdx` → `props.figureIdx` | 重建后教练小人动画恢复、0 报错 |
| ② dist/s4 重建 | 用源码构建产物覆盖 `dist/s4/`，新页面在真站（5400）可直达 | 4 个新页面 200 停留、0 报错 |
| ③ 主壳「我的」入口 | `dist/app.js` 新增 1 条 setrow `go-lab`「调养实验室」 | 8 屏 DOM 逐字符相同；profile 仅净增 1 行 |

---

## 1. 改动清单（逐字节）

### 1.1 `train/src/components/DemoAnimation.vue`（崩溃修复）

提交 `9806197`（第一批优化）把 `dur` 计算里的 `props.figureIdx` 误写成裸标识符 `figureIdx`，
渲染时抛 `ReferenceError`，导致 **`dur` 计算失败 → 教练小人动画被冻结**（实机表现：动作停滞）。

修复（与文件内其余处一致，统一用 `props.`）：

```js
const dur = computed(() => {
  if (useRoomFigure.value && props.figureIdx != null) {
    const rm = ROOM_MOVES[props.figureIdx]
    if (rm && rm.dur > 0) return rm.dur
  }
  return anim.value?.dur || 1
})
```

> ⚠️ 该修复是「重建生效」的前置条件：旧 `dist/s4` 是修复前的构建，重建后若不修，教练动画会当场冻结。

### 1.2 `dist/s4/`（重建生效）

- 构建：`cd train && ./node_modules/.bin/vite build --base=/s4/` → `rsync -a train/dist/ dist/s4/`
- **不**加 `--emptyOutDir`（会触发本机 safe-delete 保护导致构建失败）。
- `dist/s4/index.html` 指针更新：
  - 旧：`index-nCENykFt.js` / `index-DVhIuJqy.css`
  - 新：`index-CQXPRPP_.js` / `index-B8ThD6WK.css`
- 新增（38 项）：`art/`、`prot/` 资源目录 + 懒加载分块
  `CultureLabView-*`、`ProtShellView-*`、`OnboardingV2-*`、`PreviewHubView-*`、`api-*`
- 删除陈旧哈希：`index-DVhIuJqy.css`、`index-nCENykFt.js`

### 1.3 `dist/app.js`（主壳「我的」入口 · 唯一改动）

**纯新增 2 处，0 删除、0 修改既有行**（`diff` 铁证）：

```diff
@@ 764（.setlist 卡片首行，插到最前）@@
+  +'<div class="setrow" data-a="go-lab" data-label="调养实验室"><span class="ic">'+ic('leaf')+'</span><b>调养实验室</b><span>五音 · 食养 · 香事 · 功法 · 问卷</span><span class="r">›</span></div>'

@@ 1089（委托点击处理器 switch，插在 go-body 之前）@@
+    /* ---- 我的：调养实验室入口（本次新增 · 唯一改动）---- */
+    case 'go-lab':toast('正在进入调养实验室…');location.href='s4/#/preview';break
```

- 指纹：改前 `49d8e0f8258fb0c8c4a0a38ff7318860` → 改后 `03d64ee386998e7d7d62e289ac066f54`
- 目标：`s4/#/preview`（= 新页面「预览中枢」，由它再分派到文化/融合壳/问卷三页）

---

## 2. 验收证据一 · 渲染后 DOM 逐字符对比

方法：`outputs/pm-review/dom-snap.cjs` 采改前/改后两份 `dist/app.js` 的每屏 `outerHTML`，
用本次专用验收器 `outputs/branch-merge-review/verify-my-entry.cjs` 对比。
（改前档由备份 `/tmp/bak-20261010-191326/app.js` 单条命令内换入→采集→还原，并已用 served md5 自检落地。）

```
app.css 字符数：改前 47283 / 改后 47283  ✓ 样式表未动

  ✓ loading   渲染后 DOM 逐字符相同（2781 字符）
  ✓ question  渲染后 DOM 逐字符相同（4718 字符）
  ✓ audio     渲染后 DOM 逐字符相同（12501 字符）
  ✓ home      渲染后 DOM 逐字符相同（5590 字符）
  ✓ intro     渲染后 DOM 逐字符相同（6815 字符）
  ✓ practice  渲染后 DOM 逐字符相同（8381 字符）
  ✓ done      渲染后 DOM 逐字符相同（10710 字符）
  ✓ body      渲染后 DOM 逐字符相同（11787 字符）
  ◆ profile   有意改动：+3 块 / -0 块   新入口 go-lab 存在：✓
✅ 通过：其余 8 屏逐字符相同；profile 仅净增 1 条入口（10 通过 / 0 失败）
```

> `+3 块`＝一条 setrow 被按标签切成 `<div…>` / `<b>调养实验室</b>` / `<span>五音…</span>` 三块；
> **`-0 块` 表示没有任何既有元素被删除或改写**。

---

## 3. 验收证据二 · 行为探针

方法：`outputs/branch-merge-review/probe-my-entry.cjs`（Playwright + 本机 Chrome，470×900@2x）。

```
① go-lab 元素数量：1
   文案：调养实验室 五音 · 食养 · 香事 · 功法 · 问卷 ›   data-label=调养实验室
   顺序：go-lab 第 0 条 / set-basic 第 1 条  → ✓ 在基础设置之上
② 截图：outputs/branch-merge-review/我的页-新入口-截图.png
③ 点击后 URL：http://127.0.0.1:5400/s4/#/preview  → ✓ 落到 s4/#/preview
④ s4 新页面可达性：
   /s4/#/preview           ✓ 停留   首屏: ← 返回跟练 预览中枢 仅开发预览 · 不在导航内…
   /s4/#/culture           ✓ 停留   首屏: ← 首页 文化内核实验室 Culture API v1.0.0…
   /s4/#/prot              ✓ 停留   首屏: ← 首页 设计稿版 · 真引擎驱动 姿态判定：未起…
   /s4/#/onboarding-v2     ✓ 停留   首屏: 弦养 让传统之美，滋养当下的你 1 / 7 你最近哪里容易不舒服？…
控制台报错：0 条
```

---

## 4. 未触碰项自检

- **样式**：`dist/app.css` 一字未改（字符数 47283 前后一致）。
- **弹窗/委托**：新 `case 'go-lab'` 前后均有 `break`，无 fall-through；除新 setrow 外无元素带 `data-a="go-lab"`，故不可能影响其它屏。
- **s4 默认行为**：`/s4/` 仍回落 `/?screen=home`；`/s4/#/train` 仍为跟练页（本步未触碰）。

---

## 5. 备份与回退

- 备份：`/tmp/bak-20261010-191326/{app.js, s4/}`
- 回退单文件：`cp /tmp/bak-20261010-191326/app.js dist/app.js`
- 回退提交：`git reset --soft HEAD~1`（若已提交）

---

## 6. 仍存在（不在本步范围）

- s4 新页面「预览中枢」目前是**显式地址直达**（不在任何导航内），主壳仅有一个入口指向它；是否把它做成正式导航项，待定。
- `?ia=art` 开关仍在（仅显式传参才转到 `/preview`，默认行为不变）。
