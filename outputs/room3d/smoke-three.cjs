/* 烟测：确认转成全局的 three（经典 <script> 内联）能在浏览器里正常建渲染器并出图 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const THREE_SRC = fs.readFileSync(path.join(__dirname, 'three.global.js'), 'utf8')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111}canvas{display:block}</style></head>
<body><script>${THREE_SRC}</script>
<script>
  const out = { hasThree: typeof THREE !== 'undefined' };
  try {
    out.revision = THREE.REVISION;
    const need = ['Scene','PerspectiveCamera','WebGLRenderer','Mesh','BoxGeometry','CapsuleGeometry','MeshStandardMaterial','Group','Vector3','Matrix4','Plane','ShaderMaterial','WebGLRenderTarget','HalfFloatType','CanvasTexture','Sprite','SpriteMaterial','DirectionalLight','AmbientLight','Fog','ACESFilmicToneMapping','SRGBColorSpace','Color','Euler','Quaternion','InstancedMesh','CylinderGeometry','SphereGeometry','TorusGeometry','PlaneGeometry','RingGeometry'];
    out.missing = need.filter(k => typeof THREE[k] === 'undefined');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 240); renderer.setPixelRatio(1);
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x223344);
    const cam = new THREE.PerspectiveCamera(45, 400/240, .1, 100); cam.position.set(2,2,3); cam.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xffffff, .8));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(3,5,2); scene.add(dl);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color: 0x66aaff }));
    scene.add(cube);
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(.15, .5, 4, 10), new THREE.MeshStandardMaterial({ color: 0xeeeedd }));
    capsule.position.set(-1.2, .3, 0); scene.add(capsule);
    renderer.render(scene, cam);
    const gl = renderer.getContext();
    out.glVersion = gl.getParameter(gl.VERSION);
    out.maxSamples = gl.getParameter(gl.MAX_SAMPLES);
    out.rendererOK = true;
  } catch (e) { out.error = String(e && e.stack || e); }
  window.__probe = out;
</script></body></html>`

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const p = await (await b.newContext({ viewport: { width: 400, height: 240 }, deviceScaleFactor: 1 })).newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await p.setContent(html, { waitUntil: 'load' })
  await p.waitForTimeout(600)
  const probe = await p.evaluate(() => window.__probe)
  await p.screenshot({ path: path.join(__dirname, 'smoke-three.png') })
  console.log('PROBE', JSON.stringify(probe, null, 2))
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none')
  await b.close()
})()
