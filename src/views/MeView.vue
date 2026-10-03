<template>
  <div class="wrap">
    <div class="body me">
      <!-- 顶部标题 -->
      <header class="me-header">
        <div class="title-block">
          <div class="main-title">
            <span>我的</span>
            <span class="seal">弦养</span>
          </div>
          <p class="sub-title">在弦音中，遇见更好的自己</p>
        </div>
        <div class="header-actions">
          <button class="icon-btn">
            <span class="dot"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><circle cx="12" cy="20" r="2" fill="currentColor" stroke="none"/></svg>
          </button>
          <button class="icon-btn" @click="$router.push('/me/settings')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          </button>
        </div>
      </header>

      <!-- 用户信息 -->
      <section class="user-card">
        <div class="avatar">
          <img src="/assets/avatar-demo.png" alt="avatar" />
        </div>
        <div class="user-info">
          <div class="nickname" @click="$router.push('/me/body-data')">
            <span>清弦月</span>
            <span class="arrow">›</span>
          </div>
          <div class="stage-pill">
            <span class="stage-icon">♣</span>
            <span>中级阶段</span>
            <span class="arrow">›</span>
          </div>
        </div>
      </section>

      <!-- 阶段进度 -->
      <div class="exp-row">
        <div class="exp-bar"><div class="exp-fill" style="width: 60%"></div></div>
        <div class="exp-num">360 / 600</div>
      </div>
      <div class="encourage">继续练习，舒展身心，遇见更平和的自己。</div>

      <!-- 身体数据 -->
      <section class="section-card body-data">
        <div class="sec-title-row">
          <span class="sec-icon">🌿</span>
          <span class="sec-title">身体数据</span>
          <span class="sec-status-tag" :class="{ on: hasBodyData }">{{ hasBodyData ? '已填写' : '未填写' }}</span>
          <span class="sec-time">更新于 10月23日 14:20</span>
        </div>
        <div class="data-grid">
          <div class="data-col">
            <span class="data-icon red">♥</span>
            <span class="data-label">心率</span>
            <span class="data-num">72</span>
            <span class="data-unit">次/分</span>
            <span class="data-state">正常</span>
          </div>
          <div class="data-col">
            <span class="data-icon blue">☽</span>
            <span class="data-label">睡眠时长</span>
            <span class="data-num">6.5</span>
            <span class="data-unit">小时</span>
            <span class="data-state">良好</span>
          </div>
          <div class="data-col">
            <span class="data-icon green">❀</span>
            <span class="data-label">身心评分</span>
            <span class="data-num">92</span>
            <span class="data-unit">分</span>
            <span class="data-state">状态平和</span>
          </div>
        </div>
        <button class="detail-btn" @click="$router.push('/me/body-data')">查看详情 ›</button>
      </section>

      <!-- 历史数据 + 阶段进度 -->
      <div class="two-col">
        <section class="section-card half">
          <div class="sec-title-row">
            <span class="sec-icon">📊</span>
            <span class="sec-title">历史数据</span>
          </div>
          <p class="sec-desc">记录每一次的练习与变化<br/>见证更好的自己。</p>
          <div class="mini-chart">
            <span v-for="i in 12" :key="i" :style="{ height: 20 + Math.random() * 40 + '%' }"></span>
          </div>
        </section>
        <section class="section-card half">
          <div class="sec-title-row">
            <span class="sec-icon"></span>
            <span class="sec-title">阶段进度</span>
          </div>
          <p class="stage-title">八段锦 · 中级阶段</p>
          <p class="stage-done">已完成 3 / 8 节</p>
          <div class="stage-dots">
            <span v-for="i in 8" :key="i" :class="{ on: i <= 3 }"></span>
          </div>
        </section>
      </div>

      <!-- 设置列表 -->
      <section class="section-card menu-list">
        <button class="menu-row" @click="$router.push('/pose-lab')">
          <span class="menu-icon">📐</span>
          <div class="menu-text">
            <div class="menu-title">骨架采集台</div>
            <div class="menu-sub">调参用：录制骨架数据并导出给我</div>
          </div>
          <span class="arrow">›</span>
        </button>
        <button class="menu-row" @click="$router.push('/me/settings')">
          <span class="menu-icon">⚙</span>
          <div class="menu-text">
            <div class="menu-title">基础设置</div>
            <div class="menu-sub">账号管理、提醒设置、个性化偏好</div>
          </div>
          <span class="arrow">›</span>
        </button>
        <button class="menu-row" @click="$router.push('/guide')">
          <span class="menu-icon">📖</span>
          <div class="menu-text">
            <div class="menu-title">动作要领</div>
            <div class="menu-sub">八式分解、常见错误、注意事项</div>
          </div>
          <span class="arrow">›</span>
        </button>
        <button class="menu-row" @click="$router.push('/record')">
          <span class="menu-icon">🎧</span>
          <div class="menu-text">
            <div class="menu-title">我的记录</div>
            <div class="menu-sub">练习历史、打卡统计</div>
          </div>
          <span class="arrow">›</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getRecords } from '../stores/records'
import { hasBodyData as readHasBodyData } from '../stores/bodyData'

const hasBodyData = ref(false)

onMounted(() => {
  getRecords()
  hasBodyData.value = readHasBodyData()
})
</script>

<style scoped>
.me { padding: 20px 16px var(--body-pad-b); }
.me-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.title-block { flex: 1; }
.main-title { display: flex; align-items: center; gap: 8px; font-size: 40px; letter-spacing: 6px; color: #2B251E; }
.main-title .seal { width: 22px; height: 32px; background: var(--zhu); color: #fff; font-size: 11px; border-radius: 4px; writing-mode: vertical-rl; letter-spacing: 2px; display: grid; place-items: center; }
.sub-title { font-size: 13px; color: var(--xuan-dim); margin-top: 6px; }
.header-actions { display: flex; gap: 10px; }
.icon-btn { width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,.6); border: 1px solid var(--border); display: grid; place-items: center; color: var(--xuan); position: relative; }
.icon-btn svg { width: 22px; height: 22px; }
.icon-btn .dot { position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: var(--zhu); }

.user-card { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.avatar { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 2px solid var(--gold-tone); }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.user-info { flex: 1; }
.nickname { font-size: 20px; font-weight: 600; color: #2B251E; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.stage-pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--gold-tone); border-radius: 999px; padding: 5px 12px; font-size: 13px; color: var(--brown); background: var(--gold-light); }
.stage-icon { color: var(--gold-tone); }

.exp-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.exp-bar { flex: 1; height: 8px; border-radius: 4px; background: var(--gold-light); }
.exp-fill { height: 100%; border-radius: 4px; background: var(--green); }
.exp-num { font-size: 13px; color: var(--xuan); font-weight: 600; }
.encourage { font-size: 12px; color: var(--xuan-dim); margin-bottom: 16px; }

.section-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
.sec-title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.sec-title { font-size: 16px; font-weight: 600; color: #2B251E; }
.sec-status-tag { font-size: 11px; padding: 2px 7px; border-radius: 10px; background: rgba(92, 70, 50,.08); color: var(--xuan-dim); }
.sec-status-tag.on { background: var(--green-light); color: var(--green); }
.sec-time { margin-left: auto; font-size: 11px; color: var(--xuan-faint); }
.sec-desc { font-size: 12px; color: var(--xuan-dim); line-height: 1.6; }

.data-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.data-col { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; }
.data-icon { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 18px; margin-bottom: 4px; }
.data-icon.red { background: #F5E0DA; color: var(--zhu); }
.data-icon.blue { background: #E3EDF5; color: #5A7E9A; }
.data-icon.green { background: var(--green-light); color: var(--green); }
.data-label { font-size: 12px; color: var(--xuan); }
.data-num { font-size: 24px; font-weight: 700; color: var(--green); }
.data-unit { font-size: 11px; color: var(--xuan-faint); }
.data-state { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--green-light); color: var(--green); }
.detail-btn { width: 100%; padding: 10px; border-radius: 10px; background: var(--green); color: #fff; font-size: 13px; text-align: center; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.half { margin-bottom: 0; }
.mini-chart { display: flex; align-items: flex-end; gap: 4px; height: 60px; margin-top: 8px; }
.mini-chart span { flex: 1; background: var(--green); border-radius: 2px 2px 0 0; opacity: .8; min-height: 4px; }
.stage-title { font-size: 13px; color: var(--xuan); margin-bottom: 2px; }
.stage-done { font-size: 12px; color: var(--xuan-faint); margin-bottom: 8px; }
.stage-dots { display: flex; gap: 6px; }
.stage-dots span { flex: 1; height: 10px; border-radius: 50%; background: var(--gold-light); }
.stage-dots span.on { background: var(--green); }

.menu-list { padding: 4px 16px; }
.menu-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 0; border: none; border-bottom: 1px solid var(--border); background: transparent; }
.menu-row:last-child { border-bottom: none; }
.menu-icon { width: 28px; height: 28px; border-radius: 50%; background: var(--green-light); color: var(--green); display: grid; place-items: center; font-size: 14px; }
.menu-text { flex: 1; text-align: left; }
.menu-title { font-size: 15px; color: #2B251E; margin-bottom: 2px; }
.menu-sub { font-size: 11px; color: var(--xuan-faint); }
.version { font-size: 13px; color: var(--xuan-dim); }
.arrow { color: var(--xuan-faint); font-size: 18px; }
</style>
