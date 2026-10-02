<template>
  <div class="panel-wrap">
    <!-- 顶栏入口 -->
    <button class="gear" @click="open = !open" :class="{ on: open }" title="摄像头设置">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
      </svg>
    </button>

    <!-- 设置面板：常驻 DOM，用 CSS 控制显隐（切换零延迟，且可被 SSR 断言） -->
    <div class="panel" :class="{ show: open }" :aria-hidden="!open">
        <div class="panel-title">摄像头与识别设置</div>

        <label class="field">
          <span class="field-label">摄像头</span>
          <div class="row">
            <select v-model="selectedId" @change="onDevice" class="sel" :disabled="cams.length < 2 || busy">
              <option v-for="c in cams" :key="c.deviceId" :value="c.deviceId">{{ c.label }}</option>
            </select>
            <button class="mini" @click="refresh(true)" :disabled="busy" title="重新扫描设备">↻</button>
          </div>
          <span v-if="cams.length < 2" class="hint">只检测到 1 个摄像头</span>
        </label>

        <label class="field">
          <span class="field-label">取景比例</span>
          <select v-model="frameId" @change="onFrame" class="sel" :disabled="busy">
            <option v-for="f in FRAMES" :key="f.id" :value="f.id">{{ f.label }}</option>
          </select>
          <span class="hint">{{ FRAME_HINT[frameId] }}</span>
        </label>

        <label class="field">
          <span class="field-label">分辨率</span>
          <select v-model="resId" @change="onRes" class="sel" :disabled="busy">
            <option v-for="r in RESOLUTIONS" :key="r.id" :value="r.id">{{ r.label }}</option>
          </select>
          <span v-if="actual" class="hint">实际输出 {{ actual }}</span>
        </label>

        <div class="field">
          <span class="field-label">识别参数</span>
          <div class="slider-row">
            <span>灵敏度</span>
            <input type="range" min="0.35" max="0.80" step="0.01" v-model.number="threshold" :disabled="busy" />
            <b>{{ threshold.toFixed(2) }}</b>
          </div>
          <div class="slider-row">
            <span>保持帧数</span>
            <input type="range" min="4" max="26" step="1" v-model.number="holdFrames" :disabled="busy" />
            <b>{{ holdFrames }}</b>
          </div>
          <div class="hint">灵敏度越低越容易触发；保持帧数越高越不容易被抖动误触发</div>
        </div>

        <div class="field">
          <span class="field-label">画面</span>
          <label class="chk"><input type="checkbox" v-model="mirror" :disabled="busy" /> 镜像画面（照镜子）</label>
        </div>

        <div class="panel-foot">
          <span v-if="busy" class="busy">切换中…</span>
          <button class="mini wide" @click="$emit('reset-all')">恢复默认</button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { listCameras, invalidateCameraCache, RESOLUTIONS, FRAMES, FRAME_HINT } from '../engine/poseEngine'

const props = defineProps({
  threshold: { type: Number, required: true },
  holdFrames: { type: Number, required: true },
  resetTick: { type: Number, default: 0 },   // 父组件点「恢复默认」时自增，用来同步组件内状态
})
const emit = defineEmits(['device', 'resolution', 'frame', 'threshold', 'hold-frames', 'mirror', 'reset-all', 'cams'])

const open = ref(false)
const busy = ref(false)
const cams = ref([])
const selectedId = ref('')
const resId = ref(RESOLUTIONS[0].id)
const frameId = ref(FRAMES[1].id)
const actual = ref('')
const mirror = ref(true)
const threshold = ref(props.threshold)
const holdFrames = ref(props.holdFrames)

async function refresh(force = false) {
  // 由父组件在摄像头就绪后调用（refresh()），面板内的「↻」传 force=true 强制重扫。
  // 不在 onMounted 里自动调 —— 会与父组件的 listCameras() 并发请求权限，
  // 导致 getUserMedia 抢流并触发 video.play() 的 AbortError（真机实测踩过）。
  busy.value = true
  try {
    if (force) invalidateCameraCache()
    const list = await listCameras()
    cams.value = list
    emit('cams', list)
    if (list.length) {
      const saved = safeGet('xianyang.deviceId')
      const pick = list.find((c) => c.deviceId === saved) || list[0]
      if (pick.deviceId !== selectedId.value) selectedId.value = pick.deviceId
    }
  } finally {
    busy.value = false
  }
}
function safeGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function onDevice() { emit('device', selectedId.value) }
function onRes() { emit('resolution', resId.value) }
function onFrame() { emit('frame', frameId.value) }
function setActual(text) { actual.value = text }
function setBusy(v) { busy.value = v }

watch(() => props.threshold, (v) => (threshold.value = v))
watch(() => props.holdFrames, (v) => (holdFrames.value = v))
// 「恢复默认」时父组件会把 threshold/holdFrames 重置，镜像由组件自己同步回 true
watch(() => props.resetTick, () => { mirror.value = true; resId.value = RESOLUTIONS[0].id; frameId.value = FRAMES[1].id })
watch(threshold, (v) => emit('threshold', v))
watch(holdFrames, (v) => emit('hold-frames', v))
watch(mirror, (v) => emit('mirror', v))

defineExpose({ refresh, setActual, setBusy })
</script>

<style scoped>
.panel-wrap { position: relative; }
.gear {
  width: 32px; height: 32px; border-radius: 8px; color: var(--xuan-dim);
  display: grid; place-items: center; transition: all .15s;
}
.gear:hover { background: rgba(232,224,208,.08); color: var(--xuan); }
.gear.on { background: rgba(200,85,61,.2); color: var(--zhu); }

.panel {
  position: absolute; right: 0; top: 40px; z-index: 30;
  width: 282px; padding: 15px;
  background: rgba(24,20,16,.97);
  border: 1px solid rgba(232,224,208,.14);
  border-radius: var(--r-m);
  box-shadow: 0 14px 44px rgba(0,0,0,.6);
  /* 常驻 DOM，用 opacity/visibility 显隐：切换零延迟，且 SSR 能渲染出来供断言 */
  opacity: 0; visibility: hidden; transform: translateY(-6px);
  transition: opacity .14s, transform .14s, visibility .14s;
}
.panel.show { opacity: 1; visibility: visible; transform: translateY(0); }

.panel-title { font-size: 13px; letter-spacing: 1px; margin-bottom: 13px; color: var(--xuan); }
.field { display: block; margin-bottom: 14px; }
.field-label { display: block; font-size: 11px; color: var(--xuan-faint); margin-bottom: 6px; font-family: var(--font-ui); }
.row { display: flex; gap: 6px; }
.sel {
  flex: 1; min-width: 0; padding: 7px 9px; font-size: 12px;
  background: var(--ink-3); color: var(--xuan);
  border: 1px solid rgba(232,224,208,.14); border-radius: 7px;
  font-family: var(--font-ui);
}
.sel:disabled { opacity: .5; }
.mini {
  padding: 6px 10px; font-size: 12px; border-radius: 7px;
  background: var(--ink-3); color: var(--xuan-dim);
  border: 1px solid rgba(232,224,208,.14); font-family: var(--font-ui);
}
.mini:hover { color: var(--xuan); }
.mini.wide { width: 100%; }
.hint { display: block; font-size: 10.5px; color: var(--xuan-faint); margin-top: 5px; font-family: var(--font-ui); line-height: 1.5; }

.slider-row { display: flex; align-items: center; gap: 9px; font-size: 11.5px; color: var(--xuan-dim); margin-bottom: 7px; font-family: var(--font-ui); }
.slider-row span { flex: 0 0 52px; }
.slider-row input { flex: 1; accent-color: var(--zhu); }
.slider-row b { flex: 0 0 34px; text-align: right; color: var(--jin); font-weight: 400; }

.chk { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); cursor: pointer; }
.chk input { accent-color: var(--zhu); }

.panel-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid rgba(232,224,208,.08); }
.busy { font-size: 11px; color: var(--jin); font-family: var(--font-ui); }
</style>
