<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="$router.push('/me')">← 我的</button>
      <h1>身体数据</h1>
      <div class="spacer"></div>
    </div>

    <div class="body form">
      <p class="lead">这些数据会帮你获得更贴合的练习推荐、动作纠错和食谱建议。</p>

      <div class="field">
        <label>身高（cm）</label>
        <input type="number" v-model.number="form.height" placeholder="175" />
      </div>
      <div class="field">
        <label>体重（kg）</label>
        <input type="number" v-model.number="form.weight" placeholder="70" />
      </div>
      <div class="field">
        <label>年龄（岁）</label>
        <input type="number" v-model.number="form.age" placeholder="30" />
      </div>

      <div class="field">
        <label>既往运动损伤或慢性疾病</label>
        <div class="chips">
          <button v-for="o in injuryOptions" :key="o" class="chip" :class="{ on: form.injuries.includes(o) }" @click="toggleInjury(o)">{{ o }}</button>
        </div>
      </div>

      <div class="field">
        <label>主要练习目标</label>
        <div class="chips">
          <button v-for="o in goalOptions" :key="o" class="chip" :class="{ on: form.goal === o }" @click="form.goal = o">{{ o }}</button>
        </div>
      </div>

      <div class="field">
        <label>饮食偏好</label>
        <div class="chips">
          <button v-for="o in dietOptions" :key="o" class="chip" :class="{ on: form.diet === o }" @click="form.diet = o">{{ o }}</button>
        </div>
      </div>

      <div class="field">
        <label class="row">
          <input type="checkbox" v-model="form.wantRecipe" />
          <span>愿意接收每日食谱推荐</span>
        </label>
      </div>

      <div class="actions">
        <button class="btn primary" @click="save">保存</button>
        <button class="btn ghost" @click="clear">清除数据</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getBodyData, saveBodyData, clearBodyData } from '../stores/bodyData'

const router = useRouter()

const injuryOptions = ['颈肩', '腰背', '膝盖', '手腕', '无']
const goalOptions = ['舒缓肩颈', '改善睡眠', '调理脾胃', '提神', '无所谓']
const dietOptions = ['素食', '少盐', '无特殊']

const form = reactive({
  height: '',
  weight: '',
  age: '',
  injuries: [],
  goal: '无所谓',
  diet: '无特殊',
  wantRecipe: true,
})

onMounted(() => {
  const saved = getBodyData()
  if (saved) Object.assign(form, saved)
})

function toggleInjury(o) {
  const i = form.injuries.indexOf(o)
  if (i >= 0) form.injuries.splice(i, 1)
  else form.injuries.push(o)
}

function save() {
  const ok = saveBodyData(form)
  alert(ok ? '已保存' : '已保存（本次会话有效，浏览器禁用了本地存储）')
  router.push('/me')
}

function clear() {
  if (!confirm('确定清除身体数据？')) return
  clearBodyData()
  Object.assign(form, { height: '', weight: '', age: '', injuries: [], goal: '无所谓', diet: '无特殊', wantRecipe: true })
  alert('已清除')
}
</script>

<style scoped>
.form { padding: 20px 20px var(--body-pad-b); }
.lead { font-size: 12px; color: var(--xuan-dim); font-family: var(--font-ui); line-height: 1.8; margin-bottom: 20px; }
.field { margin-bottom: 20px; }
.field label { display: block; font-size: 13px; color: var(--xuan); margin-bottom: 8px; }
.field input[type="number"], .field input[type="text"] {
  width: 100%; padding: 12px 14px; border-radius: 10px;
  background: rgba(92, 70, 50,.05); border: 1px solid rgba(92, 70, 50,.12);
  color: var(--xuan); font-size: 15px; font-family: var(--font-ui);
}
.field input::placeholder { color: var(--xuan-faint); }

.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  /* 手机上 34px 高偏难点，抬到 40px；字号 13→14 更好读 */
  padding: 10px 16px; border-radius: 20px; border: 1px solid rgba(92, 70, 50,.12);
  background: rgba(92, 70, 50,.04); color: var(--xuan-dim); font-size: 14px;
  cursor: pointer; transition: .15s;
  min-height: 40px;
}
.chip.on { border-color: var(--zhu); color: var(--zhu); background: rgba(200, 93, 77,.12); }

.row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.row input { width: 18px; height: 18px; accent-color: var(--zhu); }
.row span { font-size: 13px; color: var(--xuan-dim); font-family: var(--font-ui); }

.actions { display: flex; gap: 12px; margin-top: 28px; }
.actions .btn { flex: 1; }
</style>
