/* ============================================================================
 * demo.js —— 演示页装配（不含任何动作数据；动作来自 moves-*.js）
 * ----------------------------------------------------------------------------
 * 装配顺序：createStage（房间舞台，本体 + 倒影两个 svg）
 *          → createFigure ×2（各自绘制器，独立 defs 防 id 抢用）
 *          → createPlayer（一个播放器驱动两张图，同一姿态）
 * 界面只做三件事：换题库、走传送带（上/播/下/重放/进度/循环/速度）、
 * 单独开关某一层肢体 / 单独改某一个关节。
 *
 * 自动化钩子：window.RFK = { K, stage, fig, refl, player, setStyle, state, facts }
 * ========================================================================== */
(function () {
  'use strict'
  var K = window.RoomFigureKit
  if (!K) { console.error('roomFigureKit.js 未加载'); return }
  var $ = function (s) { return document.querySelector(s) }

  /* ------------------------------------------------ 舞台 + 两张小人 */
  var stage = K.createStage({ mount: '#stage', photo: 'room-photo.jpg' })
  var fig = K.createFigure(stage.mainSvg)
  var refl = K.createFigure(stage.reflectSvg)

  var STYLE_IDS = Object.keys(K.libraries())
  var current = STYLE_IDS[0]
  try { if (current !== 'wuqinxi' && STYLE_IDS.indexOf('wuqinxi') >= 0) current = 'wuqinxi' } catch (e) {}

  /* ------------------------------------------------ 播放器 */
  var player = K.createPlayer({
    figure: [fig, refl],
    moves: K.moves(current),
    loop: true, speed: 1, blendMs: 340, autoplay: true,
    onFrame: function (f) {
      if (f.playing) $('#k-seek').value = String(Math.round(f.u * 1000))
      readout()
    },
    onMove: function (m) { renderMeta(m) },
  })

  /* ------------------------------------------------ 顶部：拳种页签 */
  function renderTabs() {
    var box = $('#k-tabs')
    box.innerHTML = ''
    STYLE_IDS.forEach(function (id) {
      var lib = K.library(id)
      var b = document.createElement('button')
      b.className = 'k-tab'
      b.type = 'button'
      b.textContent = lib.title || id
      b.setAttribute('aria-pressed', String(id === current))
      b.dataset.style = id
      b.addEventListener('click', function () { setStyle(id) })
      box.appendChild(b)
    })
  }

  function setStyle(id) {
    if (!K.library(id)) return
    current = id
    player.setMoves(K.moves(id), { playing: true })
    Array.prototype.forEach.call(document.querySelectorAll('.k-tab'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.style === id))
    })
    clearJoints()
    renderMeta({ index: 0, move: player.move(), total: player.total })
  }

  /* ------------------------------------------------ 中段：式名 / 说明 */
  function renderMeta(m) {
    var mv = m && m.move
    $('#k-idx').textContent = m && mv ? ('第 ' + (m.index + 1) + ' / ' + m.total + ' 式') : '—'
    $('#k-name').textContent = mv ? mv.name : '—'
    $('#k-desc').textContent = mv ? (mv.desc || '') : ''
    $('#k-hint').textContent = mv && mv.hint ? mv.hint : ''
  }

  /* ------------------------------------------------ 传送带 */
  $('#k-prev').addEventListener('click', function () { clearJoints(); player.prev() })
  $('#k-next').addEventListener('click', function () { clearJoints(); player.next() })
  $('#k-play').addEventListener('click', function () { player.toggle(); syncPlayBtn() })
  $('#k-replay').addEventListener('click', function () { clearJoints(); player.replay(); syncPlayBtn() })
  $('#k-seek').addEventListener('input', function (e) { player.pause(); syncPlayBtn(); player.seek(Number(e.target.value) / 1000) })
  $('#k-loop').addEventListener('change', function (e) { player.setLoop(e.target.checked) })
  $('#k-speed').addEventListener('change', function (e) { player.setSpeed(Number(e.target.value)) })
  function syncPlayBtn() { $('#k-play').textContent = player.playing ? '暂停' : '播放' }

  /* ------------------------------------------------ 分层肢体开关 */
  function renderParts() {
    var box = $('#k-parts')
    box.innerHTML = ''
    fig.partNames.forEach(function (name) {
      var b = document.createElement('button')
      b.className = 'k-part'
      b.type = 'button'
      b.textContent = name
      b.setAttribute('aria-pressed', 'true')
      b.dataset.part = name
      b.title = '点一下单独隐藏 / 显示这一层'
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true'
        b.setAttribute('aria-pressed', String(on))
        togglePart(name, on)
      })
      box.appendChild(b)
    })
  }
  function togglePart(name, on) {
    ;[fig, refl].forEach(function (f) {
      var el = f.parts[name]
      if (el) el.style.display = on ? '' : 'none'
    })
  }

  /* ------------------------------------------------ 关节微调 */
  var JH = {
    '#j-lean': function (v) { return { lean: v / 100 } },
    '#j-fold': function (v) { return { fold: v / 100 } },
    '#j-head': function (v) { return { headOff: v } },
    '#j-wr': function (v) { return { wristR: [v, Number($('#j-wt').value)] } },
    '#j-wt': function (v) { return { wristR: [Number($('#j-wr').value), v] } },
  }
  Object.keys(JH).forEach(function (sel) {
    var el = $(sel)
    el.addEventListener('input', function () {
      player.pause(); syncPlayBtn()
      player.setOverride(JH[sel](Number(el.value)))
      labelJoints()
      readout()
    })
  })
  function labelJoints() {
    $('#j-lean-v').textContent = (Number($('#j-lean').value) / 100).toFixed(2)
    $('#j-fold-v').textContent = (Number($('#j-fold').value) / 100).toFixed(2)
    $('#j-head-v').textContent = Number($('#j-head').value).toFixed(1)
    $('#j-wr-v').textContent = $('#j-wr').value
    $('#j-wt-v').textContent = $('#j-wt').value
  }
  function clearJoints() {
    player.clearOverride()
    ;['#j-lean', '#j-fold', '#j-head'].forEach(function (s) { $(s).value = 0 })
    $('#j-wr').value = 60; $('#j-wt').value = 0
    labelJoints()
  }
  $('#k-reset').addEventListener('click', function () { clearJoints(); readout() })

  /* ------------------------------------------------ 姿态读数 */
  function readout() {
    if (!player) return            // createPlayer 就位时会同步回调一次，那时 player 还没赋值
    var st = player.currentState()
    if (!st) return
    $('#k-state').textContent =
      'root   [' + st.root.map(fx1) + ']\n' +
      'lean   ' + st.lean.toFixed(3) + '   fold ' + st.fold.toFixed(3) + '   head ' + st.headOff.toFixed(1) + '\n' +
      'wristL r=' + st.wrists[0][0].toFixed(1) + ' θ=' + st.wrists[0][1].toFixed(1) + '\n' +
      'wristR r=' + st.wrists[1][0].toFixed(1) + ' θ=' + st.wrists[1][1].toFixed(1) + '\n' +
      'footL  [' + st.feet[0].map(fx1) + ']   footR [' + st.feet[1].map(fx1) + ']'
  }
  function fx1(n) { return n.toFixed(1) }

  /* ------------------------------------------------ 自动化钩子 */
  window.RFK = {
    K: K, stage: stage, fig: fig, refl: refl, player: player,
    version: K.version,
    setStyle: setStyle,
    current: function () { return current },
    state: function () { return player.currentState() },
    facts: function () {
      var cf = fig.svg
      var rect = cf.getBoundingClientRect()
      var vis = function (el) {
        if (!el) return false
        var cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.02) return false
        // path 只看「有没有几何」：上下/左右一条线时外接矩形宽或高本来就是 0，不能当隐藏
        if (el.tagName && el.tagName.toLowerCase() === 'path') return !!el.getAttribute('d')
        var r = el.getBoundingClientRect()
        return r.width > 0.2 || r.height > 0.2
      }
      var parts = {}
      fig.partNames.forEach(function (n) { parts[n] = vis(fig.parts[n]) })
      var nonEmpty = 0
      Array.prototype.forEach.call(cf.querySelectorAll('path[data-p],path'), function (p) {
        if (p.getAttribute('d')) nonEmpty++
      })
      return {
        style: current, index: player.index, total: player.total,
        u: Number(player.u.toFixed(3)), playing: player.playing, loop: player.loop, speed: player.speed,
        moveName: player.move() ? player.move().name : null,
        figures: document.querySelectorAll('#stage .rfk-taiji > svg').length,
        reflectFigures: document.querySelectorAll('#stage .rfk-reflect .rfk-taiji > svg').length,
        svgBox: { w: Math.round(rect.width), h: Math.round(rect.height) },
        stageBox: (function () { var r = stage.root.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })(),
        scale: Number(getComputedStyle(stage.scene).getPropertyValue('--rfk-scale')) || null,
        parts: parts, drawnPaths: nonEmpty,
        errors: window.__rfkErrors || 0,
      }
    },
  }

  /* ------------------------------------------------ 启动 */
  window.__rfkErrors = 0
  window.addEventListener('error', function () { window.__rfkErrors++ })
  renderTabs(); renderParts(); labelJoints(); syncPlayBtn()
  setStyle(current)
  readout()

  /* 容器尺寸变化：舞台已自带 ResizeObserver，这里只补一次读数 */
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(function () { readout() }).observe(stage.root)
})()
