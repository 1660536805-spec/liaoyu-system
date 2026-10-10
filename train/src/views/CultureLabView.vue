<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="go('/')">← 首页</button>
      <h1>文化内核实验室</h1>
      <div class="spacer"></div>
      <span class="ver">Culture API v{{ VERSION }}</span>
    </div>

    <div class="body">
      <p class="lead">
        把<strong>五音疗愈 / 子午流注 / 节气食养 / 体质功法 / 和香</strong>五套传统学说，
        数字化成同一形状的数据与规则；一张处方（音疗 · 功法 · 香事 · 食养）再经
        <strong>可插拔总线</strong>落到具体硬件上——换设备只换适配器，内核一行不改。
      </p>

      <!-- ① 处方引擎 -->
      <div class="panel">
        <div class="ph"><b>① 处方引擎</b><span class="sub">体质 × 时辰 × 目标 × 强度 → 一张可执行的方案</span></div>

        <div class="form">
          <label><span>体质</span>
            <select v-model="form.constitution">
              <option v-for="c in CONSTITUTION" :key="c.key" :value="c.key">{{ c.name }}（{{ c.tag }}）</option>
            </select>
          </label>
          <label><span>时辰</span>
            <select v-model="form.shichen">
              <option value="now">此刻（{{ nowShichen }}）</option>
              <option v-for="s in SHICHEN" :key="s.key" :value="s.key">{{ s.name }} {{ s.range }} · {{ s.zang }}·{{ s.jing }}</option>
            </select>
          </label>
          <label><span>目标</span>
            <select v-model="form.goal">
              <option v-for="g in GOALS" :key="g.key" :value="g.key">{{ g.name }}</option>
            </select>
          </label>
          <label><span>强度</span>
            <select v-model="strengthRaw">
              <option value="1">入门</option>
              <option value="2">进阶</option>
              <option value="3">强化</option>
            </select>
          </label>
        </div>

        <div class="row">
          <button class="btn primary" @click="gen">生成处方</button>
          <button class="btn" @click="applyAll" :disabled="!rx">一键落地到硬件</button>
          <button class="btn ghost" @click="copyJson" :disabled="!rx">复制 JSON</button>
          <span class="tip">{{ copyTip }}</span>
        </div>

        <div v-if="rx" class="rx">
          <div class="kv">
            <div class="k"><span>音疗</span><b>{{ rx.tone.name }}调</b><em>{{ rx.tone.feel }} · {{ rx.tone.element }}·{{ rx.tone.organ }}</em></div>
            <div class="k"><span>功法</span><b>{{ rx.moves.level }}</b><em>第 {{ rx.moves.sequence.join('、') }} 式（{{ rx.moves.core }}）</em></div>
            <div class="k"><span>香事</span><b>{{ rx.xiang ? rx.xiang.name : '未启用' }}</b><em>{{ rx.xiang ? rx.xiang.layer : '无硬件时可直接跳过' }}</em></div>
            <div class="k"><span>食养</span><b>{{ rx.jieqi.name }}</b><em>{{ rx.food.yi }}；忌{{ rx.food.ji }}</em></div>
          </div>
          <p class="lead min">{{ rx.lead }}</p>
          <pre class="json">{{ jsonText }}</pre>
        </div>
        <p v-else class="hintline">先在上面选好条件，点「生成处方」——全过程纯本地计算，不联网、不上传。</p>
      </div>

      <!-- ② 内核知识表 -->
      <div class="panel">
        <div class="ph"><b>② 内核知识表</b><span class="sub">传统学说 → 同一形状的数组，上层只认一种数据结构</span></div>
        <div class="seg">
          <button v-for="k in DICTS" :key="k.key" :class="{ on: dict === k.key }" @click="dict = k.key">{{ k.name }}</button>
        </div>
        <div class="tbwrap">
          <table class="tb">
            <thead><tr><th v-for="(h, i) in dictHead" :key="i">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in dictRows" :key="i">
                <td v-for="(h, j) in dictHead" :key="j" v-html="cell(r, j)"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ③ 可插拔总线 -->
      <div class="panel">
        <div class="ph"><b>③ 可插拔硬件总线</b><span class="sub">换设备 = 换一个适配器；内核与处方引擎零改动</span></div>

        <div class="adapters">
          <div class="ad" v-for="a in adapters" :key="a.id" :class="{ live: a.live }">
            <div class="ad-h">
              <span class="led" :class="{ on: a.live }"></span>
              <b>{{ a.id }}</b>
              <code>{{ a.transport }}</code>
            </div>
            <div class="caps">{{ a.caps.join(' · ') }}</div>
            <div class="ad-d">{{ a.docs }}</div>
            <div class="row tight">
              <button v-if="!a.live" class="btn sm" @click="doConnect(a.id)">连接</button>
              <button v-else class="btn ghost sm" @click="doDisconnect(a.id)">断开</button>
              <button class="btn ghost sm" @click="doProbe(a.id)">读状态</button>
            </div>
          </div>
        </div>

        <div class="row tight wrap">
          <span class="lbl">指令速发</span>
          <button class="btn ghost sm" @click="quick('audio.guqin', 'playTone', { toneKey: 'gong' })">出声「宫」</button>
          <button class="btn ghost sm" @click="quick('audio.guqin', 'stop')">停声</button>
          <button class="btn ghost sm" @click="quick('aroma.link2', 'mist', { level: 2 })">雾化 2 档</button>
          <button class="btn ghost sm" @click="quick('aroma.link2', 'timer', { minutes: 30 })">定时 30 分</button>
          <button class="btn ghost sm" @click="quick('light.ambiance', 'set', { hue: 'warm', bright: 35 })">暖暗灯</button>
          <button class="btn ghost sm" @click="quick('pose.mediapipe', 'start')">启动动作识别</button>
        </div>

        <div class="log">
          <div class="lg" v-for="l in logs" :key="l.seq" :class="l.level">
            <span class="t">{{ l.t }}</span><span class="g">{{ l.tag }}</span><span class="m">{{ l.msg }}</span>
          </div>
          <div v-if="!logs.length" class="lg trace"><span class="m">—— 暂无事件，点上面的按钮试试 ——</span></div>
        </div>
      </div>

      <!-- ④ 内核自检 -->
      <div class="panel">
        <div class="ph"><b>④ 内核自检</b><span class="sub">纯函数在 node 与浏览器里跑同一批断言</span></div>
        <div class="row tight">
          <button class="btn ghost sm" @click="runSelf">跑一遍</button>
          <span class="tip">{{ selfTip }}</span>
        </div>
        <pre class="json self">{{ selfText }}</pre>
      </div>

      <div class="foot">
        <b>文化内核是怎么数字化的</b>：五套学说各自拆成「表（实体属性）+ 规则（如何由输入推到输出）」，
        五张表统一为 <code>{ key, name, ... }[]</code> 形状；再由 <code>prescribe()</code> 一条编排规则
        把「体质 + 时辰 + 目标 + 强度」映射成一张处方，界面只认这张处方，不认识任何单层知识。<br />
        <b>怎么可插拔接入硬件与场景</b>：总线只定义一条契约
        <code>connect / disconnect / commands[cmd]</code>，任何设备实现它就插得上；
        适配器内部怎么走（Web Audio / 蓝牙 / WiFi / WASM）由厂商自己决定，
        <code>stepsFromPrescription()</code> 是内核与硬件之间唯一的胶水——换硬件只改这一处。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { safeCopy } from '../data/tones.js'
import {
  prescribe, query, apply as applyRx, connect, disconnect, control,
  status, selfTest, VERSION,
} from '../culture/api.js'
import { logLines, clearLog } from '../culture/plug.js'

const router = useRouter()
function go(p) { router.push(p) }

/* ---------- ① 处方引擎 ---------- */
const form = reactive({ constitution: 'qixu', shichen: 'now', goal: 'soothe' })
const strengthRaw = ref('2')
const CONSTITUTION = query('constitution')
const GOALS = query('goals')
const SHICHEN = query('shichen')

const rx = ref(null)
const jsonText = computed(() => (rx.value ? JSON.stringify(rx.value, null, 2) : ''))
const copyTip = ref('')

function gen() {
  const sc = SHICHEN.find((s) => s.key === form.shichen)
  const isNow = form.shichen === 'now'
  rx.value = prescribe({
    constitution: form.constitution,
    goal: form.goal,
    strength: Number(strengthRaw.value) || 1,
    // 选了固定时辰时，用同一天把小时钉住；「此刻」不传 date，内核自己取当前时间
    date: !isNow && sc ? `2026-10-04T${String(sc.start).padStart(2, '0')}:00:00` : undefined,
  })
}

async function applyAll() {
  if (!rx.value) return
  await applyRx(rx.value)
  refresh()
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonText.value)
    copyTip.value = '已复制，可直接贴给后端 / 队友'
  } catch (e) {
    copyTip.value = '浏览器不给剪贴板权限，请手动选中下面那段复制'
  }
  setTimeout(() => { copyTip.value = '' }, 2400)
}

/* ---------- ② 内核知识表 ---------- */
const dict = ref('tones')
const DICTS = [
  { key: 'tones', name: '五音疗愈' },
  { key: 'shichen', name: '子午流注' },
  { key: 'jieqi', name: '节气食养' },
  { key: 'constitution', name: '九种体质' },
  { key: 'xiang', name: '和香配方' },
]
const DICT_HEAD = {
  tones: ['调式', '五行', '对应', '听感'],
  shichen: ['时辰', '当令', '经络', '宜', '忌'],
  jieqi: ['节气', '日期', '宜', '忌', '当令食材'],
  constitution: ['体质', '特征', '要点', '入门', '强化'],
  xiang: ['香方', '香材', '香气层', '适配'],
}
const DICT_ROWS = {
  tones: () => query('tones').map((t) => [t.name, t.element, t.organ, t.feel, t.ds]),
  shichen: () => query('shichen').map((s) => [s.name, s.zang, s.jing, s.yi, s.ji]),
  jieqi: () => query('jieqi').map((j) => [j.name, j.span, j.yi, j.ji, j.food.join('、')]),
  constitution: () => query('constitution').map((c) => [c.name, c.tag, c.core, c.ladder[0].join('·'), c.ladder[2].join('·')]),
  xiang: () => query('xiang').map((x) => [x.name, x.mate.map((m) => m.join(':')).join(' / '), x.layer, x.fit.join('、')]),
}
const dictHead = computed(() => DICT_HEAD[dict.value])
const dictRows = computed(() => DICT_ROWS[dict.value]())
/** 单元格过一遍合规兜底再渲染（view 层手写模板改漏一处就会漏出禁词） */
function cell(row, idx) {
  return safeCopy(String(row[idx] == null ? '—' : row[idx]))
}

/* ---------- ③ 可插拔总线 ---------- */
const adapters = ref([])
const logs = ref([])

function doConnect(id) { return connect(id) }
function doDisconnect(id) { return disconnect(id) }
function doProbe(id) { return quick(id, 'read') }

function refresh() {
  adapters.value = status()
  logs.value = logLines().slice(-60).reverse()
}

async function quick(id, cmd, payload) {
  await control(id, cmd, payload)
  refresh()
}

let timer = null

/* ---------- ④ 内核自检 ---------- */
const selfTip = ref('')
const selfText = ref('点「跑一遍」生成结果')
function runSelf() {
  const rs = selfTest()
  const bad = rs.filter((r) => !r[1]).length
  selfTip.value = bad ? `${bad} 项未通过` : `${rs.length} 项全部通过`
  selfText.value = rs.map((r) => (r[1] ? '✓ ' : '✗ ') + r[0]).join('\n')
}

/* ---------- 生命周期 ---------- */
const nowShichen = ref('')
onMounted(() => {
  clearLog()
  const d = new Date()
  const sc = SHICHEN[Math.floor((d.getHours() + 1) / 2) % 12]
  nowShichen.value = `${sc.name} ${sc.range} · ${sc.zang}`
  refresh()
  timer = setInterval(refresh, 600)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.wrap { min-height: 100%; }
.topbar {
  display: flex; align-items: center; gap: 10px;
  padding: calc(var(--safe-t) + 14px) 18px 10px;
}
.topbar h1 { font-size: 19px; margin: 0; color: var(--brown-dark); font-family: var(--font-serif); letter-spacing: .04em; }
.topbar .spacer { flex: 1; }
.ver { font-size: 11px; color: var(--ink-light); font-family: ui-monospace, monospace; }
.body { padding: 4px 16px var(--body-pad-b); display: flex; flex-direction: column; gap: 14px; max-width: var(--shell-w); margin: 0 auto; }
.lead { font-size: 13.5px; line-height: 1.85; color: var(--xuan); margin: 0 0 2px; }
.lead.min { font-size: 12.5px; margin: 10px 0 0; }

.panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--r-m); padding: 14px 14px 16px; box-shadow: var(--shadow-s);
}
.ph { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.ph b { font-size: 14.5px; color: var(--brown-dark); font-family: var(--font-serif); }
.sub { font-size: 11.5px; color: var(--ink-light); }

.form { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 12px; }
.form label { display: flex; flex-direction: column; gap: 5px; }
.form span { font-size: 11.5px; color: var(--ink-light); }
.form select {
  font: inherit; color: var(--xuan); background: var(--ink-2);
  border: 1px solid var(--border); border-radius: var(--r-s);
  padding: 9px 11px; min-height: var(--tap); font-size: 13px;
}
.btn {
  font: inherit; color: var(--xuan); background: var(--ink-2);
  border: 1px solid var(--border); border-radius: var(--r-s);
  padding: 9px 11px; min-height: var(--tap);
}
.btn.ghost { background: transparent; }
.btn.sm { min-height: 36px; padding: 6px 10px; font-size: 12.5px; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.row.tight { margin-top: 6px; }
.row.wrap { gap: 6px; }
.lbl { font-size: 12px; color: var(--xuan-dim); }
.tip { font-size: 11.5px; color: var(--ink-light); }

.rx { margin-top: 12px; }
.kv { display: grid; gap: 8px; }
.k { display: grid; grid-template-columns: 46px 1fr; gap: 6px 10px; align-items: baseline; font-size: 13px; }
.k span { font-size: 11.5px; color: var(--ink-light); }
.k b { color: var(--zhu); font-weight: 600; }
.k em { font-style: normal; color: var(--xuan); opacity: .82; font-size: 12.5px; }

.json {
  margin: 12px 0 0; padding: 11px 12px; max-height: 300px; overflow: auto;
  background: var(--ink-3); border: 1px solid var(--border); border-radius: var(--r-s);
  font-size: 11.5px; line-height: 1.6; color: var(--brown);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; white-space: pre-wrap; word-break: break-all;
}
.json.self { max-height: 180px; }

.seg { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.seg button { padding: 7px 12px; min-height: 34px; font-size: 12.5px; background: var(--ink-2); border: 1px solid var(--border); border-radius: var(--r-s); color: var(--xuan); font: inherit; }
.seg button.on { background: var(--zhu); color: #fff; border-color: var(--zhu); }

.tbwrap { overflow: auto; border: 1px solid var(--border); border-radius: var(--r-s); }
.tb { width: 100%; border-collapse: collapse; font-size: 12px; }
.tb th { background: var(--ink-3); color: var(--brown); text-align: left; padding: 8px 9px; font-weight: 600; white-space: nowrap; position: sticky; top: 0; }
.tb td { padding: 7px 9px; border-top: 1px solid var(--qing); color: var(--xuan); vertical-align: top; }
.tb tr:nth-child(even) td { background: rgba(255, 255, 255, .5); }

.adapters { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.ad { border: 1px dashed var(--border); border-radius: var(--r-s); padding: 10px 11px; background: var(--ink-2); }
.ad.live { border-style: solid; border-color: var(--green); background: var(--green-light); }
.ad-h { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ad-h b { font-size: 12.5px; color: var(--brown-dark); font-family: ui-monospace, monospace; }
.ad-h code { font-size: 10.5px; color: var(--ink-light); }
.led { width: 8px; height: 8px; border-radius: 50%; background: var(--qing); flex: 0 0 auto; }
.led.on { background: var(--green); box-shadow: 0 0 0 3px rgba(94, 124, 107, .18); }
.caps { margin-top: 5px; font-size: 11px; color: var(--jin); font-family: ui-monospace, monospace; }
.ad-d { margin-top: 5px; font-size: 11.5px; color: var(--xuan-dim); line-height: 1.6; }

.log { margin-top: 10px; max-height: 168px; overflow: auto; background: var(--ink-3); border: 1px solid var(--border); border-radius: var(--r-s); padding: 8px 10px; }
.lg { display: flex; gap: 8px; font-size: 11.5px; line-height: 1.75; font-family: ui-monospace, monospace; }
.lg .t { color: var(--ink-light); flex: 0 0 auto; }
.lg .g { color: var(--jin); flex: 0 0 auto; min-width: 92px; }
.lg .m { color: var(--xuan); }
.lg.ok .m { color: var(--green-dark); }
.lg.warn .m { color: var(--zhu); }
.lg.cmd .m { color: var(--brown-dark); }

.hintline { font-size: 12px; color: var(--ink-light); margin: 10px 0 0; }
.foot { font-size: 12.5px; line-height: 1.9; color: var(--xuan); padding: 2px 2px 8px; }
.foot code { font-family: ui-monospace, monospace; font-size: 11.5px; background: var(--ink-3); padding: 1px 5px; border-radius: 5px; }

@media (min-width: 900px) {
  .topbar { padding-left: 24px; }
  .body { padding-left: 24px; padding-right: 24px; }
}
</style>
