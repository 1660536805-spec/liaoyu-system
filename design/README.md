# 设计交付区 · 仓库占位说明（ teammates 请勿改动本目录以外的文件）

> 本目录（`/design/`）归**设计 / 视觉 / 内容岗**队友所有，工程侧只写代码、不占这里。
> 代码里的界面样式在 `src/styles/tokens.css`（设计 Token）与 `src/views/*`、`src/components/*`。
> 这里只放「设计源文件 / 设计稿 / 冻结稿 / 动效说明」，放完即冻结，工程侧按稿实现。
>
> 双远端同一份代码：GitHub `ccccongggg/xianyang-s4`（主）+ Gitee `congopen/xianyang-s4`（镜像），
> 主干都是 `main`。提交一遍两边同步，不用分别推。

## 目录分工（提交时按此路径放，别自创）

| 路径 | 放什么 | 格式 | 归属 |
|---|---|---|---|
| `design/ui/` | 界面设计稿、切图、标注稿、标注链接 | `.png` / `.jpg` / `.webp` / `.fig` 导出 / 链接 md | 设计岗 |
| `design/tokens/` | 配色 / 字号 / 圆角 / 间距 Token 源文件 | `.json` / `.css` / `.sketch` 导出 | 设计岗 |
| `design/spec/` | 界面冻结稿、交互说明、文案表 | `.md` | 内容 + 设计 |
| `design/motion/` | 转场、呼吸引导、动效说明与参考视频 | `.md` / `.mp4` | 设计岗 |

## 文件命名规范（务必遵守）

```text
<Tab>_<页面>_<版本>.<ext>
```

- `Tab` ∈ `01_splash` / `02_welcome` / `03_quest` / `04_home` / `05_prepare` / `06_train` / `07_summary` / `08_me` / `09_heal` / `10_data`
- 版本写成 `v1`、`v2`；同一页面递进就 +1，不要覆盖旧稿。
- 例：`04_home_v2.png`、`07_summary_v1.fig`、`09_heal_v2.png`
- **禁止**中文文件名、空格、`(` `)`、`%`；macOS 解压产生的 `__MACOSX` / 乱码文件名一律不要提交。
- 一页多张切片用 `-1`、`-2`：`05_prepare_v3-1.png`、`05_prepare_v3-2.png`

## 设计 Token 单一真源

工程侧已落一份可被代码直接引用的 Token（`src/styles/tokens.css`），**改动前先读它**：

| Token | 值 | 用途 |
|---|---|---|
| `--ink` | `#F8F5ED` | 云中白（主背景） |
| `--xuan` | `#3A332A` | 墨褐（主文字） |
| `--zhu` | `#C85D4D` | 朱砂（强调 / 命中） |
| `--bi` | `#2E6651` | 碧玉绿（完成态） |
| `--xian` | `#D6C59E` | 弦金（描边 / 装饰） |

设计稿配色以此为准；如果设计稿 Token 与代码不一致，**先在对端沟通再改**，不要两边各自改一半。
需要新增 Token 时：改 `design/tokens/` 源文件 + `src/styles/tokens.css`，同一个 commit 一起提。

## 提交流程（队友的 AI 照此执行）

```bash
# 1. 拉最新
git pull --rebase origin main

# 2. 只往 design/ 下加文件，别碰 src/ 和 package.json
cp <你本地设计稿目录>/* design/ui/

# 3. 提交
git add design/
git commit -m "design(ui): 首页+跟练页定稿 v2"
git push origin main

# 4. 提 issue 或在 design/spec/ 追加一版说明，告诉工程侧"稿子已更新到哪版"
```

约束：

- 一个 commit 只放一个页面的设计稿；commit message 用 `design(<目录>): <说明>` 前缀。
- 不要 `git add .`，不要顺手改代码；代码接口冲突由工程侧处理。
- 大文件（>5MB）单独一个 commit，方便别人只拉设计稿。

## 冻结状态

当前 `design/spec/` 内的冻结稿版本：`v2.3`（见 `design/spec/弦养-APP界面冻结-v2.md`）。
工程侧实现基线以冻结稿为准；冻结稿之外的新增页面属于 P1，可先出稿不入仓库。
