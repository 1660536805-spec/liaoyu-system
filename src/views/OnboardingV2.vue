<template>
  <div class="ob2">
    <!-- 顶栏：返回 / 跳过 -->
    <header class="ob2-top">
      <button class="icbtn" type="button" aria-label="返回" @click="onPrev">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span></span>
      <span></span>
    </header>

    <!-- 品牌区 -->
    <div class="ob2-brand">
      <span class="t-callig">弦养</span>
      <span class="seal">弦</span>
    </div>
    <p class="ob2-sub">让传统之美，滋养当下的你</p>

    <!-- 步进条 -->
    <div class="stepper">
      <span class="num">{{ step + 1 }} <i>/ {{ questions.length }}</i></span>
      <div class="steps">
        <template v-for="(q, i) in questions" :key="i">
          <span v-if="i" class="sline" :class="{ done: i <= step }"></span>
          <span class="snode" :class="{ done: i < step, cur: i === step }">
            <svg v-if="i < step" viewBox="0 0 24 24" width="11" height="11" fill="none"
                 stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        </template>
      </div>
    </div>

    <!-- 题干 -->
    <h2 class="ob2-q">{{ q.title }}</h2>
    <p class="ob2-hint">{{ q.hint }}</p>

    <!-- 选项：第 1 题用插画卡，其余用文字行 -->
    <div v-if="q.cards" class="qgrid">
      <button
        v-for="(c, i) in q.cards" :key="c.label"
        class="qcard" :class="{ sel: picked === i }"
        type="button"
        :aria-pressed="picked === i"
        @click="pick(i)"
      >
        <span class="ck">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
               stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <img :src="c.img" :alt="c.label" loading="lazy" />
        <h4>{{ c.label }}</h4>
        <p>{{ c.desc }}</p>
      </button>
    </div>

    <div v-else class="optlist">
      <button
        v-for="(o, i) in q.options" :key="o"
        class="optrow" :class="{ sel: picked === i }"
        type="button"
        :aria-pressed="picked === i"
        @click="pick(i)"
      >
        <span class="ck">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
               stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <span class="lb">{{ o }}</span>
      </button>
    </div>

    <!-- 操作条 -->
    <footer class="ob2-actions">
      <button class="btn btn-gho" type="button" @click="onPrev">上一步</button>
      <button class="btn btn-main" type="button" :disabled="picked < 0" @click="onNext">
        {{ step < questions.length - 1 ? '下一步' : '完成' }}
      </button>
      <button class="tbtn" type="button" @click="skip">跳过</button>
    </footer>

    <!-- 未选提示（不弹 toast，就地在按钮上方提示，避免遮挡） -->
    <p v-if="hint" class="warn" role="alert">{{ hint }}</p>
  </div>
</template>

<script setup>
/**
 * 七步问答 · 宣纸插画卡形态（对齐队友 main 分支 dist/app.js 的 pgQuestion）
 *
 * 与旧 OnboardingView 的关系：**业务规则完全一致，只换视觉与交互形态**。
 *  · 题目清单、选项顺序、applyRecommendation() 的推荐逻辑逐字沿用，
 *    换 UI 绝不能顺手改推荐结果，否则问卷就失去意义了。
 *  · 形态差异：插画卡网格（第 1 题「关心哪里」配 6 张国风插画）、
 *    7 点步进条、上一步/下一步/跳过三键并排、未选时按钮禁用 + 就地提示。
 *
 * ⚠ 队友原版 pgQuestion() 的缺陷（没有照抄）：
 *  7 道题共用同一份渲染函数，题目文案恒为「你最近哪里容易不舒服?」，
 *  选项恒为那 6 张「关心哪里」插画卡 —— 也就是说队友只真正做了第 1 题，
 *  第 2~7 题点「下一步」后看到的是同一屏内容。193 项自测没覆盖内容正确性。
 *  这里保留它的视觉语言，内容仍按我们真实的 7 道题走。
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 第 1 题的六张插画卡（素材来自队友 art/，已复制到 public/art/）
const BODY_CARDS = [
  { img: '/art/q-neck.jpg', label: '颈肩', desc: '容易酸痛、僵硬' },
  { img: '/art/q-back.jpg', label: '腰背', desc: '容易酸胀、疲劳' },
  { img: '/art/q-food.jpg', label: '脾胃', desc: '容易胀气、消化不良' },
  { img: '/art/q-sleep.jpg', label: '睡眠', desc: '入睡困难、易醒' },
  { img: '/art/q-mood.jpg', label: '情绪', desc: '容易焦虑、烦躁' },
  { img: '/art/q-none.jpg', label: '没有', desc: '想整体调养' },
]

const LIST_HINT = '你的回答将帮助我们生成更合适的今日练习推荐'

const questions = [
  {
    title: '你最近哪里容易不舒服？',
    hint: LIST_HINT,
    cards: BODY_CARDS,
    // 卡片顺序即选项顺序，applyRecommendation 依赖这个下标
    options: BODY_CARDS.map((c) => c.label),
  },
  { title: '每天久坐时长？', hint: '久坐越久，越需要松解', options: ['<4h', '4–8h', '>8h'] },
  { title: '运动基础？', hint: '按实际来，不用刻意高估', options: ['零基础', '偶尔练', '有规律'] },
  { title: '今天想练什么氛围？', hint: '选一个此刻最想要的', options: ['平和', '提振', '放松', '帮我选'] },
  { title: '每天能投入多久？', hint: '短的也有效，完整比勉强更重要', options: ['5 分钟', '10 分钟', '15 分钟以上'] },
  { title: '你更想练什么？', hint: '不确定就交给推荐', options: ['八段锦', '五禽戏', '帮我选'] },
  { title: '是否有膝盖不适？', hint: '有的话我们会把幅度放小', options: ['是', '否'] },
]

const step = ref(0)
const picked = ref(-1)
const answers = ref([])
const hint = ref('')

const q = computed(() => questions[step.value])

// 切题时恢复该题已选项，并清掉上一次的提示
watch(step, () => {
  picked.value = typeof answers.value[step.value] === 'number' ? answers.value[step.value] : -1
  hint.value = ''
})

function pick(i) {
  picked.value = i
  answers.value[step.value] = i
  hint.value = ''
}

function onNext() {
  if (picked.value < 0) {
    // 不弹 toast：会盖住插画卡。就地在按钮上方提示一句，保持页面可读。
    hint.value = '请先选择一项，再继续'
    return
  }
  if (step.value < questions.length - 1) {
    step.value++
    return
  }
  applyRecommendation()
  router.push('/')
}

function onPrev() {
  if (step.value > 0) {
    step.value--
    return
  }
  router.push('/')
}

function skip() { router.push('/') }

/** 推荐逻辑：与旧 OnboardingView.applyRecommendation 逐字一致，不做任何改动 */
function applyRecommendation() {
  const a = answers.value
  const body = (a[0] !== undefined ? questions[0].options[a[0]] : '') || '没有'
  const sit = (a[1] !== undefined ? questions[1].options[a[1]] : '') || '<4h'
  const goal = (a[3] !== undefined ? questions[3].options[a[3]] : '') || '平和'
  const style = (a[5] !== undefined ? questions[5].options[a[5]] : '八段锦') || '八段锦'
  // knee = 第 7 题答「是」。旧版读了但没参与运算，这里保留读取以备后续接阈值。
  const knee = (a[6] !== undefined ? questions[6].options[a[6]] : '') === '是'

  let tone = 'gong'
  if (['颈肩', '腰背'].includes(body) || sit === '>8h') tone = 'shang'
  else if (['睡眠', '情绪'].includes(body)) tone = 'yu'
  else if (body === '脾胃') tone = 'gong'
  else if (goal === '提振') tone = 'zhi'
  else if (goal === '放松') tone = 'yu'

  try {
    localStorage.setItem('xianyang.tone', tone)
    localStorage.setItem('xianyang.style', style === '五禽戏' ? 'wuqinxi' : 'baduanjin')
    if (knee) localStorage.setItem('xianyang.kneeFlag', '1')
    localStorage.setItem('xianyang.onboardDone', '1')
  } catch {}
}
</script>

<style scoped>
/* ---------------------------------------------------------------
   宣纸插画卡形态。1rem 沿用 tokens.css 的 px 体系（根 16px），
   所以这里直接写 px，不套队友的 rem 缩放。
   色值全部走 tokens.css 的变量，改配色只改 tokens 一处。
   --------------------------------------------------------------- */
.ob2 {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: calc(20px + var(--safe-t)) 20px calc(24px + var(--safe-b));
  /* 底部不留 Tab 的位：问卷页已在 AppTab 的 noTab 名单里，Tab 不渲染。
     若哪天把 Tab 放回来，这里必须补回 --tab-h，否则「下一步」会被盖住点不到
     （实测踩过：按钮 top=872 / Tab top=871 完全重叠）。 */
  background: var(--ink);
  color: var(--xuan);
  font-family: var(--font-ui);
  position: relative;
  isolation: isolate;
}
/* 云纹底 + 宣纸罩层，与队友 .phone 同一套语言 */
.ob2::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background-image: url('/art/cloud.jpg');
  background-size: 235px;
  background-repeat: repeat;
}
.ob2::after {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(180deg,
    rgba(251, 243, 227, .62) 0%, rgba(251, 243, 227, .9) 34%, rgba(251, 243, 227, .96) 100%);
}

.ob2-top { display: flex; align-items: center; justify-content: space-between; }
.icbtn {
  width: 38px; height: 38px; border-radius: 50%;
  background: rgba(253, 249, 239, .9); border: 1px solid var(--border);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--brown); box-shadow: var(--shadow-s); flex: none; cursor: pointer;
}

.ob2-brand {
  display: flex; align-items: flex-start; gap: 9px;
  margin-top: 10px;
}
.t-callig {
  font-family: var(--font-serif); font-weight: 700; color: var(--brown-dark);
  font-size: 46px; line-height: 1.05; letter-spacing: .12em;
}
.seal {
  display: inline-flex; align-items: center; justify-content: center;
  background: #C03A26; color: #FBF3E3; border-radius: 5px;
  font-family: var(--font-serif); font-weight: 700;
  writing-mode: vertical-rl; letter-spacing: .1em; line-height: 1;
  padding: 4px 2px; font-size: 13px; margin-top: 5px;
  box-shadow: 0 1px 3px rgba(150, 40, 20, .3);
}
.ob2-sub {
  font-family: var(--font-serif);
  font-size: 15px; color: var(--brown); letter-spacing: .14em;
  margin: 14px 0 0; text-align: center;
}

/* 步进条 */
.stepper { display: flex; align-items: center; gap: 10px; margin: 24px 0 0; }
.stepper .num { font-family: var(--font-serif); font-size: 24px; color: var(--brown-dark); font-weight: 700; }
.stepper .num i { font-style: normal; font-size: 17px; color: var(--ink-light); }
.steps { flex: 1; display: flex; align-items: center; }
.snode {
  width: 17px; height: 17px; border-radius: 50%;
  border: 1px solid var(--border); background: var(--ink-2);
  flex: none; display: flex; align-items: center; justify-content: center; color: #fff;
}
.snode.done { background: var(--zhu); border-color: var(--zhu); }
.snode.cur {
  background: var(--ink-2); border: 3px solid var(--zhu);
  box-shadow: 0 0 0 3px rgba(176, 85, 46, .18);
}
.sline { flex: 1; height: 3px; background: #EADCC2; border-radius: 2px; }
.sline.done { background: var(--zhu); }

.ob2-q {
  font-family: var(--font-serif);
  font-size: 25px; font-weight: 700; color: var(--brown-dark);
  letter-spacing: .08em; margin: 30px 0 0; text-align: center;
  line-height: 1.5;
}
.ob2-hint {
  font-size: 13.5px; color: var(--ink-light); margin: 12px 0 0;
  text-align: center; line-height: 1.8;
}

/* 插画卡网格 */
.qgrid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 11px; margin: 24px 0 0;
}
.qcard {
  position: relative; border-radius: 13px;
  background: rgba(253, 249, 239, .95); border: 1px solid var(--border);
  box-shadow: var(--shadow-s); padding: 8px 8px 11px; text-align: left;
  cursor: pointer; transition: transform .15s, box-shadow .15s, border-color .15s;
  min-height: var(--tap);
}
.qcard:active { transform: scale(.97); }
.qcard img {
  width: 100%; aspect-ratio: 3 / 3.4; object-fit: cover; border-radius: 9px;
  display: block;
}
.qcard h4 {
  font-size: 16px; color: var(--brown); font-weight: 700;
  margin: 9px 0 0; letter-spacing: .08em;
  font-family: var(--font-serif);
}
.qcard p { font-size: 11.5px; color: var(--ink-light); line-height: 1.5; margin: 3px 0 0; }
.qcard.sel {
  border-color: var(--zhu);
  box-shadow: 0 0 0 2px rgba(176, 85, 46, .18), var(--shadow-s);
}
.ck {
  position: absolute; top: 8px; right: 8px; width: 25px; height: 25px; border-radius: 50%;
  background: var(--zhu); color: #fff; display: none;
  align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(122, 60, 28, .35);
}
.sel > .ck { display: flex; }

/* 文字选项行 */
.optlist { display: flex; flex-direction: column; gap: 10px; margin: 24px 0 0; }
.optrow {
  position: relative; display: flex; align-items: center; gap: 12px;
  width: 100%; text-align: left; min-height: var(--tap);
  padding: 15px 18px 15px 50px; border-radius: 13px;
  border: 1px solid var(--border); background: rgba(253, 249, 239, .95);
  box-shadow: var(--shadow-s); color: var(--xuan);
  font-size: 15.5px; font-family: var(--font-ui); cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
}
.optrow .ck {
  left: 16px; right: auto; top: 50%; margin-top: -12.5px;
  background: transparent; border: 1.5px solid var(--border);
  color: transparent; box-shadow: none;
}
.optrow.sel {
  border-color: var(--zhu);
  box-shadow: 0 0 0 2px rgba(176, 85, 46, .18), var(--shadow-s);
  color: var(--brown-dark); font-weight: 600;
}
.optrow.sel .ck {
  background: var(--zhu); border-color: var(--zhu); color: #fff;
  box-shadow: 0 1px 4px rgba(122, 60, 28, .35);
}

/* 操作条 */
.ob2-actions {
  display: flex; align-items: center; gap: 12px;
  margin-top: auto; padding-top: 26px;
}
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: var(--tap); border-radius: 999px;
  font-size: 15px; letter-spacing: .1em; cursor: pointer;
  transition: transform .12s, background .15s;
}
.btn:active { transform: scale(.98); }
.btn-gho {
  flex: 0 0 auto; padding: 0 20px;
  background: rgba(253, 249, 239, .95); border: 1px solid var(--border);
  color: var(--brown); box-shadow: var(--shadow-s);
}
.btn-main {
  flex: 1; background: var(--zhu); color: #FDF6EA; font-weight: 600;
  border: 1px solid var(--zhu);
  box-shadow: 0 5px 12px rgba(150, 72, 35, .30), inset 0 1px 0 rgba(255, 235, 210, .35);
}
.btn-main:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
.tbtn {
  flex: 0 0 auto; background: none; border: none; cursor: pointer;
  font-family: var(--font-ui); font-size: 13.5px; color: var(--brown); letter-spacing: .08em;
  min-height: 34px; padding: 0 2px;
}

.warn {
  margin: 10px 0 0; text-align: center; font-size: 13px;
  color: #9A4A2A; min-height: 18px;
}

/* 窄屏：插画卡改两列，否则 470px 下每张只有 ~130px，插画细节看不清 */
@media (max-width: 400px) {
  .qgrid { grid-template-columns: 1fr 1fr; }
  .t-callig { font-size: 40px; }
  .ob2-q { font-size: 22px; }
}
/* 矮屏（横屏手机）：压缩上边距，保证操作条不被顶出视口 */
@media (max-height: 620px) and (orientation: landscape) {
  .ob2-sub { margin-top: 8px; }
  .stepper { margin-top: 14px; }
  .ob2-q { margin-top: 16px; font-size: 20px; }
  .ob2-hint { margin-top: 8px; }
  .qgrid, .optlist { margin-top: 14px; }
  .ob2-actions { padding-top: 14px; }
}
</style>
