# STORY · 弦养 产品介绍

## ① 用户意图对齐

- **目标受众**：命题三赛道评审现场——评委、赛道评审专家与潜在合作方；用于路演汇报 / 现场演示讲解。
- **核心目标**：讲完后让评委相信三件事——① 弦养是一个有真实身体交互体验的疗愈系统原型；② 它的文化内核（五音—五脏—八段锦）有典籍依据与**数字化落点**，不是贴标签；③ 它有一条清晰、诚实、**可插拔**的工程路径，能说清"已完成什么、下一步封装什么"。
- **命题扣题（v1.2 新增）**：命题要求「任选其一或组合」的可演示模块 / 接口 / 系统原型，并**说明文化内核如何数字化、如何「可插拔」接入硬件与场景**。为此在 v1.2 增补两页：**P4 文化内核数字化**、**P10 命题三契合与交付口径**；并在封面、结尾、P11 优势页补入扣题文字。
- **PPT 长度**：12 页。
- **视觉调性**：东方疗愈 / 宣纸本草 / 静谧克制 / 高级留白 / 赭石暖调。
- **内容边界**：必讲——五音与五脏的文化串联逻辑、静听与跟练两类核心体验、点线面三阶段进阶、可复现的声音设计、模块化架构与接口契约、可插拔场景、**文化数字化方式**、**命题三契合与交付口径**、诚实边界。不讲——未验证的医学疗效、不宣称"自研基础模型 / AI 音疗处方系统已完成"。禁碰——任何治疗承诺。

## ② 页面布局骨架

- **页面总数与分章**：共 12 页，不设目录与章节扉页（连续叙事的产品介绍，按"起—承—转—合"分四段：**起点** P1–P2；**内核与体验** P3–P6；**技术纵深** P7–P9；**扣题与收束** P10–P12）。因无 catalog，全篇 `type: section` 扉页数 = 0。
- **Hero 页定位**：Hero = **P1 封面 / P6 点线面 / P12 结尾**（3/12 = 25%），互不相邻；P2、P9 设为 peak 节奏的支撑页。
- **rhythm 曲线**：P1 peak → P2 peak → P3 valley → P4 valley → P5 valley → P6 peak → P7 valley → P8 valley → P9 peak → P10 valley → P11 valley → P12 peak。最长 valley 连续段 = 3（P3–P5、P7–P8、P10–P11）。
- **非对称版式预算**：10/12 ≈ 83% 使用非对称版式（≥40% 达标）；对称版式仅 P3（图表）与 P12（居中金句）共 2 页，且不相邻。
- **`N卡片横排` 使用**：0 次。
- **`左大图+右侧文字` + `非对称双栏` 合计**：P5、P8、P9 等 ≤ 40%。

## ③ 页面大纲

### P1 · 封面
- title：以身为琴，以动为弦 ｜ type：cover ｜ role：hero ｜ rhythm：peak
- layout：全幅图+骑线文字；visual：L1 cover_guqin.png（全幅）
- description：落款三行——① 命题三：OPC 时代身心疗愈五大核心赛道；② 从宫商角徵羽出发·以五脏串联古琴声音与八段锦练习；③ **可演示的系统原型·文化内核数字化·可插拔接入硬件与场景**（扣题行，暖金）。动效：四拍递进 fadeIn。

### P2 · 产品概述：从五音进入身心疗愈
- title：起点：从五音进入身心疗愈 ｜ type：content ｜ role：supporting ｜ rhythm：peak
- layout：巨型数字+洞察（五音阵列做锚点）；visual：宫商角徵羽五字巨型阵列 ｜ L3 朱砂方印
- description：弦养不是"健身 App + 国风配乐"，而是组织一段「听·动·回应·回顾」的疗愈体验；疗愈指体验目标，不代表已证明的医学疗效。动效：五音 flyIn(自右) → 判断 fadeIn。

### P3 · 文化内核：五脏串联五音与八段锦
- title：五脏：串联五音与身体练习的内部线索 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：图表+洞察（五脏—五音—五行—意象—动作 对照表）；visual：Table ｜ visual_role：evidence
- description：心徵火 / 肝角木 / 脾宫土 / 肺商金 / 肾羽水，对应八段锦五式；典籍依据《黄帝内经·素问·阴阳应象大论》。文化关联 ≠ 播放指令，标签 ≠ 脏器诊断。

### P4 · 文化内核数字化（v1.2 新增）
- title：让文化进入可配置内容与可执行声音 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：左图（表）+ 右代码卡；visual：自绘 3 列表格（5 行）+ 文化配置模型 JSON ｜ L3 朱砂方印
- description：**回答命题"文化内核如何数字化"**。数字化不只是把概念写进界面，而是让它进入可配置内容与可执行声音——五音 / 五脏关联 / 八段锦 / 古琴声音 / 阶段体验各有对应字段、参数与来源；以 `profileId / organIntent / tone / audioProfileId / disclaimer` 等字段的文化配置模型避免硬编码进识别器。

### P5 · 核心功能一：静听与跟练
- title：静听与跟练：让身体参与声音 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：非对称双栏（60:40）；visual：L1 listen_tone.png（左 60%）｜ L2 practice_body.png（右卡片）
- description：静听不必启动摄像头；跟练在摄像头前完成八段锦，关键点触发弦位亮起与琴音——一次命中=达到本原型判定条件，不是动作标准认证。

### P6 · 进阶：点 · 线 · 面（hero）
- title：从单声回应，到一段沉浸 ｜ type：content ｜ role：hero ｜ rhythm：peak
- layout：上大图+下方卡片；visual：SVG 三幕递进环
- description：学架子·点 → 找气感·线 → 入静·面；音乐跟随动作周期是后续增强方向，不是已验证的呼吸检测。动效：三幕环 zoom → 阶段卡 fadeIn。

### P7 · 声音设计：三种听感，皆有来源
- title：三种听感，皆有来源 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：左标题+右内容；visual：频率算式（等宽深色卡）
- description：绵长 / 饱满 / 颤音三种听感各有可复现的算法来源；「宫」在这里最终落回一个可精确测量的频率。动效：fadeIn 两拍。

### P8 · 架构：一条可替换的链路
- title：一条可替换的链路 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：非对称双栏（65:35）；visual：五步链路图 + 接口契约（onHit/onPulse/onFinish）
- description：摄像头 → 关键点 → 动作判定 → 弦音反馈 → 本地记录；接口是设计契约，不是可直接安装的已发布 SDK。

### P9 · 场景：从居家练习到康养空间
- title：从居家练习，到康养空间 ｜ type：content ｜ role：supporting ｜ rhythm：peak
- layout：左大图+右侧文字；visual：L1 scene_room.png（左 55%）｜ 接入对象标签组
- description：**回答命题"如何可插拔"**。居家跟练是当前场景，团体课程 / 互动展陈 / 康养空间是扩展场景；通过适配层替换摄像头、扬声器、大屏、深度摄像头、灯光振动与智能音箱——写出接口 ≠ 已验证可插拔。

### P10 · 命题三契合与交付口径（v1.2 新增）
- title：可演示的系统原型，与诚实的交付口径 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：chips 条 + 对照表 + 诚实边界条；visual：命题方向 chips（选中 2 枚）+ 4 行对照表 ｜ L3 朱砂方印
- description：**扣题核心页**。列出命题列举的十个方向，highlight 弦养所选「五音疗愈音频 API/SDK + AI 动作识别 API」组合；对照表逐条给出"命题方向 / 弦养对应内容 / 提交口径（如实标注）"；底栏声明诚实边界（不宣称自研基础模型 / 已完成音疗处方系统）。

### P11 · 核心优势
- title：四点优势，支撑命题三的完成度 ｜ type：content ｜ role：supporting ｜ rhythm：valley
- layout：左标题+右内容；visual：FAIcon 四要点
- description：左栏「交付形态」——交付三件套（H5 系统原型 / 独立音层原型 / 模块接入方案）+ 未交付独立 API/SDK 的边界；右栏四优势（文化有纵深 / 交互是真实身体参与 / 声音可复现 / 工程可插拔）+ 诚实边界条。

### P12 · 结尾（hero）
- title：以身为琴，以动为弦 ｜ type：ending ｜ role：hero ｜ rhythm：peak
- layout：居中金句；visual：金色声波弧线 SVG ｜ L3 朱砂方印
- description：五音是起点与脉络，五脏是串联逻辑，古琴是声音载体，八段锦是身体实践，动作识别让身体得到可听见的回应——**以系统原型证明核心体验，以模块边界说明 API/SDK 封装方向**（扣题收束行）。动效：金句 fadeIn → 落款 fadeIn → 印章 pulse。

## Checklist 自检
- 页数 12，页脚 `NN / 12` 全页一致 ✅
- Hero 页 3 个（25%），互不相邻 ✅
- `N卡片横排` 出现 0 次 ✅
- 非对称版式占比 ≈83% ≥ 40% ✅
- 相邻两页版式均不同 ✅
- 每页含 role / rhythm / visual_role ✅
- 命题三三项要求均有专页/专栏落点：可演示原型（P8/P10）、文化数字化（P4）、可插拔（P9）✅
- 无 catalog，section 扉页数 0 ✅
