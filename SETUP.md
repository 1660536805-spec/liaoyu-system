# 弦养 · 环境搭建（每位队员在自己电脑上执行一次）

已确认本机具备：Node 22 / npm 10 / git 2.55 / ffmpeg 9。

```bash
cd xianyang
npm install                 # 装 vue / vue-router / vite / mediapipe tasks-vision
# 把 MediaPipe wasm 复制到本地（离线可用，不依赖 CDN）
mkdir -p public/wasm public/models
cp node_modules/@mediapipe/tasks-vision/wasm/* public/wasm/
# 下载姿态模型（lite 版，约 5MB）
curl -L -o public/models/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
npm run dev                 # 浏览器开 http://localhost:5173
```

注意：摄像头只在 `localhost` 或 https 下可用；手机真机留到 S4。
Git：`git init && git checkout -b develop`，日常合 develop，main 受保护。

---

## 已验证（2026-10-02 · 聪哥本机实测通过）

本节是**实际执行结果**，不是预期步骤。其他队员机器若报错，先比对这里的环境差异。

### 实测环境版本

| 项目 | 实测值 |
| --- | --- |
| Node | v22.22.2（WorkBuddy 托管版） |
| npm | 10.9.7 |
| git | 2.55.0.windows.3 |
| ffmpeg | 9.0.1 |
| 操作系统 | Windows 11 + Git Bash |

### 各步实测结果

| 步骤 | 结果 | 验证证据 |
| --- | --- | --- |
| 1. 装依赖 | ✅ 成功（需加 `--ignore-scripts`，见下方坑位） | `npm ls --depth=0` 无 ERR；38 包 0 漏洞 |
| 2. 复制 wasm | ✅ 成功 | `public/wasm/` 6 个文件，含 `vision_wasm_internal.js/.wasm` |
| 3. 下载模型 | ✅ 成功 | 5,777,746 字节，ZIP 魔数 `PK\x03\x04`，内含 2 个 tflite |
| 4. dev 起服务 | ✅ 成功 | `curl localhost:5173` 返回含 `<div id="app"></div>` |
| 4. 生产构建 | ✅ 成功 | 25 模块，`index-BdBKEkkw.js` 90.06 kB（gzip 35.21 kB） |
| 5. git 初始化 | ✅ 成功 | 提交 `02cc135`，main + develop 双分支，工作区干净 |

### 模型 URL（已确认有效，可直接用）

```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
```

- HTTP 200，`Content-Length: 5777746`（约 5.5 MB，非文档估的 5MB）
- `Content-Type: application/octet-stream`
- 文件是 **ZIP 包**（`.task` 本质是 zip），内含：
  - `pose_detector.tflite` 2,959,078 字节
  - `pose_landmarks_detector.tflite` 2,818,390 字节
- sha256：`59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- 校验命令：`zipfile.ZipFile(...).testzip()` 返回 `None` 即未损坏

### 坑位：本机必须用 `npm install --ignore-scripts`

**现象**：直接 `npm install` 会在 esbuild 的 postinstall 阶段失败，并把已装好的 `node_modules` 整个回滚清空：

```
npm error code: 'EBUSY'
npm error errno: -4082
npm error syscall: 'spawnSync ...node.exe'
npm error at node_modules/esbuild/install.js:285
```

**根因**：本机（WorkBuddy 托管环境）**禁止 Node spawn 任何子进程**——不只 esbuild，连 `git` 也一样：

```js
spawnSync('git', ['--version'])        // => EBUSY (errno -4082)
spawnSync(process.execPath, ['-e',''])  // => EBUSY
```

`esbuild/install.js` 的 `validateBinaryVersion()` 正好要 spawn 一次 `node esbuild --version` 来校验二进制，于是必然踩雷。
（已确认：managed node 与系统 node v22.23.2 表现一致；关沙箱也一样，所以**不是沙箱拦截、不是网络问题**，改 registry 无用。）

**解决**：加 `--ignore-scripts` 跳过该自检：

```bash
cd xianyang
npm install --ignore-scripts
```

**为什么安全**：esbuild 的 postinstall 只是自检，真正的二进制由平台包 `@esbuild/win32-x64` 提供，已随依赖正常装好。实测：

```bash
./node_modules/@esbuild/win32-x64/esbuild.exe --version   # => 0.25.12
npm run build                                             # => ✓ 25 modules transformed
```

dev 与 build 全程正常，功能无损。

### 其它实测细节

- **npm registry**：默认源 `registry.npmjs.org` 可用（vue 探测 HTTP 200，3.2s）。`registry.npmmirror.com` 也通且更快（0.8s）。本次未改配置，用默认源装成功。
- **`NODE_OPTIONS`**：本机会预设 `--require=.../node-language-shim.cjs`。跑 npm / vite 前建议 `export NODE_OPTIONS=""` 清掉，避免 shim 干扰。
- **curl 走代理**：本机 `http_proxy` 指向 `127.0.0.1:53172`，用它 curl 本地 5173 会报
  `upstream connect failed (os error 10061)`。**验证 localhost 必须加 `--noproxy '*'`**，否则误判成服务没起来。
- **离线资源已确认可访问**（dev server 实测）：
  - `GET /wasm/vision_wasm_internal.wasm` → 200，11,153,617 字节
  - `GET /models/pose_landmarker_lite.task` → 200，5,777,746 字节
  - `npm run build` 后两者同样进 `dist/`（`dist/` 共 38 MB），部署时无需再单独拷模型。
- **git 换行符**：Windows 上提交时有 `LF will be replaced by CRLF` 警告，属正常现象，不影响运行。
- **未提交项**：`.gitignore` 只忽略 `node_modules`、`dist`；`public/` 下的 wasm 与 5.5MB 模型**已按预期入库**，换机器 clone 下来即可离线跑。

### 结论

`npm run dev` 可起、`npm run build` 可过、MediaPipe 姿态模型已离线落盘。环境这一步可以收工，后续任务（`engine/preview.html`、Web Audio、onHit）可正常开工。
