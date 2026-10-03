<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="$router.push('/me')">← 我的</button>
      <h1>基础设置</h1>
      <div class="spacer"></div>
    </div>

    <div class="body set">
      <section class="grp">
        <div class="grp-title">音频</div>
        <label class="row">
          <span class="lb">进入时初始化音频</span>
          <input type="checkbox" v-model="audioOn" @change="save" />
        </label>
        <label class="row">
          <span class="lb">古琴弦音反馈</span>
          <input type="checkbox" v-model="pluckOn" @change="save" />
        </label>
        <label class="row">
          <span class="lb">语音播报动作名</span>
          <input type="checkbox" v-model="voiceOn" @change="save" />
        </label>
      </section>

      <section class="grp">
        <div class="grp-title">练习</div>
        <label class="row">
          <span class="lb">默认拳种</span>
          <select v-model="defStyle" @change="save">
            <option value="baduanjin">八段锦</option>
            <option value="wuqinxi">五禽戏</option>
          </select>
        </label>
        <label class="row">
          <span class="lb">默认练习阶段</span>
          <select v-model="defStage" @change="save">
            <option value="point">阶段一 · 点</option>
            <option value="line">阶段二 · 线</option>
            <option value="arc">阶段三 · 面</option>
          </select>
        </label>
      </section>

      <section class="grp">
        <div class="grp-title">数据</div>
        <button class="link-row" @click="$router.push('/record')"><span>打卡记录</span><span class="arrow">›</span></button>
        <button class="link-row" @click="clearAll"><span>清空本机全部数据</span><span class="arrow danger">›</span></button>
      </section>

      <section class="grp">
        <div class="grp-title">关于</div>
        <button class="link-row" @click="showPrivacy = !showPrivacy"><span>隐私说明</span><span class="arrow">›</span></button>
        <div class="privacy" v-if="showPrivacy">
          摄像头画面全部在本机处理，不上传、不联网；练习记录只存在本机浏览器。
        </div>
        <div class="ver">弦养 v1.0 · 八段锦 × 古琴音疗</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { clearRecords } from '../stores/records'
import { clearBodyData } from '../stores/bodyData'
import { getSettings, saveSettings, clearSettings } from '../stores/settings'

const audioOn = ref(true)
const pluckOn = ref(true)
const voiceOn = ref(true)
const defStyle = ref('baduanjin')
const defStage = ref('point')
const showPrivacy = ref(false)

onMounted(() => {
  const s = getSettings()
  audioOn.value = s.audioOn
  pluckOn.value = s.pluckOn
  voiceOn.value = s.voiceOn
  defStyle.value = s.defStyle
  defStage.value = s.defStage
  try {
    const st = localStorage.getItem('xianyang.style')
    if (st === 'baduanjin' || st === 'wuqinxi') defStyle.value = st
  } catch { /* 忽略 */ }
})

function save() {
  saveSettings({
    audioOn: audioOn.value, pluckOn: pluckOn.value, voiceOn: voiceOn.value,
    defStyle: defStyle.value, defStage: defStage.value,
  })
  // 拳种是首页/准备页直接读的 key，这里同步一份
  try { localStorage.setItem('xianyang.style', defStyle.value) } catch { /* 忽略 */ }
}

function clearAll() {
  if (!confirm('将清空打卡记录、身体数据与设置，确定继续？')) return
  // 走各自的 store，别手写 key —— 否则漏掉哪个 key 就变成「清了但没清干净」
  clearRecords()
  clearBodyData()
  clearSettings()
  audioOn.value = true
  pluckOn.value = true
  voiceOn.value = true
  alert('已清空')
}
</script>

<style scoped>
.set { padding: 18px 20px var(--body-pad-b); }
.grp {
  background: rgba(255, 253, 246, .72);
  border: 1px solid rgba(58, 51, 42, .10);
  border-radius: 14px; padding: 14px 16px; margin-bottom: 14px;
  backdrop-filter: blur(3px);
}
.grp-title {
  font-size: 11px; color: var(--zhu); font-family: var(--font-ui); letter-spacing: .12em;
  margin-bottom: 10px; border-bottom: 1px solid rgba(200, 93, 77, .2); padding-bottom: 7px;
}
.row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; }
.row .lb { font-size: 13.5px; color: var(--xuan); font-family: var(--font-ui); }
/* 24x24：手机上 18px 太小难点中（iOS HIG 建议 44px 命中区，靠行 padding 补） */
.row input[type="checkbox"] { width: 24px; height: 24px; accent-color: var(--zhu); flex: 0 0 auto; }
.row select {
  appearance: none; font-family: var(--font-ui); font-size: 13px; color: var(--xuan);
  background: rgba(255, 253, 246, .9); border: 1px solid rgba(58, 51, 42, .16);
  border-radius: 9px; padding: 7px 12px;
}
.link-row {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 11px 0; background: transparent; color: var(--xuan); font-size: 13.5px;
  font-family: var(--font-ui); border-bottom: 1px solid rgba(58, 51, 42, .06); cursor: pointer;
}
.link-row:last-of-type { border-bottom: 0; }
.arrow { color: var(--xuan-faint); }
.arrow.danger { color: var(--zhu); }
.privacy { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); line-height: 1.8; padding: 8px 0 4px; }
.ver { font-size: 11.5px; color: var(--xuan-faint); font-family: var(--font-ui); margin-top: 10px; }
</style>
