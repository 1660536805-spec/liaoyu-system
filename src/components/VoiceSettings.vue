<template>
  <div class="voice-sec">
    <div class="vs-head">
      <span class="vs-title">语音提示</span>
      <label class="switch">
        <input type="checkbox" :checked="local.enabled" @change="toggle" />
        <span class="track"><span class="knob"></span></span>
      </label>
    </div>

    <p class="vs-desc">动作切换时自动报出「第 N 式 + 简称 + 要领」，可闭眼跟练</p>

    <!-- 引擎状态 -->
    <div class="vs-engine" :class="engineClass">
      <span class="dot"></span>
      <span>{{ engineText }}</span>
      <button v-if="local.engineMode !== 'off' && s.kokoroStatus !== 'ready'"
              class="mini" :disabled="s.kokoroStatus === 'loading'" @click="loadOffline">
        {{ s.kokoroStatus === 'loading' ? `下载中 ${pct}%` : '加载离线语音' }}
      </button>
      <button v-else-if="s.kokoroStatus === 'ready'" class="mini ghost" @click="test">试听</button>
    </div>
    <p class="vs-hint" v-if="s.kokoroError">离线语音不可用：{{ s.kokoroError }}，已回退系统语音</p>

    <template v-if="local.enabled">
      <label class="field">
        <span class="field-label">语音来源</span>
        <select v-model="local.engineMode" class="sel" @change="apply">
          <option value="auto">自动（推荐）</option>
          <option value="webspeech">系统语音（即时可用）</option>
          <option value="kokoro">离线语音（音质更好）</option>
          <option value="off">静音</option>
        </select>
      </label>

      <div class="field">
        <span class="field-label">音量</span>
        <div class="slider-row">
          <input type="range" min="0" max="1" step="0.05"
                 :value="local.volume" @input="setVol" />
          <b>{{ Math.round(local.volume * 100) }}</b>
        </div>
      </div>

      <div class="field">
        <span class="field-label">语速</span>
        <div class="slider-row">
          <input type="range" min="0.6" max="1.6" step="0.05"
                 :value="local.rate" @input="setRate" />
          <b>{{ local.rate.toFixed(2) }}×</b>
        </div>
        <div class="hint">练八段锦建议 0.9~1.1，太快跟不上动作</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { previewText } from '../data/speech.js'

const props = defineProps({
  speaker: { type: Object, required: true },      // voice.js 实例
  announcer: { type: Object, required: true },    // announcer.js 实例
  currentId: { type: Number, default: 1 },
  total: { type: Number, default: 8 },
})
const emit = defineEmits(['change'])

const s = ref({ ...props.speaker.state })
const pct = ref(0)
const local = reactive({ enabled: false, volume: 0.9, rate: 1.0, engineMode: 'auto' })

props.speaker.on('state', (st) => { s.value = { ...st } })

// 从 localStorage 恢复（刷新/中断后保持设置）
try {
  const saved = JSON.parse(localStorage.getItem('xianyang.voice') || '{}')
  Object.assign(local, saved)
  if (local.enabled) {
    props.speaker.set({ enabled: true, volume: local.volume, rate: local.rate, engineMode: local.engineMode })
  }
} catch { /* file:// 下不可写，忽略 */ }

const engineText = computed(() => {
  if (!local.enabled) return '已关闭'
  if (s.value.kokoroStatus === 'ready') return '离线语音（音质好，断网可用）'
  if (s.value.kokoroStatus === 'loading') return `离线语音下载中 ${pct.value}%`
  if (s.value.webReady) return '系统语音（即时可用）'
  return '本机无可用中文语音，将静默'
})
const engineClass = computed(() => {
  if (!local.enabled) return 'off'
  if (s.value.kokoroStatus === 'ready' || s.value.webReady) return 'ok'
  return 'bad'
})

function persist() {
  try { localStorage.setItem('xianyang.voice', JSON.stringify(local)) } catch { /* ignore */ }
  emit('change', { ...local })
}
function apply() { props.speaker.set({ volume: local.volume, rate: local.rate, engineMode: local.engineMode }); props.announcer.refresh(); persist() }
function toggle(e) {
  local.enabled = e.target.checked
  props.speaker.set({ enabled: local.enabled })
  if (local.enabled) { props.announcer.prime(); props.announcer.repeat(props.currentId, props.total) }
  persist()
}
function setVol(e) { local.volume = Number(e.target.value); props.speaker.set({ volume: local.volume }); persist() }
function setRate(e) { local.rate = Number(e.target.value); props.speaker.set({ rate: local.rate }); persist() }
async function loadOffline() {
  pct.value = 0
  const ok = await props.speaker.preloadKokoro((p) => { pct.value = p })
  props.announcer.refresh()
  if (ok) props.announcer.repeat(props.currentId, props.total)
}
function test() { props.announcer.repeat(props.currentId, props.total) }

watch(() => props.currentId, (v) => { if (local.enabled) props.announcer.repeat(v, props.total) })
defineExpose({ previewText })
</script>

<style scoped>
.voice-sec { padding-top: 14px; margin-top: 12px; border-top: 1px solid rgba(232,224,208,.08); }
.vs-head { display: flex; align-items: center; justify-content: space-between; }
.vs-title { font-size: 13px; color: var(--xuan); letter-spacing: 1px; }
.vs-desc { font-size: 11px; color: var(--xuan-faint); margin: 6px 0 10px; font-family: var(--font-ui); line-height: 1.6; }

.switch input { display: none; }
.track {
  display: block; width: 38px; height: 21px; border-radius: 11px;
  background: rgba(232,224,208,.14); position: relative; transition: background .18s; cursor: pointer;
}
.knob {
  position: absolute; left: 3px; top: 3px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--xuan-faint); transition: transform .18s, background .18s;
}
.switch input:checked + .track { background: rgba(200,85,61,.55); }
.switch input:checked + .track .knob { transform: translateX(17px); background: #fff; }

.vs-engine {
  display: flex; align-items: center; gap: 7px; font-size: 11px;
  color: var(--xuan-dim); font-family: var(--font-ui);
  background: rgba(232,224,208,.04); padding: 6px 9px; border-radius: 8px; margin-bottom: 10px;
}
.vs-engine .dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; background: var(--xuan-faint); }
.vs-engine.ok .dot { background: #7fb069; }
.vs-engine.bad .dot { background: var(--zhu); }
.vs-engine.off .dot { background: var(--xuan-faint); }
.vs-hint { font-size: 10px; color: #c8553d; margin: -4px 0 8px; font-family: var(--font-ui); line-height: 1.5; }

.mini {
  margin-left: auto; padding: 3px 8px; font-size: 10.5px; border-radius: 6px;
  background: var(--zhu); color: #fff; border: none; font-family: var(--font-ui);
}
.mini:disabled { opacity: .55; }
.mini.ghost { background: rgba(232,224,208,.1); color: var(--xuan-dim); }

.field { display: block; margin-bottom: 11px; }
.field-label { display: block; font-size: 11px; color: var(--xuan-faint); margin-bottom: 5px; font-family: var(--font-ui); }
.sel {
  width: 100%; padding: 6px 8px; font-size: 12px;
  background: var(--ink-3); color: var(--xuan);
  border: 1px solid rgba(232,224,208,.14); border-radius: 7px; font-family: var(--font-ui);
}
.slider-row { display: flex; align-items: center; gap: 9px; }
.slider-row input { flex: 1; accent-color: var(--zhu); }
.slider-row b { flex: 0 0 36px; text-align: right; color: var(--jin); font-weight: 400; font-size: 11px; }
.hint { display: block; font-size: 10.5px; color: var(--xuan-faint); margin-top: 5px; font-family: var(--font-ui); line-height: 1.5; }
</style>
