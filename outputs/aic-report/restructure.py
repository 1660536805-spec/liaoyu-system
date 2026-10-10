# 按官方模板骨架重排 report.html：一、项目概述 → 二、（正文）→ 三、附录
# 同时把封面字样对齐模板，并把「二」的各级小节降一级（h3→h4，原 h4 改为加粗小标题）
import re, io

P = 'outputs/aic-report/report.html'
html = open(P, encoding='utf-8').read()

# ---------- 1. 封面：拆分为「算法创新赛」+「（赛题名称）」 ----------
cover = [
    ('<div class="race">算法创新赛 · AI+软件赛道</div>',
     '<div class="race">算法创新赛</div>'),
    ('<div class="kind">（赛题名称：AI+软件赛道）</div>',
     '<div class="kind">（AI+软件赛道）</div>'),
    ('<div class="date">2026年10月</div>',
     '<div class="date">2026年10月10日</div>'),
]

# ---------- 2. 正文标题重排 ----------
heads = [
    # 二、正文：插入 (一) 系统总体方案与架构，原 (一)(二)(三) 降为 1./2./3.
    ('<h2>二、系统总体方案与架构</h2>',
     '<h2>二、技术方案与核心算法</h2>\n<h3>（一）系统总体方案与架构</h3>'),
    ('<h3>（一）端到端数据流</h3>', '<h4>1. 端到端数据流</h4>'),
    ('<h3>（二）技术选型</h3>', '<h4>2. 技术选型</h4>'),
    ('<h3>（三）四层解耦架构与 onHit 可插拔契约</h3>', '<h4>3. 四层解耦架构与 onHit 可插拔契约</h4>'),
    # (二) 核心算法设计
    ('<h2>三、核心算法设计</h2>', '<h3>（二）核心算法设计</h3>'),
    ('<h3>（一）人体姿态估计与关键点净化算法</h3>', '<h4>1. 人体姿态估计与关键点净化算法</h4>'),
    ('<h4>1. 姿态估计的工程配置</h4>', '<p class="sub">① 姿态估计的工程配置</p>'),
    ('<h4>2. 关键点净化算法（三道处理）</h4>', '<p class="sub">② 关键点净化算法（三道处理）</p>'),
    ('<h4>3. 头部朝向的解算</h4>', '<p class="sub">③ 头部朝向的解算</p>'),
    ('<h3>（二）尺度归一化与几何特征构造</h3>', '<h4>2. 尺度归一化与几何特征构造</h4>'),
    ('<h3>（三）八式动作判定算法</h3>', '<h4>3. 八式动作判定算法</h4>'),
    ('<h4>1. 第 1 式「双手托天理三焦」——静态姿态型</h4>',
     '<p class="sub">① 第 1 式「双手托天理三焦」——静态姿态型</p>'),
    ('<h4>2. 第 5 式「摇头摆尾去心火」与第 6 式「两手攀足固肾腰」——时序型 + 互斥设计</h4>',
     '<p class="sub">② 第 5 式「摇头摆尾去心火」与第 6 式「两手攀足固肾腰」——时序型 + 互斥设计</p>'),
    ('<h4>3. 第 7 式「攒拳怒目增气力」——镜像自适应</h4>',
     '<p class="sub">③ 第 7 式「攒拳怒目增气力」——镜像自适应</p>'),
    ('<h3>（四）时序特征与互斥仲裁机制</h3>', '<h4>4. 时序特征与互斥仲裁机制</h4>'),
    ('<h4>1. 滑动窗口时序特征</h4>', '<p class="sub">① 滑动窗口时序特征</p>'),
    ('<h4>2. 保持帧 + 每式锁存 + 互斥仲裁</h4>', '<p class="sub">② 保持帧 + 每式锁存 + 互斥仲裁</p>'),
    ('<h3>（五）稳健性设计：抗误触发与降级</h3>', '<h4>5. 稳健性设计：抗误触发与降级</h4>'),
    ('<h3>（六）陪练教练状态机</h3>', '<h4>6. 陪练教练状态机</h4>'),
    ('<h3>（七）多模态音频调度算法</h3>', '<h4>7. 多模态音频调度算法</h4>'),
    ('<h4>1. 五音定弦：可播放的频率表</h4>', '<p class="sub">① 五音定弦：可播放的频率表</p>'),
    ('<h4>2. 点 / 线 / 面三阶段音乐调度</h4>', '<p class="sub">② 点 / 线 / 面三阶段音乐调度</p>'),
    ('<h4>3. 12 分钟弧线调度算法</h4>', '<p class="sub">③ 12 分钟弧线调度算法</p>'),
    # (三)(四)(五)
    ('<h2>四、关键技术创新点</h2>', '<h3>（三）关键技术创新点</h3>'),
    ('<h2>五、实验与验证</h2>', '<h3>（四）实验与验证</h3>'),
    ('<h3>（一）判定器单元测试</h3>', '<h4>1. 判定器单元测试</h4>'),
    ('<h3>（二）真机数据驱动的阈值标定</h3>', '<h4>2. 真机数据驱动的阈值标定</h4>'),
    ('<h3>（三）端到端与验收门槛</h3>', '<h4>3. 端到端与验收门槛</h4>'),
    ('<h3>（四）算法复杂度分析</h3>', '<h4>4. 算法复杂度分析</h4>'),
    ('<h2>六、商业计划与应用前景</h2>', '<h3>（五）商业计划与应用前景</h3>'),
    ('<h3>（一）目标用户与使用场景</h3>', '<h4>1. 目标用户与使用场景</h4>'),
    ('<h3>（二）产品定位与差异化</h3>', '<h4>2. 产品定位与差异化</h4>'),
    ('<h3>（三）落地路径与商业模式</h3>', '<h4>3. 落地路径与商业模式</h4>'),
    ('<h3>（四）可插拔生态与硬件扩展</h3>', '<h4>4. 可插拔生态与硬件扩展</h4>'),
    ('<h3>（五）风险边界与合规</h3>', '<h4>5. 风险边界与合规</h4>'),
    # 三、附录
    ('<h2>七、附录</h2>', '<h2>三、附录</h2>'),
]

for old, new in heads + cover:
    if old not in html:
        raise SystemExit('未找到待替换标题：' + old)
    html = html.replace(old, new, 1)

# ---------- 3. CSS：目录紧凑 + 加粗小标题样式 ----------
html = html.replace(
    '.toc-line { display: flex; align-items: baseline; font-size: 11.5pt; line-height: 1.35; margin: 0 0 2pt 0; }',
    '.toc-line { display: flex; align-items: baseline; font-size: 11pt; line-height: 1.28; margin: 0 0 1.5pt 0; }')
html = html.replace(
    '  .toc-l3 { padding-left: 4em; }',
    '  .toc-l3 { padding-left: 4em; }\n  .sub { font-weight: 700; margin: 7pt 0 2pt 0; }')

# ---------- 4. 目录整体替换 ----------
TOC = '''<div class="toc">
  <h1 class="toc-title">目&nbsp;&nbsp;录</h1>
  <div class="toc-line toc-l1"><span class="t">作品简介</span><span class="dots"></span><span class="pg" data-toc="作品简介">1</span></div>
  <div class="toc-line toc-l1"><span class="t">一、项目概述</span><span class="dots"></span><span class="pg" data-toc="一、项目概述">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（一）项目背景与意义</span><span class="dots"></span><span class="pg" data-toc="（一）项目背景与意义">1</span></div>
  <div class="toc-line toc-l3"><span class="t">1. 痛点：跟练产品的「反馈断点」</span><span class="dots"></span><span class="pg" data-toc="1. 痛点：跟练产品的「反馈断点」">1</span></div>
  <div class="toc-line toc-l3"><span class="t">2. 机会：让姿态识别的结果「听得见」</span><span class="dots"></span><span class="pg" data-toc="2. 机会：让姿态识别的结果「听得见」">1</span></div>
  <div class="toc-line toc-l3"><span class="t">3. 技术意义</span><span class="dots"></span><span class="pg" data-toc="3. 技术意义">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（二）赛题方向定位</span><span class="dots"></span><span class="pg" data-toc="（二）赛题方向定位">1</span></div>
  <div class="toc-line toc-l1"><span class="t">二、技术方案与核心算法</span><span class="dots"></span><span class="pg" data-toc="二、技术方案与核心算法">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（一）系统总体方案与架构</span><span class="dots"></span><span class="pg" data-toc="（一）系统总体方案与架构">1</span></div>
  <div class="toc-line toc-l3"><span class="t">1. 端到端数据流</span><span class="dots"></span><span class="pg" data-toc="1. 端到端数据流">1</span></div>
  <div class="toc-line toc-l3"><span class="t">2. 技术选型</span><span class="dots"></span><span class="pg" data-toc="2. 技术选型">1</span></div>
  <div class="toc-line toc-l3"><span class="t">3. 四层解耦架构与 onHit 可插拔契约</span><span class="dots"></span><span class="pg" data-toc="3. 四层解耦架构与 onHit 可插拔契约">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（二）核心算法设计</span><span class="dots"></span><span class="pg" data-toc="（二）核心算法设计">1</span></div>
  <div class="toc-line toc-l3"><span class="t">1. 人体姿态估计与关键点净化算法</span><span class="dots"></span><span class="pg" data-toc="1. 人体姿态估计与关键点净化算法">1</span></div>
  <div class="toc-line toc-l3"><span class="t">2. 尺度归一化与几何特征构造</span><span class="dots"></span><span class="pg" data-toc="2. 尺度归一化与几何特征构造">1</span></div>
  <div class="toc-line toc-l3"><span class="t">3. 八式动作判定算法</span><span class="dots"></span><span class="pg" data-toc="3. 八式动作判定算法">1</span></div>
  <div class="toc-line toc-l3"><span class="t">4. 时序特征与互斥仲裁机制</span><span class="dots"></span><span class="pg" data-toc="4. 时序特征与互斥仲裁机制">1</span></div>
  <div class="toc-line toc-l3"><span class="t">5. 稳健性设计：抗误触发与降级</span><span class="dots"></span><span class="pg" data-toc="5. 稳健性设计：抗误触发与降级">1</span></div>
  <div class="toc-line toc-l3"><span class="t">6. 陪练教练状态机</span><span class="dots"></span><span class="pg" data-toc="6. 陪练教练状态机">1</span></div>
  <div class="toc-line toc-l3"><span class="t">7. 多模态音频调度算法</span><span class="dots"></span><span class="pg" data-toc="7. 多模态音频调度算法">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（三）关键技术创新点</span><span class="dots"></span><span class="pg" data-toc="（三）关键技术创新点">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（四）实验与验证</span><span class="dots"></span><span class="pg" data-toc="（四）实验与验证">1</span></div>
  <div class="toc-line toc-l3"><span class="t">1. 判定器单元测试</span><span class="dots"></span><span class="pg" data-toc="1. 判定器单元测试">1</span></div>
  <div class="toc-line toc-l3"><span class="t">2. 真机数据驱动的阈值标定</span><span class="dots"></span><span class="pg" data-toc="2. 真机数据驱动的阈值标定">1</span></div>
  <div class="toc-line toc-l3"><span class="t">3. 端到端与验收门槛</span><span class="dots"></span><span class="pg" data-toc="3. 端到端与验收门槛">1</span></div>
  <div class="toc-line toc-l3"><span class="t">4. 算法复杂度分析</span><span class="dots"></span><span class="pg" data-toc="4. 算法复杂度分析">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（五）商业计划与应用前景</span><span class="dots"></span><span class="pg" data-toc="（五）商业计划与应用前景">1</span></div>
  <div class="toc-line toc-l3"><span class="t">1. 目标用户与使用场景</span><span class="dots"></span><span class="pg" data-toc="1. 目标用户与使用场景">1</span></div>
  <div class="toc-line toc-l3"><span class="t">2. 产品定位与差异化</span><span class="dots"></span><span class="pg" data-toc="2. 产品定位与差异化">1</span></div>
  <div class="toc-line toc-l3"><span class="t">3. 落地路径与商业模式</span><span class="dots"></span><span class="pg" data-toc="3. 落地路径与商业模式">1</span></div>
  <div class="toc-line toc-l3"><span class="t">4. 可插拔生态与硬件扩展</span><span class="dots"></span><span class="pg" data-toc="4. 可插拔生态与硬件扩展">1</span></div>
  <div class="toc-line toc-l3"><span class="t">5. 风险边界与合规</span><span class="dots"></span><span class="pg" data-toc="5. 风险边界与合规">1</span></div>
  <div class="toc-line toc-l1"><span class="t">三、附录</span><span class="dots"></span><span class="pg" data-toc="三、附录">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（一）八式判定特征与权重表</span><span class="dots"></span><span class="pg" data-toc="（一）八式判定特征与权重表">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（二）关键参数一览</span><span class="dots"></span><span class="pg" data-toc="（二）关键参数一览">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（三）术语表</span><span class="dots"></span><span class="pg" data-toc="（三）术语表">1</span></div>
  <div class="toc-line toc-l2"><span class="t">（四）第三方素材与授权</span><span class="dots"></span><span class="pg" data-toc="（四）第三方素材与授权">1</span></div>
</div>'''

html, n = re.subn(r'<div class="toc">.*?</div>\s*(?=<!-- ==================== 作品简介)',
                 TOC + '\n\n', html, count=1, flags=re.S)
if n != 1:
    raise SystemExit('目录替换失败')

open(P, 'w', encoding='utf-8').write(html)
print('重排完成：标题 %d 处、目录 %d 份' % (len(heads) + len(cover), n))
