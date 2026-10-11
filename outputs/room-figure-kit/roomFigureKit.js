/* ============================================================================
 * RoomFigureKit —— 「房间版小人」可复用动作演示套件
 * ----------------------------------------------------------------------------
 * 一根弦养项目的这个小人（白练功服 / 腰带发髻 / 飘带拖影 / 地面投影）原本只服务
 * 八段锦。本套件把它抽成**与招式无关的通用演示器**，用来演示五禽戏与太极等任意
 * 招式库。核心目标：
 *
 *   1) 保留小人精细外观 / 比例 / 房间场景风格 —— 绘制代码逐行沿用原版几何。
 *   2) 动作拆成**可独立控制的「关节」**（root / lean / fold / head /
 *      wristL / wristR / footL / footR）与**分层肢体**（头/颈/躯干/左右腿/脚/
 *      袖口/腰带/飘带/拖影/地面影），可单独读写。
 *   3) 招式可**切换 / 播放 / 暂停 / 循环 / 拖动进度 / 变速**，切换时带**姿态混合**
 *      保证过渡连贯。
 *   4) 输出 SVG（矢量），任一屏幕尺寸都清晰；房间场景按容器等比缩放。
 *   5) 每式带**名称 + 简要说明**（由招式库提供）。
 *
 * 坐标系（与原版一致，勿动）：v3 空间 —— 地面 y=266、骨盆静止 y=168、中轴 x=120、
 *   肩静止 y=110（左右肩 x=100/140）、臂长 32+28=60。腕位以「相对各自肩的极坐标
 *   [r, θ°]」存储（θ=0 正下方、+90 屏幕右、-90 屏幕左、±180 正上），r 夹在 [28,60]。
 *   引出的 roomPose() 再经 vx()/vy() 换算到小人所在的 600×300 viewBox 空间。
 *
 * 用法（浏览器，经典脚本，file:// 亦可）：
 *   const stage  = RoomFigureKit.createStage({ mount: '#stage', room: true })
 *   const fig    = RoomFigureKit.createFigure(stage)
 *   const player = RoomFigureKit.createPlayer({ figure: fig, moves: RoomFigureKit.moves('taiji') })
 *   player.play(); player.next(); player.goto(7); player.seek(0.5)
 * ========================================================================== */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else if (typeof define === 'function' && define.amd) define(factory)
  else global.RoomFigureKit = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var RAD = Math.PI / 180

  /* ---------------------------------------------------------------- 几何 / 姿态 */

  var VS = 1.367
  var VMX = 200 - 120 * VS
  var VGY = 434
  var vx = function (x) { return VMX + x * VS }
  var vy = function (y) { return VGY - (266 - y) * VS }

  var VB = { shoulder: 20, torso: 58, upperArm: 32, foreArm: 28 }
  var VFOLD_K = 0.62
  var VSH0L = [100, 110], VSH0R = [140, 110]
  var R_MIN = 28, R_MAX = 60

  function pol(origin, p) {
    var dx = p[0] - origin[0], dy = p[1] - origin[1]
    var r = Math.hypot(dx, dy) || 1e-6
    r = Math.min(R_MAX, Math.max(R_MIN, r))
    return [r, Math.atan2(dx, dy) / RAD]
  }
  var polar2 = function (sh, p) { return [sh[0] + Math.sin(p[1] * RAD) * p[0], sh[1] + Math.cos(p[1] * RAD) * p[0]] }

  /** 位置式构造（与原版 room.js 的 P() 完全一致）。wl/wr/fl/fr/rx,ry 都是 v3 绝对坐标。 */
  function P(wl, wr, fl, fr, rx, ry, lean, fold, ho) {
    return {
      wrists: [pol(VSH0L, wl), pol(VSH0R, wr)], feet: [fl, fr], root: [rx, ry],
      lean: lean || 0, fold: fold || 0, headOff: ho || 0,
    }
  }

  /** 对象式构造（更好写）：未给的量取「自然站姿」默认。 */
  function pose(o) {
    o = o || {}
    var L = o.L || [100, 170], R = o.R || [140, 170]
    var feet = o.feet || [[108, 266], [132, 266]]
    var root = o.root || [120, 168]
    return P(L, R, feet[0], feet[1], root[0], root[1],
      o.lean || 0, o.fold || 0, o.head || 0)
  }

  var lerp = function (a, b, k) { return a + (b - a) * k }
  var ease = function (k) { var x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x) }
  var clamp01 = function (k) { return Math.min(1, Math.max(0, k)) }
  var mixP = function (a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)] }
  var add = function (a, b, k) { k = (k === undefined) ? 1 : k; return [a[0] + b[0] * k, a[1] + b[1] * k] }

  /* 腕位是极坐标。θ 插值必须走最短弧，否则跨 ±180° 时会绕一大圈（手从头顶甩到体侧）。 */
  function lerpWrist(a, b, k) {
    var d = b[1] - a[1]
    if (d > 180) d -= 360; else if (d < -180) d += 360
    return [lerp(a[0], b[0], k), a[1] + d * k]
  }
  function lerpPose(a, b, k) {
    var Lf = function (p, q) { return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)] }
    return {
      wrists: [lerpWrist(a.wrists[0], b.wrists[0], k), lerpWrist(a.wrists[1], b.wrists[1], k)],
      feet: [Lf(a.feet[0], b.feet[0]), Lf(a.feet[1], b.feet[1])],
      root: Lf(a.root, b.root), lean: lerp(a.lean, b.lean, k),
      fold: lerp(a.fold, b.fold, k), headOff: lerp(a.headOff, b.headOff, k),
    }
  }
  function kfAt(frames, u) {
    if (u <= frames[0][0]) return frames[0][1]
    for (var i = 1; i < frames.length; i++) {
      if (u <= frames[i][0]) {
        var a = frames[i - 1], b = frames[i]
        return lerpPose(a[1], b[1], ease((u - a[0]) / Math.max(1e-6, b[0] - a[0])))
      }
    }
    return frames[frames.length - 1][1]
  }
  /** 极坐标腕 → 绝对坐标（须先算出该姿态下真实的肩点，因为 lean/fold 会移动肩） */
  function wristsAbs(st) {
    var up = [Math.sin(st.lean), -Math.cos(st.lean)], u = [Math.cos(st.lean), Math.sin(st.lean)]
    var torsoLen = VB.torso * (1 - VFOLD_K * st.fold)
    var chest = add(st.root, up, torsoLen)
    var shL = add(chest, u, -VB.shoulder), shR = add(chest, u, VB.shoulder)
    return [polar2(shL, st.wrists[0]), polar2(shR, st.wrists[1])]
  }

  /** 招式状态 → 小人可绘制的姿态（v3 → 600×300 viewBox 空间） */
  function toDrawPose(st) {
    var w = wristsAbs(st)
    return {
      px: vx(st.root[0]), py: vy(st.root[1]),
      hL: [vx(w[0][0]), vy(w[0][1])], hR: [vx(w[1][0]), vy(w[1][1])],
      feet: [[vx(st.feet[0][0]), vy(st.feet[0][1])], [vx(st.feet[1][0]), vy(st.feet[1][1])]],
      lean: st.lean, fold: st.fold, headOff: st.headOff * VS,
    }
  }

  /* ---------------------------------------------------------------- 预设姿态 */
  var NEUTRAL = P([100, 170], [140, 170], [108, 266], [132, 266], 120, 168)  // 悬垂：手离肩 60 = 臂展全开
  var BALL0 = P([102, 148], [138, 148], [108, 266], [132, 266], 120, 168)    // 抱球：多数招式的起/收同姿 ⇒ 切换不跳

  /* ---------------------------------------------------------------- 招式库注册 */
  var LIB = {}
  function defineMoves(styleId, spec) {
    var moves = (spec.moves || []).map(function (m) {
      return { id: m.id, name: m.name, desc: m.desc || m.hint || '', dur: m.dur, kf: m.kf || null, f: m.f || null }
    })
    LIB[styleId] = { id: styleId, title: spec.title || styleId, moves: moves }
    return LIB[styleId]
  }
  function moves(styleId) { return LIB[styleId] ? LIB[styleId].moves : [] }
  function library(styleId) { return LIB[styleId] || null }

  function moveState(mv, u) {
    if (!mv) return BALL0
    return mv.f ? mv.f(clamp01(u)) : kfAt(mv.kf, clamp01(u))
  }

  /* ============================================================================
   *  小人绘制（逐行沿用原版几何：两骨 IK 连续取支 + 飘带 Verlet 链 + 拖影）
   * ========================================================================== */
  var TJ = { UA: 43.7, FA: 38.3 }
  var tjLerp = lerp, tjEase = ease
  var tjAdd = add, tjP = function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1) }, tjMixPt = mixP
  var tjClamp = function (v, a, b) { return v < a ? a : v > b ? b : v }

  function tjIK(s, h, side, mem) {
    var dx = h[0] - s[0], dy = h[1] - s[1], d0 = Math.hypot(dx, dy) || 1
    var d = Math.min(Math.max(d0, Math.abs(TJ.UA - TJ.FA) + .5), TJ.UA + TJ.FA - 1e-3)
    var ux = dx / d0, uy = dy / d0
    var c = Math.acos(tjClamp((TJ.UA * TJ.UA + d * d - TJ.FA * TJ.FA) / (2 * TJ.UA * d), -1, 1)), a = Math.atan2(uy, ux)
    var e1 = [s[0] + TJ.UA * Math.cos(a + c), s[1] + TJ.UA * Math.sin(a + c)]
    var e2 = [s[0] + TJ.UA * Math.cos(a - c), s[1] + TJ.UA * Math.sin(a - c)]
    if (!mem.e) {
      mem.e = (side < 0) ? (e1[0] < e2[0] ? e1 : e2) : (e1[0] > e2[0] ? e1 : e2)
    } else {
      var p = mem.e, d1 = (e1[0] - p[0]) * (e1[0] - p[0]) + (e1[1] - p[1]) * (e1[1] - p[1]),
        d2 = (e2[0] - p[0]) * (e2[0] - p[0]) + (e2[1] - p[1]) * (e2[1] - p[1])
      mem.e = d1 <= d2 ? e1 : e2
    }
    return { e: mem.e, h: [s[0] + ux * d, s[1] + uy * d] }
  }

  function tjChain(c, anchor, len, wind) {
    c[0].p = anchor
    for (var i = 1; i < c.length; i++) {
      var q = c[i]
      if (!q.p) { q.p = [anchor[0], anchor[1] + i * len]; q.o = q.p.slice() }
      var vx2 = (q.p[0] - q.o[0]) * .9, vy2 = (q.p[1] - q.o[1]) * .9
      q.o = q.p.slice(); q.p = [q.p[0] + vx2 + wind, q.p[1] + vy2 + .45]
    }
    for (var k = 0; k < 3; k++) for (var j = 1; j < c.length; j++) {
      var a = c[j - 1].p, b = c[j].p, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, f = (d - len) / d
      if (j > 1) { a[0] += dx * f / 2; a[1] += dy * f / 2; b[0] -= dx * f / 2; b[1] -= dy * f / 2 }
      else { b[0] -= dx * f; b[1] -= dy * f }
    }
    return 'M' + c.map(function (q) { return tjP(q.p) }).join('L')
  }

  var TJ_DEFS = '<svg class="tj-defs" width="0" height="0" aria-hidden="true"><defs><radialGradient id="tj-shadow"><stop offset="0" stop-color="#05080B" stop-opacity=".75"/><stop offset="1" stop-color="#05080B" stop-opacity="0"/></radialGradient><linearGradient id="tj-robe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3F6F9"/><stop offset=".55" stop-color="#D5E0E8"/><stop offset="1" stop-color="#93A7B7"/></linearGradient><radialGradient id="tj-skin" cx=".4" cy=".35"><stop offset="0" stop-color="#EFE6DC"/><stop offset="1" stop-color="#C8B8A8"/></radialGradient><filter id="tj-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>'
  var TJ_ARM = '<path class="limb" stroke="#7D92A3" stroke-width="16"/><path class="limb" stroke="#E3EAEF" stroke-width="14"/><path fill="#E6EDF1" stroke="#7D92A3" stroke-width=".8"/><path class="limb" stroke="#7D92A3" stroke-width="16.5"/><path class="limb" stroke="#EEF2F5" stroke-width="14.5"/><path class="limb" stroke="#9FB2C1" stroke-width="2.2"/><ellipse rx="5" ry="7.5" cy="1.5" fill="url(#tj-skin)" stroke="#A8978A" stroke-width=".6"/>'
  var TJ_BODY = '<svg viewBox="-100 150 600 300" aria-hidden="true"><ellipse data-p="shadow" cy="438" rx="62" ry="7" fill="url(#tj-shadow)"/><path data-p="legL0" class="limb" stroke="#7D92A3" stroke-width="21"/><path data-p="legL" class="limb" stroke="#C9D6E0" stroke-width="19"/><path data-p="legR0" class="limb" stroke="#7D92A3" stroke-width="21"/><path data-p="legR" class="limb" stroke="#C9D6E0" stroke-width="19"/><ellipse data-p="shoeL" rx="12" ry="4.6" fill="#1C252D"/><ellipse data-p="shoeR" rx="12" ry="4.6" fill="#1C252D"/><path data-p="jacket" fill="url(#tj-robe)" stroke="#7D92A3" stroke-width="1"/><path data-p="placket" fill="none" stroke="#3E5262" stroke-opacity=".35" stroke-width="1"/><path data-p="buttons" fill="none" stroke="#4E6475" stroke-width="1.6" stroke-linecap="round"/><path data-p="sash" class="limb" stroke="#3E5262" stroke-width="7"/><g fill="none" stroke="#5D7182" stroke-linecap="round" stroke-linejoin="round"><path data-p="rb0" stroke-width="3.2"/><path data-p="rb1" stroke-width="2.6"/></g><circle data-p="knot" r="4" fill="#3E5262"/><path data-p="neck" class="limb" stroke="#D3C5B7" stroke-width="9"/><g data-p="head"><ellipse rx="14" ry="16.5" fill="url(#tj-skin)"/><path d="M-14.6 0C-16-21 16-21 14.6 0C11-9-11-9-14.6 0Z" fill="#1A232B"/><circle cy="-20" r="7.5" fill="#1A232B"/><path d="M-12-25L12-16" stroke="#AFC1CF" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="-16" r="1.8" fill="#DCE6EE"/><g data-p="face" fill="none" stroke="#3A3330" stroke-width="1" stroke-linecap="round" opacity=".7"><path d="M-8 2q3 2 6 0M2 2q3 2 6 0"/><path d="M-1.5 10q1.5 .8 3 0" opacity=".6"/></g></g><g data-p="armL"></g><g data-p="armR"></g><g data-p="trails" fill="none" stroke="#D6E4EE" stroke-linecap="round" filter="url(#tj-glow)"></g></svg>'

  var PART_NAMES = ['shadow', 'legL', 'legR', 'shoeL', 'shoeR', 'jacket', 'placket', 'buttons',
    'sash', 'rb0', 'rb1', 'knot', 'neck', 'head', 'face', 'armL', 'armR', 'trails']
  /** 关节（DOF）名 —— 可单独读写 */
  var JOINT_NAMES = ['root', 'lean', 'fold', 'head', 'wristL', 'wristR', 'footL', 'footR']

  var seq = 0
  /**
   * 建一个小人绘制器。
   * @param {SVGElement} svg 目标 <svg>（会被填入 defs + 小人本体）
   * @returns 绘制器对象
   */
  function createFigure(svg) {
    var uid = 'cf' + (++seq)
    var fx = function (h) { return h.replace(/id="tj-/g, 'id="' + uid + '-').replace(/url\(#tj-/g, 'url(#' + uid + '-') }
    var inner = function (h) { return h.slice(h.indexOf('>') + 1, h.lastIndexOf('</svg>')) }
    svg.innerHTML = fx(TJ_DEFS) + fx(inner(TJ_BODY))

    var el = {}
    svg.querySelectorAll('[data-p]').forEach(function (e) { el[e.dataset.p] = e })
    var armEls = ['armL', 'armR'].map(function (n) {
      el[n].innerHTML = TJ_ARM
      return Array.prototype.slice.call(el[n].children)
    })
    var trailEls = [0, 1].map(function () {
      return Array.from({ length: 5 }, function (_, k) {
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('stroke-width', 1 + k * .5)
        p.setAttribute('stroke-opacity', ((k + 1) / 5 * .55).toFixed(2))
        el.trails.appendChild(p)
        return p
      })
    })
    var trails = [[], []]
    var chains = [7, 5].map(function (n) { return Array.from({ length: n }, function () { return { p: null, o: null } }) })
    var mem = [{ e: null }, { e: null }]   // 左右臂各记一支：IK 取支的连续性状态
    var sx = 200, sv = 0, yaw = 0
    var lastState = NEUTRAL
    var lastDraw = null

    function render(q, step) {
      var mid = (q.feet[0][0] + q.feet[1][0]) / 2
      var lean = (q.px - mid) * .006 + q.lean
      var up = [Math.sin(lean), -Math.cos(lean)], dn = [-up[0], -up[1]], u = [Math.cos(lean), Math.sin(lean)]
      var Pp = [q.px, q.py]
      /* 前俯：正面视角下表达为躯干压缩 + 头肩下沉 */
      var torsoH = 88 * (1 - VFOLD_K * q.fold), headGap = 25 * (1 - 0.30 * q.fold)
      var N = tjAdd(Pp, up, torsoH), H = tjAdd(N, up, headGap)
      var pt = function (b, a, c) { return [b[0] + u[0] * a + dn[0] * c, b[1] + u[1] * a + dn[1] * c] }
      if (step) { sv = (sv + (q.px - sx) * .05) * .84; sx += sv } else { sv *= .9 }
      yaw = yaw + (q.headOff - yaw) * .18
      var hx = [tjClamp((sx - q.px) * 1.4, -9, 9) + yaw, 0]

      ;[-1, 1].forEach(function (s, i) {
        var hip = pt(Pp, s * 12, 0), f = q.feet[i], a = [f[0], f[1] - 4]
        var d = Math.hypot(a[0] - hip[0], a[1] - hip[1]), b = Math.sqrt(Math.max(0, 142 * 142 - d * d)) * .22
        var k = [(hip[0] + a[0]) / 2 + s * b, (hip[1] + a[1]) / 2], dd = 'M' + tjP(hip) + 'L' + tjP(k) + 'L' + tjP(a), id = i ? 'R' : 'L'
        el['leg' + id + '0'].setAttribute('d', dd); el['leg' + id].setAttribute('d', dd)
        el['shoe' + id].setAttribute('cx', f[0] + s * 3); el['shoe' + id].setAttribute('cy', f[1])
      })

      var NL = pt(N, -8, 0), NR = pt(N, 8, 0), SLo = pt(N, -29, 9), SRo = pt(N, 29, 9),
        ApL = pt(N, -25, 36), ApR = pt(N, 25, 36), WL = pt(Pp, -21, -14), WR = pt(Pp, 21, -14),
        HL = tjAdd(pt(Pp, -33, 40), hx), HR = tjAdd(pt(Pp, 33, 40), hx), HC = tjAdd(pt(Pp, 0, 50), hx), NC = pt(N, 0, 7)
      el.jacket.setAttribute('d', 'M' + tjP(NL) + 'L' + tjP(SLo) + 'L' + tjP(ApL) + 'Q' + tjP(WL) + ' ' + tjP(HL) + 'Q' + tjP(HC) + ' ' + tjP(HR) + 'Q' + tjP(WR) + ' ' + tjP(ApR) + 'L' + tjP(SRo) + 'L' + tjP(NR) + 'Q' + tjP(NC) + ' ' + tjP(NL) + 'Z')
      el.placket.setAttribute('d', 'M' + tjP(NC) + 'L' + tjP(tjAdd(pt(Pp, 0, 44), hx, .8)))
      el.buttons.setAttribute('d', [.2, .4, .6, .8].map(function (f) {
        var c = [tjLerp(NC[0], Pp[0] + up[0] * 16, f), tjLerp(NC[1], Pp[1] + up[1] * 16, f)]
        return 'M' + tjP(tjAdd(c, u, -4.5)) + 'L' + tjP(tjAdd(c, u, 4.5))
      }).join(''))
      el.sash.setAttribute('d', 'M' + tjP(pt(Pp, -21, -12)) + 'L' + tjP(pt(Pp, 21, -12)))
      var knot = pt(Pp, 12, -11); el.knot.setAttribute('cx', knot[0]); el.knot.setAttribute('cy', knot[1])
      if (step) { el.rb0.setAttribute('d', tjChain(chains[0], knot, 7, -sv * .35)); el.rb1.setAttribute('d', tjChain(chains[1], tjAdd(knot, u, 3), 7, -sv * .25)) }
      el.neck.setAttribute('d', 'M' + tjP(pt(N, 0, 2)) + 'L' + tjP(tjAdd(N, up, 12)))

      var w = 1 / (1 + Math.exp((q.hL[1] - q.hR[1]) / 12)),
        look = tjClamp((w * q.hL[0] + (1 - w) * q.hR[0] - q.px) * .06, -4, 4)
      el.head.setAttribute('transform', 'translate(' + tjP(H) + ') rotate(' + (lean * 180 / Math.PI * 1.6 + look * .8).toFixed(2) + ')')
      el.face.setAttribute('transform', 'translate(' + look.toFixed(2) + ' 0)')

      ;[[pt(N, -24, 10), q.hL, -1, 0], [pt(N, 24, 10), q.hR, 1, 1]].forEach(function (arm) {
        var S = arm[0], target = arm[1], side = arm[2], mi = arm[3]
        var r = tjIK(S, target, side, mem[mi]), Eb = r.e, h = r.h, Wr = tjMixPt(Eb, h, .86), ang = Math.atan2(h[1] - Eb[1], h[0] - Eb[0])
        var n = [-Math.sin(ang), Math.cos(ang)]; if (n[1] < 0) n = [-n[0], -n[1]]
        var md = tjMixPt(Eb, Wr, .5), c = armEls[mi], a1 = 'M' + tjP(S) + 'L' + tjP(Eb), a2 = 'M' + tjP(Eb) + 'L' + tjP(Wr),
          cuff = [Math.cos(ang + Math.PI / 2), Math.sin(ang + Math.PI / 2)]
        c[0].setAttribute('d', a1); c[1].setAttribute('d', a1)
        c[2].setAttribute('d', 'M' + tjP(tjAdd(Eb, n, 5)) + 'Q' + tjP(tjAdd(md, n, 14)) + ' ' + tjP(tjAdd(Wr, n, 11)) + 'L' + tjP(tjAdd(Wr, n, 3)) + 'Z')
        c[3].setAttribute('d', a2); c[4].setAttribute('d', a2)
        c[5].setAttribute('d', 'M' + tjP(tjAdd(Wr, cuff, -7.5)) + 'L' + tjP(tjAdd(Wr, cuff, 7.5)))
        c[6].setAttribute('transform', 'translate(' + tjP(h) + ') rotate(' + (ang * 180 / Math.PI - 90).toFixed(1) + ')')
        if (step) { trails[mi].push(h); if (trails[mi].length > 44) trails[mi].shift() }
        var tr = trails[mi], m = tr.length
        trailEls[mi].forEach(function (p, k) {
          var s = tr.slice(Math.floor(k * m / 5), Math.floor((k + 1) * m / 5) + 1)
          p.setAttribute('d', s.length > 1 ? 'M' + s.map(tjP).join('L') : '')
        })
      })
      el.shadow.setAttribute('cx', q.px.toFixed(1))
    }
    /* 切式时清空拖影：否则上一式的轨迹会横着拉一条线穿过新姿势 */
    render.clear = function () {
      trails[0].length = 0; trails[1].length = 0
      trailEls.forEach(function (a) { a.forEach(function (p) { p.setAttribute('d', '') }) })
    }

    function draw(state, step) {
      lastState = state
      lastDraw = toDrawPose(state)
      render(lastDraw, step)
    }

    return {
      svg: svg,
      parts: el,              // 分层肢体：name → SVG 元素
      partNames: PART_NAMES.slice(),
      jointNames: JOINT_NAMES.slice(),
      state: function () { return lastState },
      drawPose: function () { return lastDraw },
      /** 按「招式状态」绘制（root/feet/lean/fold/headOff + 极坐标腕） */
      apply: draw,
      clear: function () { render.clear() },
      /** 只改某一个关节后再画（别的关节不变）——「关节独立可控」的最小示例 */
      setJoint: function (name, value, step) {
        var s = JSON.parse(JSON.stringify(lastState))
        if (name === 'root') s.root = value
        else if (name === 'footL') s.feet[0] = value
        else if (name === 'footR') s.feet[1] = value
        else if (name === 'wristL') s.wrists[0] = value
        else if (name === 'wristR') s.wrists[1] = value
        else if (name === 'lean' || name === 'fold' || name === 'headOff') s[name] = value
        else throw new Error('未知关节: ' + name)
        draw(s, step)
      },
    }
  }

  /* ============================================================================
   *  房间舞台（三面墙滚动文字 + 地面圆盘 + 浮动音符 + 倒影 + 暗角）
   *  风格逐条对齐 outputs/room-baduanjin 的原始房间，只把类名加 rfk- 前缀。
   * ========================================================================== */
  var ROOM_POEM = '清晨的庭院里，<b>宫</b>声沉稳，像脚下的土地；<b>商</b>声清越，掠过肩头；<b>角</b>声舒展，从指尖抽出新枝；<b>徵</b>声温暖，停在掌心；<b>羽</b>声如水，流过一呼一吸。<b>云手</b>缓缓，一开一合，不求整齐，只求<b>此刻</b>。拨一弦，留一刻，让声音陪你守住这段<b>留白</b>。'
  var FLOOR_DISK = '<svg viewBox="-60 -60 120 120" aria-hidden="true"><circle r="56" fill="none" stroke="rgba(226,236,244,.55)" stroke-dasharray="14 6"/><circle r="48" fill="none" stroke="rgba(226,236,244,.75)"/><path d="M0-48A48 48 0 0 1 0 48A24 24 0 0 1 0 0A24 24 0 0 0 0-48Z" fill="rgba(226,236,244,.32)"/><circle cy="-24" r="6" fill="rgba(226,236,244,.32)"/><circle cy="24" r="6" fill="none" stroke="rgba(226,236,244,.6)"/></svg>'

  function bands() {
    var p = '<span>' + ROOM_POEM + '</span>'
    var t = '<span>' + '宫　商　角　徵　羽　宫高　商高　'.repeat(8) + '</span>'
    return '<div class="rfk-band rfk-band-poem"><div class="rfk-track">' + p + p + '</div></div>' +
      '<div class="rfk-band rfk-band-tones"><div class="rfk-track">' + t + t + '</div></div>'
  }
  function notes() {
    var seed = 11
    var rand = function () { return (seed = seed * 16807 % 2147483647) / 2147483647 }
    var glyphs = ['♪', '♫', '♩', '♬', '♪', '♫', '宫', '商', '角', '徵', '羽']
    var out = ''
    for (var i = 0; i < 28; i++) {
      var g = glyphs[i % glyphs.length], cjk = i % glyphs.length > 5
      var z = Math.round(-820 + rand() * 760), y = Math.round(175 + rand() * 185)
      var x = Math.round(60 + rand() * 880)
      if (x > 380 && x < 620 && z > -320 && z < -40) x += x < 500 ? -220 : 220
      out += '<span class="rfk-note' + (cjk ? ' cjk' : '') + (z > -150 ? ' near' : '') +
        '" style="transform:translate3d(' + x + 'px,' + y + 'px,' + z + 'px)">' +
        '<i style="font-size:' + Math.round((cjk ? 18 : 22) + rand() * 22) + 'px;--o:' + (.45 + rand() * .45).toFixed(2) +
        ';--d:' + (9 + rand() * 9).toFixed(1) + 's;--delay:' + (-rand() * 18).toFixed(1) +
        's;--dx:' + Math.round(-22 + rand() * 44) + 'px">' + g + (cjk ? '' : '︎') + '</i></span>'
    }
    return out
  }
  function room3d(isReflect) {
    return '<div class="rfk-room3d">' +
      '<div class="rfk-wall rfk-wall-left">' + bands() + '</div>' +
      '<div class="rfk-wall rfk-wall-back">' + bands() + '</div>' +
      '<div class="rfk-wall rfk-wall-right">' + bands() + '</div>' +
      (isReflect ? '' : '<div class="rfk-floor-disk">' + FLOOR_DISK + '</div>') +
      '<div class="rfk-taiji"><svg viewBox="-100 150 600 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg></div>' +
      notes() + '</div>'
  }

  /**
   * 建房间舞台。
   * @param {Object} o { mount, photo, room=true, ratio='1000/562' }
   * @returns {Object} { root, scene, mainSvg, reflectSvg, resize, setScale }
   */
  function createStage(o) {
    o = o || {}
    var mount = typeof o.mount === 'string' ? document.querySelector(o.mount) : (o.mount || document.body)
    var room = o.room !== false
    var photo = o.photo || 'room-photo.jpg'
    var root = document.createElement('div')
    root.className = 'rfk-stage'
    root.style.setProperty('--rfk-photo', 'url("' + photo + '")')
    root.innerHTML =
      '<div class="rfk-scene">' +
      '<div class="rfk-camera">' +
      (room ? '<div class="rfk-photo"></div><div class="rfk-tint"></div><div class="rfk-tone"></div>' : '') +
      (room ? '<div class="rfk-layer rfk-reflect">' + room3d(true) + '</div>' : '') +
      '<div class="rfk-layer">' + room3d(false) + '</div>' +
      (room ? '<div class="rfk-vignette"></div>' : '') +
      '</div></div>'
    mount.appendChild(root)

    var sceneEl = root.querySelector('.rfk-scene')
    var mainSvg = root.querySelector('.rfk-layer:not(.rfk-reflect) .rfk-taiji > svg')
    var reflectSvg = root.querySelector('.rfk-reflect .rfk-taiji > svg')

    /* 房间按 1000×562 设计，按容器宽度等比缩放（与原实现一致） */
    function resize() {
      var w = root.clientWidth || 1000
      var s = Math.max(0.05, w / 1000)
      sceneEl.style.setProperty('--rfk-scale', s)
      root.style.height = (562 * s) + 'px'
    }
    var ro = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(root) }
    window.addEventListener('resize', resize)
    resize()

    return {
      root: root, scene: sceneEl, mainSvg: mainSvg, reflectSvg: reflectSvg,
      resize: resize, setScale: function (s) { sceneEl.style.setProperty('--rfk-scale', s); root.style.height = (562 * s) + 'px' },
      destroy: function () { ro && ro.disconnect(); window.removeEventListener('resize', resize); root.remove() },
    }
  }

  /* ============================================================================
   *  播放器（切式 / 播放 / 暂停 / 循环 / 拖动 / 变速 / 姿态混合）
   * ========================================================================== */
  function createPlayer(o) {
    o = o || {}
    var list = o.moves || []
    var loop = o.loop !== false
    var speed = o.speed || 1
    var blendMs = (o.blendMs === undefined) ? 340 : o.blendMs
    var onFrame = o.onFrame || function () {}
    var onMove = o.onMove || function () {}

    // figure 可以是单个，也可以是数组（本体 + 倒影），同一姿态喂给全部
    var figures = Array.isArray(o.figure) ? o.figure.filter(Boolean) : (o.figure ? [o.figure] : [])

    var idx = 0
    var u = 0
    var playing = !!o.autoplay
    var raf = 0, last = 0
    var blendFrom = null, blendT = 0
    var lastTs = 0
    var override = null      // 外部对个别关节的临时覆盖（见 setOverride）

    function move() { return list[idx] || null }
    function dur() { return (move() && move().dur) || 3 }
    function targetState() { return moveState(move(), u) }

    /* 叠加「关节覆盖」：只替换给了值的项，其余沿用招式姿态 ⇒ 真正的独立控制 */
    function applyOverride(st) {
      if (!override) return st
      var o = override
      return {
        wrists: [o.wristL || st.wrists[0], o.wristR || st.wrists[1]],
        feet: [o.footL || st.feet[0], o.footR || st.feet[1]],
        root: o.root || st.root,
        lean: o.lean === undefined ? st.lean : o.lean,
        fold: o.fold === undefined ? st.fold : o.fold,
        headOff: o.headOff === undefined ? st.headOff : o.headOff,
      }
    }

    /** 真正要画的那个姿态（招式姿态 → 切式混合 → 关节覆盖） */
    function compose() {
      var st = targetState()
      if (blendFrom && blendMs > 0) st = lerpPose(blendFrom, st, ease(clamp01(blendT / blendMs)))
      return applyOverride(st)
    }

    function paint(step) {
      var st = compose()
      figures.forEach(function (f) { f.apply(st, step) })
    }

    function tick(ts) {
      if (!last) last = ts
      var dt = Math.min(0.1, (ts - last) / 1000)
      last = ts
      lastTs = ts
      if (blendFrom) { blendT += dt * 1000; if (blendT >= blendMs) blendFrom = null }
      var stepped = false
      if (playing) {
        u += (dt * speed) / dur()
        stepped = true
        if (u >= 1) {
          if (loop) { u -= 1; clearTrails() }
          else { u = 1; playing = false }
        }
      }
      paint(stepped)
      onFrame({ index: idx, u: u, move: move(), playing: playing, total: list.length })
      raf = requestAnimationFrame(tick)
    }

    function clearTrails() { figures.forEach(function (f) { f.clear() }) }

    /** 切到某式并（可选）从 0 播。带姿态混合，避免瞬跳。 */
    function goto(i, opts) {
      opts = opts || {}
      if (!list.length) return
      var ni = ((i % list.length) + list.length) % list.length
      var prev = targetState()
      idx = ni
      u = 0
      blendFrom = (opts.blend === false || blendMs <= 0) ? null : prev
      blendT = 0
      clearTrails()
      if (opts.playing !== false) playing = true
      paint(false)
      onMove({ index: idx, move: move(), total: list.length })
      onFrame({ index: idx, u: u, move: move(), playing: playing, total: list.length })
    }

    var api = {
      get index() { return idx },
      get u() { return u },
      get playing() { return playing },
      get loop() { return loop },
      get speed() { return speed },
      get blendMs() { return blendMs },
      get total() { return list.length },
      move: move,
      moves: function () { return list },
      /** 换一整套招式（换拳种/换题库）：重置到第 0 式；playing 不传则沿用当前值 */
      setMoves: function (l, opts) {
        opts = opts || {}
        list = l || []
        idx = 0; u = 0; blendFrom = null; blendT = 0
        clearTrails()
        if (opts.playing !== undefined) playing = !!opts.playing
        if (list.length) goto(0, { playing: playing, blend: false })
        else {
          onMove({ index: 0, move: null, total: 0 })
          onFrame({ index: 0, u: 0, move: null, playing: playing, total: 0 })
        }
        return api
      },
      play: function () { if (u >= 1 && !loop) u = 0; playing = true; return api },
      pause: function () { playing = false; return api },
      toggle: function () { playing ? api.pause() : api.play(); return api },
      replay: function () { u = 0; clearTrails(); playing = true; return api },
      next: function () { goto(idx + 1); return api },
      prev: function () { goto(idx - 1); return api },
      goto: function (i, opts) { goto(i, opts); return api },
      seek: function (k) { u = clamp01(k); clearTrails(); paint(false); return api },
      setLoop: function (v) { loop = !!v; return api },
      setSpeed: function (v) { speed = v; return api },
      setBlendMs: function (v) { blendMs = v; return api },
      /** 临时覆盖个别关节（可多次调用累加）：{ lean, fold, headOff, root, footL, footR, wristL, wristR } */
      setOverride: function (obj) {
        var next = {}
        for (var k in override) next[k] = override[k]
        for (var j in obj) next[j] = obj[j]
        override = next
        paint(false); return api
      },
      clearOverride: function () { override = null; paint(false); return api },
      /** 当前实际绘制的姿态（含混合与覆盖）—— 只读，可用于导出/回填 */
      currentState: function () { return compose() },
      /** 渲染一帧（暂停时也可用于截图 / 导出） */
      renderOnce: function () { paint(false); return api },
      start: function () { if (!raf) { last = 0; raf = requestAnimationFrame(tick) } return api },
      stop: function () { if (raf) { cancelAnimationFrame(raf); raf = 0 } return api },
      destroy: function () { api.stop() },
    }
    api.start()
    // 首帧：就位到当前式
    if (list.length) goto(0, { playing: !!o.autoplay })
    return api
  }

  /* ---------------------------------------------------------------- 导出 */
  return {
    // 几何 / 构造
    P: P, pose: pose, pol: pol, polar2: polar2, lerpPose: lerpPose, kfAt: kfAt,
    toDrawPose: toDrawPose, moveState: moveState,
    NEUTRAL: NEUTRAL, BALL0: BALL0,
    consts: { VS: VS, VB: VB, VFOLD_K: VFOLD_K, VSH0L: VSH0L, VSH0R: VSH0R, R_MIN: R_MIN, R_MAX: R_MAX, vx: vx, vy: vy },
    // 招式库
    defineMoves: defineMoves, moves: moves, library: library, libraries: function () { return LIB },
    // 组件
    createFigure: createFigure, createStage: createStage, createPlayer: createPlayer,
    PART_NAMES: PART_NAMES, JOINT_NAMES: JOINT_NAMES,
    version: '1.0.0',
  }
})
