<template>
  <div class="wrap">
    <div class="topbar">
      <button class="btn ghost sm" @click="go('/train')">← 返回跟练</button>
      <h1>预览中枢</h1>
      <div class="spacer"></div>
      <span class="ver">仅开发预览 · 不在导航内</span>
    </div>

    <div class="body">
      <p class="lead">
        这一页是本轮合入的<strong>实验性能力</strong>的统一入口。它们都<strong>不属于正式导航</strong>——
        正式 App（首页 / 跟练 / 我的）里没有任何按钮指向这里，只有手敲地址或带
        <code>?ia=art</code> 参数才会到达。
      </p>

      <div class="panel">
        <div class="ph"><b>① 文化内核实验室</b><span class="sub">Culture API v1.0.0</span></div>
        <p class="desc">
          把五音疗愈 / 子午流注 / 节气食养 / 体质功法 / 和香五套传统学说，数字化成同一形状的数据与规则；
          一张处方（音疗 · 功法 · 香事 · 食养）经<strong>可插拔总线</strong>落到具体硬件——换设备只换适配器。
        </p>
        <div class="row">
          <button class="btn primary" @click="go('/culture')">打开实验室</button>
          <code class="url">/s4/#/culture</code>
        </div>
      </div>

      <div class="panel">
        <div class="ph"><b>② 设计稿 × 真引擎融合壳</b><span class="sub">ProtShell</span></div>
        <p class="desc">
          把最终版设计稿一比一复刻的移动端 UI 原样装进 iframe，再用同源桥接把<strong>真姿态引擎</strong>的数据喂给它——
          设计稿从「只有界面、没有后台」变成「界面不变、数据是真」。
        </p>
        <div class="row">
          <button class="btn primary" @click="go('/prot')">打开融合壳</button>
          <code class="url">/s4/#/prot</code>
        </div>
      </div>

      <div class="panel">
        <div class="ph"><b>③ 七步问卷 · 宣纸插画卡</b><span class="sub">OnboardingV2</span></div>
        <p class="desc">
          新版引导问卷：每一步是一张宣纸插画卡（颈肩 / 腰背 / 脾胃 / 睡眠 / 情绪…），
          与主壳里那套旧问卷<strong>并存</strong>，不替换、不修改旧问卷。
        </p>
        <div class="row">
          <button class="btn primary" @click="go('/onboarding-v2')">打开新问卷</button>
          <code class="url">/s4/#/onboarding-v2</code>
        </div>
      </div>

      <p class="foot">
        直达方式：在地址栏把 <code>/s4/</code> 后面接上 <code>?ia=art</code> 即落到本页。<br>
        不带该参数时，<code>/s4/</code> 与改造前完全一样——整页跳回主壳首页。
      </p>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function go(p) { router.push(p) }
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
.lead code { font-family: ui-monospace, monospace; font-size: 12px; background: var(--ink-3); padding: 1px 5px; border-radius: 5px; }

.panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--r-m); padding: 14px 14px 16px; box-shadow: var(--shadow-s);
}
.ph { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.ph b { font-size: 14.5px; color: var(--brown-dark); font-family: var(--font-serif); }
.sub { font-size: 11.5px; color: var(--ink-light); }
.desc { font-size: 13px; line-height: 1.8; color: var(--xuan); margin: 0; }
.desc strong { color: var(--brown-dark); }

.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.btn {
  font: inherit; color: var(--xuan); background: var(--ink-2);
  border: 1px solid var(--border); border-radius: var(--r-s);
  padding: 9px 11px; min-height: var(--tap);
}
.btn.ghost { background: transparent; }
.btn.sm { min-height: 36px; padding: 6px 10px; font-size: 12.5px; }
.btn.primary { background: var(--zhu); border-color: var(--zhu); color: #fff; }
.url { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--ink-light); }
.foot { font-size: 12.5px; line-height: 1.9; color: var(--xuan); padding: 2px 2px 8px; }
.foot code { font-family: ui-monospace, monospace; font-size: 11.5px; background: var(--ink-3); padding: 1px 5px; border-radius: 5px; }

@media (min-width: 900px) {
  .topbar { padding-left: 24px; }
  .body { padding-left: 24px; padding-right: 24px; }
}
</style>
