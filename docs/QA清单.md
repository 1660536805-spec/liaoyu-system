# QA 清单（D1–D10 逐项）

> 每条都写清「怎么验 / 证据文件 / 谁验 / 现在什么状态」。
> **没有证据文件的 = 不算过**（交接文档 §11 第 5 条：不许接受自测结论而不复跑）。
> 最后更新：2026-10-02 23:30

图例：✅ 通过 ｜ 🟡 待实测 ｜ 🔴 阻塞 ｜ — 不需要

---

## 已通过（有复跑命令为证）

| # | Done | 怎么验 | 状态 |
|---|---|---|---|
| D9 | 文案无禁词、映射定版 | `npm run test:render`（禁词断言 + 1–7 弦一一对应 + 第 8 式 chord） | ✅ |
| D6' | 本地资源零外链，构建可跑 | `npm run build` → 46 模块 / 273 kB（gzip 96 kB） | ✅ |
| D2' | 8 式判定器可用 + 抗噪 | `npm run test:judge`（34+ 项：正例 / 盲测 / 消融 / 复杂度定级） | ✅ |
| D7' | 静立 300 帧零误触发 | `node scripts/verify-cleaner.mjs` → 静立 0 次 | ✅ |
| D5' | 判定器/滤波参数经真机 6039 帧离线验证 | `node scripts/tune-filter.mjs` | ✅（数字见 `真机实测记录.md`） |
| D5'' | **零外链**：`src/` + `index.html` 没有把请求打到任何外网域 | `node scripts/render.test.mjs`（新增「断网可用性」段，已验证该正则确实能抓到 CDN URL） | ✅ |
| D2 | 8 式判定器在**离线数据**上互不串扰 | `node src/engine/judge.test.mjs` 盲测段 | ✅ |

---

## 待打勾的（按交卷倒计时的顺序）

| # | Done | 怎么验 | 证据文件名 | 谁 | 状态 |
|---|---|---|---|---|---|
| **D1** | 做「双手托天」听到琴响 | 真机现场做第 1 式，录屏/截图 | `evidence/d01-hit.png` | 真人 | 🔴 阻塞 |
| **D2** | 8 式各触发对应弦；第 8 式七弦齐鸣 | 真机走完 8 式 | `evidence/d02-eight.png` | 真人 | 🔴 阻塞 |
| **D3** | 首页 → 跟练 → 识别 → 拨弦 → 打卡 全链路 | 真机录屏 | `evidence/d03-chain.mp4` | 真人 | 🔴 阻塞 |
| **D4** | **手机**能开、能授权、出画面 + 骨架 + 出声 | 手机 `https://192.168.1.209:5174` 实测 | `evidence/d04-phone.png` | 真人 | 🔴 阻塞 |
| **D5** | **断网**下 D1–D4 仍成立 | 手机开飞行模式重跑 D4 全流程 | `evidence/d05-offline.png` | 真人 | 🔴 阻塞（前置的「零外链」已用静态审计证明，见上一行） |
| **D6** | 控制台 0 error / 0 failed | 手机控制台截图 | `evidence/d06-console.png` | 真人 | 🔴 阻塞 |
| **D7** | 原地晃动不误触发 | 站着晃 10 秒 | `evidence/d07-shake.png` | 真人 | 🔴 阻塞 |
| **D8** | 演示掐表 2:00 ±10s；兜底切换 ≤3s | 掐表 + 掐表表 | `docs/演示脚本.md` 第三节 | 真人念表 | 🟡 脚本已写，未掐表 |
| D8b | 兜底切换 ≤3s | 断识别 → 出预录，掐表 | `evidence/d08-fallback.png` | 真人 | 🟡 接线已完，未掐表 |
| D10 | 4 人各自设备能打开 | 各交一张 | `evidence/d10-<名字>.png` ×4 | 真人（乙） | 🔴 阻塞 |

---

## 三级兜底（现场翻车时的三条命）

| 级 | 兜底 | 谁做的 | 状态 |
|---|---|---|---|
| 第一级 | 3 秒内切 60s 预录视频 `public/assets/fallback.mp4` | 视频：**真人拍**；接线：**AI 已做**（本次） | 🔴 只差视频 |
| 第二级 | 换设备（`CamSettings.vue` 设备下拉） | 已有 | ✅ |
| 第三级 | 跳过本式 / 点按也算响 / 切手动模式 | 已有（`TrainView.vue` 的 `skip()` / `manualMode()`） | ✅ |
| 新增 | 预录期间「下一个式 ▶」+ 12s 保险推进，卡死也能走完 | **AI 已做**（本次） | ✅ |

---

## 复跑命令（改动后必跑）

```bash
cd E:/Xian_Hacthon/xianyang
export NODE_OPTIONS=""                    # 本机必写，否则文件删除被 safe-delete 拦
npm install --ignore-scripts              # 本机必加，否则 esbuild 回滚 node_modules

node src/engine/judge.test.mjs            # 判定器（34+ 项）
node scripts/render.test.mjs              # 真 SSR 页面渲染 + 禁词 + 兜底接线断言
node scripts/fallback.test.mjs            # 兜底切换状态机（22 项，本次新增）
node scripts/audio.test.mjs               # 音色
node scripts/verify-node-table.mjs        # 节点表自检
node scripts/verify-cleaner.mjs           # 净化器 + 抗误触发
npm run test:all                          # 上面全部
npm run build                             # 生产构建
```

---

## 范围冻结（不许做，做了要交回执说明）

1. 不许加新功能（问卷、五禽戏、实时纠正、第二套拳种、云同步、登录、3D、复杂动效）
2. 不许把资源改回 CDN
3. 不许加后端 / 数据库 / 登录 —— 这是设计决定
4. 不许用 `ok()` 新增判定式；不许把式 8 改成单帧判定
5. 不许直接提交到 `develop` —— 先切 `s4-<日期>` 分支
