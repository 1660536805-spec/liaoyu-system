/* ============================================================================
   弦养 · 桌面版壳适配器（desktop.js）
   ----------------------------------------------------------------------------
   只做三件事，且**永不改动 <960px 时的任何 DOM**：

     ① 开壳：往 <body> 注入一个桌面侧栏 .dt-side（品牌 / 主导航 / 工具区）。
        侧栏按钮直接复用主壳已有的 [data-a] 事件委托 ——
        主壳把 click 委托在 document 上（见 app.js 末尾），所以注入的按钮
        写同样的 data-a 就能直接导航，一行业务代码都不用重复实现。

     ② 同步：监听 #app[data-screen] 的变化，点亮侧栏对应项。

     ③ 分列：主壳的每屏是「扁平的一串子节点」（paint() 直接 innerHTML 整屏替换）。
        桌面要两列排版，就必须有包装层 —— 但往 app.js 的模板里塞包装层会让
        手机端渲染后 DOM 变化（项目红线：手机端必须逐字符不变）。
        因此改为**渲染后、桌面档内**才把子节点分装进 .dt-col：
        手机档完全不动 DOM，桌面档只在 MutationObserver 回调里（微任务，
        发生在浏览器绘制之前）动一次，不会闪。

   安全兜底
     · 断点不匹配 → 立即退化为「不注入侧栏 + 不动 DOM」，页面退回手机列布局。
     · 每屏的子节点个数与 LAYOUT 表不一致（app.js 以后改过结构）→ 该屏放弃分列，
       退回单列，不报错、不错位。
     · 全程 try/catch：任何异常都退化为原生单列，绝不白屏。
   ============================================================================ */
(function () {
  'use strict'

  var BP = '(min-width: 960px)'
  var root = null
  var side = null
  var mql = window.matchMedia ? window.matchMedia(BP) : null
  var on = false

  /* ---------- 图标（与主壳 ic() 同一套描边风格，独立小副本，不依赖闭包） ---------- */
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'
  }
  var ICO = {
    home: svg('<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v10h11V10"/>'),
    music: svg('<path d="M9 18V5l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>'),
    yinyang: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9 9 9 0 0 0 0-18z" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.4" fill="#F3E9D5" stroke="none"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.6 4.4-5.5 8-5.5s6.5 1.9 8 5.5"/>'),
    qmark: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3A2.6 2.6 0 1 1 12 12.6v1.6"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>'),
    bars: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="4" y="13" width="3" height="7" rx="1"/><rect x="9" y="9" width="3" height="11" rx="1"/><rect x="14" y="5" width="3" height="15" rx="1"/></svg>',
    bell: svg('<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>'),
    leaf: svg('<path d="M5 19C5 9 11 5 20 4c-.5 9-4.5 15-13 15"/><path d="M5 19c2-5 5-8 9-10"/>')
  }

  /* ---------- 每屏的子节点分列表 ----------
     n  = 该屏 <main> 的直接子节点个数（多一个少一个就放弃分列，安全兜底）
     a  = 左列（.dt-col--a）取第几个子节点
     b  = 右列（.dt-col--b）
     未列出的下标（如 .top 通栏、nav 隐藏、绝对定位的 .done-hbg）保持原位。 */
  var LAYOUT = {
    // 左：进度 + 题干；右：六宫选项
    question: { n: 8, a: [1, 2, 3, 4, 5], b: [6] },
    // 左：播放器 + 推荐曲目；右：标题说明 + 调养方向 + 按钮 + 呼吸引导
    audio: { n: 9, a: [5, 7], b: [3, 4, 6] },
    // 左：今日节气海报；右：今日推荐 + 模式条 + 节气引文
    home: { n: 7, a: [0], b: [1, 2, 3, 4, 5] },
    // 左：海报 + 环境取景；右：练习模式 + 练习阶段
    intro: { n: 6, a: [1, 4], b: [2, 3] },
    // 左：品牌 + 评分环 + 琴谱；右：练习反馈 + 食养 + 曲目 + 操作
    done: { n: 13, a: [2, 3, 4, 5, 6, 7, 9], b: [10, 11, 12, 8] },
    // 左：标题 + 身份卡 + 身体数据；右：历史/阶段 + 设置列表
    profile: { n: 8, a: [1, 2, 3, 4], b: [5, 6] },
    // 左：海报 + 基础信息 + 损伤；右：目标 + 饮食 + 食谱开关 + 保存
    body: { n: 8, a: [1, 2, 3], b: [4, 5, 6, 7] },
    // 左：页头（品牌 + 说明）；右：对话卡 + 诚实声明（底部 nav 在桌面档被隐藏）
    inquiry: { n: 4, a: [0], b: [1, 2] }
  }

  /* ---------- ③ 分列 ---------- */
  var grouped = null   // { main, map: Map<Node, number> }

  function ungroup() {
    if (!grouped) return
    var main = grouped.main, map = grouped.map
    grouped = null
    if (!main.isConnected) return
    var wrappers = []
    var nodes = []
    Array.prototype.forEach.call(main.children, function (ch) {
      if (ch.classList && ch.classList.contains('dt-col')) {
        wrappers.push(ch)
        Array.prototype.forEach.call(ch.children, function (c) { nodes.push(c) })
      } else nodes.push(ch)
    })
    /* map 里记着**每一个**子节点的原始下标（含未分列的 .top / nav），
       所以按 map 排序 + 整串重挂，就能一次性还原原始顺序；
       若图省事用 appendChild 一股脑塞到末尾，.top / nav 会被挪到列表尾部，位置就错了。 */
    nodes.sort(function (x, y) {
      var a = map.has(x) ? map.get(x) : 1e6
      var b = map.has(y) ? map.get(y) : 1e6
      return a - b
    })
    /* 必须先摘掉包装层：否则子节点仍「在」.dt-col 里，
       只搬子节点会留下一对空的 <div class="dt-col"> 壳子，DOM 就回不到改前。 */
    wrappers.forEach(function (w) { if (w.parentNode) w.parentNode.removeChild(w) })
    nodes.forEach(function (n) { main.appendChild(n) })
  }

  function group(main, screen) {
    var cfg = LAYOUT[screen]
    if (!cfg) return
    var kids = Array.prototype.slice.call(main.children)
    if (kids.length !== cfg.n) return              // 结构变了 → 放弃分列
    if (main.querySelector(':scope > .dt-col')) return

    var map = new Map()
    kids.forEach(function (k, i) { map.set(k, i) })

    var colA = document.createElement('div'); colA.className = 'dt-col dt-col--a'
    var colB = document.createElement('div'); colB.className = 'dt-col dt-col--b'
    cfg.a.forEach(function (i) { if (kids[i]) colA.appendChild(kids[i]) })
    cfg.b.forEach(function (i) { if (kids[i]) colB.appendChild(kids[i]) })

    var all = cfg.a.concat(cfg.b)
    var firstGrouped = Math.min.apply(null, all)
    var keep = []
    for (var i = 0; i < cfg.n; i++) if (all.indexOf(i) < 0) keep.push(i)
    var prev = keep.filter(function (i) { return i < firstGrouped }).pop()
    var ref = prev === undefined ? main.firstElementChild : kids[prev].nextElementSibling
    main.insertBefore(colA, ref)
    main.insertBefore(colB, colA.nextElementSibling)
    grouped = { main: main, map: map }
  }

  /* ---------- ② 侧栏高亮同步 ---------- */
  var NAV_OF = {
    home: 'nav-home', audio: 'nav-audio',
    intro: 'nav-intro', practice: 'nav-intro', done: 'nav-intro',
    inquiry: 'nav-inquiry',
    profile: 'nav-profile', body: 'nav-profile'
  }
  function syncNav(screen) {
    if (!side) return
    var want = NAV_OF[screen] || ''
    side.querySelectorAll('.dt-nav button').forEach(function (b) {
      b.classList.toggle('on', !!want && b.getAttribute('data-a') === want)
    })
    if (document.body) document.body.setAttribute('data-dt-screen', screen || '')
  }

  /* ---------- ① 注入侧栏 ---------- */
  function buildSide() {
    if (side) return
    side = document.createElement('aside')
    side.className = 'dt-side'
    side.setAttribute('aria-label', '主导航')
    side.innerHTML =
      '<div class="dt-brand"><span class="glyph" aria-hidden="true">弦</span>' +
        '<div><b>弦养</b><i>XIANYANG</i></div></div>' +
      '<nav class="dt-nav" aria-label="主菜单">' +
        '<button type="button" data-a="nav-home">' + ICO.home + '首页</button>' +
        '<button type="button" data-a="nav-audio">' + ICO.music + '音疗</button>' +
        '<button type="button" class="dt-cta" data-a="nav-intro">' +
          '<span class="yin" aria-hidden="true">' + ICO.yinyang + '</span>开始练</button>' +
        '<button type="button" data-a="nav-inquiry">' + ICO.qmark + '问询</button>' +
        '<button type="button" data-a="nav-profile">' + ICO.user + '我的</button>' +
        '<button type="button" data-a="go-body">' + ICO.bars + '身体数据</button>' +
      '</nav>' +
      '<div class="dt-side-foot">' +
        '<button type="button" data-a="notices">' + ICO.bell + '通知</button>' +
        '<button type="button" data-a="settings">' + ICO.gear + '设置</button>' +
        '<button type="button" data-a="set-help">' + ICO.leaf + '帮助与反馈</button>' +
        '<button type="button" data-a="set-about">' + ICO.info + '版本信息</button>' +
        '<span class="ver">弦养 v1.0.0 · 桌面版</span>' +
      '</div>'
    document.body.insertBefore(side, document.body.firstChild)
  }
  function dropSide() {
    if (side && side.parentNode) side.parentNode.removeChild(side)
    side = null
  }

  /* ---------- 应用 / 撤销桌面档 ---------- */
  function apply() {
    if (!root) return
    buildSide()
    document.body.classList.add('dt-on')
    if (document.documentElement) document.documentElement.classList.add('dt')
    var main = root.querySelector('main')
    var screen = root.dataset.screen
    syncNav(screen)
    if (main) group(main, screen)
  }
  /* 完整拆卸：必须**先停观察**再拆列，否则 ungroup() 挪动节点会触发 onMutate()，
     观察器立刻把 .dt-col 又装回去（拆了等于没拆）。 */
  function revert() {
    if (mo) { mo.disconnect(); mo = null }
    on = false
    ungroup()
    dropSide()
    document.body.classList.remove('dt-on')
    /* classList.remove 会留下 class=""，body 就不再与改前逐字符相同了 —— 空就摘掉 */
    if (!document.body.className) document.body.removeAttribute('class')
    document.body.removeAttribute('data-dt-screen')
    if (document.documentElement) document.documentElement.classList.remove('dt')
  }

  /* ---------- 监听整屏重绘（paint() = root.innerHTML 整replace） ---------- */
  var mo = null
  function onMutate() {
    if (!on || !root) return
    var main = root.querySelector('main')
    syncNav(root.dataset.screen)
    if (!main) return
    if (grouped && grouped.main !== main) { grouped = null }   // 旧 main 已被替换
    if (main.querySelector(':scope > .dt-col')) return          // 已经分列过，别重复包装
    group(main, root.dataset.screen)
  }

  function start() {
    if (on) return
    try { on = true; apply() } catch (e) { try { revert() } catch (_) {} ; return }
    if (!root || !window.MutationObserver) return
    mo = new MutationObserver(onMutate)
    mo.observe(root, { childList: true, attributes: true, attributeFilter: ['data-screen'] })
  }
  function stop() {
    if (!on && !side) return
    try { revert() } catch (_) {}
  }

  function boot() {
    root = document.getElementById('app')
    if (!root) return
    window.__xyDesktop = {
      on: function () { return on }, layout: LAYOUT, apply: apply, revert: revert,
      /* 诊断用（不参与渲染）：看分列状态与观察器是否还在 */
      dbg: function () {
        return {
          on: on, mo: !!mo, side: !!side,
          grouped: !!grouped,
          groupedMainConnected: grouped ? grouped.main.isConnected : null,
          groupedMainIsCurrent: grouped ? grouped.main === root.querySelector('main') : null,
        }
      }
    }
    if (mql) {
      if (mql.matches) start()
      var h = function (e) { try { e.matches ? start() : stop() } catch (_) {} }
      if (mql.addEventListener) mql.addEventListener('change', h)
      else if (mql.addListener) mql.addListener(h)
    } else if (window.innerWidth >= 960) start()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
