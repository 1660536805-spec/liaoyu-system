/* ============================================================================
   弦养 · 首页立体房间 —— Three.js 实时 3D 版
   ----------------------------------------------------------------------------
   替换原先「CSS 3D 墙 + 内联房间照片 + 平面 SVG 小人」的做法，改为真 3D：
     · 环境背景：实建房间（地面 / 三面墙 / 顶面 / 灯带 / 太极地盘），真透视
     · 倒影：地面用平面镜（render-to-texture），替换原来的 scaleY(-1) 假倒影
     · 建模：程序化 3D 人体（分段胶囊网格 + 关节层级），驱动为太极云手循环
   对外只暴露 Room3D.mount(container, opts) -> handle{stop,resize,dispose}
   依赖：全局 THREE（内联的 three.js 全局构建）
   ========================================================================= */
(function (global) {
'use strict';

const T = global.THREE;
if (!T) { console.error('[room3d] 找不到 THREE，请先加载 three.js'); return; }

/* ---------------------------------------------------------------- 0. 常量 */

const COL = {
  fog:        0x0d151c,
  floor:      0x232c35,
  wall:       0x1d252c,
  panel:      0xeef4f8,   // 背光墙面（浅色）
  wallInk:    0x2a3a46,   // 墙上文字
  cove:       0xdceaf4,   // 灯带
  gold:       0xc9a97e,
  robe:       0xf2f5f8,
  robeShade:  0xccd8e2,
  trim:       0x3e5262,
  skin:       0xe8dbcd,
  hair:       0x1a232b,
  shoe:       0x161d24,
};

/* 房间尺度（单位≈米）。相机站在房间里朝 -Z 看，所以看不到"前方开口"。 */
const ROOM = {
  W: 13.0,          // 宽（x）
  H: 5.8,           // 高（y）
  ZA: -28.0,        // 后墙
  ZB: 2.0,          // 相机身后的墙（不会入镜，只为围合）
};
ROOM.D = ROOM.ZB - ROOM.ZA;
ROOM.CZ = (ROOM.ZA + ROOM.ZB) / 2;

const PANEL_H = 2.55;                     // 墙面背光板高
const PANEL_Y = 2.35;                     // 背光板中心高
const BAND_H  = 0.26;                     // 音名带高
const BAND_Y  = 0.86;

const FIG_Z = -6.2;                       // 人物站位
const LOOP  = 33.5;                       // 人物循环时长（沿用原房 SVG 小人）

/* 绕房间一圈的文字路径总长：左墙(后→前) + 后墙 + 右墙(后→前) */
const PERIM = ROOM.D + ROOM.W + ROOM.D;

/* ------------------------------------------------------- 1. 通用几何工具 */

function capsule(r, len) {          // 关节在顶部、肢体沿 -Y 延伸 len
  const h = Math.max(len - 2 * r, 0.0004);
  return new T.CapsuleGeometry(r, h, 6, 14).translate(0, -len / 2, 0);
}
function box(w, h, d) { return new T.BoxGeometry(w, h, d); }
function std(o) { return new T.MeshStandardMaterial(o); }
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
/* 平顶小包络：k∈[a,b] 内为 1，两侧平滑过渡 */
function bump(k, a, b, soft) {
  soft = soft || 0.06;
  if (k < a - soft || k > b + soft) return 0;
  return Math.min(smooth((k - (a - soft)) / (2 * soft)), smooth(((b + soft) - k) / (2 * soft)));
}
function rnd(seedObj) { return (seedObj.s = seedObj.s * 16807 % 2147483647) / 2147483647; }

/* ---------------------------------------------------- 2. 墙面文字贴图 */

/* 把文本画成一条长贴图。返回 { tex, worldLen }，worldLen = 一份文本对应的世界长度。 */
function makeStripTexture(text, opt) {
  const fontPx = opt.fontPx, canvasH = opt.canvasH, maxW = 8192;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const family = opt.serif !== false ? '"Songti SC","STSong","SimSun",serif'
                                     : 'system-ui,-apple-system,"PingFang SC",sans-serif';
  ctx.font = fontPx + 'px ' + family;

  let w = Math.ceil(ctx.measureText(text).width) + fontPx;
  let size = fontPx;
  if (w > maxW) { size = Math.floor(fontPx * maxW / w); w = maxW; }

  c.width = Math.min(w, maxW);
  c.height = canvasH;
  ctx.font = size + 'px ' + family;
  ctx.fillStyle = opt.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opt.ink;
  ctx.fillText(text, size * 0.5, canvasH * (opt.baseline || 0.5));

  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = opt.aniso || 4;
  /* 一份文本铺满面板高 canvasH 时，对应的世界长度 */
  const worldLen = (c.width / canvasH) * opt.worldH;
  return { tex: tex, worldLen: worldLen };
}

const POEM = '清晨的庭院里，宫声沉稳，像脚下的土地；商声清越，掠过肩头；角声舒展，从指尖抽出新枝；徵声温暖，停在掌心；羽声如水，流过一呼一吸。云手缓缓，一开一合，不求整齐，只求此刻。拨一弦，留一刻，让声音陪你守住这段留白。';
const TONES = '宫　　商　　角　　徵　　羽　　宫高　　商高　　';

/* 文本带：把 PERIM 长的墙按 u 连续拼接，三段墙共用同一张图、各自错位 */
function stripMaterials(strip, y, h, opts) {
  opts = opts || {};
  const u = w => w / strip.worldLen;
  const segs = [
    { len: ROOM.D, off: 0 },                 // 左墙：前→后
    { len: ROOM.W, off: ROOM.D },            // 后墙：左→右
    { len: ROOM.D, off: ROOM.D + ROOM.W },   // 右墙：后→前
  ];
  return segs.map(s => {
    const t = strip.tex.clone();
    t.needsUpdate = true;
    t.wrapS = T.RepeatWrapping;
    t.repeat.set(u(s.len), 1);
    t.offset.set(u(s.off), 0);
    const m = std({
      map: t,
      emissive: 0xffffff,
      emissiveMap: t,
      emissiveIntensity: opts.glow == null ? 0.55 : opts.glow,
      roughness: 1,
      metalness: 0,
      side: T.DoubleSide,
    });
    m.userData.tex = t;
    return m;
  });
}

/* ---------------------------------------------- 3. 平面镜（render-to-texture）
   移植自 three 官方 examples/jsm/objects/Reflector，改为经典脚本可直接内联。 */

const MIRROR_VS = [
  'uniform mat4 textureMatrix;',
  'varying vec4 vUv;',
  'varying vec3 vWorld;',
  'void main(){',
  '  vUv = textureMatrix * vec4(position, 1.0);',
  '  vec4 wp = modelMatrix * vec4(position, 1.0);',
  '  vWorld = wp.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * wp;',
  '}',
].join('\n');

const MIRROR_FS = [
  '#include <common>',
  'uniform vec3 color;',
  'uniform vec3 baseColor;',
  'uniform vec3 uCamPos;',
  'uniform float uFadeA;',
  'uniform float uFadeB;',
  'uniform sampler2D tDiffuse;',
  'varying vec4 vUv;',
  'varying vec3 vWorld;',
  'void main(){',
  '  vec4 base = texture2DProj(tDiffuse, vUv);',
  '  float d = length(vWorld - uCamPos);',
  '  float atten = 1.0 - smoothstep(uFadeA, uFadeB, d);',      // 远处倒影渐隐，避免"塑料镜面"
  '  float k = 0.14 + 0.70 * atten;',
  '  vec3 refl = mix(baseColor, base.rgb * color, k);',
  '  gl_FragColor = vec4(refl, 1.0);',
  '  #include <tonemapping_fragment>',
  '  #include <colorspace_fragment>',
  '}',
].join('\n');

function makeMirror(geometry, opt) {
  opt = opt || {};
  const clipBias = opt.clipBias || 0;
  const plane = new T.Plane();
  const normal = new T.Vector3();
  const rPos = new T.Vector3();
  const cPos = new T.Vector3();
  const rot = new T.Matrix4();
  const lookAt = new T.Vector3(0, 0, -1);
  const clipPlane = new T.Vector4();
  const view = new T.Vector3();
  const target = new T.Vector3();
  const q = new T.Vector4();
  const texMat = new T.Matrix4();

  const rt = new T.WebGLRenderTarget(opt.tw || 1024, opt.th || 1024, {
    samples: 4, type: T.HalfFloatType,
  });
  const mat = new T.ShaderMaterial({
    uniforms: {
      color:     { value: new T.Color(opt.color == null ? 0xa9bccb : opt.color) },
      baseColor: { value: new T.Color(opt.baseColor == null ? COL.floor : opt.baseColor) },
      uCamPos:   { value: new T.Vector3() },
      uFadeA:    { value: opt.fadeA == null ? 7 : opt.fadeA },
      uFadeB:    { value: opt.fadeB == null ? 34 : opt.fadeB },
      tDiffuse:  { value: rt.texture },
      textureMatrix: { value: texMat },
    },
    vertexShader: MIRROR_VS,
    fragmentShader: MIRROR_FS,
  });
  const mesh = new T.Mesh(geometry, mat);
  const vcam = new T.PerspectiveCamera();

  mesh.onBeforeRender = function (renderer, scene, camera) {
    rPos.setFromMatrixPosition(mesh.matrixWorld);
    cPos.setFromMatrixPosition(camera.matrixWorld);

    rot.extractRotation(mesh.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rot);

    view.subVectors(rPos, cPos);
    if (view.dot(normal) > 0) return;                 // 镜面背对相机：不渲染
    view.reflect(normal).negate().add(rPos);

    rot.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rot).add(cPos);
    target.subVectors(rPos, lookAt).reflect(normal).negate().add(rPos);

    vcam.position.copy(view);
    vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    vcam.lookAt(target);
    vcam.far = camera.far;
    vcam.updateMatrixWorld();
    vcam.projectionMatrix.copy(camera.projectionMatrix);

    texMat.set(0.5, 0, 0, 0.5,  0, 0.5, 0, 0.5,  0, 0, 0.5, 0.5,  0, 0, 0, 1);
    texMat.multiply(vcam.projectionMatrix);
    texMat.multiply(vcam.matrixWorldInverse);
    texMat.multiply(mesh.matrixWorld);

    /* 斜切近平面（Eric Lengyel / Oblique Near-Plane Clipping），把镜面以下裁掉 */
    plane.setFromNormalAndCoplanarPoint(normal, rPos);
    plane.applyMatrix4(vcam.matrixWorldInverse);
    clipPlane.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vcam.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clipPlane.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
    pm.elements[2] = clipPlane.x;
    pm.elements[6] = clipPlane.y;
    pm.elements[10] = clipPlane.z + 1.0 - clipBias;
    pm.elements[14] = clipPlane.w;

    mat.uniforms.uCamPos.value.copy(cPos);

    mesh.visible = false;
    const prevRT = renderer.getRenderTarget();
    const prevXR = renderer.xr.enabled;
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, vcam);
    renderer.xr.enabled = prevXR;
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setRenderTarget(prevRT);
    if (camera.viewport !== undefined) renderer.state.viewport(camera.viewport);
    mesh.visible = true;
  };

  mesh.userData.dispose = function () { rt.dispose(); mat.dispose(); };
  return mesh;
}

/* ------------------------------------------------------------ 4. 房间环境 */

function makeBlobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new T.CanvasTexture(c);
  return t;
}

function makeTaijiTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2, cx = R, cy = R;
  g.clearRect(0, 0, size, size);
  g.strokeStyle = 'rgba(226,236,244,.55)';
  g.lineWidth = size * 0.006;
  g.setLineDash([size * 0.05, size * 0.028]);
  g.beginPath(); g.arc(cx, cy, R * 0.94, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(226,236,244,.72)';
  g.beginPath(); g.arc(cx, cy, R * 0.80, 0, Math.PI * 2); g.stroke();
  /* 阴阳鱼 */
  g.fillStyle = 'rgba(226,236,244,.30)';
  g.beginPath(); g.arc(cx, cy, R * 0.62, -Math.PI / 2, Math.PI / 2); g.fill();
  g.beginPath(); g.arc(cx, cy - R * 0.31, R * 0.31, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.fillStyle = 'rgba(10,16,22,.55)';
  g.beginPath(); g.arc(cx, cy + R * 0.31, R * 0.31, -Math.PI / 2, Math.PI / 2); g.fill();
  g.fillStyle = 'rgba(226,236,244,.55)';
  g.beginPath(); g.arc(cx, cy - R * 0.31, R * 0.055, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(10,16,22,.75)';
  g.beginPath(); g.arc(cx, cy + R * 0.31, R * 0.055, 0, Math.PI * 2); g.fill();
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* 建房间。返回 { group, mirror, update(dt) } */
function buildRoom(aniso) {
  const g = new T.Group();
  const W = ROOM.W, H = ROOM.H, D = ROOM.D;
  const xL = -W / 2, xR = W / 2;

  /* --- 地面：真镜面 --- */
  const mirror = makeMirror(new T.PlaneGeometry(W + 0.4, D + 0.4), {
    tw: 1024, th: 1024, color: 0xa9bccb, baseColor: COL.floor, fadeA: 7, fadeB: 34, clipBias: 0.004,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, ROOM.CZ);
  g.add(mirror);

  /* --- 墙：深色基底 --- */
  const wallMat = std({ color: COL.wall, roughness: .96, metalness: .04, side: T.DoubleSide });
  const addWall = (w, h, pos, rotY) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), wallMat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.y = rotY;
    g.add(m);
    return m;
  };
  addWall(D, H, [xL, H / 2, ROOM.CZ], Math.PI / 2);   // 左墙  u: 前→后
  addWall(D, H, [xR, H / 2, ROOM.CZ], -Math.PI / 2);  // 右墙  u: 后→前
  addWall(W, H, [0, H / 2, ROOM.ZA], 0);              // 后墙  u: 左→右
  addWall(W, H, [0, H / 2, ROOM.ZB], Math.PI);        // 相机侧（不入镜）

  /* --- 顶面 --- */
  const ceil = new T.Mesh(new T.PlaneGeometry(W, D), std({ color: 0x151c23, roughness: 1, side: T.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, ROOM.CZ);
  g.add(ceil);

  /* --- 墙面背光板 + 流动文字 --- */
  const poem = makeStripTexture(POEM, { fontPx: 81, canvasH: 224, bg: '#eef4f8', ink: '#2a3a46', worldH: PANEL_H, aniso: aniso });
  const tone = makeStripTexture(TONES, { fontPx: 52, canvasH: 96, bg: '#e7eff5', ink: '#4a5f6e', worldH: BAND_H, aniso: aniso });

  const poemMats = stripMaterials(poem, PANEL_Y, PANEL_H, { glow: 0.58 });
  const toneMats = stripMaterials(tone, BAND_Y, BAND_H, { glow: 0.40 });
  const panelGeoD = new T.PlaneGeometry(D, PANEL_H);
  const panelGeoW = new T.PlaneGeometry(W, PANEL_H);
  const bandGeoD = new T.PlaneGeometry(D, BAND_H);
  const bandGeoW = new T.PlaneGeometry(W, BAND_H);

  const put = (geo, mat, pos, rotY) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.y = rotY;
    g.add(m);
  };
  const eps = 0.045;
  put(panelGeoD, poemMats[0], [xL + eps, PANEL_Y, ROOM.CZ], Math.PI / 2);
  put(panelGeoW, poemMats[1], [0, PANEL_Y, ROOM.ZA + eps], 0);
  put(panelGeoD, poemMats[2], [xR - eps, PANEL_Y, ROOM.CZ], -Math.PI / 2);
  put(bandGeoD, toneMats[0], [xL + eps, BAND_Y, ROOM.CZ], Math.PI / 2);
  put(bandGeoW, toneMats[1], [0, BAND_Y, ROOM.ZA + eps], 0);
  put(bandGeoD, toneMats[2], [xR - eps, BAND_Y, ROOM.CZ], -Math.PI / 2);

  /* --- 顶部灯槽（墙与顶交界的亮线） --- */
  const coveMat = new T.MeshBasicMaterial({ color: COL.cove, toneMapped: false });
  const coveGeoD = box(0.055, 0.055, D);
  const coveGeoW = box(W, 0.055, 0.055);
  [[xL + 0.05, ROOM.CZ], [xR - 0.05, ROOM.CZ]].forEach(([x, z]) => {
    const m = new T.Mesh(coveGeoD, coveMat); m.position.set(x, H - 0.30, z); g.add(m);
  });
  const cw = new T.Mesh(coveGeoW, coveMat); cw.position.set(0, H - 0.30, ROOM.ZA + 0.05); g.add(cw);

  /* 墙面下缘的暗光线（呼应照片里墙脚的一道亮边） */
  const skimMat = new T.MeshBasicMaterial({ color: 0x9fb6c6, toneMapped: false });
  [[xL + 0.05, ROOM.CZ, Math.PI / 2], [xR - 0.05, ROOM.CZ, Math.PI / 2]].forEach(([x, z]) => {
    const m = new T.Mesh(box(0.03, 0.028, D), skimMat); m.position.set(x, 0.10, z); g.add(m);
  });

  /* --- 顶面灯格：纵向 4 道 + 横向 6 道 --- */
  const lampMat = new T.MeshBasicMaterial({ color: 0xf2f8ff, toneMapped: false });
  const invMat = new T.MeshBasicMaterial({ color: 0x2a3742 });
  const longGeo = box(0.085, 0.11, D);
  const crossGeo = box(W, 0.11, 0.085);
  const shellGeo = box(0.30, 0.16, D);
  [-4.3, -1.45, 1.45, 4.3].forEach(x => {
    const s = new T.Mesh(shellGeo, invMat); s.position.set(x, H - 0.06, ROOM.CZ); g.add(s);
    const m = new T.Mesh(longGeo, lampMat); m.position.set(x, H - 0.135, ROOM.CZ); g.add(m);
  });
  [-25.4, -20.6, -15.8, -11.0, -6.2, -1.4].forEach(z => {
    const m = new T.Mesh(crossGeo, lampMat); m.position.set(0, H - 0.135, z); g.add(m);
  });

  /* --- 地面太极盘 --- */
  const taiji = new T.Mesh(
    new T.CircleGeometry(2.15, 64),
    new T.MeshBasicMaterial({ map: makeTaijiTexture(512), transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })
  );
  taiji.rotation.x = -Math.PI / 2;
  taiji.position.set(0, 0.012, FIG_Z);
  g.add(taiji);

  /* --- 人物脚下的接触影 --- */
  const blob = new T.Mesh(
    new T.PlaneGeometry(2.0, 2.0),
    new T.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, 0.016, FIG_Z);
  g.add(blob);

  /* 滚动：以「绕房间一圈耗时 period 秒」为速度基准（诗句 180s 顺流，音名 120s 逆流） */
  const strips = [
    { strip: poem, mats: poemMats, dir: -1, period: 180 },
    { strip: tone, mats: toneMats, dir: 1, period: 120 },
  ];

  return {
    group: g,
    mirror: mirror,
    taiji: taiji,
    blob: blob,
    update(dt) {
      strips.forEach(({ strip, mats, dir, period }) => {
        const v = dir * (PERIM / period) * dt / strip.worldLen;
        mats.forEach(m => { m.userData.tex.offset.x += v; });
      });
      taiji.rotation.z -= dt * 0.09;
    },
  };
}

/* -------------------------------------------------------------- 5. 人物建模 */

const B = {
  hipY: 0.92, waistY: 1.05, chestY: 1.31, shoulderY: 1.43, neckY: 1.49,
  headY: 1.615, headR: 0.107,
  shHalf: 0.186, hipHalf: 0.098,
  upperArm: 0.285, foreArm: 0.245, hand: 0.075,
  thigh: 0.425, shin: 0.415, footL: 0.235,
};

/* 造一个「关节在原点、肢体沿 -Y」的分段。返回 { group, mesh } */
function segment(parent, r, len, mat, pos) {
  const grp = new T.Group();
  if (pos) grp.position.set(pos[0], pos[1], pos[2]);
  parent.add(grp);
  const mesh = new T.Mesh(capsule(r, len), mat);
  grp.add(mesh);
  return { group: grp, mesh: mesh };
}

function buildFigure() {
  const mRobe  = std({ color: COL.robe, roughness: .74, metalness: .02 });
  const mRobe2 = std({ color: COL.robeShade, roughness: .8, metalness: .02 });
  const mTrim  = std({ color: COL.trim, roughness: .6, metalness: .18 });
  const mSkin  = std({ color: COL.skin, roughness: .62, metalness: .02 });
  const mHair  = std({ color: COL.hair, roughness: .5, metalness: .05 });
  const mShoe  = std({ color: COL.shoe, roughness: .55, metalness: .1 });

  const root  = new T.Group();
  const hips  = new T.Group(); hips.position.y = B.hipY; root.add(hips);
  const spine = new T.Group(); spine.position.y = B.waistY - B.hipY; hips.add(spine);
  const chest = new T.Group(); chest.position.y = B.chestY - B.waistY; spine.add(chest);
  const neck  = new T.Group(); neck.position.y = B.neckY - B.chestY; chest.add(neck);
  const head  = new T.Group(); head.position.y = B.headY - B.neckY; neck.add(head);

  /* 躯干：长身练功服。挂在 spine（跟腰走），截面是「横宽纵薄」的椭圆——
     宽度必须小于肩关节间距，否则会把两条手臂整个吞进衣服里。 */
  const JTOP = 0.40, JBOT = -0.33;                    // 相对 spine 原点的上/下摆
  const jacket = new T.Mesh(
    new T.CylinderGeometry(0.170, 0.204, JTOP - JBOT, 28, 1, true),
    mRobe
  );
  jacket.material.side = T.DoubleSide;
  jacket.position.y = (JTOP + JBOT) / 2;
  jacket.scale.set(1, 1, 0.60);                       // 纵深压到 60%，避免"桶"感
  spine.add(jacket);

  /* 前襟 + 立领 + 腰带 */
  const placket = new T.Mesh(box(0.032, (JTOP - JBOT) - 0.12, 0.018), mTrim);
  placket.position.set(0, (JTOP + JBOT) / 2 + 0.03, 0.116);
  spine.add(placket);

  const collar = new T.Mesh(new T.TorusGeometry(0.098, 0.026, 8, 24, Math.PI * 1.3), mRobe2);
  collar.rotation.x = -Math.PI / 2;
  collar.rotation.z = Math.PI * 0.35;
  collar.position.set(0, B.shoulderY - B.chestY + 0.012, 0.01);
  collar.scale.set(1.34, 1, 0.92);
  chest.add(collar);

  const sash = new T.Mesh(new T.TorusGeometry(0.196, 0.026, 8, 30), mTrim);
  sash.rotation.x = -Math.PI / 2;
  sash.position.y = -0.02;
  sash.scale.set(1, 1, 0.645);
  spine.add(sash);

  /* 腰带飘带（两片，随身体轻摆） */
  const ribbons = [0, 1].map(i => {
    const r = new T.Mesh(box(0.010, 0.30, 0.062), mTrim);
    r.position.set(i ? 0.045 : -0.045, -0.245, 0.088 + i * 0.018);
    spine.add(r);
    return r;
  });

  /* 头：脸 + 发 + 发髻 */
  const skull = new T.Mesh(new T.SphereGeometry(B.headR, 26, 20), mSkin);
  skull.scale.set(0.92, 1.06, 0.98);
  head.add(skull);
  const hairCap = new T.Mesh(
    new T.SphereGeometry(B.headR * 1.045, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mHair
  );
  hairCap.scale.set(0.94, 1.06, 1.0);
  hairCap.position.y = 0.004;
  head.add(hairCap);
  const bun = new T.Mesh(new T.SphereGeometry(0.052, 16, 12), mHair);
  bun.position.set(0, B.headR * 0.86, -0.048);
  head.add(bun);
  const eyes = [-1, 1].map(s => {
    const e = new T.Mesh(new T.SphereGeometry(0.0125, 10, 8), mHair);
    e.position.set(s * 0.036, 0.004, 0.093);
    head.add(e);
    return e;
  });
  const nose = new T.Mesh(new T.SphereGeometry(0.013, 10, 8), mSkin);
  nose.position.set(0, -0.024, 0.098);
  head.add(nose);

  /* 手臂：肩 → 上臂 → 肘 → 前臂 → 手 */
  const arms = [-1, 1].map(side => {                 // side: -1 画面左(角色右) / +1 画面右(角色左)
    const sh = new T.Group();
    sh.position.set(side * B.shHalf, B.shoulderY - B.chestY, 0);
    chest.add(sh);
    const upper = new T.Mesh(capsule(0.058, B.upperArm), mRobe);
    sh.add(upper);
    const shoulderBall = new T.Mesh(new T.SphereGeometry(0.070, 16, 12), mRobe);
    shoulderBall.scale.set(1, 1, 0.78);
    sh.add(shoulderBall);

    const el = new T.Group();
    el.position.y = -B.upperArm;
    sh.add(el);
    const fore = new T.Mesh(capsule(0.042, B.foreArm), mRobe2);
    el.add(fore);
    const cuff = new T.Mesh(new T.CylinderGeometry(0.049, 0.047, 0.05, 14), mTrim);
    cuff.position.y = -B.foreArm + 0.03;
    el.add(cuff);
    const hand = new T.Group();
    hand.position.y = -B.foreArm;
    el.add(hand);
    const palm = new T.Mesh(new T.SphereGeometry(0.05, 12, 10), mSkin);
    palm.scale.set(1, 1.15, 0.5);
    hand.add(palm);

    return { side, sh, upper, el, fore, hand, palm, shoulderBall };
  });

  /* 腿：髋 → 大腿 → 膝 → 小腿 → 脚 */
  const legs = [-1, 1].map(side => {
    const hip = new T.Group();
    hip.position.set(side * B.hipHalf, 0, 0);
    hips.add(hip);
    const thighM = new T.Mesh(capsule(0.082, B.thigh), mRobe);
    hip.add(thighM);
    const kn = new T.Group();
    kn.position.y = -B.thigh;
    hip.add(kn);
    const shinM = new T.Mesh(capsule(0.062, B.shin), mRobe);
    kn.add(shinM);
    const ft = new T.Group();
    ft.position.y = -B.shin;
    kn.add(ft);
    const footM = new T.Mesh(box(0.095, 0.055, B.footL), mShoe);
    footM.position.set(0, -0.026, B.footL / 2 - 0.055);
    ft.add(footM);
    return { side, hip, thighM, kn, shinM, ft, footM };
  });

  return { root, hips, spine, chest, neck, head, arms, legs, ribbons, jacket, eyes, sash, torso: jacket };
}

/* ---------------------------------------------------------- 6. 云手姿态 */

/* 静止立姿 */
const REST = {
  x: 0, z: 0, yaw: 0, lift: 0,
  hipsYaw: 0, hipsRoll: 0, lean: 0, twist: 0, side: 0,
  neckX: 0, neckY: 0, headY: 0,
  armL: { flex: 0.10, abd: 0.13, swing: 0.02, elbow: 0.16 },
  armR: { flex: 0.10, abd: 0.13, swing: 0.02, elbow: 0.16 },
  legL: { hipFlex: 0.02, hipAbd: 0.045, knee: 0.05, ankle: 0.02, lift: 0 },
  legR: { hipFlex: 0.02, hipAbd: 0.045, knee: 0.05, ankle: 0.02, lift: 0 },
};

/* 起势后的抱球位 */
const GUARD = {
  x: 0, z: 0, yaw: 0, lift: 0.012,
  hipsYaw: 0, hipsRoll: 0, lean: -0.045, twist: 0, side: 0,
  neckX: 0.05, neckY: 0, headY: 0,
  armL: { flex: 0.92, abd: 0.34, swing: 0.30, elbow: 1.62 },
  armR: { flex: 0.92, abd: 0.34, swing: -0.30, elbow: 1.62 },
  legL: { hipFlex: 0.02, hipAbd: 0.055, knee: 0.06, ankle: 0.02, lift: 0 },
  legR: { hipFlex: 0.02, hipAbd: 0.055, knee: 0.06, ankle: 0.02, lift: 0 },
};

/* 云手：一步 4s 一圈；前 3 步向画面右，后 3 步回中 */
const CLOUD0 = 4.0, CLOUD1 = 28.0, STEP_T = 4.0, NSTEP = 6, STEP_X = 0.235;

function cloudPose(t) {
  const k = (t - CLOUD0) / STEP_T;
  const n = clamp(Math.floor(k), 0, NSTEP - 1);
  const u = clamp(k - n, 0, 1);
  const nxt = Math.min(n + 1, NSTEP);
  const xa = Math.min(n, NSTEP - n) * STEP_X;
  const xb = Math.min(nxt, NSTEP - nxt) * STEP_X;
  const x = lerp(xa, xb, smooth(clamp((u - 0.10) / 0.72, 0, 1)));

  const d = n < NSTEP / 2 ? 1 : -1;               // 行进方向（画面右为 +1）
  const P = 2 * Math.PI * u;                      // 每步一圈
  const sw = Math.sin(P), cw = Math.cos(P);

  const liftLead = bump(u, 0.06, 0.40, 0.09);
  const liftTrail = bump(u, 0.56, 0.90, 0.09);
  const lead = d > 0 ? 1 : -1;                    // 哪条腿先动（画面右移时右腿先）

  const mkLeg = (s, lift) => ({
    hipFlex: 0.03 + 0.22 * lift,
    hipAbd: 0.055 + s * d * 0.055 + 0.16 * lift * (s === lead ? 1 : 0.55),
    knee: 0.06 + 0.58 * lift,
    ankle: 0.02 - 0.18 * lift,
    lift: lift * 0.075,
  });

  return {
    x: x, z: 0, yaw: 0.045 * d * sw, lift: 0.012 + 0.012 * Math.abs(sw),
    hipsYaw: -0.10 * d * sw, hipsRoll: 0.035 * d,
    lean: -0.05, twist: 0.11 * d * cw, side: -0.05 * d * sw,
    neckX: 0.045 + 0.03 * sw, neckY: -0.10 * d * sw, headY: -0.07 * d * cw,
    /* 上手 / 下手：左右相位差 π，画圆 */
    armL: {
      flex: 0.60 + 0.40 * Math.sin(P),
      abd: 0.30 + 0.24 * Math.cos(P * 0.5) * d,
      swing: 0.62 - 0.46 * Math.cos(P),
      elbow: 1.28 + 0.40 * Math.sin(P + 1.1),
    },
    armR: {
      flex: 0.60 + 0.40 * Math.sin(P + Math.PI),
      abd: 0.30 - 0.24 * Math.cos(P * 0.5) * d,
      swing: -0.62 + 0.46 * Math.cos(P + Math.PI),
      elbow: 1.28 + 0.40 * Math.sin(P + 1.1 + Math.PI),
    },
    legL: mkLeg(-1, lead > 0 ? liftTrail : liftLead),
    legR: mkLeg(1, lead > 0 ? liftLead : liftTrail),
  };
}

function blendPose(a, b, k) {
  const o = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    if (typeof va === 'number') o[key] = lerp(va, vb, k);
    else { o[key] = {}; for (const j in va) o[key][j] = lerp(va[j], vb[j], k); }
  }
  return o;
}

function poseAt(t) {
  t = ((t % LOOP) + LOOP) % LOOP;
  if (t < 4.0) {
    /* 起势：静止 → 抱球，并在头 0.8s 保持静止，不"弹" */
    const k = smooth((t - 0.35) / 3.65);
    return blendPose(REST, GUARD, k);
  }
  if (t < CLOUD1) return cloudPose(t);
  /* 收势：云手末位 → 静止 */
  const k = smooth((t - CLOUD1) / (LOOP - CLOUD1));
  return blendPose(cloudPose(CLOUD1 - 0.001), REST, k);
}

/* 把姿态写进骨架 */
function applyPose(fig, p, t) {
  const R = fig.root;
  R.position.set(p.x, p.lift, FIG_Z + p.z);
  R.rotation.y = p.yaw;
  fig.hips.rotation.set(0, p.hipsYaw, p.hipsRoll, 'YXZ');
  fig.spine.rotation.set(p.lean, p.twist, p.side, 'YXZ');
  fig.chest.rotation.set(p.lean * 0.45, p.twist * 0.5, p.side * 0.45, 'YXZ');
  fig.neck.rotation.set(p.neckX, p.neckY, 0, 'YXZ');
  fig.head.rotation.set(p.neckX * 0.4, p.headY, 0, 'YXZ');

  fig.arms.forEach((a, i) => {
    const q = i === 0 ? p.armL : p.armR;    // i=0 → side -1（画面左）
    const sgn = a.side;                     // -1 / +1
    a.sh.rotation.set(-q.flex, q.swing * sgn, sgn * q.abd, 'YXZ');
    a.el.rotation.set(-q.elbow, 0, 0);
  });
  fig.legs.forEach((l, i) => {
    const q = i === 0 ? p.legL : p.legR;
    l.hip.rotation.set(-q.hipFlex, 0, l.side * q.hipAbd, 'YXZ');
    l.kn.rotation.set(q.knee, 0, 0);
    l.ft.rotation.set(q.ankle, 0, 0);
  });

  /* 腰带飘带：随重心横移甩动 */
  const sway = clamp((p.x - (fig._px == null ? p.x : fig._px)) / 0.02, -1, 1);
  fig._px = p.x;
  fig.ribbons.forEach((r, i) => {
    r.rotation.x = 0.06 + 0.10 * Math.sin(t * 1.3 + i * 2.1);
    r.rotation.z = (i ? -1 : 1) * (0.10 + 0.22 * Math.abs(sway)) + sway * 0.10;
  });

  /* 眼睛朝向：轻微跟随上手 */
  const look = clamp((p.armL.flex - p.armR.flex) * 0.16, -0.12, 0.12);
  fig.eyes.forEach(e => { e.position.x = (e.position.x < 0 ? -1 : 1) * 0.036 + look * 0.05; });
}

/* -------------------------------------------------------------- 7. 浮动音符 */

const GLYPHS = ['♪', '♫', '♩', '♬', '宫', '商', '角', '徵', '羽'];

function glyphTexture(ch, cjk) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.font = (cjk ? 74 : 92) + 'px ' + (cjk ? '"Songti SC",serif' : 'serif');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(228,240,250,.9)';
  g.shadowBlur = 16;
  g.fillStyle = cjk ? 'rgba(198,222,238,.95)' : 'rgba(226,240,250,.92)';
  g.fillText(ch, S / 2, S / 2 + 4);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

function buildNotes(n) {
  const seed = { s: 11 };
  const texes = GLYPHS.map((g, i) => glyphTexture(g, i >= 4));
  const mats = texes.map(t => new T.SpriteMaterial({
    map: t, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  }));
  const sprites = [];
  const group = new T.Group();
  for (let i = 0; i < n; i++) {
    const s = new T.Sprite(mats[i % mats.length]);
    const gi = i % GLYPHS.length;
    const scale = (gi >= 4 ? 0.30 : 0.26) + rnd(seed) * 0.26;
    s.scale.set(scale, scale, 1);
    const x = -ROOM.W / 2 + 0.9 + rnd(seed) * (ROOM.W - 1.8);
    const y = 0.7 + rnd(seed) * 3.6;
    const z = ROOM.ZA + 2 + rnd(seed) * (ROOM.D - 6);
    /* 避开人物正前方一小块，免得糊在脸上 */
    const zz = (x > -1.6 && x < 1.6 && z > FIG_Z - 2.4 && z < FIG_Z + 1.2) ? z - 3.2 : z;
    s.position.set(x, y, zz);
    s.userData = {
      base: y, sp: 0.10 + rnd(seed) * 0.22, ph: rnd(seed) * Math.PI * 2,
      dx: (rnd(seed) - 0.5) * 0.12, op: 0.34 + rnd(seed) * 0.46,
      depthFade: 1,
    };
    group.add(s);
    sprites.push(s);
  }
  return { group, sprites };
}

/* --------------------------------------------------------- 8. 装配 + 循环 */

function mount(container, opts) {
  opts = opts || {};
  const reduce = opts.reduce != null ? opts.reduce
    : (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    container.innerHTML = '<div class="room-fallback">当前浏览器无法启用 WebGL，已降级为静态房间。</div>';
    return null;
  }
  renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.className = 'room-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color(COL.fog);
  scene.fog = new T.Fog(COL.fog, 12, 48);

  const camera = new T.PerspectiveCamera(46, 1, 0.1, 90);
  camera.position.set(0, 2.42, 0.55);
  const camTarget = new T.Vector3(0, 1.42, -9.0);
  camera.lookAt(camTarget);

  /* 灯光 */
  scene.add(new T.AmbientLight(0x93aec4, 0.62));
  scene.add(new T.HemisphereLight(0xc6dcec, 0x161d24, 0.72));
  const key = new T.DirectionalLight(0xffffff, 1.15); key.position.set(4.5, 9, 6); scene.add(key);
  const fill = new T.DirectionalLight(0x9dc0dc, 0.5); fill.position.set(-5, 4, -6); scene.add(fill);
  const rim = new T.PointLight(0xd8ecff, 9, 22, 2); rim.position.set(0, 4.6, -12); scene.add(rim);

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const room = buildRoom(aniso);
  scene.add(room.group);

  const fig = buildFigure();
  scene.add(fig.root);

  const notes = buildNotes(30);
  scene.add(notes.group);

  /* 尺寸自适应 */
  function resize() {
    const w = Math.max(1, container.clientWidth || 1);
    const h = Math.max(1, container.clientHeight || 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  let ro = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(resize); ro.observe(container); }
  global.addEventListener('resize', resize);

  /* 主循环 */
  let raf = null, last = null, t = 0, alive = true, paused = false;

  /* 渲染一帧（时间轴不推进），供截图/自检用 */
  function renderAt(v) {
    t = v;
    const p = poseAt(t);
    applyPose(fig, p, t);
    room.blob.position.x = p.x;
    camera.position.set(0, 2.42 + 0.04 * (0.5 - 0.5 * Math.cos(2 * Math.PI * (t / 34))),
                        0.55 + 0.42 * (0.5 - 0.5 * Math.cos(2 * Math.PI * (t / 34))));
    camera.lookAt(camTarget);
    room.update(0);
    notes.sprites.forEach(s => { s.position.y = s.userData.base + 0.55 * Math.sin(t * 0.22 + s.userData.ph); });
    renderer.render(scene, camera);
  }

  function frame(now) {
    if (!alive || paused) return;
    const dt = last == null ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    last = now;

    /* 相机极缓推拉（对应原来的 dolly 34s） */
    const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / 34));
    camera.position.set(0, 2.42 + 0.04 * k, 0.55 + 0.42 * k);
    camera.lookAt(camTarget);

    const p = poseAt(t);
    applyPose(fig, p, t);
    room.blob.position.x = p.x;

    room.update(dt);
    notes.sprites.forEach(s => {
      const u = s.userData;
      const y = u.base + 0.55 * Math.sin(t * 0.22 + u.ph);
      s.position.set(
        s.position.x + u.dx * dt * 0.18,
        y,
        s.position.z
      );
      /* 越远越淡，越靠边越淡 */
      const zk = clamp((s.position.z - ROOM.ZA) / ROOM.D, 0, 1);
      const xk = 1 - Math.abs(s.position.x) / (ROOM.W / 2) * 0.45;
      s.material.opacity = u.op * (0.35 + 0.65 * zk) * xk;
      s.scale.setScalar(s.scale.x); // 保持
    });

    renderer.render(scene, camera);
    t = (t + dt) % (LOOP * 4);
    raf = global.requestAnimationFrame(frame);
  }

  if (reduce) {
    applyPose(fig, poseAt(6.5), 6.5);
    room.update(0);
    resize();
    renderer.render(scene, camera);
  } else {
    raf = global.requestAnimationFrame(frame);
  }

  function dispose() {
    alive = false;
    if (raf) global.cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    global.removeEventListener('resize', resize);
    scene.traverse(o => {
      if (o.userData && o.userData.dispose) o.userData.dispose();
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => {
          for (const k2 in m) {
            const v = m[k2];
            if (v && v.isTexture && v !== m.map && v !== m.emissiveMap) v.dispose();
          }
          if (m.map) m.map.dispose();
          if (m.emissiveMap) m.emissiveMap.dispose();
          m.dispose();
        });
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return {
    stop() { alive = false; if (raf) global.cancelAnimationFrame(raf); raf = null; },
    resume() { if (!alive) { alive = true; paused = false; last = null; raf = global.requestAnimationFrame(frame); } },
    pause() { paused = true; if (raf) global.cancelAnimationFrame(raf); raf = null; },
    setTime(v) { renderAt(v); },
    resize: resize,
    dispose: dispose,
    scene: scene, camera: camera, renderer: renderer, figure: fig, room: room,
    notes: notes, poseAt: poseAt,
    /* 调试视角：临时换机位渲染一帧（只在自检脚本里用） */
    debugView(px, py, pz, tx, ty, tz, fov) {
      const old = [camera.fov, camera.position.clone(), camTarget.clone()];
      camera.fov = fov || 46; camera.position.set(px, py, pz);
      camTarget.set(tx, ty, tz); camera.lookAt(camTarget);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      camera.fov = old[0]; camera.position.copy(old[1]); camTarget.copy(old[2]);
      camera.lookAt(camTarget); camera.updateProjectionMatrix();
    },
  };
}

global.Room3D = { mount: mount, poseAt: poseAt, LOOP: LOOP, ROOM: ROOM, THREE: T };
})(typeof window !== 'undefined' ? window : this);
