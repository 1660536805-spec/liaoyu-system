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
