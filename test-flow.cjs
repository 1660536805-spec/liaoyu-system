'use strict'
// 只执行本次新增闭环代码与已审阅的函数片段；服务端使用内存 mock，不监听端口。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = __dirname
const bundle = fs.readFileSync(path.join(root, 'dist/assets/index-arZpQuM3.js'), 'utf8')

class Node {
  constructor(tag) {
    this.tag = tag
    this.children = []
    this.attrs = {}
    this.listeners = {}
    this.isConnected = true
    this.textContent = ''
  }
  setAttribute(key, value) { this.attrs[key] = value }
  getAttribute(key) { return this.attrs[key] }
  appendChild(child) { child.parent = this; this.children.push(child); return child }
  insertBefore(child) { child.parent = this; this.children.unshift(child) }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) }
  fire(type) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {} }) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.isConnected = false }
  close() {}
  showModal() {}
  focus() {}
  querySelector(selector) { return this.querySelectorAll(selector)[0] }
  querySelectorAll(selector) { return flatten(this).filter(n => selector.split(',').some(s => matches(n, s.trim()))) }
}
function matches(node, selector) {
  const attribute = selector.match(/\[([^\]]+)\]/)
  if (attribute && !(attribute[1] in node.attrs)) return false
  const base = selector.replace(/\[[^\]]+\]/g, '')
  if (base.startsWith('.')) return base.slice(1).split('.').every(cls => (node.className || '').split(' ').includes(cls))
  return !base || node.tag === base
}
function flatten(node) { return node.children.flatMap(n => [n, ...flatten(n)]) }
const body = new Node('body')
const listeners = {}
const documentListeners = {}
let app = null
let observation = null
const storage = new Map()
let failStorage = false
let clock = 100000
class Clock extends Date { constructor() { super(clock) } static now() { return clock } }
const window = {
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn) },
  dispatchEvent(event) { for (const fn of listeners[event.type] || []) fn(event) }
}
const context = vm.createContext({
  window, document: {
    body, createElement: tag => new Node(tag), activeElement: null,
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn) },
    getElementById() { return app }
  },
  MutationObserver: class {
    constructor(fn) { this.fn = fn; this.observing = false; observation = this }
    observe() { this.observing = true }
    disconnect() { this.observing = false }
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem(key, value) { if (failStorage) throw Error('存储被阻止'); storage.set(key, value) }
  },
  Date: Clock, queueMicrotask, console,
  CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail } }
})
vm.runInContext(fs.readFileSync(path.join(root, 'dist/flow.js'), 'utf8'), context)
// 从 bundle 仅抽取存储函数，避免执行交付包其余未知代码。
const storeStart = bundle.indexOf('function Vd()')
const storeEnd = bundle.indexOf('var Rr=', storeStart)
assert(storeStart > 0 && storeEnd > storeStart)
vm.runInContext(bundle.slice(storeStart, storeEnd), context)
const flow = window.XianyangFlow
let before, after
const pushed = []
const router = {
  currentRoute: { value: { path: '/' } },
  beforeEach(fn) { before = fn }, afterEach(fn) { after = fn },
  push(path) { pushed.push(path); return Promise.resolve() }
}
flow.installRouter(router)
const route = p => ({ path: p, matched: [1] })
function modal() { return body.children.find(n => n.tag === 'dialog') }
function choose(text) {
  const node = flatten(modal()).find(n => n.tag === 'button' && n.textContent === text)
  assert(node, '未找到按钮：' + text)
  node.fire('click')
}
function record(moves, completion) {
  return context.F4(flow.withMeta({ moves, names: moves.map(i => '动作' + i) }, completion))
}
function records() { return JSON.parse(storage.get('xianyang.records.v1') || '[]') }
const tick = () => new Promise(resolve => setImmediate(resolve))

async function main() {
  let guard = before(route('/train'), route('/'))
  assert(modal(), '进入训练之前应先显示安全确认')
  const start = flatten(modal()).find(n => n.textContent === '确认，开始跟练')
  assert.equal(start.disabled, true)
  const check = flatten(modal()).find(n => n.tag === 'input')
  check.checked = true; check.fire('change')
  assert.equal(start.disabled, false)
  choose('确认，开始跟练')
  assert.equal(await guard, true)

  guard = before(route('/train'), { path: '/', matched: [] })
  modal().fire('cancel')
  assert.equal(await guard, '/', '直接进入训练但取消应回首页，而非空白')

  let partialCalls = 0, resumed = 0
  flow.begin(() => ({ moves: [0, 1] }), () => { partialCalls++; return record([0, 1], 'partial') }, () => resumed++)
  flow.mark('manual'); clock += 65000; flow.mark('camera')
  const metadata = flow.withMeta({}, 'complete')
  assert.equal(metadata.mode, 'mixed')
  assert.equal(metadata.durationMs, 65000)
  guard = before(route('/'), route('/train'))
  assert.equal(flow.canAdvance(), false, '退出确认期间应停止计数')
  choose('继续练习')
  assert.equal(await guard, false)
  assert.equal(partialCalls, 0)
  assert.equal(resumed, 1)
  guard = before(route('/'), route('/train'))
  choose('保存进度并退出')
  assert.equal(await guard, true)
  assert.equal(records()[0].completion, 'partial')
  assert.equal(records()[0].complete, false)
  assert.equal(records()[0].mode, 'mixed')
  assert.equal(flow.canAdvance(), false)
  await before(route('/'), route('/train'))
  assert.equal(partialCalls, 1, '已结束训练不应再次保存')

  flow.begin(() => ({ moves: [] }), () => { throw Error('零进度不应保存') })
  assert.equal(await before(route('/'), route('/train')), true)
  assert.equal(modal(), undefined)

  flow.begin(() => ({ moves: [0] }), () => record([0], 'partial'))
  flow.mark('manual')
  clock += 9000
  const full = record([0, 1, 2, 3, 4, 5, 6, 7], 'complete')
  assert.equal(full.complete, true)
  assert.equal(full.mode, 'manual')
  assert.equal(full.durationMs, 9000)
  assert.equal('score' in full, false)
  flow.completed(full)
  assert(modal(), '完成事件应展示反馈')
  const uncomfortable = flatten(modal()).find(n => n.tag === 'input' && n.attrs.value === '2')
  uncomfortable.fire('change')
  choose('保存后看总结')
  await tick()
  assert.equal(records().at(-1).feedback, '不舒服')
  assert(flatten(modal()).some(n => n.textContent.includes('不舒服')))
  choose('回到首页')
  await tick()
  assert.equal(pushed.at(-1), '/', '练后总结应可回到品牌首页')
  const count = records().length
  assert.equal(await before(route('/'), route('/train')), true)
  assert.equal(records().length, count, '完成后退出不能额外保存 partial')

  app = new Node('div')
  const list = new Node('div'); list.className = 'body list'; app.appendChild(list)
  const card = new Node('div'); card.className = 'rec'
  card.setAttribute('data-flow-record', full.id); list.appendChild(card)
  router.currentRoute.value.path = '/record'
  for (const fn of documentListeners.DOMContentLoaded || []) fn()
  await tick()
  assert.equal(card.querySelectorAll('[data-xf-details]').length, 1)
  const details = card.querySelector('[data-xf-details]')
  observation.fn(); observation.fn(); await tick()
  assert.equal(card.querySelector('[data-xf-details]'), details, '无变化不得重复插入，防止 observer 循环')
  assert.equal(app.querySelectorAll('[data-xf-local]').length, 1)
  details.querySelector('button').fire('click')
  flatten(modal()).find(n => n.tag === 'input' && n.attrs.value === '0').fire('change')
  choose('保存后看总结'); await tick()
  assert.equal(records().at(-1).feedback, '更放松')
  assert(flatten(card).some(n => n.textContent.includes('更放松')), '补填后记录详情应刷新')
  const navigationCount = pushed.length
  choose('关闭'); await tick()
  assert.equal(pushed.length, navigationCount, '历史补填的总结关闭后应留在历史页')
  flow.showLastSummary()
  choose('再练一次'); await tick()
  assert.equal(pushed.at(-1), '/explore', '再练应先回体验选择，不直接申请摄像头')
  flow.showLastSummary()
  choose('查看历史'); await tick()
  assert.equal(pushed.at(-1), '/record')
  flow.showLastSummary()
  choose('关闭'); await tick()
  assert.equal(pushed.at(-1), '/', '练后总结关闭应回到新首页')
  assert(observation.observing)
  router.currentRoute.value.path = '/'
  app = null

  flow.writeRecords(Array.from({ length: 70 }, (_, ts) => ({ ts })))
  assert.equal(records().length, 60)
  assert.equal(records()[0].ts, 10)
  failStorage = true
  flow.begin(() => ({ moves: [0] }), () => record([0], 'partial'))
  flow.mark('manual')
  guard = before(route('/'), route('/train'))
  choose('保存进度并退出'); await tick()
  choose('返回练习，稍后重试')
  assert.equal(await guard, false)
  assert.equal(flow.canAdvance(), true)
  guard = before(route('/'), route('/train'))
  choose('保存进度并退出'); await tick()
  choose('不保存，仍然退出')
  assert.equal(await guard, true, '存储失败不能阻止用户随时退出')
  assert.equal(flow.writeRecords([]), false)
  assert(flatten(body).some(n => n.attrs.role === 'alert'))
  assert.equal(context.D4(), false)
  assert.equal(records().length, 60)
  failStorage = false
  storage.set('xianyang.records.v1', '{损坏')
  const damaged = record([0], 'partial')
  assert.equal(damaged.saved, false)
  assert.equal(storage.get('xianyang.records.v1'), '{损坏', '损坏记录不得被默默覆盖')

  assert(bundle.includes('window.XianyangFlow.mark("manual")'))
  assert(bundle.includes('window.XianyangFlow.mark("camera")'))
  assert(bundle.includes('"data-flow-record":String(o.id||o.ts)'))
  assert(bundle.includes('window.removeEventListener("xianyang:records-changed",refresh)'))
  assert(bundle.includes('function t0(){n.push("/")}'))
  assert(bundle.includes('window.XianyangFlow.installRouter(XianyangRouter)'))
  assert(!fs.readFileSync(path.join(root, 'dist/flow.js'), 'utf8').includes('innerHTML'))
  await testShell()
  testServer()
  console.log('通过：原房间保真提取、四页壳层路由、导航取消保护、手动免摄像头、真实汇总、持久偏好、移动端样式、练前守卫、partial、反馈、总结回首页、60 条上限、存储失败、损坏保护与服务安全（无网络、无监听、无浏览器）。')
}

async function testShell() {
  const source = fs.readFileSync(path.join(root, 'dist/shell.js'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'dist/shell.css'), 'utf8')
  const index = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8')
  const original = fs.readFileSync('/Users/leo/Downloads/工作文件/西客松/疗愈/xianyang-prototype.html', 'utf8')
  const image = text => text.match(/url\((data:image\/jpeg;base64,[^)]+)\)/)[1]
  assert.equal(image(css), image(original), '必须保留原实景照片的完整base64')
  const roomCSS = original.slice(original.indexOf('/* 首页 · 灰蓝立体房间'), original.indexOf('</style>'))
  assert(css.includes(roomCSS), '房间透视、倒影、动画CSS应完整复用')
  const functions = original.slice(original.indexOf('const ROOM_POEM='), original.indexOf('// 首页挂载后启动'))
  assert(source.includes(functions), '纯房间与云手展示函数应原样提取')
  const roomHTML = original.slice(original.indexOf('const FLOOR_DISK='), original.indexOf('// 房间按 1000'))
  assert(source.includes(roomHTML), '原房间HTML、三面墙与地面倒影应完整保留')
  assert(!source.includes('class XianyangEngine'))
  assert(!source.includes('getUserMedia'))
  assert(!source.includes('iframe'))
  assert(!css.includes('.shell-person{'), '不得用假插画取代原房间')
  assert(index.includes('/shell.css') && index.includes('/shell.js'))
  assert(index.indexOf('/shell.js') < index.indexOf('/assets/index-arZpQuM3.js'))
  assert(bundle.includes('window.XianyangShell.installRouter(XianyangRouter)'))
  assert(bundle.includes('path:"/",component:{render(){return null}}'))
  for (const page of ['/explore', '/culture', '/profile']) assert(bundle.includes('path:"' + page + '",component:{render(){return null}}'))
  assert(bundle.includes('XianyangManual=t.query.mode==="manual"'))
  assert(bundle.includes('XianyangManual?(o.value="",e0()'))
  assert(bundle.includes('XianyangManual?e0():O&&!O.isRunning?d()'))
  const mountStart = bundle.indexOf('Go(()=>{window.XianyangFlow.begin(')
  const mountEnd = bundle.indexOf('}),Jh', mountStart) + 2
  assert(mountStart > 0 && mountEnd > mountStart)
  const mount = bundle.slice(mountStart, mountEnd)
  for (const manual of [true, false]) {
    let cameraStarts = 0, demoStarts = 0, manualStarts = 0, mountedSessions = 0
    const mounted = vm.createContext({
      XianyangManual: manual, Go: fn => fn(),
      window: { XianyangFlow: { begin() { mountedSessions++ } } },
      Ml() {}, G2() {}, xt: { prime() {} }, S() { demoStarts++ }, d() { cameraStarts++ },
      e0() { manualStarts++ }, o: { value: '正在准备' }, D: { value: '' }
    })
    vm.runInContext(mount, mounted)
    assert.equal(mountedSessions, 1)
    assert.equal(cameraStarts, manual ? 0 : 1, '手动首次进入不得启动摄像头')
    assert.equal(demoStarts, manual ? 0 : 1, '手动模式不得自动进入预录演示')
    assert.equal(manualStarts, manual ? 1 : 0)
    if (manual) assert.equal(mounted.o.value, '', '手动模式不得残留准备遮罩')
  }

  class ShellNode extends Node {
    constructor(tag) {
      super(tag)
      this.classList = { toggle: (name, value) => { (this.classes ||= new Set()); value ? this.classes.add(name) : this.classes.delete(name) } }
    }
    contains(node) { return node === this || flatten(this).includes(node) }
    querySelector() { return null }
    querySelectorAll() { return [] }
  }
  const shellBody = new ShellNode('body'), shellApp = new ShellNode('div')
  let shellAfter
  const shellListeners = {}, shellDocumentListeners = {}
  const shellStorage = new Map()
  let shellFailure = false, animationCalls = 0
  const shellWindow = {
    XianyangFlow: { readRecords: () => [{ ts: 1, date: '<img src=x onerror=1>', complete: true, feedback: '更放松', durationMs: 60000 }] },
    addEventListener(type, fn) { (shellListeners[type] ||= []).push(fn) },
    matchMedia: () => ({ matches: true }), scrollTo() {}
  }
  const shellContext = vm.createContext({
    window: shellWindow,
    document: { body: shellBody, hidden: false, createElement: tag => new ShellNode(tag), getElementById: () => shellApp,
      addEventListener(type, fn) { (shellDocumentListeners[type] ||= []).push(fn) } },
    localStorage: { getItem: key => shellStorage.get(key) || null,
      setItem(key, value) { if (shellFailure) throw Error('存储被阻止'); shellStorage.set(key, value) } },
    requestAnimationFrame() { animationCalls++; return 1 }, cancelAnimationFrame() {}, console
  })
  vm.runInContext(source, shellContext)
  const shell = shellWindow.XianyangShell
  const summary = shell.recordSummary([
    { ts: 1, complete: true, durationMs: 60000 },
    { ts: 2, complete: true, completion: 'partial', durationMs: 30000 },
    { ts: 3, complete: false }, null
  ])
  assert.equal(summary.total, 3)
  assert.equal(summary.complete, 1)
  assert.equal(summary.durationMs, 90000)
  assert.equal(summary.timed, 2)
  assert.equal(summary.recent[0].ts, 3)
  const shellRouter = {
    currentRoute: { value: route('/explore') },
    afterEach(fn) { shellAfter = fn }, isReady: () => Promise.resolve(),
    push(target) { pushed.push(target); return Promise.resolve() }
  }
  shell.installRouter(shellRouter)
  await tick()
  const host = shellBody.children[0]
  assert.equal(shellApp.hidden, true)
  assert.equal(host.hidden, false)
  assert(host.innerHTML.includes('选择体验，去做安全确认'))
  assert(!host.innerHTML.includes('data-route="/train'))
  assert(!host.innerHTML.includes('data-route="/train?style=taiji'))
  host.querySelector = () => ({ value: 'manual' })
  host.listeners.submit[0]({ target: { id: 'shell-experience' }, preventDefault() {} })
  assert.equal(pushed.at(-1), '/train?style=baduanjin&mode=manual')
  host.querySelector = () => null
  const exploration = host.innerHTML
  shellAfter(route('/train'), route('/explore'), { type: 4 })
  assert.equal(host.innerHTML, exploration, '取消安全确认不能隐藏壳层')
  shellAfter(route('/train'), route('/explore'))
  assert.equal(shellApp.hidden, false)
  assert.equal(host.hidden, true)
  shellAfter(route('/profile'), route('/train'), { type: 4 })
  assert.equal(host.hidden, true, '取消训练退出不得提前显示我的练习')
  shellRouter.currentRoute.value = route('/profile')
  shellAfter(route('/profile'), route('/train'))
  assert(host.innerHTML.includes('&lt;img src=x onerror=1&gt;'))
  assert(!host.innerHTML.includes('<img src=x'))
  assert(host.innerHTML.includes('data-route="/record"'))
  assert(host.innerHTML.includes('data-pref="reduceMotion"'))

  const status = {}, modeControl = { value: 'camera', getAttribute: () => 'mode' }
  host.querySelector = selector => selector === '#shell-preference-status' ? status : null
  host.listeners.change[0]({ target: modeControl })
  assert.equal(JSON.parse(shellStorage.get('xianyang.shell.preferences.v1')).mode, 'camera')
  assert(status.textContent.includes('已保存'))
  shellFailure = true
  modeControl.value = 'manual'
  host.listeners.change[0]({ target: modeControl })
  assert.equal(modeControl.value, 'camera', '存储失败应恢复已保存偏好')
  assert(status.textContent.includes('未保存'))
  shellFailure = false
  shellStorage.set('xianyang.shell.preferences.v1', '{损坏')
  modeControl.value = 'manual'
  host.listeners.change[0]({ target: modeControl })
  assert.equal(shellStorage.get('xianyang.shell.preferences.v1'), '{损坏')
  shellStorage.delete('xianyang.shell.preferences.v1')
  const reduceControl = { checked: true, getAttribute: () => 'reduceMotion' }
  host.listeners.change[0]({ target: reduceControl })
  assert.equal(JSON.parse(shellStorage.get('xianyang.shell.preferences.v1')).reduceMotion, true)
  assert(host.classes.has('reduce'))
  shellAfter(route('/'), route('/profile'))
  assert(host.innerHTML.includes('class="room-photo"'))
  assert(host.innerHTML.includes('拨一弦，留一刻。'))
  assert.equal(animationCalls, 0)
  assert(css.includes('body.shell-active') && css.includes('overflow:auto'))
  assert(css.includes('[hidden]{display:none!important}'))
  assert(css.includes('@media(max-width:800px)'))
  assert(css.includes('prefers-reduced-motion:reduce'))
}

function testServer() {
  let handler, binding, opened
  const serverContext = vm.createContext({
    __dirname: root, process: { argv: [] }, console: { log() {} },
    require(name) {
      if (name === 'path') return path
      if (name === 'http') return { createServer(fn) { handler = fn; return { listen(port, host) { binding = host } } } }
      if (name === 'fs') return {
        existsSync(file) { return file.endsWith('.ogg') || file.endsWith('index.html') || file.endsWith('outside.js') },
        statSync() { return { isDirectory: () => false } },
        realpathSync(file) { return file.endsWith('outside.js') ? path.join(root, 'private.js') : file },
        createReadStream(file) { opened = file; return { pipe() {} } }
      }
      throw Error('非预期模块')
    }
  })
  vm.runInContext(fs.readFileSync(path.join(root, 'server.cjs'), 'utf8'), serverContext)
  assert.equal(binding, '127.0.0.1')
  function request(url) {
    const response = { writeHead(code, headers) { this.code = code; this.headers = headers }, end(text) { this.text = text } }
    handler({ url }, response)
    return response
  }
  assert.equal(request('/../dist-other/private.js').code, 403)
  assert.equal(request('/%2e%2e/server.cjs').code, 403)
  assert.equal(request('/outside.js').code, 403)
  const escaped = request('/%3Cimg%20src=x%20onerror=1%3E.js')
  assert.equal(escaped.code, 404)
  assert(!escaped.text.includes('<img'))
  assert(escaped.text.includes('&lt;img'))
  assert.equal(request('/guqin/test.ogg').headers['Content-Type'], 'audio/ogg')
  assert(opened.endsWith('test.ogg'))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
