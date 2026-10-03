"""
浅色化收尾：把「浅色页面语境」里残留的旧深色主题 rgba 换成深褐 rgba。
背景：tokens.css 已从深色墨底换成浅色水彩体系，但有一批页面/组件的 scoped CSS
      还写着旧深色主题的半透明白（rgba(232,224,208,*)）——在浅底上等于隐形。

关键约束（不能一刀切）：
  跟练页的 HUD 是叠在摄像头画面上的，浅色字才看得见，
  所以 TrainView / DemoAnimation / CamSettings / VoiceSettings 一律不动。
  只改真正坐在浅色页面底上的那些 view。

映射：
  rgba(232,224,208,a) -> rgba(58,51,42,a)     旧浅色边线/底色 → 深褐边线/底色
  rgba(214,197,158,a) -> rgba(154,123,51,a)     旧 --jin（弦的金）→ 新 --jin 文字可用色
用法：python scripts/fix-light-rgba.py [--check]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src'

# 坐在浅色页面底上的 view —— 只有这些能动
LIGHT_VIEWS = [
    'views/MeView.vue',
    'views/SummaryView.vue',
    'views/RecordView.vue',
    'views/GuideView.vue',
    'views/PrepareView.vue',
    'views/OnboardingView.vue',
    'views/OrderView.vue',
    'views/ListenView.vue',
    'views/WorkshopView.vue',
    'views/ArcView.vue',
    'views/BodyDataView.vue',
    'views/WelcomeView.vue',
    'views/SplashView.vue',
    'components/AppTab.vue',
]

# 叠在摄像头画面上的深色 HUD —— 浅色字才看得见，绝不能动
DARK_HUD = [
    'views/TrainView.vue',
    'components/DemoAnimation.vue',
    'components/CamSettings.vue',
    'components/VoiceSettings.vue',
]

SUBS = [
    # 旧深色主题的半透明白（边线 / 面板底 / 进度槽）→ 深褐
    (re.compile(r'rgba\(\s*232\s*,\s*224\s*,\s*208\s*,'), 'rgba(58, 51, 42,'),
    # 旧 --jin 描边/高亮 → 新 --jin 文字可用色
    (re.compile(r'rgba\(\s*214\s*,\s*197\s*,\s*158\s*,'), 'rgba(154, 123, 51,'),
    # 旧 --zhu-glow（深底上的朱砂辉光）→ 浅底上的朱砂
    (re.compile(r'rgba\(\s*200\s*,\s*85\s*,\s*61\s*,'), 'rgba(200, 93, 77,'),
]

# 硬编码的旧深底色（面板底 / 提示条）
LITERALS = [
    ('#211c16', '#F1ECE1'),
    ('#2e2720', '#EAE3D3'),
    ('#3a3229', '#E3DAC6'),
    ('#191510', '#F1ECE1'),
    ('#2a231b', '#EAE3D3'),
]

check_only = '--check' in sys.argv
total = 0

for rel in LIGHT_VIEWS:
    p = ROOT / rel
    if not p.exists():
        print(f'  ! 缺失 {rel}')
        continue
    src = p.read_text(encoding='utf-8')
    out = src
    n = 0
    for pat, rep in SUBS:
        out, k = pat.subn(rep, out)
        n += k
    for a, b in LITERALS:
        n += out.count(a)
        out = out.replace(a, b)
    if out != src:
        total += n
        print(f'  ✓ {rel}  替换 {n} 处')
        if not check_only:
            p.write_text(out, encoding='utf-8')
    else:
        print(f'  · {rel}  无残留')

print(f'\n合计替换 {total} 处（check_only={check_only}）')

# 复核：深色 HUD 必须一个都没被碰
print('\n复核深色 HUD 未被改动：')
for rel in DARK_HUD:
    p = ROOT / rel
    txt = p.read_text(encoding='utf-8')
    light_leak = len(re.findall(r'rgba\(58,\s*51,\s*42,', txt))
    dark_keep = len(re.findall(r'rgba\(232,\s*224,\s*208,', txt))
    print(f'  · {rel}: 深褐 {light_leak} 处 / 旧浅色 {dark_keep} 处'
          + ('  ← 需复查' if light_leak else '  ✓'))
