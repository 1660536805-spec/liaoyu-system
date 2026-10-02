<template>
  <div class="wrap">
    <div class="body home">
      <div class="hero">
        <div class="brand">弦养</div>
        <div class="tagline">练完一套 · 弹完一曲古琴</div>
      </div>

      <!-- 拳种选择：八段锦/五禽戏已上线，太极仅起势可用 -->
      <div class="styles">
        <button
          v-for="st in STYLE_LIST" :key="st.id"
          class="style" :class="{ on: styleId === st.id, partial: st.status === 'partial' }"
          :disabled="!st.moves.length"
          :title="st.moves.length ? st.desc : st.pendingReason"
          @click="pick(st)"
        >
          <div class="style-name">
            {{ st.name }}
            <span v-if="st.status !== 'ready'" class="style-badge">{{ st.badge }}</span>
          </div>
          <div class="style-sub">{{ st.moves.length ? st.moves.length + ' 式 · ' + st.subtitle.split('· ').pop() : st.subtitle }}</div>
          <div class="style-pending-note" v-if="st.status === 'partial'">{{ st.pendingReason }}</div>
        </button>
      </div>

      <button class="big-btn" @click="start" :disabled="!cur">
        <span class="big-btn-label">开始练</span>
        <span class="big-btn-sub">{{ cur ? cur.name + ' · ' + cur.moves.length + ' 式 · 约 ' + Math.ceil(cur.moves.length * 0.5) + ' 分钟' : '暂无可练拳种' }}</span>
      </button>

      <p class="style-desc" v-if="cur">{{ cur.desc }}</p>
      <p class="style-pending" v-for="st in pendingList" :key="st.id">
        {{ st.name }} · {{ st.pendingReason }}
      </p>

      <div class="stats" v-if="lastRecord">
        <div class="stat">
          <div class="stat-num">{{ lastRecord.doneCount }}</div>
          <div class="stat-label">上次完成式数</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ records.length }}</div>
          <div class="stat-label">累计打卡</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ lastRecord.date }}</div>
          <div class="stat-label">最近一次</div>
        </div>
      </div>

      <nav class="links">
        <button class="btn ghost" @click="$router.push('/record')">打卡记录</button>
        <button class="btn ghost" @click="$router.push('/guide')">动作要领</button>
      </nav>

      <div class="cam-state" v-if="camInfo">
        <span class="dot" :class="camInfo.ok ? 'ok' : 'bad'"></span>
        <span>{{ camInfo.text }}</span>
        <button class="btn mini" @click="probeCam">{{ camInfo.ok ? '重新检测' : '开启摄像头' }}</button>
      </div>

      <div class="foot">摄像头画面全部在本机处理，不上传、不联网</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecords } from '../stores/records'
import { listCameras } from '../engine/poseEngine'
import { STYLE_LIST, getStyle, resolveStyle } from '../data/styles'
import { unlockAudio, preloadSamples } from '../engine/guqin'
import { primeVoice } from '../engine/voice'

const router = useRouter()
const records = ref([])
const styleId = ref(resolveStyle(safeGetStyle()))
const cur = computed(() => getStyle(styleId.value))
const pendingList = computed(() => STYLE_LIST.filter((s) => s.status !== 'ready'))
function safeGetStyle() { try { return localStorage.getItem('xianyang.style') } catch { return null } }
function pick(s) {
  if (!s.moves.length) return
  styleId.value = s.id
  try { localStorage.setItem('xianyang.style', s.id) } catch { /* file:// 下不可写，忽略 */ }
}
const lastRecord = computed(() => records.value[0] || null)

// 摄像头预检：点「开始练」时浏览器才弹权限框，用户会紧张。
// 改成在首页就静默枚举（不弹框），进跟练页时权限已就绪，画面秒出。
const camInfo = ref(null)

async function probeCam() {
  camInfo.value = { ok: false, text: '正在检测摄像头…' }
  try {
    const cams = await listCameras()   // 内部会请求一次权限
    camInfo.value = cams.length
      ? { ok: true, text: `已就绪：${cams[0].label}${cams.length > 1 ? ` 等 ${cams.length} 个设备` : ''}` }
      : { ok: false, text: '未检测到摄像头，接上后点此重试' }
  } catch (e) {
    camInfo.value = { ok: false, text: '摄像头未授权：' + (e?.message || e) }
  }
}

onMounted(() => {
  records.value = getRecords()
  unlockAudio()
  probeCam()
})

function start() {
  if (!cur.value) return
  // 在用户手势内解锁语音与音频（浏览器自动播放策略要求）
  unlockAudio()
  // 趁手势内把 7 个采样拉进内存，避免第一个动作触发时才加载
  preloadSamples()
  primeVoice()
  router.push({ path: '/train', query: { style: cur.value.id } })
}
</script>

<style scoped>
.home {
  display: flex; flex-direction: column; align-items: center;
  padding: 8vh 24px 32px; gap: 18px; text-align: center;
}
.hero { margin-bottom: 1vh; }
.brand {
  font-size: 54px; letter-spacing: 16px; text-indent: 16px;
  color: var(--xuan); font-weight: 400; line-height: 1.1;
  text-shadow: 0 0 40px rgba(214, 197, 158, .18);
}
.tagline { margin-top: 14px; font-size: 14px; color: var(--xuan-dim); letter-spacing: 2px; }

.big-btn {
  width: min(250px, 64vw); aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 50% 38%, #2a231b, #191510);
  border: 1px solid rgba(214, 197, 158, .28);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; box-shadow: 0 0 60px rgba(200, 85, 61, .12), inset 0 0 40px rgba(0,0,0,.5);
  transition: transform .16s, box-shadow .16s;
}
.big-btn:disabled { opacity: .45; cursor: not-allowed; }
.big-btn:hover:not(:disabled) { box-shadow: 0 0 80px rgba(200, 85, 61, .26), inset 0 0 40px rgba(0,0,0,.5); }
.big-btn:active { transform: scale(.96); }
.big-btn-label { font-size: 30px; letter-spacing: 6px; text-indent: 6px; }
.big-btn-sub { font-size: 12px; color: var(--xuan-faint); font-family: var(--font-ui); letter-spacing: 1px; }

.stats { display: flex; gap: 34px; margin-top: 2vh; }
.stat-num { font-size: 26px; color: var(--jin); }
.stat-label { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 4px; }

/* 拳种选择 */
.styles { display: flex; gap: 8px; width: 100%; max-width: 420px; }
.style {
  flex: 1; padding: 9px 8px; border-radius: var(--r-m);
  background: rgba(232, 224, 208, .04);
  border: 1px solid rgba(232, 224, 208, .09);
  text-align: center; transition: all .15s;
}
.style:hover:not(:disabled) { background: rgba(232, 224, 208, .08); }
.style.on { background: rgba(200, 85, 61, .16); border-color: var(--zhu); }
.style.pending { opacity: .5; cursor: not-allowed; }
.style-name { font-size: 14px; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 5px; }
.style-badge { font-size: 9px; padding: 1px 5px; border-radius: 8px; background: rgba(232, 224, 208, .12); color: var(--xuan-faint); font-family: var(--font-ui); }
.style.on .style-badge { background: rgba(200, 85, 61, .3); color: #f0c0b4; }
.style-pending-note { font-size: 9.5px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 4px; line-height: 1.4; }
.style-sub { font-size: 10.5px; color: var(--xuan-faint); margin-top: 3px; font-family: var(--font-ui); }
.style-desc { font-size: 12px; color: var(--xuan-dim); line-height: 1.8; max-width: 380px; text-align: center; font-family: var(--font-ui); }
.style-pending { font-size: 11px; color: var(--xuan-faint); font-family: var(--font-ui); margin: -14px 0 0; }

.links { display: flex; gap: 12px; margin-top: 1vh; }

.cam-state {
  display: flex; align-items: center; gap: 9px;
  font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui);
  background: rgba(232, 224, 208, .04); border: 1px solid rgba(232, 224, 208, .09);
  padding: 8px 14px; border-radius: 20px; max-width: 100%;
}
.cam-state .dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
.cam-state .dot.ok { background: #7fb069; box-shadow: 0 0 8px rgba(127, 176, 105, .5); }
.cam-state .dot.bad { background: var(--zhu); box-shadow: 0 0 8px var(--zhu-glow); }
.btn.mini { padding: 4px 11px; font-size: 11px; border-radius: 14px; }

.foot { margin-top: auto; font-size: 11px; color: rgba(232,224,208,.2); font-family: var(--font-ui); }
</style>
